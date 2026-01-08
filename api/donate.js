import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { getAuth } from 'firebase-admin/auth'; // Added for Token Verification

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!getApps().length) {
    initializeApp({
        credential: cert(serviceAccount),
        databaseURL: "https://itzhoyoo-f9f7e-default-rtdb.firebaseio.com"
    });
}
const db = getDatabase();
const auth = getAuth();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    // We take idToken instead of senderUid for security
    const { idToken, targetId, amount, type } = req.body;
    const adminUid = "4xEDAzSt5javvSnW5mws2Ma8i8n1"; // Your Vault UID

    try {
        // --- SECURITY: VERIFY THE USER IS WHO THEY SAY THEY ARE ---
        const decodedToken = await auth.verifyIdToken(idToken);
        const senderUid = decodedToken.uid; 

        const senderRef = db.ref(`users/${senderUid}`);
        const snap = await senderRef.get();
        const userData = snap.val() || {};

        if (userData.banned) return res.status(403).json({ error: "ACCOUNT_BANNED" });
        if (!userData || (userData.tokens || 0) < amount) {
            return res.status(400).json({ error: "Insufficient Balance" });
        }

        // --- STRIKE DECAY (24H CLEANING) ---
        let currentStrikes = userData.strikes || 0;
        const lastStrikeTime = userData.lastStrikeTimestamp || 0;
        if (currentStrikes > 0 && (Date.now() - lastStrikeTime) > 86400000) {
            currentStrikes = 0;
        }

        // --- FIND ACTUAL RECIPIENT OWNER ---
        let recipientOwnerUid = targetId;
        if (type === 'campaign') {
            const campSnap = await db.ref(`campaigns/${targetId}`).get();
            recipientOwnerUid = campSnap.val()?.ownerUid;
        }

        // --- SELF-DONATION CHECK ---
        if (senderUid === recipientOwnerUid) {
            const newStrikes = currentStrikes + 1;
            const strikeData = { strikes: newStrikes, lastStrikeTimestamp: Date.now() };
            
            if (newStrikes >= 3) {
                await senderRef.update({ ...strikeData, banned: true });
                return res.status(403).json({ error: "BANNED: Third Strike." });
            }
            
            await senderRef.update(strikeData);
            return res.status(400).json({ error: `Self-Donation Strike ${newStrikes}/3` });
        }

        // --- SECURE MATH & UPDATES ---
        const netAmount = Math.floor(amount * 0.7);
        const feeAmount = amount - netAmount;
        const updates = {};

        // 1. Deduct from Sender
        updates[`users/${senderUid}/tokens`] = userData.tokens - amount;

        // 2. Add to Recipient
        const targetRef = db.ref(`users/${recipientOwnerUid}`);
        const targetSnap = await targetRef.get();
        const targetData = targetSnap.val() || {};
        
        updates[`users/${recipientOwnerUid}/tokens`] = (targetData.tokens || 0) + netAmount;
        updates[`users/${recipientOwnerUid}/totalEarned`] = (targetData.totalEarned || 0) + netAmount;

        // 3. Campaign specific stats
        if (type === 'campaign') {
            const raisedSnap = await db.ref(`campaigns/${targetId}/raised`).get();
            updates[`campaigns/${targetId}/raised`] = (raisedSnap.val() || 0) + netAmount;
            updates[`campaign_donors/${targetId}/${senderUid}`] = {
                uid: senderUid,
                username: userData.username || "User",
                avatar: userData.avatar || '',
                timestamp: Date.now()
            };
        }

        // 4. THE VAULT (Admin Token Routing)
        const adminRef = db.ref(`users/${adminUid}/tokens`);
        const adminSnap = await adminRef.get();
        updates[`users/${adminUid}/tokens`] = (adminSnap.val() || 0) + feeAmount;

        await db.ref().update(updates);
        return res.status(200).json({ success: true, netSent: netAmount });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
