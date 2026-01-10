export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const API_KEY = process.env.GROQ_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: "Missing GROQ_API_KEY" });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const userPrompt = body.prompt?.trim();

    if (!userPrompt) return res.status(400).json({ error: "No message provided." });

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { 
            role: "system", 
            content: "You are Grok Core, a helpful AI assistant. Be concise, professional, and friendly. Answer any user questions accurately." 
          },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ text: "System over capacity. Please retry." });
    }

    const aiText = data.choices[0].message.content.trim();
    return res.status(200).json({ text: aiText });

  } catch (error) {
    return res.status(500).json({ text: "Grok is resting. Try again shortly." });
  }
}
