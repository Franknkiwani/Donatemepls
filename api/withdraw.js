// --- NEW: GROQ FRAUD AUDIT ---
try {
    // 1. Check if we have the key
    if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY_MISSING");

    // 2. Call Groq
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: "You are a fraud auditor. Respond ONLY with 'BLOCK' or 'PASS'." },
                { role: "user", content: `Audit: UID ${uid} is withdrawing ${amount} tokens. Session withdrawals: ${withdrawalCount}.` }
            ]
        })
    });

    if (!groqResponse.ok) {
        const errorText = await groqResponse.text();
        console.error("Groq API Technical Error:", errorText);
        throw new Error("GROQ_EXTERNAL_FAIL");
    }

    const auditData = await groqResponse.json();
    const decision = auditData.choices[0].message.content.trim().toUpperCase();

    // 3. If AI says BLOCK, we stop everything
    if (decision.includes("BLOCK") && !isAuthorizedAdmin) {
        await db.ref(`users/${uid}`).update({ isBanned: true, banReason: "AI Fraud Trigger" });
        return res.status(403).json({ error: "Security Alert: Unusual activity detected." });
    }

} catch (aiError) {
    // If the AI is down, we don't want to stop the user from getting their money
    // unless it's a massive amount. This is a "Fail-Safe".
    console.error("AI Audit Failed, falling back to manual rules:", aiError.message);
    
    if (amount > 10000 && !isAuthorizedAdmin) {
        return res.status(500).json({ error: "High-value audit offline. Try a smaller amount." });
    }
}
