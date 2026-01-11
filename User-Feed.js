import { ref, onValue, get, query, limitToLast, set, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { auth, db } from './firebase-config.js';

// --- CONFIGURATION ---
const communityPresets = [
    "https://img.pikbest.com/origin/10/25/30/74apIkbEsT5qB.jpg!w700wp",
    "https://thumbs.dreamstime.com/b/cool-neon-party-wolf-headphones-black-background-colorful-illustration-music-theme-modern-portrait-bright-vibrant-385601082.jpg",
    "https://wallpapers.com/images/hd/gaming-profile-pictures-tt8bbzdcf6zibhoi.jpg"
];

const notify = (msg) => window.notify ? window.notify(msg) : alert(msg);

const toggleScroll = (lock) => {
    document.body.style.overflow = lock ? 'hidden' : '';
};

// --- 1. USER FEED ENGINE (WITH INTERVAL BANNERS & ALL BADGES) ---
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
                banner.className = "col-span-full my-6 overflow-hidden rounded-[28px] border border-white/10 shadow-2xl transition-all hover:border-white/20";
                banner.innerHTML = `<img src="https://i.imgur.com/tJgykoC.png" class="w-full h-auto object-cover block" alt="Community Banner">`;
                feedGrid.appendChild(banner);
            }

            // --- REAL-TIME USER CARD ---
            onValue(ref(db, `users/${uid}`), (snap) => {
                const u = snap.val();
                if (!u) return;

                const isPro = u.isPremium || u.premium || false;
                const isAdmin = uid === "4xEDAzSt5javvSnW5mws2Ma8i8n1"; // Replace with your actual Admin UID
                const shareUrl = encodeURIComponent(`${window.location.origin}${window.location.pathname}#profile-${uid}`);

                card.className = `p-5 rounded-[32px] border relative transition-all duration-500 hover:translate-y-[-4px] ${
                    isPro ? 'border-pink-500/40 bg-pink-500/5 shadow-[0_20px_40px_rgba(236,72,153,0.08)]' : 'border-white/5 bg-zinc-900/40'
                }`;

                card.innerHTML = `
                    <div class="flex items-start gap-4">
                        <div onclick="window.openQuickProfile('${uid}')" class="relative w-16 h-16 rounded-[22px] border-2 ${isPro ? 'border-pink-500 animate-pulse' : 'border-zinc-800'} p-0.5 flex-shrink-0 cursor-pointer overflow-hidden shadow-xl">
                            <img src="${u.avatar || communityPresets[0]}" class="w-full h-full object-cover rounded-[18px]">
                        </div>

                        <div class="flex-1 min-w-0">
                            <div class="flex justify-between items-center gap-1 mb-1.5">
                                <div class="bg-white/5 backdrop-blur-xl px-2.5 py-1 rounded-xl border border-white/10 flex items-center gap-2 max-w-full overflow-hidden">
                                    <span class="font-black text-[10px] text-white uppercase italic truncate pr-2">@${u.username || 'Member'}</span>
                                    ${isPro ? '<img src="https://img.icons8.com/color/48/verified-badge.png" class="w-3.5 h-3.5 flex-shrink-0">' : ''}
                                    ${(isPro || isAdmin) ? '<img src="https://i.imgur.com/BoVp6Td.png" class="w-4 h-4 object-contain flex-shrink-0">' : ''}
                                    ${isAdmin ? '<span class="text-[7px] bg-amber-500 text-black px-1.5 rounded-sm font-black ml-1">STAFF</span>' : ''}
                                </div>
                                <span class="text-xs">${u.mood === 'happy' ? '😊' : u.mood === 'sad' ? '😔' : '😐'}</span>
                            </div>
                            
                            <p class="text-[10px] text-zinc-400 italic line-clamp-1 mb-2 px-1">"${u.bio || 'Sharing the energy!'}"</p>
                            
                            <div class="flex items-center justify-between px-1">
                                <span class="text-[8px] bg-black/40 px-2.5 py-1 rounded-full text-zinc-500 font-bold uppercase border border-white/5">${u.country || 'Global'}</span>
                                <div class="flex items-center gap-3">
                                    <a href="https://twitter.com/intent/tweet?url=${shareUrl}" target="_blank" class="opacity-40 hover:opacity-100"><img src="https://img.icons8.com/ios-filled/50/ffffff/twitterx.png" class="w-3 h-3"></a>
                                    <a href="https://wa.me/?text=${shareUrl}" target="_blank" class="opacity-40 hover:opacity-100"><img src="https://img.icons8.com/ios-filled/50/ffffff/whatsapp.png" class="w-3 h-3"></a>
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
    } catch (e) { console.error("Feed Error:", e); }
};

// --- 2. PROFILE DOSSIER MODAL (NETWORTH & TOTAL) ---
window.openQuickProfile = async (targetUid) => {
    toggleScroll(true);
    window.location.hash = `profile-${targetUid}`;
    
    let modal = document.getElementById('quick-profile-modal') || document.createElement('div');
    modal.id = 'quick-profile-modal';
    modal.className = "fixed inset-0 z-[100] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4";
    document.body.appendChild(modal);
    modal.style.display = 'flex';
    modal.innerHTML = `<div class="animate-spin rounded-full h-12 w-12 border-t-2 border-emerald-500"></div>`;

    const snap = await get(ref(db, `users/${targetUid}`));
    const u = snap.val();

    if (u) {
        modal.innerHTML = `
            <div class="bg-zinc-950 border border-white/10 w-full max-w-[420px] rounded-[45px] overflow-hidden relative shadow-2xl animate-in zoom-in duration-300">
                <button onclick="closeQuickProfile()" class="absolute top-6 right-6 z-20 bg-black/50 text-white w-10 h-10 rounded-full border border-white/10 hover:scale-110 transition-all">&times;</button>
                
                <div class="h-36 bg-zinc-900 relative">
                    <img src="${u.banner || communityPresets[2]}" class="w-full h-full object-cover opacity-50">
                    <div class="absolute inset-0 bg-gradient-to-t from-zinc-950 to-transparent"></div>
                </div>

                <div class="px-8 pb-12 -mt-20 relative z-10 text-center">
                    <img src="${u.avatar || communityPresets[0]}" class="w-32 h-32 rounded-[40px] border-[6px] border-zinc-950 object-cover mx-auto shadow-2xl">
                    
                    <div class="mt-5 bg-white/5 backdrop-blur-xl px-5 py-2 rounded-2xl border border-white/10 inline-flex items-center gap-2">
                        <h2 class="text-2xl font-black italic text-white uppercase tracking-tighter">@${u.username}</h2>
                        ${(u.isPremium || u.premium) ? '<img src="https://i.imgur.com/BoVp6Td.png" class="w-6 h-6">' : ''}
                    </div>

                    <div class="grid grid-cols-2 gap-3 mt-8">
                        <div class="bg-white/5 p-4 rounded-[30px] border border-white/5">
                            <p class="text-[8px] text-zinc-500 font-black uppercase tracking-widest mb-1">Networth</p>
                            <p class="text-xl text-emerald-400 font-black">${u.tokens || 0}</p>
                        </div>
                        <div class="bg-white/5 p-4 rounded-[30px] border border-white/5">
                            <p class="text-[8px] text-zinc-500 font-black uppercase tracking-widest mb-1">Total</p>
                            <p class="text-xl text-white font-black">${u.totalReceivedTokens || 0}</p>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-3 mt-8">
                        <button onclick="handleTip('${targetUid}', '${u.username}', '${u.avatar}')" class="py-4.5 bg-emerald-500 text-black font-black uppercase rounded-2xl shadow-lg text-[11px] active:scale-95 transition-all">Donate</button>
                        <button onclick="window.openRequestPanel('${targetUid}', '${u.username}')" class="py-4.5 bg-white/10 text-white font-black uppercase rounded-2xl border border-white/10 text-[11px] active:scale-95 transition-all">Request</button>
                    </div>

                    <a href="profile.html?id=${targetUid}" class="block mt-8 text-[10px] font-black uppercase text-zinc-600 hover:text-white tracking-[4px] transition-all">Open Records &rarr;</a>
                </div>
            </div>
        `;
    }
};

// --- 3. REVERSE REQUEST PANEL (ASK FOR SUPPORT) ---
window.openRequestPanel = (targetUid, targetUsername) => {
    let overlay = document.getElementById('request-overlay') || document.createElement('div');
    overlay.id = 'request-overlay';
    overlay.className = "fixed inset-0 z-[150] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6";
    document.body.appendChild(overlay);

    overlay.innerHTML = `
        <div class="w-full max-w-sm text-center animate-in slide-in-from-bottom-10">
            <h3 class="text-3xl font-black text-white italic uppercase tracking-tighter">Ask for Support</h3>
            <p class="text-zinc-500 text-[10px] font-black uppercase tracking-[3px] mt-2 mb-8">Asking @${targetUsername} to donate to you</p>
            
            <div class="bg-white/5 p-8 rounded-[40px] border border-white/10 mb-4">
                <label class="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-2">Tokens Needed</label>
                <input type="number" id="req-amount" placeholder="0" class="bg-transparent text-center text-6xl font-black text-emerald-400 outline-none w-full placeholder:opacity-5">
            </div>

            <div class="bg-white/5 p-6 rounded-[30px] border border-white/10 mb-8">
                <textarea id="req-message" placeholder="Why do you need support?" class="bg-transparent w-full h-28 text-sm text-zinc-300 outline-none resize-none italic placeholder:text-zinc-800"></textarea>
            </div>

            <button onclick="window.submitHelpRequest('${targetUid}', '${targetUsername}')" class="w-full py-5 bg-emerald-500 text-black font-black uppercase rounded-[25px] shadow-2xl active:scale-95 transition-all">Submit Request</button>
            <button onclick="document.getElementById('request-overlay').remove()" class="mt-6 text-[11px] text-zinc-600 uppercase font-black tracking-widest">Cancel</button>
        </div>
    `;
};

window.submitHelpRequest = async (targetUid, targetUsername) => {
    const amount = document.getElementById('req-amount').value;
    const msg = document.getElementById('req-message').value;
    if (!amount || !msg) return notify("Please fill in all details");

    try {
        const helpRef = ref(db, `help_requests/${targetUid}`);
        await push(helpRef, {
            requesterId: auth.currentUser.uid,
            requesterName: auth.currentUser.displayName || "Member",
            amount: amount,
            message: msg,
            timestamp: serverTimestamp(),
            status: 'pending'
        });
        notify(`Success! Request sent to @${targetUsername}`);
        document.getElementById('request-overlay').remove();
    } catch (e) { notify("Submission Failed"); }
};

window.closeQuickProfile = () => {
    toggleScroll(false);
    document.getElementById('quick-profile-modal').style.display = 'none';
    window.history.replaceState(null, null, ' ');
};

// --- AUTO-RUN ---
window.addEventListener('load', () => {
    if (window.location.hash.startsWith('#profile-')) {
        const uid = window.location.hash.replace('#profile-', '');
        window.openQuickProfile(uid);
    }
});
