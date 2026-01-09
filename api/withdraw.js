import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin
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

    const { idToken, email, amount, adminSecret } = req.body;
    const BLOCKED_ADMIN_UID = "4xEDAzSt5javvSnW5mws2Ma8i8n1"; 

    try {
        // --- AUTH VERIFICATION ---
        const decodedToken = await auth.verifyIdToken(idToken);
        const uid = decodedToken.uid;
        
        // Check if requester is the specific Admin and provided the correct ENV secret
        const isAuthorizedAdmin = (uid === BLOCKED_ADMIN_UID && adminSecret === process.env.ADMIN_VERIFY_TOKEN);

        // --- STEP 1: FETCH DAILY LIMIT STATS ---
        const today = new Date().toISOString().split('T')[0]; 
        const dailyRef = db.ref(`stats/daily_withdrawals/${today}/${uid}`);
        const dailySnap = await dailyRef.get();
        const currentDailyTotal = Number(dailySnap.val() || 0);
        const newDailyTotal = currentDailyTotal + Number(amount);

        // --- STEP 2: AI FRAUD AUDIT (GROQ) ---
        const auditPromise = fetch("https://api.groq.com/openai/v1/chat/completions", {
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
                        content: "Respond ONLY with 'PASS', 'FLAG', or 'BLOCK'." 
                    },
                    { 
                        role: "user", 
                        content: `UID: ${uid}, Request: ${amount}, DailyTotal: ${newDailyTotal}. Rules: FLAG if amount > 10000. BLOCK if DailyTotal > 50000.` 
                    }
                ],
                max_tokens: 5,
                temperature: 0
            })
        }).then(r => r.json()).catch(() => ({ choices: [{ message: { content: "PASS" } }] }));

        const userRef = db.ref(`users/${uid}`);
        const [auditData] = await Promise.all([auditPromise]);

        const aiDecision = auditData.choices?.[0]?.message?.content || "PASS";
        let finalStatus = 'pending';
        let reviewRequired = false;

        // --- STEP 3: HANDLE AI DECISION ---
        if (!isAuthorizedAdmin) {
            if (aiDecision.includes("BLOCK")) {
                await userRef.update({ isBanned: true, banReason: "AI Anti-Drain Trigger" });
                return res.status(403).json({ error: "Security Alert: Account locked for review." });
            }
            if (aiDecision.includes("FLAG")) {
                finalStatus = 'awaiting_manual_review';
                reviewRequired = true;
            }
        }

        // --- STEP 4: DATABASE TRANSACTION (CRITICAL FIX) ---
        const transactionResult = await userRef.transaction((userData) => {
            if (userData === null) return userData;
            if (userData.isBanned) return;

            const bal = Number(userData.tokens || 0);
            const reqAmt = Number(amount);

            // Basic Balance Check
            if (bal < reqAmt) return; 

            // Deduct tokens
            userData.tokens = bal - reqAmt;

            // Update totalEarned ONLY if it exists and user is not admin
            if (!isAuthorizedAdmin && userData.totalEarned) {
                userData.totalEarned = Math.max(0, Number(userData.totalEarned) - reqAmt);
            }
            
            return userData;
        });

        if (!transactionResult.committed) {
            return res.status(400).json({ error: "Insufficient balance or transaction failed." });
        }

        // --- STEP 5: LOGGING & STATS ---
        // 15% Fee applied here (0.85 multiplier)
        const netUSD = isAuthorizedAdmin ? (amount / 10) : (amount / 10) * 0.85;
        const payoutId = Date.now();

        await dailyRef.set(newDailyTotal);

        await db.ref(`payouts/${payoutId}_${uid}`).set({
            uid,
            paypal: email,
            tokensRequested: amount,
            netAmount: netUSD,
            status: finalStatus,
            review_required: reviewRequired,
            ai_judgment: aiDecision,
            timestamp: payoutId
        });

        return res.status(200).json({ 
            success: true, 
            netAmount: netUSD,
            review: reviewRequired,
            message: reviewRequired ? "Flagged for manual review." : "Payout submitted successfully."
        });

    } catch (e) {
        console.error("Critical Error:", e);
        return res.status(500).json({ error: "Server Error: Security Bridge Offline" });
    }
}
