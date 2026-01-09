// ... (keep your firebase imports and initialization)

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { idToken, email, amount, adminSecret } = req.body;
    const BLOCKED_ADMIN_UID = "4xEDAzSt5javvSnW5mws2Ma8i8n1"; 

    try {
        const decodedToken = await auth.verifyIdToken(idToken);
        const uid = decodedToken.uid;
        const isAuthorizedAdmin = (uid === BLOCKED_ADMIN_UID && adminSecret === process.env.ADMIN_VERIFY_TOKEN);

        // --- STEP 1: FAST RULE CHECK (Instant) ---
        // If it's a huge amount, we don't even ask the AI, we just block or flag.
        if (amount > 50000 && !isAuthorizedAdmin) {
            return res.status(403).json({ error: "Amount exceeds instant withdrawal limit." });
        }

        // --- STEP 2: PARALLEL AUDIT (Saves Time) ---
        // We start the AI audit and the Firebase check at the same time
        const auditPromise = fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [{ role: "system", content: "Fraud Auditor: Respond PASS or BLOCK." },
                           { role: "user", content: `UID: ${uid}, Amt: ${amount}` }],
                max_tokens: 5 // Keep it ultra-short so it's fast
            })
        }).then(r => r.json()).catch(() => ({ choices: [{ message: { content: "PASS" } }] })); // Fail-safe: PASS if AI is slow

        const userRef = db.ref(`users/${uid}`);
        const [auditData, userSnap] = await Promise.all([auditPromise, userRef.get()]);

        const decision = auditData.choices?.[0]?.message?.content || "PASS";

        if (decision.includes("BLOCK") && !isAuthorizedAdmin) {
            return res.status(403).json({ error: "Security Alert: Transaction flagged." });
        }

        // --- STEP 3: TRANSACTION (Existing logic) ---
        const result = await userRef.transaction((userData) => {
            if (!userData) return userData;
            const currentBalance = userData.tokens || 0;
            const withdrawable = userData.totalEarned || 0;

            if (currentBalance < amount) return; 
            if (!isAuthorizedAdmin && withdrawable < amount) return; 

            userData.tokens = currentBalance - amount;
            if (!isAuthorizedAdmin) userData.totalEarned = Math.max(0, withdrawable - amount);
            return userData;
        });

        if (!result.committed) return res.status(400).json({ error: "Insufficient earned tokens." });

        const netUSD = isAuthorizedAdmin ? (amount / 10) : (amount / 10) * 0.85;
        const payoutId = Date.now();

        await db.ref(`payouts/${payoutId}_${uid}`).set({
            uid, paypal: email, tokensRequested: amount, netAmount: netUSD,
            status: 'pending', timestamp: payoutId
        });

        return res.status(200).json({ success: true, netAmount: netUSD });

    } catch (error) {
        console.error("Critical Error:", error);
        // This prevents the "Unexpected token A" error by ensuring we ALWAYS send JSON
        return res.status(500).json({ error: "System busy. Please try again." });
    }
}
