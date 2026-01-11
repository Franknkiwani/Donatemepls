import { ref, get } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { db } from './firebase-config.js';

/**
 * OPENS THE QUICK VIEW DOSSIER
 * Triggered by window.openQuickProfile(uid) from the main feed
 */
window.openQuickProfile = async (targetUid) => {
    // 1. Prevent background scrolling
    document.body.style.overflow = 'hidden';
    
    // 2. Update URL for deep-linking
    window.location.hash = `profile-${targetUid}`;

    // 3. Setup/Clear Modal Container
    let modal = document.getElementById('quick-profile-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'quick-profile-modal';
        modal.className = "fixed inset-0 z-[200] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4 md:p-6 transition-all duration-300";
        document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
    modal.innerHTML = `<div class="animate-spin rounded-full h-12 w-12 border-t-2 border-emerald-500"></div>`;

    // 4. Fetch User Data
    try {
        const snap = await get(ref(db, `users/${targetUid}`));
        const u = snap.val();

        if (!u) {
            modal.innerHTML = `<div class="text-white font-black uppercase tracking-widest opacity-20">Profile Not Found</div>`;
            return;
        }

        const isPro = u.isPremium || u.premium || false;

        // 5. Render High-End Dossier UI
        modal.innerHTML = `
            <div class="bg-zinc-950 border border-white/10 w-full max-w-[440px] rounded-[50px] overflow-hidden relative shadow-[0_50px_100px_rgba(0,0,0,0.8)] animate-in zoom-in duration-300">
                
                <button onclick="closeQuickProfile()" class="absolute top-6 right-6 z-30 bg-black/40 text-white w-12 h-12 rounded-full border border-white/10 hover:bg-white/10 transition-all flex items-center justify-center text-2xl font-light">&times;</button>
                
                <div class="h-40 bg-zinc-900 relative">
                    <img src="${u.banner || 'https://wallpapers.com/images/hd/gaming-profile-pictures-tt8bbzdcf6zibhoi.jpg'}" class="w-full h-full object-cover opacity-50">
                    <div class="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent"></div>
                </div>

                <div class="px-8 pb-12 -mt-20 relative z-10 text-center">
                    
                    <div class="relative inline-block">
                        <img src="${u.avatar}" class="w-36 h-36 rounded-[45px] border-[6px] border-zinc-950 object-cover shadow-2xl">
                        ${isPro ? '<div class="absolute -bottom-2 -right-2 bg-pink-500 p-2 rounded-2xl shadow-lg animate-bounce"><img src="https://img.icons8.com/color/48/verified-badge.png" class="w-5 h-5"></div>' : ''}
                    </div>
                    
                    <div class="mt-6 bg-white/5 backdrop-blur-2xl px-6 py-2.5 rounded-2xl border border-white/10 inline-flex items-center gap-3">
                        <h2 class="text-2xl font-black italic text-white uppercase tracking-tighter">@${u.username}</h2>
                        ${isPro ? '<img src="https://i.imgur.com/BoVp6Td.png" class="w-6 h-6 object-contain">' : ''}
                    </div>

                    <p class="text-zinc-500 text-xs mt-6 italic leading-relaxed px-6 opacity-80">
                        "${u.bio || 'This member has not set a bio yet. Stay tuned for updates.'}"
                    </p>

                    <div class="grid grid-cols-2 gap-4 mt-8">
                        <div class="bg-white/5 p-5 rounded-[35px] border border-white/5 shadow-inner group hover:border-emerald-500/30 transition-all">
                            <p class="text-[9px] text-zinc-500 font-black uppercase tracking-[2px] mb-1">Networth</p>
                            <div class="flex items-center justify-center gap-1">
                                <span class="text-xl text-emerald-400 font-black tracking-tighter">${u.tokens || 0}</span>
                                <span class="text-[10px] text-emerald-600 font-bold uppercase">TKN</span>
                            </div>
                        </div>
                        
                        <div class="bg-white/5 p-5 rounded-[35px] border border-white/5 shadow-inner group hover:border-white/20 transition-all">
                            <p class="text-[9px] text-zinc-500 font-black uppercase tracking-[2px] mb-1">Total</p>
                            <div class="flex items-center justify-center gap-1">
                                <span class="text-xl text-white font-black tracking-tighter">${u.totalReceivedTokens || 0}</span>
                                <span class="text-[10px] text-zinc-600 font-bold uppercase">TKN</span>
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-3.5 mt-10">
                        <button onclick="handleTip('${targetUid}', '${u.username}', '${u.avatar}')" 
                            class="py-5 bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase rounded-2xl shadow-[0_15px_30px_rgba(16,185,129,0.2)] active:scale-95 transition-all text-[11px] tracking-widest">
                            Donate
                        </button>
                        
                        <button onclick="window.openRequestPanel('${targetUid}', '${u.username}')" 
                            class="py-5 bg-white/5 hover:bg-white/10 text-white font-black uppercase rounded-2xl border border-white/10 active:scale-95 transition-all text-[11px] tracking-widest">
                            Request
                        </button>
                    </div>

                    <a href="profile.html?id=${targetUid}" class="block mt-10 text-[9px] font-black uppercase text-zinc-700 hover:text-emerald-500 tracking-[5px] transition-all">
                        Open Full Records &rarr;
                    </a>
                </div>
            </div>
        `;
    }
} catch (error) {
    console.error("Modal Error:", error);
    modal.innerHTML = `<div class="text-red-500 font-black uppercase">Load Error</div>`;
}
};

/**
 * CLOSES MODAL & RESTORES PAGE
 */
window.closeQuickProfile = () => {
    document.body.style.overflow = '';
    const modal = document.getElementById('quick-profile-modal');
    if (modal) {
        modal.classList.add('animate-out', 'fade-out', 'zoom-out');
        setTimeout(() => {
            modal.style.display = 'none';
            window.history.replaceState(null, null, ' '); // Clear hash
        }, 200);
    }
};
