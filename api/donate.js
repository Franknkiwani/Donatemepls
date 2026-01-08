// /api/donate.js
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

// 1. Setup Admin SDK (Use your Vercel Env Var)
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!getApps().length) {
    initializeApp({
        credential: cert(serviceAccount),
        databaseURL: "https://itzhoyoo-f9f7e-default-rtdb.firebaseio.com"
    });
}
const db = getDatabase();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { senderUid, targetId, amount, type } = req.body;

    try {
        const senderRef = db.ref(`users/${senderUid}`);
        const snap = await senderRef.get();
        const userData = snap.val();

        if (!userData || userData.tokens < amount) {
            return res.status(400).json({ error: "Insufficient Balance" });
        }

        const netAmount = Math.floor(amount * 0.7);
        const feeAmount = amount - netAmount;

        const updates = {};
        // 1. Deduct from Sender
        updates[`users/${senderUid}/tokens`] = userData.tokens - amount;

        // 2. Add to Recipient (User or Campaign)
        if (type === 'user') {
            const targetSnap = await db.ref(`users/${targetId}/tokens`).get();
            updates[`users/${targetId}/tokens`] = (targetSnap.val() || 0) + netAmount;
        } else {
            const campSnap = await db.ref(`campaigns/${targetId}/raised`).get();
            updates[`campaigns/${targetId}/raised`] = (campSnap.val() || 0) + netAmount;
            
            // Log donor
            updates[`campaign_donors/${targetId}/${senderUid}`] = {
                uid: senderUid,
                username: userData.username,
                avatar: userData.avatar || '',
                timestamp: Date.now()
            };
        }

        // 3. THE VAULT (Replacing your Frank Account UID)
        const vaultSnap = await db.ref('system_vault/total_fees').get();
        updates['system_vault/total_fees'] = (vaultSnap.val() || 0) + feeAmount;

        await db.ref().update(updates);
        return res.status(200).json({ success: true, netSent: netAmount });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
