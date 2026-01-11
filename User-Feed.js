import { ref, onValue, get, query, limitToLast } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { auth, db } from './firebase-config.js';

const communityPresets = [
    "https://img.pikbest.com/origin/10/25/30/74apIkbEsT5qB.jpg!w700wp",
    "https://thumbs.dreamstime.com/b/cool-neon-party-wolf-headphones-black-background-colorful-illustration-music-theme-modern-portrait-bright-vibrant-385601082.jpg",
    "https://wallpapers.com/images/hd/gaming-profile-pictures-tt8bbzdcf6zibhoi.jpg"
];

let activeListeners = [];

const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

const notify = (msg) => {
    if (window.showErrorModal) window.showErrorModal(msg);
    else if (window.notify) window.notify(msg);
    else alert(msg);
};

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
        const shuffledUids = shuffleArray(Object.keys(data));

        shuffledUids.forEach((uid, index) => {
            const userPos = index + 1;
            const card = document.createElement('div');
            card.id = `user-card-${uid}`;
            feedGrid.appendChild(card);

            if (userPos === 3 || userPos === 8 || userPos === 16) {
                const banner = document.createElement('div');
                banner.className = "col-span-full my-6 overflow-hidden rounded-[24px] border border-white/10 shadow-2xl";
                banner.innerHTML = `<img src="https://i.imgur.com/tJgykoC.png" class="w-full h-auto object-cover block">`;
                feedGrid.appendChild(banner);
            }

            const unsubscribe = onValue(ref(db, `users/${uid}`), (userSnap) => {
                const u = userSnap.val();
                if (!u) return;

                const isPro = u.isPremium || u.premium || false;
                const isAdmin = uid === "4xEDAzSt5javvSnW5mws2Ma8i8n1";
                const shareUrl = encodeURIComponent(`${window.location.origin}/profile.html?id=${uid}`);
                const shareText = encodeURIComponent(`Check out ${u.username || 'this user'}!`);

                card.className = `p-5 rounded-[28px] border relative transition-all duration-500 hover:translate-y-[-4px] flex flex-col justify-between ${
                    isPro ? 'border-pink-500/40 bg-pink-500/5 shadow-[0_0_25px_rgba(236,72,153,0.1)]' : 'border-white/5 bg-zinc-900/40'
                }`;

                card.innerHTML = `
                    <div class="flex items-start gap-4">
                        <div onclick="openQuickProfile('${uid}')" class="relative w-14 h-14 rounded-2xl border-2 ${isPro ? 'border-pink-500 animate-pulse' : 'border-zinc-800'} p-0.5 flex-shrink-0 cursor-pointer overflow-hidden shadow-lg">
                            <img src="${u.avatar || communityPresets[0]}" class="w-full h-full object-cover rounded-xl" loading="lazy">
                        </div>

                        <div class="flex-1 min-w-0">
                            <div class="flex justify-between items-center gap-1 mb-1">
                                <div class="bg-white/5 backdrop-blur-md px-2 py-0.5 rounded-lg border border-white/10 flex items-center gap-1.5 max-w-full overflow-hidden">
                                    <span class="font-black text-[10px] text-white uppercase italic tracking-tight truncate pr-1">
                                        @${u.username || 'Member'}
                                    </span>
                                    ${isPro ? '<img src="https://img.icons8.com/color/48/verified-badge.png" class="w-3 h-3 flex-shrink-0">' : ''}
                                    ${(isPro || isAdmin) ? '<img src="https://i.imgur.com/BoVp6Td.png" class="w-4 h-4 object-contain flex-shrink-0">' : ''}
                                </div>
                                <span class="text-xs flex-shrink-0">${u.mood === 'happy' ? '😊' : '😐'}</span>
                            </div>
                            
                            <p class="text-[9px] text-zinc-400 italic line-clamp-1 mb-2 px-1">
                                ${u.bio || 'Sharing the energy...'}
                            </p>

                            <div class="flex items-center justify-between mt-1 px-1">
                                <span class="text-[7px] bg-black/40 px-2 py-0.5 rounded-full text-zinc-500 font-bold uppercase border border-white/5">
                                    ${u.country || 'Global'}
                                </span>
                                <div class="flex items-center gap-2.5">
                                    <a href="https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareText}" target="_blank" class="opacity-40 hover:opacity-100"><img src="https://img.icons8.com/ios-filled/50/ffffff/twitterx.png" class="w-2.5 h-2.5"></a>
                                    <a href="https://wa.me/?text=${shareText}%20${shareUrl}" target="_blank" class="opacity-40 hover:opacity-100"><img src="https://img.icons8.com/ios-filled/50/ffffff/whatsapp.png" class="w-2.5 h-2.5"></a>
                                    <a href="https://www.facebook.com/sharer/sharer.php?u=${shareUrl}" target="_blank" class="opacity-40 hover:opacity-100"><img src="https://img.icons8.com/ios-filled/50/ffffff/facebook-new.png" class="w-2.5 h-2.5"></a>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-2 mt-4">
                        <button onclick="handleTip('${uid}', '${(u.username || 'User').replace(/'/g, "\\'")}', '${u.avatar}')" 
                            class="py-2.5 ${isPro ? 'bg-pink-600' : 'bg-zinc-800 text-white'} text-[9px] font-black uppercase rounded-xl transition-all active:scale-95 shadow-lg">
                            Tip
                        </button>
                        <button onclick="openQuickProfile('${uid}')" 
                            class="py-2.5 ${isPro ? 'bg-white text-black' : 'bg-emerald-500 text-black'} text-[9px] font-black uppercase rounded-xl transition-all active:scale-95 shadow-lg">
                            Profile
                        </button>
                    </div>
                    ${isAdmin ? '<div class="absolute -top-2 -right-1 bg-amber-500 text-black text-[7px] px-2 py-0.5 rounded-full font-black shadow-lg">STAFF UNIT</div>' : ''}
                `;
            });
            activeListeners.push(unsubscribe);
        });
    } catch (e) { console.error(e); }
};

