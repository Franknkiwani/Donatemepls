import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    databaseURL: "https://itzhoyoo-f9f7e-default-rtdb.firebaseio.com"
  });
}

const db = admin.database();

export default async function handler(req, res) {
  // Security check: Only Vercel or someone with the password can run this
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const usersRef = db.ref('users');
    const snapshot = await usersRef.once('value');
    const updates = {};

    snapshot.forEach((child) => {
      const user = child.val();
      // If user is Premium, add 20 tokens to their current total
      if (user.isPremium) {
        updates[`${child.key}/tokens`] = (user.tokens || 0) + 20;
        updates[`${child.key}/lastRefill`] = new Date().toISOString();
      }
    });

    await usersRef.update(updates);
    return res.status(200).json({ message: 'Monthly refill successful!' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
