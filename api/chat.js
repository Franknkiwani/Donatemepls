import admin from 'firebase-admin';

// Initialize Admin SDK using the Secret Key from Vercel
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    databaseURL: "https://itzhoyoo-f9f7e-default-rtdb.firebaseio.com"
  });
}

const db = admin.database();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, userId, username } = req.body;

  try {
    // 1. Send user message to Groq
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "If the user asks for a human/person/support, reply: HANDOFF_REQUEST. Otherwise, answer concise." },
          { role: "user", content: prompt }
        ]
      })
    });

    const data = await groqResponse.json();
    const aiText = data.choices[0].message.content.trim();

    // 2. IF AI triggers Handoff, update Firebase using the SECRET KEY
    if (aiText === "HANDOFF_REQUEST" && userId) {
      await db.ref(`support_tickets/${userId}`).set({
        username: username || "User",
        timestamp: Date.now(),
        status: 'pending'
      });
    }

    return res.status(200).json({ text: aiText });

  } catch (error) {
    return res.status(500).json({ text: "Grok Connection Error" });
  }
}
