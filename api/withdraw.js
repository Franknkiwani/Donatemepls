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

    // Added adminSecret to the incoming request body
    const { idToken, email, amount, adminSecret } = req.body;
    
    // The account we want to protect with a secret
    const BLOCKED_ADMIN_UID = "4xEDAzSt5javvSnW5mws2Ma8i8n1"; 

    try {
        const decodedToken = await auth.verifyIdToken(idToken);
        const uid = decodedToken.uid;

        // --- THE SECRET VERIFICATION LOGIC ---
        let isAuthorizedAdmin = false;

        if (uid === BLOCKED_ADMIN_UID) {
            const expectedSecret = process.env.ADMIN_VERIFY_TOKEN;
            
            // If the secret from the prompt doesn't match Vercel, BLOCK IT
            if (!adminSecret || adminSecret !== expectedSecret) {
                return res.status(403).json({ 
                    error: "Action Denied: Valid Admin Secret Token required for this account." 
                });
            }
            // If we reach here, the admin secret was correct
            isAuthorizedAdmin = true;
        }

        const userRef = db.ref(`users/${uid}`);

        const result = await userRef.transaction((userData) => {
            if (!userData) return userData;

            const currentBalance = userData.tokens || 0;
            const withdrawable = userData.totalEarned || 0;

            // 1. CHECK PHYSICAL BALANCE
            if (currentBalance < amount) return; 
            
            // 2. THE SECURITY LOCK
            // Regular users must have "withdrawable" (earned) tokens.
            // Authorized Admin (with secret) bypasses the "earned" check to access Fees.
            if (!isAuthorizedAdmin && withdrawable < amount) {
                return; 
            }

            // 3. EXECUTE DEDUCTION
            userData.tokens = currentBalance - amount;
            
            // Admin doesn't reduce totalEarned (since it's 0), regular users do
            if (!isAuthorizedAdmin) {
                userData.totalEarned = Math.max(0, withdrawable - amount);
            }

            return userData;
        });

        if (!result.committed) {
            return res.status(400).json({ 
                error: "Security Limit: You can only withdraw earned tokens." 
            });
        }

        // 4. PAYOUT MATH
        // Admin gets full value ($0.10/token), Users get 15% fee removed ($0.085/token)
        const netUSD = isAuthorizedAdmin ? (amount / 10) : (amount / 10) * 0.85;
        const payoutId = Date.now();

        // 5. LOG TRANSACTION
        await db.ref(`payouts/${payoutId}_${uid}`).set({
            uid: uid,
            paypal: email,
            tokensRequested: amount,
            netAmount: netUSD,
            status: 'pending',
            type: isAuthorizedAdmin ? 'PLATFORM_PROFIT_WITHDRAWAL' : 'USER_EARNINGS',
            timestamp: payoutId
        });

        return res.status(200).json({ success: true, netAmount: netUSD });

    } catch (error) {
        console.error("Auth Error:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}
