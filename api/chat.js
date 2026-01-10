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
            content: `You are Grok Core, the AI assistant for this crowdfunding platform. 
            
            ### COMMAND: HUMAN HANDOFF
            If the user asks to speak to a human, a real person, or support, you MUST respond ONLY with: HANDOFF_REQUEST
            
            ### PLATFORM RULES:
            1. TOKENS: 1 Token = $0.10. 
            2. REACH MATH: 1 Token spent on 'Boost' gives 3 views (1:3 ratio).
            3. DONATIONS: There is a 30% platform fee. The recipient gets 70% of tokens sent.
            4. WITHDRAWALS: Minimum 50 tokens ($5.00). 15% processing fee on payouts.
            5. PRO MEMBERSHIP: Costs $20. Includes custom PFP uploads, 20 tokens, and profile viewing.
            6. LIMITS: Free users have a 2-name-change limit per week.
            
            Be professional and strictly follow these numbers.` 
          },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.5,
        max_tokens: 500
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error("Groq Error:", data.error.message);
      return res.status(500).json({ text: "Grok is over capacity. Please retry." });
    }

    const aiText = data.choices[0].message.content.trim();
    return res.status(200).json({ text: aiText });

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ text: "Grok is resting. Try again shortly." });
  }
}
