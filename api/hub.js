import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

// 1. Ensure the Service Account exists
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is missing in Vercel Env");
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!getApps().length) {
    initializeApp({
        credential: cert(serviceAccount),
        databaseURL: "https://itzhoyoo-f9f7e-default-rtdb.firebaseio.com"
    });
}

const db = getDatabase();

export default async function handler(req, res) {
    // 2. Add CORS headers so your website can actually read the response
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
    const { view, lastValue, limit = 25 } = req.query;
    
    let dbPath = view === 'live' ? 'donations' : 'users';
    let sortKey = view === 'live' ? 'timestamp' : (view === 'top-donors' ? 'totalDonated' : 'totalRaised');

    try {
        let queryRef = db.ref(dbPath).orderByChild(sortKey);

        // 3. Robust pagination check
        if (lastValue && lastValue !== 'null' && lastValue !== 'undefined') {
            // We use Number() because timestamps and tokens are numeric
            queryRef = queryRef.endBefore(Number(lastValue));
        }

        const snapshot = await queryRef.limitToLast(parseInt(limit)).get();
        const data = snapshot.val();

        if (!data) {
            return res.status(200).json({ results: [], nextLastValue: null });
        }

        // 4. Convert and Sort strictly
        const results = Object.entries(data)
            .map(([id, val]) => ({ id, ...val }))
            .sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0));

        // 5. Identify the true "bottom" value for the next page
        // We take the value of the very last item in our sorted array
        const nextLastValue = results.length > 0 ? results[results.length - 1][sortKey] : null;

        return res.status(200).json({
            results,
            nextLastValue
        });
    } catch (error) {
        console.error("API Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