// --- QUICK PROFILE MODAL LOGIC ---
window.openQuickProfile = async (targetUid) => {
    // Check access first
    const user = auth.currentUser;
    if (!user) return notify("Login required");

    const userSnap = await get(ref(db, `users/${user.uid}`));
    const isPremium = userSnap.val()?.isPremium || userSnap.val()?.premium;
    const isAdmin = user.uid === "4xEDAzSt5javvSnW5mws2Ma8i8n1";

    if (!isPremium && !isAdmin) {
        notify("PRO required to view profiles");
        if(window.openUpgradeModal) window.openUpgradeModal();
        return;
    }

    // This creates an overlay that loads the profile content
    let modal = document.getElementById('quick-profile-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'quick-profile-modal';
        modal.className = "fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4";
        document.body.appendChild(modal);
    }

    modal.innerHTML = `<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>`;
    modal.style.display = 'flex';

    // Fetch the target user's detailed data
    const targetSnap = await get(ref(db, `users/${targetUid}`));
    const targetData = targetSnap.val();

    if (targetData) {
        modal.innerHTML = `
            <div class="bg-zinc-900 border border-white/10 w-full max-w-md rounded-[32px] overflow-hidden relative shadow-2xl">
                <button onclick="document.getElementById('quick-profile-modal').style.display='none'" class="absolute top-5 right-5 text-white/50 hover:text-white font-black text-xl">&times;</button>
                <div class="h-32 bg-gradient-to-br from-zinc-800 to-black"></div>
                <div class="px-6 pb-8 -mt-12 text-center">
                    <img src="${targetData.avatar || communityPresets[0]}" class="w-24 h-24 rounded-3xl mx-auto border-4 border-zinc-900 object-cover shadow-2xl">
                    <h2 class="mt-4 text-xl font-black italic text-white uppercase tracking-tighter">@${targetData.username}</h2>
                    <p class="text-zinc-400 text-sm mt-2 italic px-4">"${targetData.bio || 'This user is part of the elite community.'}"</p>
                    <div class="mt-6 flex justify-center gap-4">
                        <div class="bg-white/5 p-3 rounded-2xl border border-white/5 w-24">
                            <div class="text-[10px] text-zinc-500 uppercase font-black">Region</div>
                            <div class="text-xs text-white font-bold">${targetData.country || 'Global'}</div>
                        </div>
                        <div class="bg-white/5 p-3 rounded-2xl border border-white/5 w-24">
                            <div class="text-[10px] text-zinc-500 uppercase font-black">Status</div>
                            <div class="text-xs text-pink-500 font-bold">${targetData.isPremium ? 'PRO' : 'MEMBER'}</div>
                        </div>
                    </div>
                    <button onclick="window.location.href='profile.html?id=${targetUid}'" class="w-full mt-8 py-4 bg-white text-black font-black uppercase rounded-2xl hover:scale-[1.02] transition-transform">View Full Dossier</button>
                </div>
            </div>
        `;
    }
};
