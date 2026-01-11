import { ref, onValue, get, query, limitToLast } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { auth, db } from './firebase-config.js';

const communityPresets = [
    "https://img.pikbest.com/origin/10/25/30/74apIkbEsT5qB.jpg!w700wp",
    "https://thumbs.dreamstime.com/b/cool-neon-party-wolf-headphones-black-background-colorful-illustration-music-theme-modern-portrait-bright-vibrant-385601082.jpg",
    "https://wallpapers.com/images/hd/gaming-profile-pictures-tt8bbzdcf6zibhoi.jpg"
];

let activeListeners = [];

const toggleScroll = (lock) => {
    document.body.style.overflow = lock ? 'hidden' : '';
};

const notify = (msg) => {
    if (window.showErrorModal) window.showErrorModal(msg);
    else alert(msg);
};

// --- DYNAMIC USER FEED ---
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

        const shuffledUids = Object.keys(data).sort(() => Math.random() - 0.5);

        shuffledUids.forEach((uid, index) => {
            const userPos = index + 1;
            const card = document.createElement('div');
            card.id = `user-card-${uid}`;
            feedGrid.appendChild(card);

            if (userPos === 3 || userPos === 8 || userPos === 16) {
                const banner = document.createElement('div');
                banner.className = "col-span-full my-6 overflow-hidden rounded-[24px] border border-white/10 shadow-2xl";
                banner.innerHTML = `<img src="https://i.imgur.com/tJgykoC.png" class="w-full h-auto object-cover">`;
                feedGrid.appendChild(banner);
            }

            const unsubscribe = onValue(ref(db, `users/${uid}`), (userSnap) => {
                const u = userSnap.val();
                if (!u) return;
                const isPro = u.isPremium || u.premium || false;
                const isAdmin = uid === "4xEDAzSt5javvSnW5mws2Ma8i8n1";

                card.className = `p-5 rounded-[28px] border transition-all duration-500 ${isPro ? 'border-pink-500/40 bg-pink-500/5 shadow-[0_10px_30px_rgba(236,72,153,0.05)]' : 'border-white/5 bg-zinc-900/40'}`;
                card.innerHTML = `
                    <div class="flex items-start gap-4">
                        <div onclick="window.openQuickProfile('${uid}')" class="relative w-14 h-14 rounded-2xl border-2 ${isPro ? 'border-pink-500 animate-pulse' : 'border-zinc-800'} p-0.5 flex-shrink-0 cursor-pointer overflow-hidden"><img src="${u.avatar || communityPresets[0]}" class="w-full h-full object-cover rounded-xl"></div>
                        <div class="flex-1 min-w-0">
                            <div class="flex justify-between items-center mb-1">
                                <div class="bg-white/5 px-2 py-0.5 rounded-lg border border-white/10 inline-flex items-center gap-1.5"><span class="font-black text-[10px] text-white uppercase italic truncate">@${u.username}</span>
                                ${isPro ? '<img src="https://img.icons8.com/color/48/verified-badge.png" class="w-3 h-3">' : ''}${isAdmin ? '<span class="text-[7px] bg-amber-500 text-black px-1 rounded-sm font-black">STAFF</span>' : ''}</div>
                                <span class="text-xs">${u.mood === 'happy' ? '😊' : '😐'}</span>
                            </div>
                            <p class="text-[9px] text-zinc-400 italic line-clamp-1 mb-3">"${u.bio || '...'}"</p>
                            <div class="grid grid-cols-2 gap-2">
                                <button onclick="handleTip('${uid}', '${u.username}', '${u.avatar}')" class="py-2.5 bg-emerald-500 text-black text-[9px] font-black uppercase rounded-xl">Donate</button>
                                <button onclick="window.openQuickProfile('${uid}')" class="py-2.5 bg-white/5 text-white text-[9px] font-black uppercase rounded-xl border border-white/10">Profile</button>
                            </div>
                        </div>
                    </div>
                `;
            });
            activeListeners.push(unsubscribe);
        });
    } catch (e) { console.error(e); }
};

