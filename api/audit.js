import admin from 'firebase-admin';
import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. Initialize Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    databaseURL: "https://itzhoyoo-f9f7e-default-rtdb.firebaseio.com"
  });
}
const db = admin.database();

// 2. Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  
  let { image } = req.body; 
  if (!image) return res.status(400).json({ error: "No image provided" });

  // Clean the base64 string
  if (image.includes('base64,')) {
    image = image.split('base64,')[1];
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Custom DLS 26 Valuation Prompt
    const prompt = "Analyze this DLS 26 screenshot. Identify the players. Calculate the total account value where Maxed/Legendary cards = $2 and Rare/Blue cards = $0.50. Format your response exactly like this: 'Value: $[Total] | Key Players: [Names]'";
    
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: image,
          mimeType: "image/jpeg"
        }
      }
    ]);

    const aiText = result.response.text();

    // 3. Save to Firebase
    const reportRef = db.ref('audit_reports').push();
    const reportId = reportRef.key;
    
    await reportRef.set({
      reportId,
      analysis: aiText,
      timestamp: Date.now()
    });

    return res.status(200).json({ success: true, reportId, analysis: aiText });

  } catch (err) {
    console.error("Gemini System Error:", err);
    return res.status(500).json({ error: "Gemini Analysis Failed", details: err.message });
  }
}
