import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

export default async function handler(req, res) {
    // 1. Better CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    try {
        // 2. Fix Private Key Newlines
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        if (serviceAccount.private_key) {
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }

        if (!getApps().length) {
            initializeApp({
                credential: cert(serviceAccount),
                databaseURL: "https://itzhoyoo-f9f7e-default-rtdb.firebaseio.com"
            });
        }

        const db = getDatabase();
        const { view, lastValue, limit = 25 } = req.query;
        
        let dbPath = view === 'live' ? 'donations' : 'users';
        let sortKey = view === 'live' ? 'timestamp' : (view === 'top-donors' ? 'totalDonated' : 'totalRaised');

        let queryRef = db.ref(dbPath).orderByChild(sortKey);

        // 3. Fix Pagination Types
        if (lastValue && lastValue !== 'null' && lastValue !== 'undefined') {
            const numericValue = Number(lastValue);
            // If the database value is a number, we MUST use a number here
            queryRef = queryRef.endBefore(numericValue);
        }

        const snapshot = await queryRef.limitToLast(parseInt(limit)).get();
        const data = snapshot.val();

        if (!data) {
            return res.status(200).json({ results: [], nextLastValue: null });
        }

        const results = Object.entries(data)
            .map(([id, val]) => ({ id, ...val }))
            .sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0));

        const nextLastValue = results.length > 0 ? results[results.length - 1][sortKey] : null;

        return res.status(200).json({ results, nextLastValue });

    } catch (error) {
        console.error("CRITICAL API ERROR:", error.message);
        return res.status(500).json({ error: "INTERNAL_ERROR", detail: error.message });
    }
}
