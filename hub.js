import { ref, get } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { auth, db } from './firebase-config.js';

// --- CONFIG & PRESETS ---
const presets = [
    "https://img.pikbest.com/origin/10/25/30/74apIkbEsT5qB.jpg!w700wp",
    "https://thumbs.dreamstime.com/b/cool-neon-party-wolf-headphones-black-background-colorful-illustration-music-theme-modern-portrait-bright-vibrant-385601082.jpg",
    "https://wallpapers.com/images/hd/gaming-profile-pictures-tt8bbzdcf6zibhoi.jpg"
];

const getRelativeTime = (ts) => {
    if (!ts) return "Recently";
    const ms = Date.now() - ts;
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return "Just now";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return `${Math.floor(hr / 24)}d ago`;
};

const getVerifiedBadge = () => `<svg class="w-2.5 h-2.5 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"></path></svg>`;

window.switchHubView = async (view) => {
    document.querySelectorAll('.hub-nav-btn').forEach(btn => {
        btn.classList.remove('active', 'text-blue-500');
        btn.classList.add('text-zinc-500');
    });
    
    const activeBtnId = view === 'live' ? 'btn-live' : (view === 'top-donors' ? 'btn-donors' : 'btn-earners');
    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) {
        activeBtn.classList.add('active', 'text-blue-500');
        activeBtn.classList.remove('text-zinc-500');
    }

    const container = document.getElementById('hub-content');
    if (!container) return;
    container.innerHTML = `<div class="flex flex-col items-center justify-center py-20 opacity-40"><div class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div><p class="text-[8px] font-black uppercase tracking-[0.2em] text-blue-500">Synchronizing Pulse...</p></div>`;

    try {
        if (view === 'live') {
            const snap = await get(ref(db, 'donations')); 
            const logs = snap.val();
            if (!logs) { container.innerHTML = `<div class="py-20 text-center opacity-30 text-[10px] font-black uppercase">No Signal Detected</div>`; return; }

            const sortedLogs = Object.entries(logs).sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0)).slice(0, 20);
            container.innerHTML = '';
            sortedLogs.forEach(([id, tx]) => {
                const isPrem = tx.fromIsPremium === true;
                container.insertAdjacentHTML('beforeend', `
                <div class="flex items-center gap-4 p-4 ${isPrem ? 'bg-blue-500/5 border-blue-500/30' : 'bg-white/5 border-white/5'} border rounded-[28px] animate-in slide-in-from-bottom-2">
                    <div class="flex -space-x-3 flex-shrink-0">
                        <img src="${tx.fromAvatar || presets[0]}" class="w-10 h-10 rounded-full border-2 border-black object-cover ${isPrem ? 'ring-2 ring-blue-500/40' : ''}">
                        <img src="${tx.toAvatar || presets[1]}" class="w-10 h-10 rounded-full border-2 border-black object-cover">
                    </div>
                    <div class="flex-1 min-w-0">
                        <h4 class="text-[10px] font-black text-white uppercase truncate flex items-center gap-1">
                            @${tx.fromName || 'User'} ${isPrem ? getVerifiedBadge() : ''}
                            <span class="text-blue-500 mx-1">→</span> ${tx.toName || 'Mission'}
                        </h4>
                        <p class="text-[7px] text-zinc-500 font-bold uppercase tracking-widest mt-1">${getRelativeTime(tx.timestamp)} • ${tx.type || 'Signal'}</p>
                    </div>
                    <div class="text-right">
                        <span class="text-xs font-black text-emerald-400">+$${tx.amount || 0}</span>
                    </div>
                </div>`);
            });

        } else {
            const sortKey = view === 'top-donors' ? 'totalDonated' : 'totalRaised';
            const snapshot = await get(ref(db, 'users'));
            const allData = snapshot.val() || {};

            const sorted = Object.entries(allData)
                .filter(([id, u]) => (u[sortKey] || 0) > 0)
                .sort((a, b) => (b[1][sortKey] || 0) - (a[1][sortKey] || 0))
                .slice(0, 25);

            if (sorted.length === 0) {
                container.innerHTML = `<div class="py-20 text-center"><p class="text-[9px] font-black uppercase text-zinc-600 tracking-widest">No Data Recorded Yet</p></div>`;
            } else {
                container.innerHTML = '';
                sorted.forEach(([id, item], index) => {
                    const rank = index + 1;
                    const isPrem = item.isPremium === true || item.premium === true;
                    
                    container.insertAdjacentHTML('beforeend', `
                    <div class="group flex items-center gap-4 p-4 rounded-[32px] ${isPrem ? 'bg-blue-500/5 border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.05)]' : 'bg-white/5 border-white/5'} border transition-all animate-in fade-in duration-300">
                        <div class="w-8 text-center font-black italic ${rank <= 3 ? 'text-blue-500' : 'text-zinc-800'}">${rank.toString().padStart(2, '0')}</div>
                        <div class="relative">
                            <img src="${item.avatar || presets[0]}" class="w-12 h-12 rounded-full object-cover border-2 border-white/5 shadow-xl ${isPrem ? 'ring-2 ring-blue-500' : ''}">
                            ${isPrem ? `<div class="absolute -right-1 -bottom-1 bg-blue-500 rounded-full p-0.5 border border-black shadow-lg"><svg class="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"></path></svg></div>` : ''}
                        </div>
                        <div class="flex-1 min-w-0">
                            <h4 class="text-[11px] font-black text-white uppercase truncate flex items-center gap-1">
                                @${item.username || 'User'} ${isPrem ? getVerifiedBadge() : ''}
                            </h4>
                            <p class="text-[7px] text-zinc-600 font-bold uppercase tracking-widest mt-0.5">${view === 'top-donors' ? 'Verified Donor' : 'Verified Recipient'}</p>
                        </div>
                        <div class="text-right">
                            <span class="text-sm font-black text-white italic">${item[sortKey] || 0}</span>
                            <p class="text-[7px] text-zinc-800 font-black uppercase">Tokens</p>
                        </div>
                    </div>`);
                });
            }

            const currentUser = auth.currentUser;
            if (currentUser && allData[currentUser.uid]) {
                renderStickyUserStats(allData[currentUser.uid], sortKey);
            }
        }
    } catch (e) { 
        console.error("Hub Error:", e);
        container.innerHTML = `<p class="text-center text-red-500 text-[8px] uppercase font-black py-20">Network Sync Error</p>`;
    }
};

