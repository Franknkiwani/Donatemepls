import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    databaseURL: "https://itzhoyoo-f9f7e-default-rtdb.firebaseio.com"
  });
}

const db = admin.database();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, userId, username, action } = req.body;

  try {
    // 1. HANDLE DIRECT BUTTON REDIRECTS
    if (action === "INITIATE_HANDOFF" && userId) {
      await db.ref(`support_tickets/${userId}`).set({
        username: username || "User",
        timestamp: Date.now(),
        status: 'pending',
        lastMessage: "User clicked 'Human Agent' selector."
      });
      return res.status(200).json({ redirect: '/support' });
    }

    // 2. THE EXPANDED BRAIN (System Instructions)
    const systemInstructions = `
      You are Grok Core, the official AI for this Crowdfunding Platform.
      Your goal: Resolve 99% of issues without needing a human.

      APP KNOWLEDGE:
      - TOKENS: 1 Token = $0.10. Used for donations and boosts.
      - DONATION FEE: 30% (goes toward platform maintenance and reach).
      - WITHDRAWAL FEE: 15% (processed within 24-48 hours).
      - CROWDFUNDING: Users create goals. Once hit, funds are locked for 7 days for verification before withdrawal.
      - SECURITY: Use 2FA in settings. We never ask for passwords.
      - REACH: Donating tokens increases a goal's visibility in the global feed.

      TONE: Professional, robotic but helpful, extremely concise.

      HANDOFF RULE:
      If the user says things like "I lost money", "I want to sue", "Talk to a real person", or asks a question about a specific transaction ID you cannot see, reply ONLY with: HANDOFF_REQUEST.
    `;

    // 3. GROQ AI CALL
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.4, // Lower temperature = more factual
        messages: [
          { role: "system", content: systemInstructions },
          { role: "user", content: prompt }
        ]
      })
    });

    const data = await groqResponse.json();
    let aiText = data.choices[0].message.content.trim();

    // 4. SMART HANDOFF DETECTION
    if (aiText.includes("HANDOFF_REQUEST") && userId) {
      await db.ref(`support_tickets/${userId}`).set({
        username: username || "User",
        timestamp: Date.now(),
        status: 'pending',
        lastMessage: prompt
      });
      return res.status(200).json({ text: "HANDOFF_REQUEST", redirect: '/support' });
    }

    return res.status(200).json({ text: aiText });

  } catch (error) {
    console.error("API Crash:", error);
    return res.status(500).json({ text: "Grok Core is offline. Please use the /support page." });
  }
}
