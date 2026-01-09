export default async function handler(req, res) {
  // 1. Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. Grab the Groq Key from Vercel Environment Variables
  const API_KEY = process.env.GROQ_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: "Missing GROQ_API_KEY in Vercel settings." });
  }

  try {
    // 3. Parse the title sent from your frontend
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const prompt = body.prompt?.trim();

    if (!prompt) {
      return res.status(400).json({ error: "No title provided." });
    }

    // 4. The Direct Bridge to Groq (Llama 3.3 70B)
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
            content: "You are a professional crowdfunding expert. Write exactly 3 impactful sentences. No emojis or hashtags." 
          },
          { 
            role: "user", 
            content: `Write a mission statement for a campaign titled: "${prompt}"` 
          }
        ],
        temperature: 0.6,
        max_tokens: 150
      })
    });

    const data = await response.json();

    // 5. Error Handling
    if (data.error) {
      console.error("Groq Error:", data.error.message);
      return res.status(500).json({ error: `AI Error: ${data.error.message}` });
    }

    // 6. Send the result back to your website
    const aiText = data.choices[0].message.content.trim();
    return res.status(200).json({ text: aiText });

  } catch (error) {
    console.error("Bridge Crash:", error.message);
    return res.status(500).json({ error: "The AI bridge is resetting. Try again in 5 seconds." });
  }
}
