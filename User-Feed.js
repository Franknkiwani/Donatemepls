import { ref, onValue, get } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { auth, db } from './firebase-config.js';

const communityPresets = [
    "https://img.pikbest.com/origin/10/25/30/74apIkbEsT5qB.jpg!w700wp",
    "https://thumbs.dreamstime.com/b/cool-neon-party-wolf-headphones-black-background-colorful-illustration-music-theme-modern-portrait-bright-vibrant-385601082.jpg",
    "https://wallpapers.com/images/hd/gaming-profile-pictures-tt8bbzdcf6zibhoi.jpg"
];

const notify = (msg) => {
    if (window.showErrorModal) window.showErrorModal(msg);
    else alert(msg);
};

// --- USER FEED ENGINE ---
window.loadUserFeed = () => {
    const feedGrid = document.getElementById('user-feed-grid');
    if (!feedGrid) return;

    onValue(ref(db, 'users'), (snapshot) => {
        const users = snapshot.val();
        feedGrid.innerHTML = '';
        if (!users) return;
        
        Object.keys(users).forEach(uid => {
            const u = users[uid];
            const isPro = u.isPremium || u.premium || false;

            const card = document.createElement('div');
            card.setAttribute('data-handle', u.username || "");
            card.setAttribute('data-email', u.email || "");
            card.className = `p-5 rounded-[24px] border relative transition-all ${isPro ? 'border-pink-500/30 bg-white/5 shadow-[0_0_15px_rgba(236,72,153,0.05)]' : 'border-white/5 bg-zinc-900/40'}`;
            
            card.innerHTML = `
                <div class="flex items-start gap-4">
                    <div onclick="viewCreatorProfile('${uid}')" class="w-12 h-12 rounded-full border-2 ${isPro ? 'border-pink-500' : 'border-zinc-800'} p-0.5 overflow-hidden cursor-pointer">
                        <img src="${u.avatar || communityPresets[0]}" class="w-full h-full object-cover rounded-full">
                    </div>
                    <div class="flex-1">
                        <div class="flex justify-between items-center">
                            <span class="font-black text-xs text-white uppercase italic">@${u.username || 'User'}</span>
                            <span class="text-xs">${u.mood === 'happy' ? '😊' : u.mood === 'sad' ? '😔' : '😐'}</span>
                        </div>
                        <p class="text-[9px] text-zinc-400 mt-1 italic line-clamp-2">${u.bio || 'Sharing the energy!'}</p>
                        <div class="flex items-center gap-2 mt-2">
                             <span class="text-[8px] bg-white/5 px-2 py-0.5 rounded text-zinc-500 font-bold uppercase">${u.country || 'Global'}</span>
                        </div>
                    </div>
                </div>
                <button onclick="handleTip('${uid}', '${u.username}', '${u.avatar}')" class="w-full mt-4 py-2 bg-emerald-500 text-black text-[10px] font-black uppercase rounded-xl hover:bg-emerald-400 transition-all">Tip User</button>
            `;
            feedGrid.appendChild(card);
        });
    });
};

// --- TIMER LOGIC ---
window.startCountdown = (id, deadline) => {
    const timerInterval = setInterval(() => {
        const el = document.getElementById(`timer-${id}`);
        if (!el) return clearInterval(timerInterval);
        
        const diff = deadline - Date.now();
        if (diff <= 0) {
            el.innerText = "ENDED";
            if (window.loadCampaigns) window.loadCampaigns(); 
            return clearInterval(timerInterval);
        }
        
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        el.innerText = `${d}d ${h}h ${m}m ${s}s`;
    }, 1000);
};

// --- PROFILE REDIRECT ---
window.viewCreatorProfile = async (targetUid) => {
    const user = auth.currentUser;
    if (!user) return notify("Login required");

    try {
        const snap = await get(ref(db, `users/${user.uid}`));
        const userData = snap.val();
        
        if (userData?.isPremium || userData?.premium || user.uid === "4xEDAzSt5javvSnW5mws2Ma8i8n1") {
            window.location.href = `profile.html?id=${targetUid}`;
        } else {
            notify("PRO required to view profiles!");
            if(window.openUpgradeModal) window.openUpgradeModal();
        }
    } catch (e) {
        console.error("Profile view error:", e);
    }
};
