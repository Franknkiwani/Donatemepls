import { GoogleGenerativeAI } from "@google/generative-ai";
import admin from "firebase-admin";

// 1. Initialize Firebase
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            // Fixing the private key format for Vercel
            privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
        })
    });
}

const db = admin.firestore();

// 2. Initialize Gemini with your SPECIFIC Key Name
// We use process.env.GEMINI_API_KEY because that's what you set in Vercel
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    
    // Check if API key exists before running
    if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is missing in Vercel settings' });
    }

    const { imageBase64 } = req.body;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        
        const prompt = "Analyze this DLS squad. Extract every player name and their current rating. Return ONLY a JSON array like this: [{\"n\": \"Mbappe\", \"r\": 98}]";
        
        const visionResult = await model.generateContent([
            prompt,
            { inlineData: { data: imageBase64, mimeType: "image/png" } }
        ]);
        
        // Clean the AI response (remove markdown ```json blocks if present)
        const cleanJson = visionResult.response.text().replace(/```json|```/g, "").trim();
        const players = JSON.parse(cleanJson);

        // 3. Update Database with "Price Floor" Logic
        for (const player of players) {
            const docRef = db.collection("dlsvalueapi").doc(player.n);

            await db.runTransaction(async (t) => {
                const doc = await t.get(docRef);
                
                let totalPoints = player.r;
                let scanCount = 1;

                if (doc.exists) {
                    const data = doc.data();
                    totalPoints = (data.total_points || 0) + player.r;
                    scanCount = (data.scan_count || 0) + 1;
                }

                const avgRating = totalPoints / scanCount;
                let calculatedWorth = avgRating * 0.65; 

                // HARD FLOOR: Price never goes under $45.00
                const finalWorth = Math.max(calculatedWorth, 45.00).toFixed(2);

                t.set(docRef, {
                    total_points: totalPoints,
                    scan_count: scanCount,
                    avg_rating: avgRating.toFixed(1),
                    current_worth: finalWorth,
                    last_update: new Date().toISOString()
                }, { merge: true });
            });
        }

        res.status(200).json({ success: true, playersFound: players.length });

    } catch (error) {
        console.error("API Error:", error);
        res.status(500).json({ error: "Analysis failed", details: error.message });
    }
}
