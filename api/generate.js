import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // Ensure it's a POST request
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: "API Key missing in Vercel settings." });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const prompt = body.prompt;

    const genAI = new GoogleGenerativeAI(API_KEY);
    
    // We are using 1.5-Flash because your logs show 2.0-Flash is completely out of quota
    const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash" 
    });

    const result = await model.generateContent(`Write a 3-sentence crowdfunding mission for: "${prompt}". No emojis.`);
    const response = await result.response;
    const text = response.text().trim();

    return res.status(200).json({ text });

  } catch (error) {
    console.error("AI Error:", error.message);
    
    // If we hit the 429 quota again, this sends a clear message to your UI
    if (error.status === 429 || error.message.includes('429')) {
        return res.status(429).json({ error: "AI is over-capacity. Wait 30 seconds." });
    }

    return res.status(500).json({ error: "AI Bridge Error" });
  }
}
