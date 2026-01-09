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

    const { idToken, email, amount, adminSecret } = req.body;
    const BLOCKED_ADMIN_UID = "4xEDAzSt5javvSnW5mws2Ma8i8n1"; 

    try {
        const decodedToken = await auth.verifyIdToken(idToken);
        const uid = decodedToken.uid;
        const isAuthorizedAdmin = (uid === BLOCKED_ADMIN_UID && adminSecret === process.env.ADMIN_VERIFY_TOKEN);

        // --- STEP 1: PARALLEL AI AUDIT ---
        const auditPromise = fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [{ role: "system", content: "Respond ONLY 'PASS' or 'BLOCK'." },
                           { role: "user", content: `Audit: UID ${uid}, Amt ${amount}` }],
                max_tokens: 5
            })
        }).then(r => r.json()).catch(() => ({ choices: [{ message: { content: "PASS" } }] }));

        const userRef = db.ref(`users/${uid}`);
        const [auditData] = await Promise.all([auditPromise]);

        if (auditData.choices?.[0]?.message?.content.includes("BLOCK") && !isAuthorizedAdmin) {
            return res.status(403).json({ error: "Security Alert: Transaction blocked by AI." });
        }

        // --- STEP 2: TRANSACTION (The Fix) ---
        const result = await userRef.transaction((userData) => {
            if (userData === null) return userData; // Important: Tell Firebase to retry
            if (userData.isBanned) return;

            const bal = Number(userData.tokens || 0);
            const earned = Number(userData.totalEarned || 0);
            const reqAmt = Number(amount);

            if (bal < reqAmt) return; // Not enough total tokens
            if (!isAuthorizedAdmin && earned < reqAmt) return; // Not enough EARNED tokens

            userData.tokens = bal - reqAmt;
            if (!isAuthorizedAdmin) userData.totalEarned = Math.max(0, earned - reqAmt);
            return userData;
        });

        if (!result.committed) return res.status(400).json({ error: "Insufficient or restricted funds." });

        const netUSD = isAuthorizedAdmin ? (amount / 10) : (amount / 10) * 0.85;
        const payoutId = Date.now();
        await db.ref(`payouts/${payoutId}_${uid}`).set({
            uid, paypal: email, tokensRequested: amount, netAmount: netUSD, status: 'pending', timestamp: payoutId
        });

        return res.status(200).json({ success: true, netAmount: netUSD });
    } catch (e) {
        return res.status(500).json({ error: "Security Bridge Error" });
    }
}
