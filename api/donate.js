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

        // --- 1. FETCH SENDER DATA DYNAMICALLY ---
        const senderRef = db.ref(`users/${senderUid}`);
        const snap = await senderRef.get();
        const userData = snap.val() || {};

        if (!userData.username) return res.status(404).json({ error: "Sender profile not found" });
        if (userData.banned || userData.isBanned) return res.status(403).json({ error: "ACCOUNT_BANNED" });
        
        // Dynamic fetch of premium status
        const senderIsPremium = userData.isPremium || userData.premium || false;

        // --- 2. ADMIN VAULT VERIFICATION ---
        if (senderUid === BLOCKED_ADMIN_UID) {
            const expectedSecret = process.env.ADMIN_VERIFY_TOKEN; 
            if (!adminSecret || adminSecret !== expectedSecret) {
                return res.status(403).json({ error: "ADMIN_LOCK: Verification Token required." });
            }
        }

        if ((userData.tokens || 0) < amount) {
            return res.status(400).json({ error: "Insufficient Balance" });
        }

        // --- 3. ANTI-FRAUD: STRIKE SYSTEM ---
        let currentStrikes = userData.strikes || 0;
        const lastStrikeTime = userData.lastStrikeTimestamp || 0;
        if (currentStrikes > 0 && (Date.now() - lastStrikeTime) > 86400000) {
            currentStrikes = 0;
        }

        // --- 4. FIND RECIPIENT & PREP LIVE FEED DATA ---
        let recipientOwnerUid = targetId;
        let recipientDisplayName = "User";
        let recipientDisplayAvatar = "";

        if (type === 'campaign') {
            const campSnap = await db.ref(`campaigns/${targetId}`).get();
            const campData = campSnap.val();
            if (!campData) return res.status(404).json({ error: "Campaign not found" });
            
            recipientOwnerUid = campData.creator;
            recipientDisplayName = campData.title || "Mission";
            recipientDisplayAvatar = campData.image || "";
        } else {
            const recSnap = await db.ref(`users/${targetId}`).get();
            const recData = recSnap.val() || {};
            recipientDisplayName = recData.username || "Ghost_Signal";
            recipientDisplayAvatar = recData.avatar || "";
        }

        // --- 5. SELF-DONATION CHECK ---
        if (senderUid === recipientOwnerUid) {
            const newStrikes = currentStrikes + 1;
            const strikeData = { strikes: newStrikes, lastStrikeTimestamp: Date.now() };
            if (newStrikes >= 3) {
                await senderRef.update({ ...strikeData, isBanned: true, banReason: "Self-Donation Loop" });
                return res.status(403).json({ error: "BANNED: Third Strike for Self-Donation." });
            }
            await senderRef.update(strikeData);
            return res.status(400).json({ error: `Self-Donation Strike ${newStrikes}/3.` });
        }

        // --- 6. SECURE ATOMIC UPDATES ---
        const netAmount = Math.floor(amount * 0.7); 
        const feeAmount = amount - netAmount;     
        const updates = {};

        // SENDER UPDATES
        updates[`users/${senderUid}/tokens`] = ServerValue.increment(-amount);
        updates[`users/${senderUid}/totalDonated`] = ServerValue.increment(amount);

        // RECIPIENT UPDATES
        updates[`users/${recipientOwnerUid}/tokens`] = ServerValue.increment(netAmount);
        updates[`users/${recipientOwnerUid}/totalEarned`] = ServerValue.increment(netAmount);
        updates[`users/${recipientOwnerUid}/totalRaised`] = ServerValue.increment(netAmount);
        updates[`users/${recipientOwnerUid}/donorCount`] = ServerValue.increment(1);

        // Campaign Specific
        if (type === 'campaign') {
            updates[`campaigns/${targetId}/raised`] = ServerValue.increment(netAmount);
            updates[`campaigns/${targetId}/donorsCount`] = ServerValue.increment(1);
            
            const donorLogRef = `campaign_donors/${targetId}/${senderUid}`;
            updates[donorLogRef] = {
                uid: senderUid,
                username: userData.username,
                avatar: userData.avatar || '',
                amount: netAmount,
                timestamp: ServerValue.TIMESTAMP,
                isPremium: senderIsPremium // Log premium status for campaign list
            };
        }

        // --- 7. THE VAULT (Admin Fee) ---
        updates[`users/${BLOCKED_ADMIN_UID}/tokens`] = ServerValue.increment(feeAmount);

        // --- 8. GLOBAL LIVE FEED LOG ---
        const liveLogId = db.ref('donations').push().key;
        updates[`donations/${liveLogId}`] = {
            fromName: userData.username,
            fromAvatar: userData.avatar || "",
            fromIsPremium: senderIsPremium, // Fetched dynamically from DB
            toName: recipientDisplayName,
            toAvatar: recipientDisplayAvatar,
            amount: amount,
            timestamp: ServerValue.TIMESTAMP,
            type: type
        };

        // EXECUTE ALL CHANGES ATOMICALLY
        await db.ref().update(updates);

        return res.status(200).json({ 
            success: true, 
            netSent: netAmount,
            message: "Transmission Complete."
        });

    } catch (error) {
        console.error("API Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
