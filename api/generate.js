export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: "API Key missing." });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const prompt = body.prompt?.trim();

    // Use a direct fetch call. This is the "Lightest" way to talk to Google.
    // We use gemini-1.5-flash because it has the highest free-tier quota.
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `Write a powerful 3-sentence crowdfunding mission for: "${prompt}". Focus on impact and urgency. No emojis or hashtags.` }]
        }]
      })
    });

    const data = await response.json();

    // If Google says 429, we catch it here
    if (data.error) {
      return res.status(data.error.code || 500).json({ error: data.error.message });
    }

    const aiText = data.candidates[0].content.parts[0].text.trim();
    return res.status(200).json({ text: aiText.replace(/^["']+|["']+$/g, '') });

  } catch (error) {
    return res.status(500).json({ error: "AI Bridge reset. Please try again." });
  }
}
