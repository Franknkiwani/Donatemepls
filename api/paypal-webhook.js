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
  // Browser test
  if (req.method === "GET") {
    return res.status(200).json({ alive: true });
  }

  // PayPal calls POST
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const event = req.body;

  const allowedEvents = [
    "PAYMENT.CAPTURE.COMPLETED",
    "BILLING.SUBSCRIPTION.ACTIVATED",
    "BILLING.SUBSCRIPTION.PAYMENT.COMPLETED"
  ];

  if (!allowedEvents.includes(event.event_type)) {
    return res.status(200).send("Ignored");
  }

  const uid =
    event?.resource?.custom_id ||
    event?.resource?.subscriber?.custom_id;

  if (!uid) {
    console.log("No UID in webhook");
    return res.status(200).send("No UID");
  }

  await db.ref(`users/${uid}`).update({
    isPremium: true,
    tokens: admin.database.ServerValue.increment(20),
    lastBillingDate: new Date().toISOString()
  });

  console.log(`Tokens added for user ${uid}`);
  return res.status(200).json({ success: true });
}