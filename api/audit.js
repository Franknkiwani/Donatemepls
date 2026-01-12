import admin from 'firebase-admin';
import Groq from 'groq-sdk';

// Initialize Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    databaseURL: "https://itzhoyoo-f9f7e-default-rtdb.firebaseio.com"
  });
}
const db = admin.database();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { image } = req.body; 

  try {
    // VISION MODEL: Llama 3.2 90B is required for images
    const chatCompletion = await groq.chat.completions.create({
      model: "llama-3.2-90b-vision-preview", 
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Identify all DLS 26 players in this image. Calculate the total account value if legendary players are worth $2 each. Format as: Value: [Amount] | Key Players: [Names]" },
            { 
              type: "image_url", 
              image_url: { 
                url: `data:image/jpeg;base64,${image}` 
              } 
            }
          ]
        }
      ],
      temperature: 0.1, // Low temp for factual accuracy
    });

    const aiText = chatCompletion.choices[0].message.content;

    // Save to Firebase
    const reportRef = db.ref('audit_reports').push();
    const reportId = reportRef.key;
    await reportRef.set({
      reportId,
      analysis: aiText,
      timestamp: Date.now()
    });

    return res.status(200).json({ success: true, reportId, analysis: aiText });

  } catch (err) {
    // EXTREMELY IMPORTANT: This returns the REAL error message to your toast
    console.error("Groq Error:", err);
    return res.status(500).json({ 
      error: err.message || "Unknown Groq Error",
      tip: "Ensure model 'llama-3.2-90b-vision-preview' is active in your Groq tier."
    });
  }
}
