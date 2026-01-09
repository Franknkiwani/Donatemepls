export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: "Key Missing" });

  try {
    // 1. Parse the incoming request correctly
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const prompt = body.prompt;

    // 2. Direct HTTPS fetch to Google (Bypasses library bugs)
    // We use gemini-1.5-flash because your logs proved 2.0-flash is over-quota
    const googleResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Write a 3-sentence crowdfunding description for: "${prompt}". No emojis.` }] }]
      })
    });

    const data = await googleResponse.json();

    // 3. Handle Google's internal errors
    if (data.error) {
      console.error("Google Error:", data.error.message);
      return res.status(data.error.code || 500).json({ error: data.error.message });
    }

    // 4. Extract text safely
    if (data.candidates && data.candidates[0].content.parts[0].text) {
      const aiText = data.candidates[0].content.parts[0].text.trim();
      return res.status(200).json({ text: aiText });
    } else {
      throw new Error("Invalid AI response format");
    }

  } catch (error) {
    console.error("Bridge Error:", error.message);
    return res.status(500).json({ error: "Connection to AI Bridge lost. Try again." });
  }
}
