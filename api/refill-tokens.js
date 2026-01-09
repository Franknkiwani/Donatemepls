import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    databaseURL: "https://itzhoyoo-f9f7e-default-rtdb.firebaseio.com"
  });
}

const db = admin.database();

export default async function handler(req, res) {
  // 1. FIX: Node.js header access (req.headers['authorization'])
  const authHeader = req.headers['authorization'];
  
  // Security check
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const usersRef = db.ref('users');
    const snapshot = await usersRef.once('value');
    const updates = {};
    let count = 0;

    snapshot.forEach((child) => {
      const user = child.val();
      
      // Only refill if user is Premium
      if (user.isPremium === true) {
        const currentTokens = Number(user.tokens || 0); // Force to Number
        updates[`${child.key}/tokens`] = currentTokens + 20;
        updates[`${child.key}/lastRefill`] = new Date().toISOString();
        count++;
      }
    });

    if (Object.keys(updates).length > 0) {
      await usersRef.update(updates);
    }

    return res.status(200).json({ message: `Success! Refilled ${count} premium users.` });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
