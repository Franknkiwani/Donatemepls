import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // 1. Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 2. Grab the prompt (the campaign title) from the frontend
    const { prompt } = JSON.parse(req.body);

    if (!prompt) {
      return res.status(400).json({ error: 'No title provided' });
    }

    // 3. Initialize Gemini with your Environment Variable
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Using gemini-1.5-flash because it's the fastest and best for short descriptions
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // 4. Set the "Persona" for the AI
    const aiInstructions = `
      Write a compelling, professional crowdfunding mission description for a campaign titled: "${prompt}". 
      Requirements:
      - Max 3 sentences.
      - Tone: High-energy, inspiring, and urgent.
      - Do not include hashtags or emojis.
      - Focus on the impact the tokens will have.
    `;

    // 5. Generate and send back
    const result = await model.generateContent(aiInstructions);
    const response = await result.response;
    const text = response.text().trim();

    return res.status(200).json({ text });

  } catch (error) {
    console.error("Gemini Error:", error);
    return res.status(500).json({ error: "AI failed to generate content. Check API key." });
  }
}
