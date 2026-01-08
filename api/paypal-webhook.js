const admin = require("firebase-admin");

export const config = {
  api: { bodyParser: true }
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    ),
    databaseURL: "https://itzhoyoo-f9f7e-default-rtdb.firebaseio.com"
  });
}

const db = admin.database();

export default async function handler(req, res) {
  // 1. Health check
  if (req.method === "GET") return res.status(200).json({ alive: true });
  if (req.method !== "POST") return res.status(405).end();

  const event = req.body;

  // 2. Identify the User (UID)
  // PayPal sends custom_id in different spots depending on the transaction type
  const uid =
    event?.resource?.custom_id || 
    event?.resource?.subscriber?.custom_id || 
    event?.resource?.amount?.custom_id;

  if (!uid) {
    console.log(`Ignored ${event.event_type}: No UID found.`);
    return res.status(200).send("No UID");
  }

  const userRef = db.ref(`users/${uid}`);

  try {
    // CASE A: Subscriptions (Monthly Plan)
    if (event.event_type === "BILLING.SUBSCRIPTION.ACTIVATED" || 
        event.event_type === "BILLING.SUBSCRIPTION.PAYMENT.COMPLETED") {
        
        await userRef.update({
          isPremium: true,
          tokens: admin.database.ServerValue.increment(20),
          lastBillingDate: new Date().toISOString()
        });
        console.log(`Subscription processed for UID: ${uid}`);
    }

    // CASE B: One-Time Token Packs
    else if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
        const amount = parseFloat(event.resource.amount.value);
        let tokensToAdd = 0;

        // Pricing logic
        if (amount >= 24.0) tokensToAdd = 250;
        else if (amount >= 9.0) tokensToAdd = 100;
        else if (amount >= 4.0) tokensToAdd = 50;
        else if (amount >= 2.5) tokensToAdd = 30;

        if (tokensToAdd > 0) {
            await userRef.update({
              tokens: admin.database.ServerValue.increment(tokensToAdd)
            });
            console.log(`Refilled ${tokensToAdd} tokens for UID: ${uid}`);
        }
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error("Webhook Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
