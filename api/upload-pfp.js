import admin from 'firebase-admin';

// Initialize Firebase Admin (Only once)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

export const config = {
  api: { bodyParser: { sizeLimit: '4mb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { image, uid } = req.body; // UID sent from frontend
    if (!image || !uid) return res.status(400).json({ error: 'Missing data' });

    // 1. CHECK USER STATUS & LIMITS
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data();

    if (!userData) return res.status(404).json({ error: 'User not found' });

    const isPremium = userData.isPremium === true;
    const lastUpload = userData.lastAvatarUpload; // Expected format: YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];

    // Block if Free and already uploaded today
    if (!isPremium && lastUpload === today) {
      return res.status(429).json({ error: 'Daily limit reached' });
    }

    // 2. UPLOAD TO IMGUR
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const imgurResponse = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: {
        Authorization: `Client-ID ${process.env.IMGUR_CLIENT_ID}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: base64Data, type: 'base64' }),
    });

    const data = await imgurResponse.json();

    if (data.success) {
      // 3. UPDATE USER LIMIT IN FIRESTORE
      await db.collection('users').doc(uid).update({
        lastAvatarUpload: today
      });

      return res.status(200).json({ link: data.data.link });
    } else {
      return res.status(500).json({ error: 'Imgur upload failed' });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
