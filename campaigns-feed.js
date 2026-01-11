import { ref, get, query, orderByChild, limitToLast, endBefore, onValue } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { db } from './firebase-config.js';

// --- STATE MANAGER ---
let lastVisibleTimestamp = null;
let isFetching = false;
let reachedEnd = false;

/**
 * MASTER SKELETON GENERATOR
 */
export const injectSkeletons = () => {
    const loader = document.getElementById('master-loader');
    if (!loader) return;

    loader.innerHTML = `
        <div class="max-w-6xl mx-auto p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            ${Array(6).fill(0).map(() => `
                <div class="skeleton-card p-5 rounded-[32px] border flex flex-col gap-4" style="background: var(--card-bg); border-color: var(--border);">
                    <div class="flex justify-between">
                        <div class="w-24 h-4 rounded-full shimmer"></div>
                        <div class="w-16 h-4 rounded-full shimmer"></div>
                    </div>
                    <div class="flex gap-4">
                        <div class="w-16 h-16 rounded-2xl shimmer flex-shrink-0"></div>
                        <div class="flex-1 space-y-2">
                            <div class="w-3/4 h-4 rounded shimmer"></div>
                            <div class="w-full h-3 rounded shimmer"></div>
                        </div>
                    </div>
                    <div class="space-y-2 py-2">
                        <div class="flex justify-between"><div class="w-12 h-3 shimmer"></div><div class="w-12 h-3 shimmer"></div></div>
                        <div class="w-full h-1.5 rounded-full shimmer"></div>
                    </div>
                    <div class="flex justify-between items-center border-t pt-3" style="border-color: var(--border)">
                        <div class="w-20 h-4 rounded shimmer"></div>
                        <div class="flex gap-2">
                            <div class="w-8 h-8 rounded-xl shimmer"></div>
                            <div class="w-20 h-8 rounded-xl shimmer"></div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
};

window.signalDataReady = (type) => {
    const loader = document.getElementById('master-loader');
    if (loader) {
        loader.classList.add('loader-fade-out');
        setTimeout(() => loader.remove(), 600);
    }
};

const shuffleBatch = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

const getRemainingTime = (deadline) => {
    const diff = deadline - Date.now();
    if (diff <= 0) return "EXPIRED";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff / (1000 * 60)) % 60);
    return `${hours}H ${mins}M LEFT`;
};

/**
 * Main Loader - Optimized Batching
 */
window.loadCampaigns = async (isInitial = true) => {
    if (isFetching || (reachedEnd && !isInitial)) return;
    
    const grid = document.getElementById('campaign-grid');
    if (!grid) return;

    isFetching = true;

    if (isInitial) {
        grid.innerHTML = '';
        lastVisibleTimestamp = null;
        reachedEnd = false;
        injectSkeletons();
    }

    try {
        let q;
        if (isInitial) {
            q = query(ref(db, 'campaigns'), orderByChild('timestamp'), limitToLast(5));
        } else {
            q = query(ref(db, 'campaigns'), orderByChild('timestamp'), endBefore(lastVisibleTimestamp), limitToLast(5));
        }

        const snapshot = await get(q);
        const data = snapshot.val();

        if (!data) {
            if (isInitial) {
                grid.innerHTML = `<div class="col-span-full py-20 text-center opacity-40 uppercase tracking-widest text-[10px] font-black" style="color: var(--text-dim)">No active missions</div>`;
                window.signalDataReady('campaigns');
            }
            reachedEnd = true;
            return;
        }

        let items = Object.keys(data).map(id => ({ id, ...data[id] }));
        items.sort((a, b) => b.timestamp - a.timestamp);
        lastVisibleTimestamp = items[items.length - 1].timestamp;
        
        const displayItems = shuffleBatch([...items]);
        if (items.length < 5) reachedEnd = true;

        displayItems.forEach(c => {
            if (c.visibility === 'private') return;
            renderCampaignCard(c, grid);
        });

        if (isInitial) window.signalDataReady('campaigns');

    } catch (e) {
        console.error("Scroll Fetch Error:", e);
        if (isInitial) window.signalDataReady('campaigns');
    } finally {
        isFetching = false;
    }
};

