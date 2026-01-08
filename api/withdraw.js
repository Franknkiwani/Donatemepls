import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
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
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { idToken, email, amount } = req.body;
    
    // THE UID YOU WANT TO BLOCK
    const BLOCKED_UID = "4xEDAzSt5javvSnW5mws2Ma8i8n1"; 
    // If you ever want a DIFFERENT admin to work, put their ID here:
    const ACTIVE_ADMIN_UID = "NEW_ADMIN_UID_HERE"; 

    try {
        const decodedToken = await auth.verifyIdToken(idToken);
        const uid = decodedToken.uid;

        // --- HARD BLOCK CHECK ---
        // If the user is the blocked UID, stop immediately.
        if (uid === BLOCKED_UID) {
            return res.status(403).json({ 
                error: "Withdrawals are disabled for this specific Admin/User account." 
            });
        }

        const isAdmin = (uid === ACTIVE_ADMIN_UID);
        const userRef = db.ref(`users/${uid}`);

        const result = await userRef.transaction((userData) => {
            if (!userData) return userData;

            const currentBalance = userData.tokens || 0;
            const withdrawable = userData.totalEarned || 0;

            // 1. CHECK PHYSICAL BALANCE
            if (currentBalance < amount) return; 
            
            // 2. THE SECURITY LOCK
            // Everyone (including the blocked UID if they got past the first check)
            // must now follow the "Earned" rule unless they match ACTIVE_ADMIN_UID.
            if (!isAdmin && withdrawable < amount) {
                return; 
            }

            // 3. EXECUTE DEDUCTION
            userData.tokens = currentBalance - amount;
            
            if (!isAdmin) {
                userData.totalEarned = withdrawable - amount;
            }

            return userData;
        });

        if (!result.committed) {
            return res.status(400).json({ 
                error: "Security Limit: Insufficient earned balance." 
            });
        }

        // 4. PAYOUT MATH
        const netUSD = isAdmin ? (amount / 10) : (amount / 10) * 0.85;
        const payoutId = Date.now();

        // 5. LOG TRANSACTION
        await db.ref(`payouts/${payoutId}_${uid}`).set({
            uid: uid,
            paypal: email,
            tokensRequested: amount,
            netAmount: netUSD,
            status: 'pending',
            type: isAdmin ? 'PLATFORM_PROFIT_WITHDRAWAL' : 'USER_EARNINGS',
            timestamp: payoutId
        });

        return res.status(200).json({ success: true, netAmount: netUSD });

    } catch (error) {
        console.error("Auth Error:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}
