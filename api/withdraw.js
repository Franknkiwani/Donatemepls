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
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { idToken, email, amount, adminSecret } = req.body;
    const BLOCKED_ADMIN_UID = "4xEDAzSt5javvSnW5mws2Ma8i8n1"; 

    try {
        // 2. Verify Identity
        const decodedToken = await auth.verifyIdToken(idToken);
        const uid = decodedToken.uid;

        // 3. Admin & Security Check
        const isAuthorizedAdmin = (uid === BLOCKED_ADMIN_UID && adminSecret === process.env.ADMIN_VERIFY_TOKEN);

        // --- STEP A: PARALLEL AUDIT (Fast Path) ---
        // We check the AI and the Database at the same time to prevent Vercel Timeouts
        const auditPromise = fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { 
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, 
                "Content-Type": "application/json" 
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: "You are a fraud detector. Respond PASS or BLOCK." },
                    { role: "user", content: `User ${uid} withdrawing ${amount} tokens. Rules: Block if amount > 10000.` }
                ],
                max_tokens: 5,
                temperature: 0
            })
        }).then(r => r.json()).catch(() => ({ choices: [{ message: { content: "PASS" } }] }));

        const userRef = db.ref(`users/${uid}`);
        const [auditData, userSnap] = await Promise.all([auditPromise, userRef.get()]);

        // --- STEP B: AI DECISION ---
        const aiDecision = auditData.choices?.[0]?.message?.content || "PASS";
        if (aiDecision.includes("BLOCK") && !isAuthorizedAdmin) {
            // Auto-ban high-risk scammers
            await userRef.update({ isBanned: true, banReason: "AI Fraud Detection" });
            return res.status(403).json({ error: "Security Alert: Unusual activity detected. Account locked." });
        }

        // --- STEP C: TRANSACTION LOGIC ---
        const result = await userRef.transaction((userData) => {
            if (!userData || userData.isBanned) return; 

            const currentBalance = userData.tokens || 0;
            const withdrawable = userData.totalEarned || 0;

            // Enforce Balance
            if (currentBalance < amount) return; 
            
            // Regular users must have earned the tokens; Admin bypasses for platform fees
            if (!isAuthorizedAdmin && withdrawable < amount) return; 

            // Execute Deduction
            userData.tokens = currentBalance - amount;
            if (!isAuthorizedAdmin) {
                userData.totalEarned = Math.max(0, withdrawable - amount);
            }
            return userData;
        });

        if (!result.committed) {
            return res.status(400).json({ error: "Insufficient or restricted funds." });
        }

        // --- STEP D: PAYOUT LOGGING ---
        const netUSD = isAuthorizedAdmin ? (amount / 10) : (amount / 10) * 0.85;
        const payoutId = Date.now();

        await db.ref(`payouts/${payoutId}_${uid}`).set({
            uid: uid,
            paypal: email,
            tokensRequested: amount,
            netAmount: netUSD,
            status: 'pending',
            type: isAuthorizedAdmin ? 'PLATFORM_FEE_WITHDRAWAL' : 'USER_EARNINGS',
            timestamp: payoutId,
            aiVerified: true
        });

        return res.status(200).json({ success: true, netAmount: netUSD });

    } catch (error) {
        console.error("Critical Error:", error.message);
        // ALWAYS return JSON to prevent the "Unexpected Token A" error
        return res.status(500).json({ error: "Security bridge busy. Try again in 10s." });
    }
}
