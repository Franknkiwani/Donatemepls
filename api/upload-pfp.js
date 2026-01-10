export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Get the image data from the request body
    // Note: We expect the frontend to send a JSON with { image: "base64_string" }
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    // 2. Forward to Imgur
    const imgurResponse = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: {
        Authorization: `Client-ID ${process.env.IMGUR_CLIENT_ID}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: image.split(',')[1], // Remove the "data:image/png;base64," prefix
        type: 'base64'
      }),
    });

    const data = await imgurResponse.json();

    if (data.success) {
      return res.status(200).json({ link: data.data.link });
    } else {
      console.error('Imgur Error:', data);
      return res.status(500).json({ error: 'Imgur upload failed' });
    }
  } catch (error) {
    console.error('Server Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
