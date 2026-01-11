// 1. IMPORT CONFIGURATION
import { 
    ref, 
    onValue, 
    get, 
    query, 
    limitToLast, 
    push, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { auth, db } from './firebase-config.js';

// 2. CONSTANTS & UTILITIES
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

// --- DEEP LINKING ---
window.addEventListener('load', () => {
    if (window.location.hash.startsWith('#profile-')) {
        const uid = window.location.hash.replace('#profile-', '');
        window.openQuickProfile(uid);
    }
});

// --- DYNAMIC USER FEED ENGINE ---
window.loadUserFeed = async () => {
    const feedGrid = document.getElementById('user-feed-grid');
    if (!feedGrid) return;

    // Clean up old listeners to prevent memory leaks
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

            // Ad/Banner Injections at slots 3, 8, 16
            if (userPos === 3 || userPos === 8 || userPos === 16) {
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
                            <img src="${u.avatar || communityPresets[0]}" class="w-full h-full object-cover rounded-[18px]" loading="lazy">
                        </div>

                        <div class="flex-1 min-w-0">
                            <div class="flex justify-between items-center gap-1 mb-1.5">
                                <div class="bg-white/5 backdrop-blur-xl px-2.5 py-1 rounded-xl border border-white/10 flex items-center gap-2 max-w-full overflow-hidden">
                                    <span class="font-black text-[10px] text-white uppercase italic tracking-tight truncate pr-1">@${u.username || 'Member'}</span>
                                    ${isPro ? '<img src="https://img.icons8.com/color/48/verified-badge.png" class="w-3.5 h-3.5">' : ''}
                                    ${(isPro || isAdmin) ? '<img src="https://i.imgur.com/BoVp6Td.png" class="w-4 h-4 object-contain">' : ''}
                                    ${isAdmin ? '<span class="text-[7px] bg-amber-500 text-black px-1.5 rounded-sm font-black">STAFF</span>' : ''}
                                </div>
                                <span class="text-xs flex-shrink-0">${u.mood === 'happy' ? '😊' : u.mood === 'sad' ? '😔' : '😐'}</span>
                            </div>
                            
                            <p class="text-[10px] text-zinc-400 italic line-clamp-1 mb-3 px-1 leading-tight">
                                ${u.bio || 'Sharing the energy on the platform!'}
                            </p>

                            <div class="flex items-center justify-between px-1">
                                <span class="text-[8px] bg-black/40 px-2 py-0.5 rounded-full text-zinc-500 font-bold uppercase border border-white/5">
                                    ${u.country || 'Global'}
                                </span>
                                <div class="flex items-center gap-3">
                                    <a href="https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareText}" target="_blank" class="opacity-40 hover:opacity-100 transition-all"><img src="https://img.icons8.com/ios-filled/50/ffffff/twitterx.png" class="w-3 h-3"></a>
                                    <a href="https://wa.me/?text=${shareText}%20${shareUrl}" target="_blank" class="opacity-40 hover:opacity-100 transition-all"><img src="https://img.icons8.com/ios-filled/50/ffffff/whatsapp.png" class="w-3 h-3"></a>
                                    <a href="https://www.facebook.com/sharer/sharer.php?u=${shareUrl}" target="_blank" class="opacity-40 hover:opacity-100 transition-all"><img src="https://img.icons8.com/ios-filled/50/ffffff/facebook-new.png" class="w-3 h-3"></a>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-2.5 mt-5">
                        <button onclick="handleTip('${uid}', '${u.username}', '${u.avatar}')" 
                            class="py-3 ${isPro ? 'bg-pink-600' : 'bg-emerald-500'} text-black text-[10px] font-black uppercase rounded-2xl shadow-lg active:scale-95 transition-all">
                            Donate
                        </button>
                        <button onclick="window.openQuickProfile('${uid}')" 
                            class="py-3 bg-white/5 text-white text-[10px] font-black uppercase rounded-2xl border border-white/10 hover:bg-white/10 active:scale-95 transition-all">
                            Profile
                        </button>
                    </div>
                `;
            });
            activeListeners.push(unsubscribe);
        });
    } catch (e) { console.error(e); }
};

// --- PROFILE MODAL (FULL VERSION) ---
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
    modal.innerHTML = `<div class="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-500"></div>`;

    const snap = await get(ref(db, `users/${targetUid}`));
    const u = snap.val();

    if (u) {
        const shareUrl = encodeURIComponent(`${window.location.origin}${window.location.pathname}#profile-${targetUid}`);
        const shareText = encodeURIComponent(`Check out @${u.username}'s profile!`);

        modal.innerHTML = `
            <div class="bg-zinc-950 border border-white/10 w-full max-w-[420px] rounded-[45px] overflow-hidden relative shadow-[0_50px_100px_rgba(0,0,0,0.9)] animate-in zoom-in duration-300">
                
                <button onclick="closeQuickProfile()" class="absolute top-5 right-5 z-20 bg-black/60 text-white w-10 h-10 rounded-full border border-white/10 hover:scale-110 transition-all">&times;</button>
                
                <div class="h-36 bg-zinc-900 relative">
                    <img src="${u.banner || communityPresets[1]}" class="w-full h-full object-cover opacity-60">
                    <div class="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent"></div>
                </div>

                <div class="px-8 pb-10 -mt-20 relative z-10 text-center">
                    <img src="${u.avatar || communityPresets[0]}" class="w-32 h-32 rounded-[40px] border-[6px] border-zinc-950 object-cover mx-auto shadow-2xl">
                    
                    <div class="mt-5 bg-white/5 backdrop-blur-2xl px-5 py-2 rounded-2xl border border-white/10 inline-flex items-center gap-2 shadow-xl">
                        <h2 class="text-2xl font-black italic text-white uppercase tracking-tighter">@${u.username}</h2>
                        ${(u.isPremium || u.premium) ? '<img src="https://i.imgur.com/BoVp6Td.png" class="w-6 h-6">' : ''}
                    </div>

                    <p class="text-zinc-400 text-xs mt-5 italic leading-relaxed px-4 opacity-80">"${u.bio || 'Elite community member.'}"</p>

                    <div class="grid grid-cols-3 gap-2.5 mt-7">
                        <div class="bg-white/5 p-3.5 rounded-[22px] border border-white/5">
                            <p class="text-[8px] text-zinc-500 font-black uppercase tracking-widest mb-1">Region</p>
                            <p class="text-[11px] text-white font-bold truncate uppercase">${u.country || 'Global'}</p>
                        </div>
                        <div class="bg-white/5 p-3.5 rounded-[22px] border border-white/5">
                            <p class="text-[8px] text-zinc-500 font-black uppercase tracking-widest mb-1">Tokens</p>
                            <p class="text-[11px] text-white font-bold">${u.totalReceivedTokens || '0'}</p>
                        </div>
                        <div class="bg-white/5 p-3.5 rounded-[22px] border border-white/5">
                            <p class="text-[8px] text-zinc-500 font-black uppercase tracking-widest mb-1">Status</p>
                            <p class="text-[11px] text-pink-500 font-black">${u.isPremium ? 'PRO' : 'FREE'}</p>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-3 mt-8">
                        <button onclick="handleTip('${targetUid}', '${u.username}', '${u.avatar}')" 
                            class="py-4.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase rounded-2xl shadow-lg active:scale-95 transition-all text-xs">
                            Donate
                        </button>
                        <button onclick="openRequestPanel('${targetUid}', '${u.username}')" 
                            class="py-4.5 bg-white/10 hover:bg-white/20 text-white font-black uppercase rounded-2xl border border-white/10 active:scale-95 transition-all text-xs">
                            Request
                        </button>
                    </div>

                    <a href="profile.html?id=${targetUid}" class="block mt-7 text-[10px] font-black uppercase text-zinc-600 hover:text-white tracking-[4px] transition-all">
                        View Full Records &rarr;
                    </a>

                    <div class="mt-8 flex justify-center gap-8 pt-7 border-t border-white/5">
                        <a href="https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareText}" target="_blank"><img src="https://img.icons8.com/ios-filled/50/ffffff/twitterx.png" class="w-5 h-5 opacity-40 hover:opacity-100 transition-all hover:scale-110"></a>
                        <a href="https://wa.me/?text=${shareText}%20${shareUrl}" target="_blank"><img src="https://img.icons8.com/ios-filled/50/ffffff/whatsapp.png" class="w-5 h-5 opacity-40 hover:opacity-100 transition-all hover:scale-110"></a>
                        <a href="https://www.facebook.com/sharer/sharer.php?u=${shareUrl}" target="_blank"><img src="https://img.icons8.com/ios-filled/50/ffffff/facebook-new.png" class="w-5 h-5 opacity-40 hover:opacity-100 transition-all hover:scale-110"></a>
                    </div>
                </div>
            </div>
        `;
    }
};

window.closeQuickProfile = () => {
    toggleScroll(false);
    document.getElementById('quick-profile-modal').style.display = 'none';
    window.history.replaceState(null, null, ' '); 
};

// --- REQUEST SYSTEM ---
window.openRequestPanel = (targetUid, username) => {
    const overlay = document.createElement('div');
    overlay.id = 'request-panel-overlay';
    overlay.className = "fixed inset-0 z-[110] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300";
    
    overlay.innerHTML = `
        <div class="bg-zinc-900 border border-white/10 w-full max-w-[400px] rounded-[35px] p-8 shadow-2xl relative">
            <h3 class="text-white font-black uppercase tracking-widest text-lg mb-2 italic">Send Request</h3>
            <p class="text-zinc-500 text-[10px] uppercase font-bold mb-6">Recipient: <span class="text-pink-500">@${username}</span></p>
            
            <textarea id="request-message" 
                placeholder="What would you like to request? (e.g. Collaboration, Shoutout, Custom Work)" 
                class="w-full h-32 bg-black/40 border border-white/5 rounded-2xl p-4 text-white text-sm focus:outline-none focus:border-pink-500/50 transition-all resize-none mb-6"
            ></textarea>

            <div class="grid grid-cols-2 gap-3">
                <button onclick="document.getElementById('request-panel-overlay').remove()" 
                    class="py-4 bg-white/5 text-zinc-400 text-[10px] font-black uppercase rounded-2xl hover:bg-white/10 transition-all">
                    Cancel
                </button>
                <button onclick="submitRequest('${targetUid}')" 
                    id="submit-req-btn"
                    class="py-4 bg-emerald-500 text-black text-[10px] font-black uppercase rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-all">
                    Send Request
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
};

window.submitRequest = async (targetUid) => {
    const msgInput = document.getElementById('request-message');
    const msg = msgInput.value.trim();
    const btn = document.getElementById('submit-req-btn');
    const user = auth.currentUser;

    if (!user) {
        notify("You must be logged in to send requests!");
        return;
    }

    if (msg.length < 5) {
        notify("Please enter a more detailed message.");
        return;
    }

    btn.disabled = true;
    btn.innerText = "Processing...";
    btn.classList.add('opacity-50');

    try {
        await push(ref(db, `requests/${targetUid}`), {
            senderUid: user.uid,
            senderName: user.displayName || "Anonymous",
            message: msg,
            timestamp: serverTimestamp(),
            status: 'unread'
        });

        notify("Request sent successfully!");
        document.getElementById('request-panel-overlay').remove();
    } catch (error) {
        console.error("Request Error:", error);
        notify("Failed to send request. Try again.");
        btn.disabled = false;
        btn.innerText = "Send Request";
        btn.classList.remove('opacity-50');
    }
};
