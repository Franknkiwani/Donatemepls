import { ref, onValue, get, query, limitToLast, set, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { auth, db } from './firebase-config.js';

// --- CONFIGURATION ---
const communityPresets = [
    "https://img.pikbest.com/origin/10/25/30/74apIkbEsT5qB.jpg!w700wp",
    "https://thumbs.dreamstime.com/b/cool-neon-party-wolf-headphones-black-background-colorful-illustration-music-theme-modern-portrait-bright-vibrant-385601082.jpg"
];

const notify = (msg) => window.notify ? window.notify(msg) : alert(msg);

// --- 1. USER FEED ENGINE (WITH BANNERS & FULL BADGES) ---
window.loadUserFeed = async () => {
    const feedGrid = document.getElementById('user-feed-grid');
    if (!feedGrid) return;

    try {
        const q = query(ref(db, 'users'), limitToLast(40));
        const snapshot = await get(q);
        const data = snapshot.val();
        if (!data) return;

        feedGrid.innerHTML = '';
        const shuffledUids = Object.keys(data).sort(() => Math.random() - 0.5);

        shuffledUids.forEach((uid, index) => {
            const userPos = index + 1;
            const card = document.createElement('div');
            card.id = `user-card-${uid}`;
            feedGrid.appendChild(card);

            // --- INTERVAL BANNERS (3, 8, 16) ---
            if ([3, 8, 16].includes(userPos)) {
                const banner = document.createElement('div');
                banner.className = "col-span-full my-6 overflow-hidden rounded-[28px] border border-white/10 shadow-2xl";
                banner.innerHTML = `<img src="https://i.imgur.com/tJgykoC.png" class="w-full h-auto object-cover block">`;
                feedGrid.appendChild(banner);
            }

            // --- REAL-TIME DATA LISTENER ---
            onValue(ref(db, `users/${uid}`), (snap) => {
                const u = snap.val();
                if (!u) return;

                const isPro = u.isPremium || u.premium || false;
                const isAdmin = uid === "4xEDAzSt5javvSnW5mws2Ma8i8n1"; 
                const shareUrl = encodeURIComponent(`${window.location.origin}${window.location.pathname}#profile-${uid}`);

                card.className = `p-5 rounded-[32px] border relative transition-all duration-500 hover:translate-y-[-4px] ${
                    isPro ? 'border-pink-500/40 bg-pink-500/5 shadow-xl' : 'border-white/5 bg-zinc-900/40'
                }`;

                card.innerHTML = `
                    <div class="flex items-start gap-4">
                        <div onclick="window.openQuickProfile('${uid}')" class="relative w-16 h-16 rounded-[22px] border-2 ${isPro ? 'border-pink-500 animate-pulse' : 'border-zinc-800'} p-0.5 flex-shrink-0 cursor-pointer overflow-hidden">
                            <img src="${u.avatar || communityPresets[0]}" class="w-full h-full object-cover rounded-[18px]">
                        </div>

                        <div class="flex-1 min-w-0">
                            <div class="flex justify-between items-center gap-1 mb-1.5">
                                <div class="bg-white/5 backdrop-blur-xl px-2.5 py-1 rounded-xl border border-white/10 flex items-center gap-2 max-w-full overflow-hidden">
                                    <span class="font-black text-[10px] text-white uppercase italic truncate pr-2">@${u.username || 'Member'}</span>
                                    ${isPro ? '<img src="https://img.icons8.com/color/48/verified-badge.png" class="w-3.5 h-3.5">' : ''}
                                    ${isAdmin ? '<span class="text-[7px] bg-amber-500 text-black px-1.5 rounded-sm font-black">STAFF</span>' : ''}
                                </div>
                                <span class="text-xs">${u.mood === 'happy' ? '😊' : '😐'}</span>
                            </div>
                            
                            <p class="text-[10px] text-emerald-400 font-black tracking-tighter uppercase mb-2 px-1">NETWORTH: ${u.tokens || 0}</p>
                            
                            <div class="flex items-center justify-between px-1">
                                <span class="text-[8px] bg-black/40 px-2.5 py-1 rounded-full text-zinc-500 font-bold uppercase border border-white/5">${u.country || 'Global'}</span>
                                <div class="flex items-center gap-3">
                                    <a href="https://twitter.com/intent/tweet?url=${shareUrl}" target="_blank" class="opacity-40 hover:opacity-100 transition-all"><img src="https://img.icons8.com/ios-filled/50/ffffff/twitterx.png" class="w-3 h-3"></a>
                                    <a href="https://wa.me/?text=${shareUrl}" target="_blank" class="opacity-40 hover:opacity-100 transition-all"><img src="https://img.icons8.com/ios-filled/50/ffffff/whatsapp.png" class="w-3 h-3"></a>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-2.5 mt-5">
                        <button onclick="handleTip('${uid}', '${u.username}', '${u.avatar}')" class="py-3 ${isPro ? 'bg-pink-600' : 'bg-emerald-500'} text-black text-[10px] font-black uppercase rounded-2xl shadow-lg active:scale-95 transition-all">Donate</button>
                        <button onclick="window.openQuickProfile('${uid}')" class="py-3 bg-white/5 text-white text-[10px] font-black uppercase rounded-2xl border border-white/10 active:scale-95 transition-all">Profile</button>
                    </div>
                `;
            });
        });
    } catch (e) { console.error(e); }
};

// --- 2. NOTIFICATION SYSTEM (INCOMING REQUESTS GLOW) ---
window.initInboxObserver = () => {
    auth.onAuthStateChanged((user) => {
        if (!user) return;
        const helpRef = ref(db, `help_requests/${user.uid}`);
        onValue(helpRef, (snap) => {
            const requests = snap.val();
            const dot = document.getElementById('notif-dot');
            if (requests && dot) {
                const pending = Object.values(requests).some(r => r.status === 'pending');
                pending ? dot.classList.remove('hidden') : dot.classList.add('hidden');
            }
        });
    });
};

// --- 3. REVERSE REQUEST PANEL (ASK FOR SUPPORT) ---
window.openRequestPanel = (targetUid, targetUsername) => {
    let overlay = document.getElementById('request-overlay') || document.createElement('div');
    overlay.id = 'request-overlay';
    overlay.className = "fixed inset-0 z-[150] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6";
    document.body.appendChild(overlay);

    overlay.innerHTML = `
        <div class="w-full max-w-sm text-center animate-in zoom-in duration-300">
            <h3 class="text-3xl font-black text-white italic uppercase tracking-tighter">Ask Support</h3>
            <p class="text-zinc-500 text-[10px] font-black uppercase tracking-[3px] mt-2 mb-8">Asking @${targetUsername} to donate</p>
            
            <div class="bg-white/5 p-8 rounded-[40px] border border-white/10 mb-4">
                <input type="number" id="req-amount" placeholder="0" class="bg-transparent text-center text-6xl font-black text-emerald-400 outline-none w-full">
                <p class="text-[8px] text-zinc-500 uppercase mt-2 font-black">Requested Tokens</p>
            </div>

            <div class="bg-white/5 p-6 rounded-[30px] border border-white/10 mb-8">
                <textarea id="req-message" placeholder="Reason..." class="bg-transparent w-full h-24 text-sm text-zinc-300 outline-none resize-none italic"></textarea>
            </div>

            <button onclick="window.submitHelpRequest('${targetUid}', '${targetUsername}')" class="w-full py-5 bg-emerald-500 text-black font-black uppercase rounded-[25px] shadow-2xl">Submit Request</button>
            <button onclick="document.getElementById('request-overlay').remove()" class="mt-6 text-[10px] text-zinc-600 uppercase font-black">Cancel</button>
        </div>
    `;
};

window.submitHelpRequest = async (targetUid, targetUsername) => {
    const amount = document.getElementById('req-amount').value;
    const msg = document.getElementById('req-message').value;
    if (!amount || !msg) return notify("Missing info");

    try {
        await push(ref(db, `help_requests/${targetUid}`), {
            requesterId: auth.currentUser.uid,
            requesterName: auth.currentUser.displayName || "Member",
            amount: amount,
            message: msg,
            timestamp: serverTimestamp(),
            status: 'pending'
        });
        notify(`Request sent to @${targetUsername}`);
        document.getElementById('request-overlay').remove();
    } catch (e) { notify("Error"); }
};

// --- INITIALIZE ---
window.addEventListener('load', () => {
    window.loadUserFeed();
    window.initInboxObserver();
});
