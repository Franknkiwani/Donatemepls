// /api/chat.js
export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ text: "Method not allowed" });
    }

    try {
        const { prompt } = req.body;

        const response = await fetch("https://api.x.ai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.GROK_API_KEY}` 
            },
            body: JSON.stringify({
                model: "grok-beta",
                messages: [
                    { 
                        role: "system", 
                        content: "You are Grok, the AI assistant for this fundraising platform. Be sharp, helpful, and concise." 
                    },
                    { role: "user", content: prompt }
                ],
                stream: false
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("xAI Error:", data);
            return res.status(500).json({ text: "Grok is resting. Try again shortly." });
        }

        // Send the text back to your glassy modal
        res.status(200).json({ text: data.choices[0].message.content });

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ text: "Connection to Grok Core failed." });
    }
}