// --- QUICK PROFILE MODAL ---
window.openQuickProfile = async (targetUid) => {
    toggleScroll(true);
    window.location.hash = `profile-${targetUid}`;
    let modal = document.getElementById('quick-profile-modal') || document.createElement('div');
    modal.id = 'quick-profile-modal';
    modal.className = "fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4";
    document.body.appendChild(modal);
    modal.style.display = 'flex';

    const snap = await get(ref(db, `users/${targetUid}`));
    const u = snap.val();

    if (u) {
        modal.innerHTML = `
            <div class="bg-zinc-950 border border-white/10 w-full max-w-[420px] rounded-[40px] overflow-hidden relative animate-in zoom-in duration-300">
                <button onclick="closeQuickProfile()" class="absolute top-5 right-5 z-20 bg-black/50 text-white w-10 h-10 rounded-full border border-white/10">&times;</button>
                <div class="h-32 bg-zinc-900 relative"><img src="${u.banner || communityPresets[2]}" class="w-full h-full object-cover opacity-50"><div class="absolute inset-0 bg-gradient-to-t from-zinc-950 to-transparent"></div></div>
                <div class="px-8 pb-10 -mt-16 relative z-10 text-center">
                    <img src="${u.avatar || communityPresets[0]}" class="w-28 h-28 rounded-[35px] border-4 border-zinc-950 object-cover mx-auto shadow-2xl">
                    <div class="mt-4 bg-white/5 px-4 py-1.5 rounded-2xl border border-white/10 inline-flex items-center gap-2">
                        <h2 class="text-xl font-black italic text-white uppercase tracking-tighter">@${u.username}</h2>
                        ${(u.isPremium || u.premium) ? '<img src="https://i.imgur.com/BoVp6Td.png" class="w-5 h-5">' : ''}
                    </div>
                    <div class="grid grid-cols-3 gap-2 mt-6">
                        <div class="bg-white/5 p-3 rounded-2xl border border-white/5"><p class="text-[8px] text-zinc-500 font-black">REGION</p><p class="text-[10px] text-white font-bold truncate">${u.country || 'Global'}</p></div>
                        <div class="bg-white/5 p-3 rounded-2xl border border-white/5"><p class="text-[8px] text-zinc-500 font-black uppercase">REVENUE</p><p class="text-[10px] text-white font-bold">${u.totalReceivedTokens || '0'}</p></div>
                        <div class="bg-white/5 p-3 rounded-2xl border border-white/5"><p class="text-[8px] text-zinc-500 font-black uppercase">LEVEL</p><p class="text-[10px] text-pink-500 font-bold">${u.level || '1'}</p></div>
                    </div>

                    <div class="grid grid-cols-2 gap-3 mt-6">
                        <button onclick="handleTip('${targetUid}', '${u.username}', '${u.avatar}')" class="py-4 bg-emerald-500 text-black font-black uppercase rounded-2xl shadow-lg active:scale-95 transition-all text-[11px]">Donate</button>
                        <button onclick="openRequestPanel('${targetUid}', '${u.username}')" class="py-4 bg-white/10 text-white font-black uppercase rounded-2xl border border-white/10 active:scale-95 transition-all text-[11px]">Request</button>
                    </div>

                    <a href="profile.html?id=${targetUid}" class="block mt-6 text-[9px] font-black uppercase text-zinc-600 hover:text-white tracking-[2px]">View Dossier</a>
                </div>
            </div>
        `;
    }
};

// --- REQUEST PANEL (Step 2) ---
window.openRequestPanel = async (targetUid, username) => {
    const user = auth.currentUser;
    if (!user) return notify("Login to send requests");

    // Fetch sender balance
    const senderSnap = await get(ref(db, `users/${user.uid}`));
    const myBalance = senderSnap.val()?.tokens || 0;

    let panel = document.getElementById('request-panel') || document.createElement('div');
    panel.id = 'request-panel';
    panel.className = "fixed inset-0 z-[110] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-6 transition-all";
    panel.innerHTML = `
        <div class="w-full max-w-sm text-center">
            <h3 class="text-2xl font-black text-white italic uppercase tracking-tighter">Submit Request</h3>
            <p class="text-zinc-500 text-xs mt-2 uppercase font-bold tracking-widest">Target: @${username}</p>
            
            <div class="mt-8 bg-white/5 p-6 rounded-[32px] border border-white/10">
                <label class="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-4">Offer Amount (Tokens)</label>
                <input type="number" id="req-amount" placeholder="0.00" class="bg-transparent text-center text-4xl font-black text-emerald-400 outline-none w-full mb-2">
                <p class="text-[9px] text-zinc-600">Your Current Balance: ${myBalance} Tokens</p>
            </div>

            <button onclick="submitRequestLogic('${targetUid}', '${username}', ${myBalance})" class="w-full mt-6 py-5 bg-white text-black font-black uppercase rounded-2xl active:scale-95 transition-all">Send Request</button>
            <button onclick="document.getElementById('request-panel').remove()" class="mt-4 text-[10px] text-zinc-500 uppercase font-black tracking-widest">Cancel</button>
        </div>
    `;
    document.body.appendChild(panel);
};

window.submitRequestLogic = (targetUid, username, balance) => {
    const amount = parseFloat(document.getElementById('req-amount').value);
    if (!amount || amount <= 0) return notify("Enter a valid amount");
    
    if (amount > balance) {
        return notify(`Insufficient Balance. You need ${amount - balance} more tokens.`);
    }

    // Success Simulation (Doesn't deduct yet)
    notify(`Request sent to @${username}. Tokens will be held until they accept!`);
    document.getElementById('request-panel').remove();
};

window.closeQuickProfile = () => {
    toggleScroll(false);
    document.getElementById('quick-profile-modal').style.display = 'none';
    window.location.hash = '';
};
