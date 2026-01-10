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

  const { prompt, userId, username } = req.body;

  // SYSTEM PROMPT: This makes the AI "Smart"
  const systemInstructions = `
    You are Grok Core, the high-speed assistant for this platform.
    KNOWLEDGE BASE:
    - 1 Token = $0.10.
    - Donation Fee: 30%.
    - Withdrawal Fee: 15%.
    - Platform: Focused on crowdfunding and reaching high-value goals.
    
    RULES:
    1. Be concise, bold, and efficient.
    2. If the user is frustrated, asks for a human, asks for "live support," or asks a complex technical question you can't answer, reply ONLY with the word: HANDOFF_REQUEST.
    3. Never make up new fees.
  `;

  try {
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.5, // Keeps it focused
        messages: [
          { role: "system", content: systemInstructions },
          { role: "user", content: prompt }
        ]
      })
    });

    const data = await groqResponse.json();
    
    // Safety check for AI response
    if (!data.choices || data.choices.length === 0) {
        throw new Error("AI Empty Response");
    }

    let aiText = data.choices[0].message.content.trim();

    // 2. TRIGGER HUMAN NOTIFICATION
    // We check if the AI sent the secret word
    if (aiText.includes("HANDOFF_REQUEST") && userId) {
      await db.ref(`support_tickets/${userId}`).set({
        username: username || "User",
        timestamp: Date.now(),
        status: 'pending',
        lastMessage: prompt // Gives you a preview in your admin panel
      });
      
      // Clean up the text so the user doesn't see the "code" word
      aiText = "HANDOFF_REQUEST"; 
    }

    return res.status(200).json({ text: aiText });

  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({ text: "Grok is recalibrating. Please try again or request a human." });
  }
}
