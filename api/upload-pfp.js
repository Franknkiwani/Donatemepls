export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb', // Allows larger image strings
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'No image data provided' });

    // Remove the data:image/png;base64, prefix if it exists
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    const imgurResponse = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: {
        Authorization: `Client-ID ${process.env.IMGUR_CLIENT_ID}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: base64Data,
        type: 'base64'
      }),
    });

    const data = await imgurResponse.json();

    if (data.success) {
      return res.status(200).json({ link: data.data.link });
    } else {
      console.error('Imgur Error:', data);
      return res.status(500).json({ error: 'Imgur rejected the image' });
    }
  } catch (error) {
    console.error('Vercel Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
