import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getDatabase, ServerValue } from 'firebase-admin/database';
import { getAuth } from 'firebase-admin/auth';

// --- INITIALIZE FIREBASE ADMIN ---
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
    // Only allow POST requests
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { idToken, targetId, amount, type, adminSecret } = req.body; 
    const BLOCKED_ADMIN_UID = "4xEDAzSt5javvSnW5mws2Ma8i8n1"; // The Vault Account

    try {
        // --- 1. VERIFY SENDER ---
        const decodedToken = await auth.verifyIdToken(idToken);
        const senderUid = decodedToken.uid; 

        const senderRef = db.ref(`users/${senderUid}`);
        const snap = await senderRef.get();
        const userData = snap.val() || {};

        if (!userData.username) return res.status(404).json({ error: "Sender profile not found" });
        if (userData.banned || userData.isBanned) return res.status(403).json({ error: "ACCOUNT_BANNED" });
        
        const senderIsPremium = userData.isPremium || userData.premium || false;

        // --- 2. ADMIN VAULT SECURITY ---
        if (senderUid === BLOCKED_ADMIN_UID) {
            const expectedSecret = process.env.ADMIN_VERIFY_TOKEN; 
            if (!adminSecret || adminSecret !== expectedSecret) {
                return res.status(403).json({ error: "ADMIN_LOCK: Verification Token required." });
            }
        }

        // --- 3. BALANCE CHECK ---
        const currentTokens = Number(userData.tokens || 0);
        const donationAmount = Number(amount);

        if (currentTokens < donationAmount) {
            return res.status(400).json({ error: "Insufficient Balance" });
        }

        // --- 4. ANTI-FRAUD STRIKES ---
        let currentStrikes = userData.strikes || 0;
        const lastStrikeTime = userData.lastStrikeTimestamp || 0;
        // Reset strikes after 24 hours
        if (currentStrikes > 0 && (Date.now() - lastStrikeTime) > 86400000) {
            currentStrikes = 0;
        }

        // --- 5. IDENTIFY RECIPIENT ---
        let recipientOwnerUid = targetId;
        let recipientDisplayName = "User";
        let recipientDisplayAvatar = "";

        if (type === 'campaign') {
            const campSnap = await db.ref(`campaigns/${targetId}`).get();
            const campData = campSnap.val();
            if (!campData) return res.status(404).json({ error: "Campaign not found" });
            
            recipientOwnerUid = campData.creator;
            recipientDisplayName = campData.title || "Mission";
            recipientDisplayAvatar = campData.imageUrl || "";
        } else {
            const recSnap = await db.ref(`users/${targetId}`).get();
            const recData = recSnap.val() || {};
            recipientDisplayName = recData.username || "Member";
            recipientDisplayAvatar = recData.avatar || "";
        }

        // --- 6. SELF-DONATION CHECK ---
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

        // --- 7. ATOMIC FINANCIAL CALCULATIONS ---
        const netAmount = Math.floor(donationAmount * 0.7); // 70% to User/Campaign
        const feeAmount = donationAmount - netAmount;     // 30% to Admin Vault
        const updates = {};

        // SENDER: Deduct tokens
        updates[`users/${senderUid}/tokens`] = ServerValue.increment(-donationAmount);
        updates[`users/${senderUid}/totalDonated`] = ServerValue.increment(donationAmount);

        // RECIPIENT: Add tokens and build reputation
        updates[`users/${recipientOwnerUid}/tokens`] = ServerValue.increment(netAmount);
        updates[`users/${recipientOwnerUid}/totalReceivedTokens`] = ServerValue.increment(netAmount);
        updates[`users/${recipientOwnerUid}/totalEarned`] = ServerValue.increment(netAmount);
        updates[`users/${recipientOwnerUid}/donorCount`] = ServerValue.increment(1);
        updates[`users/${recipientOwnerUid}/reputation`] = ServerValue.increment(5); // Trust Points

        // CAMPAIGN LOGIC: Log specific donor info
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
                isPremium: senderIsPremium 
            };
        }

        // ADMIN: Deposit the 30% fee
        updates[`users/${BLOCKED_ADMIN_UID}/tokens`] = ServerValue.increment(feeAmount);

        // LIVE FEED: Global log for ticker/notifications
        const liveLogId = db.ref('donations').push().key;
        updates[`donations/${liveLogId}`] = {
            fromName: userData.username,
            fromAvatar: userData.avatar || "",
            fromIsPremium: senderIsPremium,
            toName: recipientDisplayName,
            toAvatar: recipientDisplayAvatar,
            amount: donationAmount,
            timestamp: ServerValue.TIMESTAMP,
            type: type
        };

        // --- 8. EXECUTE ALL UPDATES ATOMICALLY ---
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
