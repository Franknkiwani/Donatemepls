import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!getApps().length) {
    initializeApp({
        credential: cert(serviceAccount),
        databaseURL: "https://itzhoyoo-f9f7e-default-rtdb.firebaseio.com"
    });
}
const db = getDatabase();

export default async function handler(req, res) {
    const { view, lastValue, limit = 25 } = req.query;
    
    let dbPath = view === 'live' ? 'donations' : 'users';
    let sortKey = view === 'live' ? 'timestamp' : (view === 'top-donors' ? 'totalDonated' : 'totalRaised');

    try {
        let queryRef = db.ref(dbPath).orderByChild(sortKey);

        // If lastValue exists, we start from there for pagination
        if (lastValue && lastValue !== 'null') {
            queryRef = queryRef.endBefore(Number(lastValue));
        }

        // Fetch one extra to get the "next" lastValue
        const snapshot = await queryRef.limitToLast(parseInt(limit)).get();
        const data = snapshot.val() || {};

        // Convert to array and sort descending
        const results = Object.entries(data)
            .map(([id, val]) => ({ id, ...val }))
            .sort((a, b) => b[sortKey] - a[sortKey]);

        return res.status(200).json({
            results,
            nextLastValue: results.length > 0 ? results[results.length - 1][sortKey] : null
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
