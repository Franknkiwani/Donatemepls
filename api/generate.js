import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // 1. Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. Immediate Security Check
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "Server Configuration Error: API Key missing." });
  }

  try {
    const body = JSON.parse(req.body);
    const prompt = body.prompt?.trim();

    if (!prompt || prompt.length < 3) {
      return res.status(400).json({ error: 'Campaign title is too short.' });
    }

    // 3. Initialize with latest 2026 model
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash", // Faster & smarter for 2026
        systemInstruction: "You are a professional crowdfunding copywriter. Your goal is to write high-impact mission statements."
    });

    // 4. Structured Prompt for exact output
    const aiPrompt = `Write a powerful 3-sentence description for a campaign titled: "${prompt}". 
    Focus on social impact and urgency. 
    Output ONLY the description text. Do not use hashtags, emojis, or introductory phrases like 'Here is your description'.`;

    // 5. Generate and clean response
    const result = await model.generateContent(aiPrompt);
    const response = await result.response;
    let text = response.text().trim();

    // Remove quotes if the AI adds them accidentally
    text = text.replace(/^["']+|["']+$/g, '');

    return res.status(200).json({ text });

  } catch (error) {
    console.error("Gemini API Error:", error);
    return res.status(500).json({ error: "The AI is currently refueling. Please try again in a moment." });
  }
}