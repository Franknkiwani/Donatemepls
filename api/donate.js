import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getDatabase, ServerValue } from 'firebase-admin/database';
import { getAuth } from 'firebase-admin/auth';

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

    const { idToken, targetId, amount, type, adminSecret } = req.body; // Added adminSecret
    const BLOCKED_ADMIN_UID = "4xEDAzSt5javvSnW5mws2Ma8i8n1"; 

    try {
        const decodedToken = await auth.verifyIdToken(idToken);
        const senderUid = decodedToken.uid; 

        // --- 1. THE BLOCK & VERIFICATION LOGIC ---
        if (senderUid === BLOCKED_ADMIN_UID) {
            // Check if the secret provided in the request matches the Vercel Environment Variable
            const expectedSecret = process.env.ADMIN_VERIFY_TOKEN; 
            
            if (!adminSecret || adminSecret !== expectedSecret) {
                return res.status(403).json({ 
                    error: "ADMIN_LOCK: Verification Token required to move Vault funds." 
                });
            }
            // If secret matches, it proceeds!
        }

        const senderRef = db.ref(`users/${senderUid}`);
        const snap = await senderRef.get();
        const userData = snap.val() || {};

        if (userData.banned) return res.status(403).json({ error: "ACCOUNT_BANNED" });
        if (!userData || (userData.tokens || 0) < amount) {
            return res.status(400).json({ error: "Insufficient Balance" });
        }

        // --- STRIKE DECAY ---
        let currentStrikes = userData.strikes || 0;
        const lastStrikeTime = userData.lastStrikeTimestamp || 0;
        if (currentStrikes > 0 && (Date.now() - lastStrikeTime) > 86400000) {
            currentStrikes = 0;
        }

        // --- FIND RECIPIENT ---
        let recipientOwnerUid = targetId;
        if (type === 'campaign') {
            const campSnap = await db.ref(`campaigns/${targetId}`).get();
            const campData = campSnap.val();
            recipientOwnerUid = campData?.creator;
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

        // --- SECURE ATOMIC UPDATES ---
        const netAmount = Math.floor(amount * 0.7);
        const feeAmount = amount - netAmount;
        const updates = {};

        updates[`users/${senderUid}/tokens`] = ServerValue.increment(-amount);
        updates[`users/${recipientOwnerUid}/tokens`] = ServerValue.increment(netAmount);
        updates[`users/${recipientOwnerUid}/totalRaised`] = ServerValue.increment(netAmount);
        updates[`users/${recipientOwnerUid}/donorCount`] = ServerValue.increment(1);

        if (type === 'campaign') {
            updates[`campaigns/${targetId}/raised`] = ServerValue.increment(netAmount);
            updates[`campaigns/${targetId}/donorsCount`] = ServerValue.increment(1);
            updates[`campaign_donors/${targetId}/${senderUid}`] = {
                uid: senderUid,
                username: userData.username || "User",
                avatar: userData.avatar || '',
                timestamp: ServerValue.TIMESTAMP
            };
        }

        // THE VAULT (Admin Fee) - Stays with the designated Admin UID
        updates[`users/${BLOCKED_ADMIN_UID}/tokens`] = ServerValue.increment(feeAmount);

        await db.ref().update(updates);
        return res.status(200).json({ success: true, netSent: netAmount });

    } catch (error) {
        console.error("API Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
