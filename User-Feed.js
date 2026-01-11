import { ref, onValue, get, query, limitToLast, set, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { auth, db } from './firebase-config.js';

// --- CONFIG & UTILS ---
const communityPresets = [
    "https://img.pikbest.com/origin/10/25/30/74apIkbEsT5qB.jpg!w700wp",
    "https://thumbs.dreamstime.com/b/cool-neon-party-wolf-headphones-black-background-colorful-illustration-music-theme-modern-portrait-bright-vibrant-385601082.jpg"
];

const notify = (msg) => window.notify ? window.notify(msg) : alert(msg);

// --- USER FEED ENGINE ---
window.loadUserFeed = async () => {
    const feedGrid = document.getElementById('user-feed-grid');
    if (!feedGrid) return;

    try {
        const q = query(ref(db, 'users'), limitToLast(40));
        const snapshot = await get(q);
        const data = snapshot.val();
        if (!data) return;

        feedGrid.innerHTML = '';
        Object.keys(data).forEach((uid) => {
            const card = document.createElement('div');
            card.id = `user-card-${uid}`;
            feedGrid.appendChild(card);

            onValue(ref(db, `users/${uid}`), (snap) => {
                const u = snap.val();
                if (!u) return;

                const isPro = u.isPremium || false;
                const isAdmin = uid === "YOUR_ADMIN_UID";

                card.className = `p-5 rounded-[32px] border transition-all duration-500 ${isPro ? 'border-pink-500/40 bg-pink-500/5 shadow-xl' : 'border-white/5 bg-zinc-900/40'}`;
                card.innerHTML = `
                    <div class="flex items-start gap-4">
                        <div onclick="window.openQuickProfile('${uid}')" class="relative w-16 h-16 rounded-[22px] border-2 ${isPro ? 'border-pink-500 animate-pulse' : 'border-zinc-800'} p-0.5 cursor-pointer overflow-hidden">
                            <img src="${u.avatar || communityPresets[0]}" class="w-full h-full object-cover rounded-[18px]">
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex justify-between items-center mb-1.5">
                                <div class="bg-white/5 px-2.5 py-1 rounded-xl border border-white/10 flex items-center gap-2">
                                    <span class="font-black text-[10px] text-white uppercase italic truncate max-w-[80px]">@${u.username}</span>
                                    ${isPro ? '<img src="https://img.icons8.com/color/48/verified-badge.png" class="w-3 h-3">' : ''}
                                    ${isAdmin ? '<span class="text-[7px] bg-amber-500 text-black px-1 rounded-sm font-black">STAFF</span>' : ''}
                                </div>
                                <span class="text-xs">${u.mood || '😐'}</span>
                            </div>
                            <p class="text-[9px] text-zinc-500 italic line-clamp-1 px-1">NETWORTH: ${u.tokens || 0}</p>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-2 mt-4">
                        <button onclick="handleTip('${uid}', '${u.username}')" class="py-2.5 bg-emerald-500 text-black text-[9px] font-black uppercase rounded-xl">Donate</button>
                        <button onclick="window.openQuickProfile('${uid}')" class="py-2.5 bg-white/5 text-white text-[9px] font-black uppercase rounded-xl border border-white/10">Profile</button>
                    </div>
                `;
            });
        });
    } catch (e) { console.error(e); }
};

// --- REVERSE REQUEST SUBMISSION ---
window.submitHelpRequest = async (targetUid, targetUsername) => {
    const amount = document.getElementById('req-amount').value;
    const msg = document.getElementById('req-message').value;
    if (!amount || !msg) return notify("Missing details");

    try {
        await push(ref(db, `help_requests/${targetUid}`), {
            requesterId: auth.currentUser.uid,
            requesterName: auth.currentUser.displayName || "Member",
            amountRequested: amount,
            message: msg,
            timestamp: serverTimestamp(),
            status: 'pending'
        });
        notify(`Request sent to @${targetUsername}!`);
        document.getElementById('request-overlay').remove();
    } catch (e) { notify("Error sending request"); }
};
