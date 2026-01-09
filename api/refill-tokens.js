import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    databaseURL: "https://itzhoyoo-f9f7e-default-rtdb.firebaseio.com"
  });
}

const db = admin.database();

export default async function handler(req, res) {
  // 1. FIX: Use standard Node.js header access
  // req.headers is an object, not a Map with a .get() method
  const authHeader = req.headers['authorization']; 
  
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // 2. FIX: Added return to stop execution if unauthorized
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 3. IMPROVEMENT: Only allow POST or GET depending on your cron setup
  // Vercel Crons usually send a GET request
  
  try {
    const usersRef = db.ref('users');
    const snapshot = await usersRef.once('value');
    const updates = {};
    let count = 0;

    snapshot.forEach((child) => {
      const user = child.val();
      // Only update if they are premium
      if (user && user.isPremium) {
        updates[`${child.key}/tokens`] = (user.tokens || 0) + 20;
        updates[`${child.key}/lastRefill`] = new Date().toISOString();
        count++;
      }
    });

    if (count > 0) {
      await usersRef.update(updates);
    }

    return res.status(200).json({ 
      success: true, 
      message: `Refilled ${count} premium members!` 
    });
  } catch (error) {
    console.error("Refill Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
