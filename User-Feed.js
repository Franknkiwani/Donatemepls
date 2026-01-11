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

// --- DEEP LINKING AUTO-LOADER ---
window.addEventListener('load', () => {
    const hash = window.location.hash;
    if (hash.startsWith('#profile-')) {
        const uid = hash.replace('#profile-', '');
        window.openQuickProfile(uid);
    }
});

// --- DYNAMIC USER FEED ENGINE ---
window.loadUserFeed = async () => {
    const feedGrid = document.getElementById('user-feed-grid');
    if (!feedGrid) return;

    activeListeners.forEach(unsub => unsub());
    activeListeners = [];

    try {
        const q = query(ref(db, 'users'), limitToLast(40));
        const snapshot = await get(q);
        const data = snapshot.val();
        
        if (!data) {
            feedGrid.innerHTML = `<div class="col-span-full py-20 text-center opacity-30 uppercase text-[10px] font-black tracking-widest">No members found</div>`;
            return;
        }

        feedGrid.innerHTML = '';
        const shuffledUids = Object.keys(data).sort(() => Math.random() - 0.5);

        shuffledUids.forEach((uid, index) => {
            const userPos = index + 1;
            const card = document.createElement('div');
            card.id = `user-card-${uid}`;
            feedGrid.appendChild(card);

            // 1. INTERVAL BANNERS (3, 8, 16)
            if (userPos === 3 || userPos === 8 || userPos === 16) {
                const banner = document.createElement('div');
                banner.className = "col-span-full my-6 overflow-hidden rounded-[24px] border border-white/10 shadow-2xl";
                banner.innerHTML = `<img src="https://i.imgur.com/tJgykoC.png" class="w-full h-auto object-cover">`;
                feedGrid.appendChild(banner);
            }

            // 2. LIVE LISTENER (Restored full data display)
            const unsubscribe = onValue(ref(db, `users/${uid}`), (userSnap) => {
                const u = userSnap.val();
                if (!u) return;

                const isPro = u.isPremium || u.premium || false;
                const isAdmin = uid === "4xEDAzSt5javvSnW5mws2Ma8i8n1";
                const shareUrl = encodeURIComponent(`${window.location.origin}${window.location.pathname}#profile-${uid}`);
                const shareText = encodeURIComponent(`Check out @${u.username}!`);

                card.className = `p-5 rounded-[28px] border relative transition-all duration-500 hover:translate-y-[-4px] ${
                    isPro ? 'border-pink-500/40 bg-pink-500/5 shadow-[0_10px_30px_rgba(236,72,153,0.05)]' : 'border-white/5 bg-zinc-900/40'
                }`;

                card.innerHTML = `
                    <div class="flex items-start gap-4">
                        <div onclick="window.openQuickProfile('${uid}')" class="relative w-14 h-14 rounded-2xl border-2 ${isPro ? 'border-pink-500 animate-pulse' : 'border-zinc-800'} p-0.5 flex-shrink-0 cursor-pointer overflow-hidden shadow-lg">
                            <img src="${u.avatar || communityPresets[0]}" class="w-full h-full object-cover rounded-xl" loading="lazy">
                        </div>

                        <div class="flex-1 min-w-0">
                            <div class="flex justify-between items-center gap-1 mb-1">
                                <div class="bg-white/5 backdrop-blur-md px-2 py-0.5 rounded-lg border border-white/10 inline-flex items-center gap-1.5 max-w-full">
                                    <span class="font-black text-[10px] text-white uppercase italic truncate pr-1">@${u.username || 'User'}</span>
                                    ${isPro ? '<img src="https://img.icons8.com/color/48/verified-badge.png" class="w-3 h-3">' : ''}
                                    ${(isPro || isAdmin) ? '<img src="https://i.imgur.com/BoVp6Td.png" class="w-4 h-4">' : ''}
                                    ${isAdmin ? '<span class="text-[7px] bg-amber-500 text-black px-1 rounded-sm font-black">STAFF</span>' : ''}
                                </div>
                                <span class="text-xs flex-shrink-0">${u.mood === 'happy' ? '😊' : u.mood === 'sad' ? '😔' : '😐'}</span>
                            </div>
                            
                            <p class="text-[10px] text-zinc-400 italic line-clamp-1 mb-2 px-1">
                                ${u.bio || 'Sharing the energy on the platform!'}
                            </p>

                            <div class="flex items-center justify-between mt-1 px-1">
                                <span class="text-[8px] bg-black/40 px-2 py-0.5 rounded-full text-zinc-500 font-bold uppercase border border-white/5">
                                    ${u.country || 'Global'}
                                </span>
                                <div class="flex items-center gap-2.5">
                                    <a href="https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareText}" target="_blank" class="opacity-40 hover:opacity-100 transition-opacity">
                                        <img src="https://img.icons8.com/ios-filled/50/ffffff/twitterx.png" class="w-3 h-3">
                                    </a>
                                    <a href="https://wa.me/?text=${shareText}%20${shareUrl}" target="_blank" class="opacity-40 hover:opacity-100 transition-opacity">
                                        <img src="https://img.icons8.com/ios-filled/50/ffffff/whatsapp.png" class="w-3 h-3">
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-2 mt-4">
                        <button onclick="handleTip('${uid}', '${u.username}', '${u.avatar}')" 
                            class="py-2.5 ${isPro ? 'bg-pink-600' : 'bg-emerald-500'} text-black text-[9px] font-black uppercase rounded-xl shadow-md active:scale-95 transition-all">
                            Donate
                        </button>
                        <button onclick="window.openQuickProfile('${uid}')" 
                            class="py-2.5 bg-white/5 hover:bg-white/10 text-white text-[9px] font-black uppercase rounded-xl border border-white/10 transition-all">
                            Profile
                        </button>
                    </div>
                `;
            });
            activeListeners.push(unsubscribe);
        });
    } catch (e) { console.error("Feed Error:", e); }
};

