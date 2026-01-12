import admin from 'firebase-admin';

// Initialize Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    databaseURL: "https://itzhoyoo-f9f7e-default-rtdb.firebaseio.com"
  });
}
const db = admin.database();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageUrl, userId, username } = req.body;

  try {
    // 1. THE DLS EXPERT BRAIN (Master System Prompt)
    const systemInstructions = `
      You are the DLS 26 Audit Engine for dlsmarket.store.
      Your goal: Identify players from a Dream League Soccer screenshot and estimate value.
      
      MARKET RULES (Early 2026):
      - Maxed Legendary (Black Card): $1.50 - $3.00 depending on player.
      - Legacy Messi (90+): $15.00+
      - Legacy Ronaldo: $10.00+
      - Base Legendary (Gold Card): $0.50
      
      OUTPUT FORMAT:
      Return a JSON-like summary:
      - Team Strength: [Score /100]
      - Top Players: [List names]
      - Estimated Value: $[Amount]
      - Risk Level: [Low/Med/High based on forgery signs]
    `;

    // 2. CALL GROK VISION (xAI API)
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.XAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "grok-vision-beta", // Multimodal model
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: systemInstructions },
              { type: "image_url", image_url: { url: imageUrl } }
            ]
          }
        ],
        temperature: 0.2
      })
    });

    const data = await response.json();
    const aiAnalysis = data.choices[0].message.content;

    // 3. SAVE REPORT TO FIREBASE
    const reportRef = db.ref('audit_reports').push();
    const reportId = reportRef.key;

    await reportRef.set({
      reportId,
      userId: userId || "guest",
      username: username || "Anonymous",
      imageUrl,
      analysis: aiAnalysis,
      timestamp: Date.now()
    });

    // 4. RETURN RESULT
    return res.status(200).json({ 
      success: true, 
      reportId, 
      analysis: aiAnalysis 
    });

  } catch (error) {
    console.error("Audit Error:", error);
    return res.status(500).json({ error: "Grok Vision connection failed." });
  }
}
