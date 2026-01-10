export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    // Use a URL parameter to decide what to do
    const { type } = req.query;

    try {
        // --- LOGIC 1: AI CHAT ---
        if (type === 'chat') {
            const { message } = req.body;
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        { role: "system", content: "You are the ItzHoyoo AI. Assist users. Premium is $4.99. Be concise." },
                        { role: "user", content: message }
                    ]
                })
            });
            const data = await response.json();
            return res.status(200).json({ reply: data.choices[0].message.content });
        }

        // --- LOGIC 2: IMAGE UPLOAD ---
        if (type === 'upload') {
            const { image } = req.body;
            const response = await fetch("https://api.imgur.com/3/image", {
                method: "POST",
                headers: {
                    "Authorization": `Client-ID ${process.env.IMGUR_CLIENT_ID}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ image: image.split(',')[1] })
            });
            const data = await response.json();
            return res.status(200).json(data);
        }

        return res.status(400).json({ error: "Invalid request type" });

    } catch (err) {
        return res.status(500).json({ error: "Internal Server Error" });
    }
}