const renderCampaignCard = (c, container) => {
    const id = c.id;
    const now = Date.now();
    const isBoosted = ((c.tokensBudget || 0) * 3 > (c.viewsActive || 0));
    const isPro = c.creatorIsPremium || false;
    const progress = Math.min((c.raised / c.goal) * 100, 100);

    const card = document.createElement('div');
    card.className = `p-5 rounded-[32px] border relative flex flex-col gap-4 transition-all duration-500 hover:translate-y-[-4px] shadow-sm`;
    card.style.backgroundColor = 'var(--card-bg)';
    card.style.borderColor = isBoosted ? '#f59e0b' : 'var(--border)';
    
    if (isBoosted) card.style.boxShadow = '0 0 25px rgba(245,158,11,0.15)';

    card.innerHTML = `
        <div class="flex justify-between items-center">
            <div class="flex items-center gap-2">
                <div class="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-full border border-white/5">
                    <div class="w-1.5 h-1.5 rounded-full ${now > (c.deadline - 3600000) ? 'bg-orange-500 animate-pulse' : 'bg-emerald-500'}"></div>
                    <span class="text-[9px] font-black uppercase countdown-timer" data-deadline="${c.deadline}" style="color: var(--text-main)">
                        ${getRemainingTime(c.deadline)}
                    </span>
                </div>
                ${isBoosted ? '<span class="bg-amber-500 text-black text-[7px] font-black px-2 py-0.5 rounded-full">⚡ BOOSTED</span>' : ''}
            </div>
            <span class="text-[9px] font-black uppercase tracking-widest" style="color: var(--text-dim)">${c.category || 'Global'}</span>
        </div>

        <div class="flex gap-4 items-start">
            <div class="w-16 h-16 rounded-2xl bg-zinc-800 flex-shrink-0 border border-white/10 overflow-hidden relative shadow-lg">
                <img src="${c.imageUrl}" class="w-full h-full object-cover" loading="lazy">
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                    <h3 class="text-sm font-black uppercase truncate tracking-tight" style="color: var(--text-main)">${c.title}</h3>
                </div>
                <div class="text-[11px] leading-snug" style="color: var(--text-dim)">
                    <span id="desc-short-${id}">${formatCampaignText(c.description || '', 85)}</span>
                    <span id="desc-full-${id}" class="hidden">${formatCampaignText(c.description || '')}</span>
                    ${c.description?.length > 85 ? `<button onclick="toggleDesc('${id}')" id="btn-${id}" class="text-blue-500 font-bold ml-1">Read More</button>` : ''}
                </div>
            </div>
        </div>

        <div class="p-3 rounded-2xl border" style="background: var(--input-bg); border-color: var(--border)">
            <div class="flex justify-between text-[10px] font-black mb-2 px-1 uppercase">
                <span class="text-emerald-400">$${Number(c.raised || 0).toLocaleString()} <span style="color: var(--text-dim)" class="text-[8px] ml-1 font-bold">Raised</span></span>
                <span style="color: var(--text-main)">$${Number(c.goal || 0).toLocaleString()} <span style="color: var(--text-dim)" class="text-[8px] ml-1 font-bold">Goal</span></span>
            </div>
            <div class="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div class="h-full bg-gradient-to-r from-emerald-500 to-cyan-500" style="width: ${progress}%"></div>
            </div>
        </div>

        <div id="donors-${id}" class="flex -space-x-2 overflow-hidden mb-2 px-1"></div>

        <div class="flex items-center justify-between border-t pt-3 mt-auto" style="border-color: var(--border)">
            <button onclick="viewCreatorProfile('${c.creator}')" class="group flex items-center gap-2">
                <div class="relative">
                    <img src="${c.creatorAvatar || 'https://img.icons8.com/fluency/48/user-male-circle.png'}" class="w-6 h-6 rounded-full object-cover border border-white/10">
                </div>
                <span class="text-[9px] font-black uppercase" style="color: var(--text-dim)">@${c.creatorName || 'Member'}</span>
            </button>
            <div class="flex items-center gap-2">
                <button onclick="handleDonateCampaign('${id}', '${c.title.replace(/'/g, "\\'")}')" class="px-5 py-2.5 bg-white text-black rounded-xl text-[10px] font-black uppercase hover:scale-105 active:scale-95 transition-all shadow-md">Donate</button>
            </div>
        </div>
    `;
    container.appendChild(card);
    if(window.loadDonors) window.loadDonors(id);
};

// --- SCROLL LISTENER ---
window.addEventListener('scroll', () => {
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 200) {
        window.loadCampaigns(false);
    }
});

function formatCampaignText(text, limit = null) {
    if (!text) return "";
    let clean = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-blue-400 hover:underline">$1</a>')
                    .replace(/#(\w+)/g, '<span class="text-amber-500">#$1</span>');
    if (limit && text.length > limit) return clean.substring(0, limit) + "...";
    return clean;
}

window.toggleDesc = (id) => {
    const s = document.getElementById(`desc-short-${id}`);
    const f = document.getElementById(`desc-full-${id}`);
    const b = document.getElementById(`btn-${id}`);
    const isHidden = f.classList.contains('hidden');
    f.classList.toggle('hidden', !isHidden);
    s.classList.toggle('hidden', isHidden);
    b.innerText = isHidden ? "Less" : "Read More";
};

window.loadDonors = (campaignId) => {
    onValue(ref(db, `campaign_donors/${campaignId}`), (snap) => {
        const container = document.getElementById(`donors-${campaignId}`);
        if(!container) return;
        const data = snap.val();
        if(!data) return;
        container.innerHTML = '';
        Object.values(data).slice(0, 3).forEach(d => {
            container.innerHTML += `<img src="${d.avatar || 'https://img.icons8.com/fluency/48/user-male-circle.png'}" class="w-5 h-5 rounded-full border-2 border-zinc-900 -ml-1.5 first:ml-0 shadow-sm">`;
        });
    }, { onlyOnce: true });
};

// GLOBAL TIMER LOOP
setInterval(() => {
    document.querySelectorAll('.countdown-timer').forEach(el => {
        const deadline = parseInt(el.getAttribute('data-deadline'));
        const diff = deadline - Date.now();
        if (diff <= 0) { 
            el.innerText = "ENDED"; 
            el.style.color = "#ef4444";
            return; 
        }
        el.innerText = getRemainingTime(deadline);
    });
}, 1000);
