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

    const { idToken, targetId, amount, type, adminSecret } = req.body; 
    const BLOCKED_ADMIN_UID = "4xEDAzSt5javvSnW5mws2Ma8i8n1"; 

    try {
        const decodedToken = await auth.verifyIdToken(idToken);
        const senderUid = decodedToken.uid; 

        // --- 1. ADMIN VAULT VERIFICATION ---
        if (senderUid === BLOCKED_ADMIN_UID) {
            const expectedSecret = process.env.ADMIN_VERIFY_TOKEN; 
            if (!adminSecret || adminSecret !== expectedSecret) {
                return res.status(403).json({ 
                    error: "ADMIN_LOCK: Verification Token required to move Vault funds." 
                });
            }
        }

        const senderRef = db.ref(`users/${senderUid}`);
        const snap = await senderRef.get();
        const userData = snap.val() || {};

        if (userData.banned || userData.isBanned) return res.status(403).json({ error: "ACCOUNT_BANNED" });
        if (!userData || (userData.tokens || 0) < amount) {
            return res.status(400).json({ error: "Insufficient Balance" });
        }

        // --- 2. ANTI-FRAUD: STRIKE SYSTEM ---
        let currentStrikes = userData.strikes || 0;
        const lastStrikeTime = userData.lastStrikeTimestamp || 0;
        // Reset strikes after 24 hours
        if (currentStrikes > 0 && (Date.now() - lastStrikeTime) > 86400000) {
            currentStrikes = 0;
        }

        // --- 3. FIND RECIPIENT ---
        let recipientOwnerUid = targetId;
        let campaignTitle = "";

        if (type === 'campaign') {
            const campSnap = await db.ref(`campaigns/${targetId}`).get();
            const campData = campSnap.val();
            if (!campData) return res.status(404).json({ error: "Campaign not found" });
            recipientOwnerUid = campData.creator;
            campaignTitle = campData.title;
        }

        // --- 4. SELF-DONATION CHECK ---
        if (senderUid === recipientOwnerUid) {
            const newStrikes = currentStrikes + 1;
            const strikeData = { strikes: newStrikes, lastStrikeTimestamp: Date.now() };
            if (newStrikes >= 3) {
                await senderRef.update({ ...strikeData, isBanned: true, banReason: "Self-Donation Loop" });
                return res.status(403).json({ error: "BANNED: Third Strike for Self-Donation." });
            }
            await senderRef.update(strikeData);
            return res.status(400).json({ error: `Self-Donation Strike ${newStrikes}/3. Do not donate to yourself.` });
        }

        // --- 5. SECURE ATOMIC UPDATES ---
        const netAmount = Math.floor(amount * 0.7); // Creator gets 70%
        const feeAmount = amount - netAmount;     // System/Vault gets 30%
        const updates = {};

        // Deduct from Sender
        updates[`users/${senderUid}/tokens`] = ServerValue.increment(-amount);

        // Credit to Recipient
        updates[`users/${recipientOwnerUid}/tokens`] = ServerValue.increment(netAmount);
        updates[`users/${recipientOwnerUid}/totalRaised`] = ServerValue.increment(netAmount);
        
        // IMPORTANT: Update totalEarned so the withdrawal security check passes
        updates[`users/${recipientOwnerUid}/totalEarned`] = ServerValue.increment(netAmount);
        
        updates[`users/${recipientOwnerUid}/donorCount`] = ServerValue.increment(1);

        // Campaign Specific Updates
        if (type === 'campaign') {
            updates[`campaigns/${targetId}/raised`] = ServerValue.increment(netAmount);
            updates[`campaigns/${targetId}/donorsCount`] = ServerValue.increment(1);
            
            // Log Donor for the campaign "Wall of Fame"
            const donorLogRef = `campaign_donors/${targetId}/${senderUid}`;
            updates[donorLogRef] = {
                uid: senderUid,
                username: userData.username || "Supporter",
                avatar: userData.avatar || '',
                amount: netAmount,
                timestamp: ServerValue.TIMESTAMP
            };
        }

        // 6. THE VAULT (Admin/Platform Fee)
        updates[`users/${BLOCKED_ADMIN_UID}/tokens`] = ServerValue.increment(feeAmount);

        // Execute all database changes at once (Atomic)
        await db.ref().update(updates);

        return res.status(200).json({ 
            success: true, 
            netSent: netAmount,
            message: "Donation successful! Withdrawal balance updated."
        });

    } catch (error) {
        console.error("API Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
