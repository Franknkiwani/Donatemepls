import { ref, onValue, get, query, limitToLast } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { auth, db } from './firebase-config.js';

const communityPresets = [
    "https://img.pikbest.com/origin/10/25/30/74apIkbEsT5qB.jpg!w700wp",
    "https://thumbs.dreamstime.com/b/cool-neon-party-wolf-headphones-black-background-colorful-illustration-music-theme-modern-portrait-bright-vibrant-385601082.jpg",
    "https://wallpapers.com/images/hd/gaming-profile-pictures-tt8bbzdcf6zibhoi.jpg"
];

/**
 * SHUFFLE UTILITY
 * Ensures a fresh experience on every load
 */
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

    try {
        // 1. Fetch only the 40 most recently active UIDs (Prevents loading whole node)
        const q = query(ref(db, 'users'), limitToLast(40));
        const snapshot = await get(q);
        const data = snapshot.val();
        
        if (!data) {
            feedGrid.innerHTML = `<div class="col-span-full py-20 text-center opacity-30 uppercase text-[10px] font-black tracking-widest">No members found</div>`;
            return;
        }

        // 2. Prepare the grid and shuffle the list of IDs
        feedGrid.innerHTML = '';
        const shuffledUids = shuffleArray(Object.keys(data));

        // 3. Create real-time listeners for each specific user card
        shuffledUids.forEach(uid => {
            // Create a placeholder container for this specific user
            const card = document.createElement('div');
            card.id = `user-card-${uid}`;
            feedGrid.appendChild(card);

            // ATTACH LIVE LISTENER: Only syncs data for THIS specific user
            // If they change their name, bio, or go PRO, it updates instantly.
            onValue(ref(db, `users/${uid}`), (userSnap) => {
                const u = userSnap.val();
                if (!u) return;

                const isPro = u.isPremium || u.premium || false;
                const isAdmin = uid === "4xEDAzSt5javvSnW5mws2Ma8i8n1";

                // Set dynamic classes based on PRO status
                card.className = `p-5 rounded-[28px] border relative transition-all duration-500 hover:translate-y-[-4px] ${
                    isPro 
                    ? 'border-pink-500/40 bg-pink-500/5 shadow-[0_0_25px_rgba(236,72,153,0.1)] z-10' 
                    : 'border-white/5 bg-zinc-900/40 z-0'
                }`;

                card.setAttribute('data-handle', u.username || "");
                card.setAttribute('data-email', u.email || "");

                card.innerHTML = `
                    <div class="flex items-start gap-4">
                        <div onclick="viewCreatorProfile('${uid}')" class="relative w-14 h-14 rounded-2xl border-2 ${isPro ? 'border-pink-500 animate-pulse' : 'border-zinc-800'} p-0.5 flex-shrink-0 cursor-pointer overflow-hidden shadow-lg">
                            <img src="${u.avatar || communityPresets[0]}" class="w-full h-full object-cover rounded-xl" loading="lazy">
                            ${isPro ? '<div class="absolute inset-0 bg-gradient-to-tr from-pink-500/20 to-transparent"></div>' : ''}
                        </div>

                        <div class="flex-1 min-w-0">
                            <div class="flex justify-between items-center gap-1 mb-1">
                                <div class="flex items-center gap-1.5 truncate">
                                    <span class="font-black text-[11px] text-white uppercase italic tracking-tight truncate">
                                        @${u.username || 'Member'}
                                    </span>
                                    ${isPro ? '<img src="https://img.icons8.com/color/48/verified-badge.png" class="w-3.5 h-3.5 flex-shrink-0">' : ''}
                                    ${isAdmin ? '<span class="text-[7px] bg-amber-500 text-black px-1 rounded-sm font-black">STAFF</span>' : ''}
                                </div>
                                <span class="text-xs flex-shrink-0">${u.mood === 'happy' ? '😊' : u.mood === 'sad' ? '😔' : '😐'}</span>
                            </div>
                            
                            <p class="text-[10px] text-zinc-400 italic line-clamp-2 leading-tight mb-2">
                                ${u.bio || 'Sharing the energy on the platform!'}
                            </p>

                            <div class="flex items-center gap-2">
                                 <span class="text-[8px] bg-black/40 px-2 py-0.5 rounded-full text-zinc-500 font-bold uppercase border border-white/5">
                                    ${u.country || 'Global'}
                                 </span>
                                 ${isPro ? '<span class="text-[7px] bg-pink-500 text-white px-2 py-0.5 rounded-full font-black italic tracking-widest">PRO MEMBER</span>' : ''}
                            </div>
                        </div>
                    </div>

                    <button onclick="handleTip('${uid}', '${(u.username || 'User').replace(/'/g, "\\'")}', '${u.avatar}')" 
                        class="w-full mt-4 py-2.5 ${isPro ? 'bg-pink-600 hover:bg-pink-500' : 'bg-emerald-500 hover:bg-emerald-400'} text-black text-[10px] font-black uppercase rounded-xl transition-all shadow-md active:scale-95">
                        Send Tip
                    </button>
                `;
            });
        });

    } catch (e) {
        console.error("User Feed Batch Error:", e);
    }
};

// --- PROFILE REDIRECT WITH PERMISSION CHECK ---
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
        console.error("Profile Navigation Error:", e);
    }
};
