import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { getAuth } from 'firebase-admin/auth';

// 1. Initialize Firebase Admin
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
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { idToken, email, amount } = req.body;

    try {
        // 2. Security: Verify who is making the request
        const decodedToken = await auth.verifyIdToken(idToken);
        const uid = decodedToken.uid;

        const userRef = db.ref(`users/${uid}`);

        // 3. ATOMIC TRANSACTION: Locks the user record during the check
        const result = await userRef.transaction((userData) => {
            if (!userData) return userData;

            const currentBalance = userData.tokens || 0;
            const withdrawable = userData.totalEarned || 0;

            // --- SAFETY CHECKS ---
            // A. Check if they have enough tokens total
            if (currentBalance < amount) return; 
            
            // B. Check if they have enough "Earned" tokens (Safety Net)
            if (withdrawable < amount) return; 
            
            // C. Enforce minimum limit
            if (amount < 50) return; 

            // --- EXECUTE DEDUCTION ---
            userData.tokens = currentBalance - amount;
            userData.totalEarned = withdrawable - amount;

            return userData;
        });

        // If the transaction returned 'undefined', it means a safety check failed
        if (!result.committed) {
            return res.status(400).json({ 
                error: "Insufficient earned balance or withdrawal limit not met." 
            });
        }

        // 4. CALCULATE PAYOUT (15% Platform Fee)
        // Tokens / 10 = USD Gross. USD Gross * 0.85 = Net to user.
        const netUSD = (amount / 10) * 0.85;
        const payoutId = Date.now();

        // 5. LOG THE REQUEST FOR ADMIN APPROVAL
        // This creates a record you can check before actually sending money on PayPal
        await db.ref(`payouts/${payoutId}_${uid}`).set({
            uid: uid,
            username: result.snapshot.val().username || "User",
            paypal: email,
            tokensRequested: amount,
            netAmount: netUSD,
            status: 'pending', // You will change this to 'paid' manually in your DB
            timestamp: payoutId
        });

        // 6. Return success to the frontend
        return res.status(200).json({ 
            success: true, 
            netAmount: netUSD 
        });

    } catch (error) {
        console.error("Withdraw API Error:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}
