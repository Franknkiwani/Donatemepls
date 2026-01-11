import { ref, onValue, get, query, limitToLast, off } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
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

    // Cleanup existing listeners to prevent memory leaks
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
            const userPos = index + 1; // 1-based index for logic
            
            // Create Card Container
            const card = document.createElement('div');
            card.id = `user-card-${uid}`;
            feedGrid.appendChild(card);

            // INTERVAL BANNER LOGIC: After 3, then +5 (8), then +8 (16)
            if (userPos === 3 || userPos === 8 || userPos === 16) {
                const banner = document.createElement('div');
                banner.className = "col-span-full my-6 overflow-hidden rounded-[24px] border border-white/10 shadow-2xl";
                banner.innerHTML = `<img src="https://i.imgur.com/tJgykoC.png" class="w-full h-auto object-cover block" alt="Community Spotlight">`;
                feedGrid.appendChild(banner);
            }

            const userRef = ref(db, `users/${uid}`);
            const unsubscribe = onValue(userRef, (userSnap) => {
                const u = userSnap.val();
                if (!u) return;

                const isPro = u.isPremium || u.premium || false;
                const isAdmin = uid === "4xEDAzSt5javvSnW5mws2Ma8i8n1";
                
                // Share Data
                const shareUrl = encodeURIComponent(`${window.location.origin}/profile.html?id=${uid}`);
                const shareText = encodeURIComponent(`Check out ${u.username || 'this user'} on our platform!`);

                // Dynamic Styling
                card.className = `p-5 rounded-[28px] border relative transition-all duration-500 hover:translate-y-[-4px] ${
                    isPro 
                    ? 'border-pink-500/40 bg-pink-500/5 shadow-[0_0_25px_rgba(236,72,153,0.1)] z-10' 
                    : 'border-white/5 bg-zinc-900/40 z-0'
                }`;

                card.innerHTML = `
                    <div class="flex items-start gap-4">
                        <div onclick="viewCreatorProfile('${uid}')" class="relative w-14 h-14 rounded-2xl border-2 ${isPro ? 'border-pink-500 animate-pulse' : 'border-zinc-800'} p-0.5 flex-shrink-0 cursor-pointer overflow-hidden shadow-lg">
                            <img src="${u.avatar || communityPresets[0]}" class="w-full h-full object-cover rounded-xl" loading="lazy">
                        </div>

                        <div class="flex-1 min-w-0">
                            <div class="flex justify-between items-center gap-1 mb-1">
                                <div class="flex items-center gap-1.5 truncate">
                                    <span class="font-black text-[11px] text-white uppercase italic tracking-tight truncate">
                                        @${u.username || 'Member'}
                                    </span>
                                    
                                    <div class="flex items-center gap-1">
                                        ${isPro ? '<img src="https://img.icons8.com/color/48/verified-badge.png" class="w-3.5 h-3.5 flex-shrink-0">' : ''}
                                        ${(isPro || isAdmin) ? '<img src="https://i.imgur.com/BoVp6Td.png" class="w-5 h-5 object-contain flex-shrink-0 ml-0.5">' : ''}
                                        ${isAdmin ? '<span class="text-[7px] bg-amber-500 text-black px-1.5 py-0.5 rounded-sm font-black ml-1">STAFF</span>' : ''}
                                    </div>
                                </div>
                                <span class="text-xs flex-shrink-0">${u.mood === 'happy' ? '😊' : u.mood === 'sad' ? '😔' : '😐'}</span>
                            </div>
                            
                            <p class="text-[10px] text-zinc-400 italic line-clamp-1 leading-tight mb-2">
                                ${u.bio || 'Sharing the energy on the platform!'}
                            </p>

                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                     <span class="text-[8px] bg-black/40 px-2 py-0.5 rounded-full text-zinc-500 font-bold uppercase border border-white/5">
                                        ${u.country || 'Global'}
                                     </span>
                                </div>
                                
                                <div class="flex items-center gap-3">
                                    <a href="https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareText}" target="_blank" class="opacity-40 hover:opacity-100 transition-opacity">
                                        <img src="https://img.icons8.com/ios-filled/50/ffffff/twitterx.png" class="w-3 h-3">
                                    </a>
                                    <a href="https://wa.me/?text=${shareText}%20${shareUrl}" target="_blank" class="opacity-40 hover:opacity-100 transition-opacity">
                                        <img src="https://img.icons8.com/ios-filled/50/ffffff/whatsapp.png" class="w-3 h-3">
                                    </a>
                                    <a href="https://www.facebook.com/sharer/sharer.php?u=${shareUrl}" target="_blank" class="opacity-40 hover:opacity-100 transition-opacity">
                                        <img src="https://img.icons8.com/ios-filled/50/ffffff/facebook-new.png" class="w-3 h-3">
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button onclick="handleTip('${uid}', '${(u.username || 'User').replace(/'/g, "\\'")}', '${u.avatar}')" 
                        class="w-full mt-4 py-2.5 ${isPro ? 'bg-pink-600 hover:bg-pink-500' : 'bg-emerald-500 hover:bg-emerald-400'} text-black text-[10px] font-black uppercase rounded-xl transition-all shadow-md active:scale-95">
                        Send Tip
                    </button>
                `;
            });
            activeListeners.push(unsubscribe);
        });

    } catch (e) {
        console.error("User Feed Error:", e);
    }
};

window.viewCreatorProfile = async (targetUid) => {
    const user = auth.currentUser;
    if (!user) return notify("Please login to view profiles");

    try {
        const snap = await get(ref(db, `users/${user.uid}`));
        const userData = snap.val();
        
        const isPremium = userData?.isPremium || userData?.premium;
        const isAdmin = user.uid === "4xEDAzSt5javvSnW5mws2Ma8i8n1";

        if (isPremium || isAdmin) {
            window.location.href = `profile.html?id=${targetUid}`;
        } else {
            notify("Premium membership required to view full profiles");
            if(window.openUpgradeModal) window.openUpgradeModal();
        }
    } catch (e) {
        console.error("Navigation Error:", e);
    }
};
