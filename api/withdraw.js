import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase (Keep your existing config)
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

    const { idToken, email, amount, adminSecret } = req.body;
    const BLOCKED_ADMIN_UID = "4xEDAzSt5javvSnW5mws2Ma8i8n1"; 

    try {
        const decodedToken = await auth.verifyIdToken(idToken);
        const uid = decodedToken.uid;
        let isAuthorizedAdmin = (uid === BLOCKED_ADMIN_UID && adminSecret === process.env.ADMIN_VERIFY_TOKEN);

        // --- NEW: GROQ FRAUD AUDIT ---
        // 1. Fetch recent activity for this user from Firebase to check velocity
        const recentPayoutsSnap = await db.ref('payouts')
            .orderByChild('uid')
            .equalTo(uid)
            .limitToLast(5) // Get last 5 withdrawals
            .get();
        
        const recentActivity = recentPayoutsSnap.val() || {};
        const withdrawalCount = Object.keys(recentActivity).length;

        // 2. Call Groq to judge the risk
        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                  { 
                    role: "system", 
                    content: "You are a financial fraud auditor. Analyze transaction patterns. Respond ONLY with 'BLOCK' or 'PASS'." 
                  },
                  { 
                    role: "user", 
                    content: `User: ${uid}, Amount: ${amount} tokens, Recent Withdrawals: ${withdrawalCount}. 
                              Rules: Block if amount > 5000 tokens OR if withdrawalCount > 3 in one session.` 
                  }
                ]
            })
        });

        const auditData = await groqResponse.json();
        const decision = auditData.choices[0].message.content.trim();

        if (decision.includes("BLOCK") && !isAuthorizedAdmin) {
            // Auto-ban user in Firebase if AI detects high-risk fraud
            await db.ref(`users/${uid}`).update({ isBanned: true, banReason: "AI Fraud Detection: High Velocity/Amount" });
            return res.status(403).json({ error: "Security Alert: Unusual activity detected. Account suspended for review." });
        }

        // --- PROCEED WITH TRANSACTION (Your existing logic) ---
        const userRef = db.ref(`users/${uid}`);
        const result = await userRef.transaction((userData) => {
            if (!userData || userData.isBanned) return; // Prevent banned users from withdrawing
            
            const currentBalance = userData.tokens || 0;
            const withdrawable = userData.totalEarned || 0;

            if (currentBalance < amount) return; 
            if (!isAuthorizedAdmin && withdrawable < amount) return; 

            userData.tokens = currentBalance - amount;
            if (!isAuthorizedAdmin) userData.totalEarned = Math.max(0, withdrawable - amount);
            
            return userData;
        });

        if (!result.committed) return res.status(400).json({ error: "Transaction Failed: Insufficient or Locked Funds." });

        const netUSD = isAuthorizedAdmin ? (amount / 10) : (amount / 10) * 0.85;
        const payoutId = Date.now();

        await db.ref(`payouts/${payoutId}_${uid}`).set({
            uid, paypal: email, tokensRequested: amount, netAmount: netUSD,
            status: 'pending', type: isAuthorizedAdmin ? 'PLATFORM_PROFIT' : 'USER_EARNINGS',
            timestamp: payoutId, aiVerified: true
        });

        return res.status(200).json({ success: true, netAmount: netUSD });

    } catch (error) {
        console.error("Critical Error:", error);
        return res.status(500).json({ error: "Security Bridge Offline" });
    }
}
