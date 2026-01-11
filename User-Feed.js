import { ref, onValue, get, query, limitToLast, set, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { auth, db } from './firebase-config.js';

const communityPresets = [
    "https://img.pikbest.com/origin/10/25/30/74apIkbEsT5qB.jpg!w700wp",
    "https://thumbs.dreamstime.com/b/cool-neon-party-wolf-headphones-black-background-colorful-illustration-music-theme-modern-portrait-bright-vibrant-385601082.jpg",
    "https://wallpapers.com/images/hd/gaming-profile-pictures-tt8bbzdcf6zibhoi.jpg"
];

let activeListeners = [];

const notify = (msg) => {
    if (window.showErrorModal) window.showErrorModal(msg);
    else if (window.notify) window.notify(msg);
    else alert(msg);
};

const toggleScroll = (lock) => {
    document.body.style.overflow = lock ? 'hidden' : '';
};

// --- 1. DEEP LINKING (Direct Access via URL) ---
window.addEventListener('load', () => {
    if (window.location.hash.startsWith('#profile-')) {
        const uid = window.location.hash.replace('#profile-', '');
        window.openQuickProfile(uid);
    }
});

// --- 2. USER FEED ENGINE (Full Design Restored) ---
window.loadUserFeed = async () => {
    const feedGrid = document.getElementById('user-feed-grid');
    if (!feedGrid) return;

    activeListeners.forEach(unsub => unsub());
    activeListeners = [];

    try {
        const q = query(ref(db, 'users'), limitToLast(40));
        const snapshot = await get(q);
        const data = snapshot.val();
        if (!data) return;

        feedGrid.innerHTML = '';
        const shuffledUids = Object.keys(data).sort(() => Math.random() - 0.5);

        shuffledUids.forEach((uid, index) => {
            const card = document.createElement('div');
            card.id = `user-card-${uid}`;
            feedGrid.appendChild(card);

            // Banners at 3, 8, 16
            if ([3, 8, 16].includes(index + 1)) {
                const banner = document.createElement('div');
                banner.className = "col-span-full my-6 overflow-hidden rounded-[28px] border border-white/10 shadow-2xl";
                banner.innerHTML = `<img src="https://i.imgur.com/tJgykoC.png" class="w-full h-auto object-cover block">`;
                feedGrid.appendChild(banner);
            }

            const unsubscribe = onValue(ref(db, `users/${uid}`), (userSnap) => {
                const u = userSnap.val();
                if (!u) return;

                const isPro = u.isPremium || u.premium || false;
                const isAdmin = uid === "4xEDAzSt5javvSnW5mws2Ma8i8n1";
                const shareUrl = encodeURIComponent(`${window.location.origin}${window.location.pathname}#profile-${uid}`);
                const shareText = encodeURIComponent(`Check out @${u.username}!`);

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
                                <div class="bg-white/5 backdrop-blur-xl px-2.5 py-1 rounded-xl border border-white/10 flex items-center gap-2 max-w-full">
                                    <span class="font-black text-[10px] text-white uppercase italic truncate pr-2">@${u.username || 'Member'}</span>
                                    ${isPro ? '<img src="https://img.icons8.com/color/48/verified-badge.png" class="w-3.5 h-3.5">' : ''}
                                    ${isAdmin ? '<span class="text-[7px] bg-amber-500 text-black px-1.5 rounded-sm font-black">STAFF</span>' : ''}
                                </div>
                                <span class="text-xs">${u.mood === 'happy' ? '😊' : '😐'}</span>
                            </div>
                            <p class="text-[10px] text-zinc-400 italic line-clamp-1 mb-3 px-1">"${u.bio || 'Digital Nomad'}"</p>
                            <div class="flex items-center justify-between px-1">
                                <span class="text-[8px] bg-black/40 px-2 py-0.5 rounded-full text-zinc-500 font-bold uppercase border border-white/5">${u.country || 'Global'}</span>
                                <div class="flex items-center gap-3">
                                    <a href="https://twitter.com/intent/tweet?url=${shareUrl}" target="_blank" class="opacity-40 hover:opacity-100"><img src="https://img.icons8.com/ios-filled/50/ffffff/twitterx.png" class="w-3 h-3"></a>
                                    <a href="https://wa.me/?text=${shareUrl}" target="_blank" class="opacity-40 hover:opacity-100"><img src="https://img.icons8.com/ios-filled/50/ffffff/whatsapp.png" class="w-3 h-3"></a>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-2.5 mt-5">
                        <button onclick="handleTip('${uid}', '${u.username}', '${u.avatar}')" class="py-3 ${isPro ? 'bg-pink-600' : 'bg-emerald-500'} text-black text-[10px] font-black uppercase rounded-2xl">Donate</button>
                        <button onclick="window.openQuickProfile('${uid}')" class="py-3 bg-white/5 text-white text-[10px] font-black uppercase rounded-2xl border border-white/10">Profile</button>
                    </div>
                `;
            });
            activeListeners.push(unsubscribe);
        });
    } catch (e) { console.error(e); }
};

// --- 3. QUICK PROFILE MODAL (YouTube Style + Net Worth) ---
window.openQuickProfile = async (targetUid) => {
    toggleScroll(true);
    window.location.hash = `profile-${targetUid}`;
    let modal = document.getElementById('quick-profile-modal') || document.createElement('div');
    modal.id = 'quick-profile-modal';
    modal.className = "fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4";
    document.body.appendChild(modal);
    modal.style.display = 'flex';
    modal.innerHTML = `<div class="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500"></div>`;

    const snap = await get(ref(db, `users/${targetUid}`));
    const u = snap.val();

    if (u) {
        modal.innerHTML = `
            <div class="bg-zinc-950 border border-white/10 w-full max-w-[420px] rounded-[45px] overflow-hidden relative shadow-2xl animate-in zoom-in">
                <button onclick="closeQuickProfile()" class="absolute top-5 right-5 z-20 bg-black/60 text-white w-10 h-10 rounded-full border border-white/10">&times;</button>
                <div class="h-36 bg-zinc-900 relative">
                    <img src="${u.banner || communityPresets[1]}" class="w-full h-full object-cover opacity-60">
                    <div class="absolute inset-0 bg-gradient-to-t from-zinc-950 to-transparent"></div>
                </div>
                <div class="px-8 pb-10 -mt-20 relative z-10 text-center">
                    <img src="${u.avatar || communityPresets[0]}" class="w-32 h-32 rounded-[40px] border-[6px] border-zinc-950 object-cover mx-auto shadow-2xl">
                    <div class="mt-5 bg-white/5 backdrop-blur-2xl px-5 py-2 rounded-2xl border border-white/10 inline-flex items-center gap-2">
                        <h2 class="text-2xl font-black italic text-white uppercase tracking-tighter">@${u.username}</h2>
                        ${(u.isPremium || u.premium) ? '<img src="https://i.imgur.com/BoVp6Td.png" class="w-6 h-6">' : ''}
                    </div>
                    <div class="grid grid-cols-3 gap-2 mt-6">
                        <div class="bg-white/5 p-3 rounded-2xl border border-white/5"><p class="text-[7px] text-zinc-500 font-black uppercase">Region</p><p class="text-[10px] text-white font-bold truncate uppercase">${u.country || 'Global'}</p></div>
                        <div class="bg-white/5 p-3 rounded-2xl border border-white/5"><p class="text-[7px] text-zinc-500 font-black uppercase">NETWORTH</p><p class="text-[10px] text-white font-bold">${u.tokens || '0'}</p></div>
                        <div class="bg-white/5 p-3 rounded-2xl border border-white/5"><p class="text-[7px] text-zinc-500 font-black uppercase">Status</p><p class="text-[10px] text-pink-500 font-black">${u.isPremium ? 'PRO' : 'FREE'}</p></div>
                    </div>
                    <div class="grid grid-cols-2 gap-3 mt-8">
                        <button onclick="handleTip('${targetUid}', '${u.username}', '${u.avatar}')" class="py-4.5 bg-emerald-500 text-black font-black uppercase rounded-2xl shadow-lg active:scale-95 transition-all text-xs">Donate</button>
                        <button onclick="openRequestPanel('${targetUid}', '${u.username}')" class="py-4.5 bg-white/10 text-white font-black uppercase rounded-2xl border border-white/10 active:scale-95 transition-all text-xs">Request</button>
                    </div>
                    <a href="profile.html?id=${targetUid}" class="block mt-7 text-[10px] font-black uppercase text-zinc-600 hover:text-white tracking-[4px]">View Full Dossier</a>
                </div>
            </div>
        `;
    }
};

// --- 4. REVERSE REQUEST PANEL (Ask them to donate to you) ---
window.openRequestPanel = async (targetUid, targetUsername) => {
    let overlay = document.getElementById('request-overlay') || document.createElement('div');
    overlay.id = 'request-overlay';
    overlay.className = "fixed inset-0 z-[120] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6";
    document.body.appendChild(overlay);

    overlay.innerHTML = `
        <div class="w-full max-w-sm text-center animate-in slide-in-from-bottom-10">
            <h3 class="text-3xl font-black text-white italic uppercase tracking-tighter">Ask for Support</h3>
            <p class="text-zinc-500 text-[10px] font-black uppercase tracking-[3px] mt-2 mb-8">Asking @${targetUsername} to donate</p>
            <div class="bg-white/5 p-6 rounded-[32px] border border-white/10 mb-4">
                <input type="number" id="req-amount" placeholder="0" class="bg-transparent text-center text-5xl font-black text-emerald-400 outline-none w-full placeholder:opacity-10">
            </div>
            <div class="bg-white/5 p-5 rounded-[28px] border border-white/10 mb-8">
                <textarea id="req-message" placeholder="Why do you need support?" class="bg-transparent w-full h-24 text-sm text-zinc-300 outline-none resize-none italic"></textarea>
            </div>
            <button onclick="submitHelpRequest('${targetUid}', '${targetUsername}')" class="w-full py-5 bg-emerald-500 text-black font-black uppercase rounded-[24px]">Submit Request</button>
            <button onclick="document.getElementById('request-overlay').remove()" class="mt-4 text-[10px] text-zinc-600 uppercase font-black">Cancel</button>
        </div>
    `;
};

window.submitHelpRequest = async (targetUid, targetUsername) => {
    const amount = document.getElementById('req-amount').value;
    const msg = document.getElementById('req-message').value;
    if (!amount || !msg) return notify("Fill in all details");

    try {
        await push(ref(db, `help_requests/${targetUid}`), {
            requesterId: auth.currentUser.uid,
            amount: amount,
            message: msg,
            timestamp: serverTimestamp()
        });
        notify(`Request sent to @${targetUsername}`);
        document.getElementById('request-overlay').remove();
    } catch (e) { console.error(e); }
};

window.closeQuickProfile = () => {
    toggleScroll(false);
    document.getElementById('quick-profile-modal').style.display = 'none';
    window.history.replaceState(null, null, ' ');
};