// --- QUICK PROFILE MODAL LOGIC ---
window.openQuickProfile = async (targetUid) => {
    toggleScroll(true);
    window.location.hash = `profile-${targetUid}`;

    let modal = document.getElementById('quick-profile-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'quick-profile-modal';
        modal.className = "fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4";
        document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
    modal.innerHTML = `<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>`;

    const snap = await get(ref(db, `users/${targetUid}`));
    const u = snap.val();

    if (u) {
        const shareUrl = encodeURIComponent(`${window.location.origin}${window.location.pathname}#profile-${targetUid}`);
        const shareText = encodeURIComponent(`Check out @${u.username}'s profile!`);

        modal.innerHTML = `
            <div class="bg-zinc-950 border border-white/10 w-full max-w-[420px] rounded-[40px] overflow-hidden relative shadow-2xl animate-in zoom-in duration-300">
                <button onclick="closeQuickProfile()" class="absolute top-5 right-5 z-20 bg-black/50 text-white w-10 h-10 rounded-full border border-white/10 hover:bg-white hover:text-black transition-all">&times;</button>
                
                <div class="h-32 bg-zinc-900 relative">
                    <img src="${u.banner || communityPresets[2]}" class="w-full h-full object-cover opacity-50">
                    <div class="absolute inset-0 bg-gradient-to-t from-zinc-950 to-transparent"></div>
                </div>

                <div class="px-8 pb-10 -mt-16 relative z-10 text-center">
                    <img src="${u.avatar || communityPresets[0]}" class="w-28 h-28 rounded-[35px] border-4 border-zinc-950 object-cover mx-auto shadow-2xl">
                    
                    <div class="mt-4 bg-white/5 backdrop-blur-md px-4 py-1.5 rounded-2xl border border-white/10 inline-flex items-center gap-2">
                        <h2 class="text-xl font-black italic text-white uppercase tracking-tighter">@${u.username}</h2>
                        ${(u.isPremium || u.premium) ? '<img src="https://i.imgur.com/BoVp6Td.png" class="w-5 h-5">' : ''}
                    </div>

                    <p class="text-zinc-400 text-xs mt-4 italic leading-relaxed px-2">"${u.bio || 'Elite Member'}"</p>

                    <div class="grid grid-cols-3 gap-2 mt-6">
                        <div class="bg-white/5 p-3 rounded-2xl border border-white/5">
                            <p class="text-[8px] text-zinc-500 font-black uppercase">Region</p>
                            <p class="text-[10px] text-white font-bold truncate">${u.country || 'Global'}</p>
                        </div>
                        <div class="bg-white/5 p-3 rounded-2xl border border-white/5">
                            <p class="text-[8px] text-zinc-500 font-black uppercase">Tokens</p>
                            <p class="text-[10px] text-white font-bold">${u.tokens || '0'}</p>
                        </div>
                        <div class="bg-white/5 p-3 rounded-2xl border border-white/5">
                            <p class="text-[8px] text-zinc-500 font-black uppercase">Level</p>
                            <p class="text-[10px] text-pink-500 font-bold">${u.level || '1'}</p>
                        </div>
                    </div>

                    <button onclick="handleTip('${targetUid}', '${u.username}', '${u.avatar}')" 
                        class="w-full mt-6 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase rounded-2xl shadow-lg active:scale-95 transition-all">
                        Donate to Creator
                    </button>

                    <a href="profile.html?id=${targetUid}" class="block mt-5 text-[10px] font-black uppercase text-zinc-500 hover:text-white tracking-[3px] transition-colors">
                        View Full Dossier &rarr;
                    </a>

                    <div class="mt-8 flex justify-center gap-6 pt-6 border-t border-white/5">
                        <a href="https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareText}" target="_blank"><img src="https://img.icons8.com/ios-filled/50/ffffff/twitterx.png" class="w-4 h-4 opacity-50 hover:opacity-100 transition-all"></a>
                        <a href="https://wa.me/?text=${shareText}%20${shareUrl}" target="_blank"><img src="https://img.icons8.com/ios-filled/50/ffffff/whatsapp.png" class="w-4 h-4 opacity-50 hover:opacity-100 transition-all"></a>
                        <a href="https://www.facebook.com/sharer/sharer.php?u=${shareUrl}" target="_blank"><img src="https://img.icons8.com/ios-filled/50/ffffff/facebook-new.png" class="w-4 h-4 opacity-50 hover:opacity-100 transition-all"></a>
                    </div>
                </div>
            </div>
        `;
    }
};

window.closeQuickProfile = () => {
    toggleScroll(false);
    document.getElementById('quick-profile-modal').style.display = 'none';
    window.location.hash = ''; 
};
