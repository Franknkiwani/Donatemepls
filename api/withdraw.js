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
    const ADMIN_UID = "4xEDAzSt5javvSnW5mws2Ma8i8n1"; // THE FEE VAULT

    try {
        const decodedToken = await auth.verifyIdToken(idToken);
        const uid = decodedToken.uid;
        const isAdmin = (uid === ADMIN_UID);

        const userRef = db.ref(`users/${uid}`);

        const result = await userRef.transaction((userData) => {
            if (!userData) return userData;

            const currentBalance = userData.tokens || 0;
            const withdrawable = userData.totalEarned || 0;

            // 1. CHECK PHYSICAL BALANCE (Everyone must have the tokens)
            if (currentBalance < amount) return; 
            
            // 2. THE SECURITY LOCK
            // Regular users: Must have "Earned" tokens.
            // Admin: Bypasses this because your money comes from Fees.
            if (!isAdmin && withdrawable < amount) {
                return; // This triggers the "Action Denied" on frontend
            }

            // 3. EXECUTE DEDUCTION
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

        // 4. PAYOUT MATH
        // Admin: 1 Token = $0.10 (No Fee)
        // User: 1 Token = $0.085 (15% Fee)
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
        return res.status(500).json({ error: "Internal Server Error" });
    }
}
