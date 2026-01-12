import admin from 'firebase-admin';
import Groq from 'groq-sdk';

// 1. Better Firebase Initialization
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
      databaseURL: "https://itzhoyoo-f9f7e-default-rtdb.firebaseio.com"
    });
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

const db = admin.database();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  let { image } = req.body; 

  // Clean the image string: Remove prefix if the frontend already added it
  if (image.includes('base64,')) {
    image = image.split('base64,')[1];
  }

  try {
    const chatCompletion = await groq.chat.completions.create({
      model: "llama-3.2-90b-vision-preview", 
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Identify all DLS 26 players in this image. Calculate total value: Legendary cards = $2, Rare = $0.50. Format: Value: [Amount] | Key Players: [Names]" },
            { 
              type: "image_url", 
              image_url: { 
                url: `data:image/jpeg;base64,${image}` 
              } 
            }
          ]
        }
      ],
      temperature: 0.1,
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
    console.error("Groq/System Error:", err);
    // Return specific error message for easier debugging
    return res.status(500).json({ 
      error: err.message || "Internal Server Error",
      code: err.code || "UNKNOWN_ERROR"
    });
  }
}
