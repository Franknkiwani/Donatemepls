import admin from 'firebase-admin';
import Groq from 'groq-sdk'; // Use the official Groq SDK

// 1. Initialize Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    databaseURL: "https://itzhoyoo-f9f7e-default-rtdb.firebaseio.com"
  });
}
const db = admin.database();

// 2. Initialize Groq Client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Use POST');
  const { image } = req.body; // Base64 from frontend

  try {
    // 3. Upload to Imgur (Same logic as before)
    const imgurFormData = new FormData();
    imgurFormData.append('image', image);
    const imgurRes = await fetch("https://api.imgur.com/3/image", {
      method: "POST",
      headers: { Authorization: `Client-ID ${process.env.IMGUR_CLIENT_ID}` },
      body: imgurFormData
    });
    const imgurData = await imgurRes.json();
    const imageUrl = imgurData.data.link;

    // 4. Call GROQ Vision with Llama 3.2
    const chatCompletion = await groq.chat.completions.create({
      model: "llama-3.2-11b-vision-preview", // Specified Vision model
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze this DLS 26 team screenshot. List players and estimate total account value in USD." },
            { type: "image_url", image_url: { url: imageUrl } }
          ]
        }
      ],
      temperature: 0.2
    });

    const aiText = chatCompletion.choices[0].message.content;

    // 5. Save to Firebase
    const reportRef = db.ref('audit_reports').push();
    const reportId = reportRef.key;
    await reportRef.set({ reportId, imageUrl, analysis: aiText, timestamp: Date.now() });

    return res.status(200).json({ success: true, reportId });

  } catch (err) {
    console.error("Audit Failed:", err.message);
    return res.status(500).json({ error: "Groq Vision Connection Failed" });
  }
}
