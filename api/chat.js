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
    // 1. BUTTON-DRIVEN HANDOFF
    if (action === "INITIATE_HANDOFF" && userId) {
      await db.ref(`support_tickets/${userId}`).set({
        username: username || "User",
        timestamp: Date.now(),
        status: 'pending',
        lastMessage: "User clicked 'Human Agent' via the UI."
      });
      return res.status(200).json({ redirect: '/support' });
    }

    // 2. THE MASTER BRAIN (All your info is now here)
    const systemInstructions = `
      You are Grok Core, the AI assistant for DonateMePls (donatemepls.com). 
      Founded by Franknkiwani in Early 2026. 

      CORE KNOWLEDGE:
      - 100% Legit: Uses Firebase architecture & PayPal security.
      - TOKEN PACKS: 30 for $3, 50 for $5, 100 for $10, 250 for $25.
      - BOOST SYSTEM: 1 Token = 3 guaranteed views in Mission Scan.
      - FEES: 30% fee on donations (User receives 70%). 15% fee on withdrawals.
      - WITHDRAWALS: Min 50 tokens ($5). Paid via PayPal.
      - MISSIONS: Feature AI-writing tools and real-time progress.
      
      ESCALATION:
      - If user needs a real person: Reply "HANDOFF_REQUEST".
      - For serious account issues: Direct them to franknkiwani@gmail.com.
      
      TONE: Helpful, fast, and high-energy. Keep responses under 3 sentences.
    `;

    // 3. GROQ REQUEST
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.3, // Accurate & Factual
        messages: [
          { role: "system", content: systemInstructions },
          { role: "user", content: prompt }
        ]
      })
    });

    const data = await groqResponse.json();
    let aiText = data.choices[0].message.content.trim();

    // 4. SMART HANDOFF DETECTOR
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
    return res.status(500).json({ text: "Connection error. Contact franknkiwani@gmail.com." });
  }
}