function renderStickyUserStats(data, sortKey) {
    let bar = document.getElementById('user-hub-status');
    if (!bar) return;
    const label = sortKey === 'totalDonated' ? 'Donation Volume' : 'Total Earnings';
    const isPrem = data.isPremium === true || data.premium === true;

    bar.className = `sticky bottom-0 p-5 ${isPrem ? 'bg-blue-900/30 border-blue-500/50' : 'bg-black/90 border-blue-500/20'} border-t mt-4 backdrop-blur-2xl animate-in slide-in-from-bottom-full`;
    bar.innerHTML = `
        <div class="flex justify-between items-center max-w-2xl mx-auto">
            <div class="flex items-center gap-3">
                <div class="relative">
                    <img src="${data.avatar || presets[0]}" class="w-10 h-10 rounded-full object-cover border-2 border-blue-600">
                    <div class="absolute inset-0 rounded-full animate-pulse border border-blue-400"></div>
                </div>
                <div>
                    <p class="text-[10px] font-black text-white uppercase tracking-tight flex items-center gap-1">
                        @${data.username} ${isPrem ? getVerifiedBadge() : ''}
                    </p>
                    <p class="text-[7px] text-blue-500 font-black uppercase tracking-[0.2em]">${label}</p>
                </div>
            </div>
            <div class="text-right">
                <span class="text-xl font-black text-white italic">${data[sortKey] || 0}</span>
                <p class="text-[8px] text-zinc-600 font-black uppercase">My Total</p>
            </div>
        </div>`;
}
