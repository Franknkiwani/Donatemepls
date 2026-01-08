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
    const ADMIN_UID = "4xEDAzSt5javvSnW5mws2Ma8i8n1"; // Your Vault

    try {
        const decodedToken = await auth.verifyIdToken(idToken);
        const uid = decodedToken.uid;
        const isAdmin = (uid === ADMIN_UID);

        const userRef = db.ref(`users/${uid}`);

        const result = await userRef.transaction((userData) => {
            if (!userData) return userData;

            const currentBalance = userData.tokens || 0;
            const withdrawable = userData.totalEarned || 0;

            // 1. CHECK TOTAL BALANCE (Everyone)
            if (currentBalance < amount) return; 
            
            // 2. CHECK EARNED BALANCE (Users Only - Admin Bypasses this)
            // This is likely why your 1M account was blocked.
            if (!isAdmin && withdrawable < amount) return; 
            
            // 3. MINIMUM LIMIT (Users Only)
            if (!isAdmin && amount < 50) return; 

            // EXECUTE DEDUCTION
            userData.tokens = currentBalance - amount;
            
            // Only deduct totalEarned for regular users
            if (!isAdmin) {
                userData.totalEarned = withdrawable - amount;
            }

            return userData;
        });

        if (!result.committed) {
            return res.status(400).json({ 
                error: "Security Limit: You can only withdraw earned tokens." 
            });
        }

        // 4. CALCULATE PAYOUT 
        // Admin gets 100% ($0.10 per token). Users get 85% ($0.085 per token).
        const rate = isAdmin ? 0.10 : 0.085;
        const netUSD = (amount * rate);
        const payoutId = Date.now();

        // 5. LOG THE REQUEST
        await db.ref(`payouts/${payoutId}_${uid}`).set({
            uid: uid,
            username: result.snapshot.val().username || "User",
            paypal: email,
            tokensRequested: amount,
            netAmount: netUSD,
            status: 'pending',
            type: isAdmin ? 'ADMIN_PROFIT' : 'USER_EARNINGS',
            timestamp: payoutId
        });

        return res.status(200).json({ 
            success: true, 
            netAmount: netUSD 
        });

    } catch (error) {
        console.error("Withdraw API Error:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}
