import { ref, onValue, get, query, limitToLast, set, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { auth, db } from './firebase-config.js';

// ... (Keep your existing communityPresets and Feed Logic from the previous block) ...

/**
 * REQUEST PANEL LOGIC
 * Triggered from the Profile Modal
 */
window.openRequestPanel = async (targetUid, targetUsername) => {
    const user = auth.currentUser;
    if (!user) return notify("Please login to send requests");
    if (user.uid === targetUid) return notify("You cannot request from yourself");

    // 1. Fetch Sender's current balance for the check
    const senderSnap = await get(ref(db, `users/${user.uid}`));
    const myBalance = senderSnap.val()?.tokens || 0;

    // 2. Create the Request Overlay
    let requestOverlay = document.getElementById('request-action-overlay');
    if (!requestOverlay) {
        requestOverlay = document.createElement('div');
        requestOverlay.id = 'request-action-overlay';
        requestOverlay.className = "fixed inset-0 z-[120] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-6 transition-all duration-300";
        document.body.appendChild(requestOverlay);
    }

    requestOverlay.innerHTML = `
        <div class="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div class="text-center mb-8">
                <h3 class="text-3xl font-black text-white italic uppercase tracking-tighter">Submit Request</h3>
                <p class="text-emerald-500 text-[10px] font-black uppercase tracking-[3px] mt-2">To @${targetUsername}</p>
            </div>

            <div class="space-y-4">
                <div class="bg-white/5 p-6 rounded-[32px] border border-white/10 text-center">
                    <label class="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-2">Offer Amount (Tokens)</label>
                    <input type="number" id="req-amount" placeholder="0" 
                        class="bg-transparent text-center text-5xl font-black text-white outline-none w-full placeholder:opacity-20">
                    <p class="text-[10px] text-zinc-500 mt-4 font-bold uppercase">Your Balance: <span class="text-white">${myBalance}</span></p>
                </div>

                <div class="bg-white/5 p-5 rounded-[28px] border border-white/10">
                    <textarea id="req-message" placeholder="What are you requesting? (e.g. Custom Shoutout, Gaming Duo...)" 
                        class="bg-transparent w-full h-24 text-sm text-zinc-300 outline-none resize-none placeholder:text-zinc-700 italic"></textarea>
                </div>
            </div>

            <div class="mt-8 space-y-3">
                <button onclick="submitRequestToFirebase('${targetUid}', '${targetUsername}', ${myBalance})" 
                    class="w-full py-5 bg-white text-black font-black uppercase rounded-[24px] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all">
                    Send Request
                </button>
                <button onclick="document.getElementById('request-action-overlay').remove()" 
                    class="w-full py-4 text-[10px] text-zinc-500 font-black uppercase tracking-widest hover:text-white transition-colors">
                    Cancel Process
                </button>
            </div>

            <p class="text-[8px] text-zinc-700 text-center mt-6 uppercase leading-relaxed px-10">
                Note: Tokens are not deducted until the creator accepts your request.
            </p>
        </div>
    `;
};

/**
 * FIREBASE SUBMISSION
 * Saves the request to the database
 */
window.submitRequestToFirebase = async (targetUid, targetUsername, currentBalance) => {
    const amount = parseFloat(document.getElementById('req-amount').value);
    const message = document.getElementById('req-message').value.trim();
    const sender = auth.currentUser;

    if (!amount || amount <= 0) return notify("Please enter a valid amount");
    if (!message) return notify("Please describe your request");
    
    // Safety check
    if (amount > currentBalance) {
        return notify(`Insufficient Tokens. You need ${amount - currentBalance} more.`);
    }

    try {
        const requestRef = ref(db, `requests/${targetUid}`);
        const newRequestRef = push(requestRef);
        
        await set(newRequestRef, {
            fromId: sender.uid,
            fromName: sender.displayName || "Member",
            amount: amount,
            message: message,
            status: 'pending',
            timestamp: serverTimestamp()
        });

        notify(`Success! Your request has been sent to @${targetUsername}`);
        document.getElementById('request-action-overlay').remove();
        
    } catch (e) {
        console.error(e);
        notify("Failed to send request. Try again.");
    }
};
