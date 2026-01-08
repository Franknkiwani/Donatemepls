import { db, auth } from './firebase-config.js';
import { ref, onValue, get, set, update } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";

// --- STATE & CONFIG ---
const PRESETS = [
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=James"
];

let activeTarget = { id: null, type: null };

// --- UTILS ---
const toggleModal = (id, show) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', !show);
};

// --- 1. SEARCH LOGIC ---
export const searchUser = () => {
    const query = document.getElementById('user-search-input')?.value.toLowerCase().trim();
    if (!query) return resetSearch();

    // Clean query for handles/tags
    const cleanQuery = query.replace(/[@#]/g, '');

    // Search Campaigns
    document.querySelectorAll('#campaign-grid > div').forEach(card => {
        card.classList.toggle('hidden', !card.innerText.toLowerCase().includes(cleanQuery));
    });

    // Search Users
    document.querySelectorAll('#user-feed-grid > div').forEach(card => {
        const handle = card.getAttribute('data-handle')?.toLowerCase() || "";
        card.classList.toggle('hidden', !handle.includes(cleanQuery));
    });
};

const resetSearch = () => {
    document.querySelectorAll('#campaign-grid > div, #user-feed-grid > div').forEach(c => c.classList.remove('hidden'));
};

// --- 2. VIEW SWITCHER ---
export const switchView = (view) => {
    const isCamp = view === 'campaigns';
    
    // Toggle Sections
    document.getElementById('view-campaigns')?.classList.toggle('hidden', !isCamp);
    document.getElementById('view-community')?.classList.toggle('hidden', isCamp);

    // Update Buttons
    const campBtn = document.getElementById('tab-campaigns');
    const commBtn = document.getElementById('tab-community');

    if (campBtn) campBtn.className = isCamp 
        ? "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase bg-amber-500 text-black shadow-lg" 
        : "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase text-zinc-500 hover:text-white";

    if (commBtn) commBtn.className = !isCamp 
        ? "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase bg-emerald-500 text-black shadow-lg" 
        : "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase text-zinc-500 hover:text-white";
};

// --- 3. CAMPAIGN LOGIC ---
export const loadCampaigns = () => {
    const grid = document.getElementById('campaign-grid');
    if (!grid) return;

    onValue(ref(db, 'campaigns'), (snapshot) => {
        const campaigns = snapshot.val();
        grid.innerHTML = '';
        if(!campaigns) return;

        Object.entries(campaigns).forEach(([id, c]) => {
            if (c.deadline && Date.now() > c.deadline) {
                archiveCampaign(id, c);
                return;
            }
            grid.appendChild(createCampaignCard(id, c));
            startCountdown(id, c.deadline);
            loadDonors(id);
        });
    });
};

const createCampaignCard = (id, c) => {
    const card = document.createElement('div');
    const progress = Math.min((c.raised / c.goal) * 100, 100);
    const isPro = c.creatorIsPremium || false;

    card.className = `p-6 rounded-[32px] border relative flex flex-col gap-4 mb-4 transition-all ${isPro ? 'border-pink-500/50 bg-white/5' : 'border-white/5 bg-zinc-900/40'}`;
    card.innerHTML = `
        <div class="flex justify-between items-center text-[8px] font-black uppercase">
            <div class="px-2 py-1 rounded-full bg-black/40 text-pink-500 border border-pink-500/20">Ends: <span id="timer-${id}">...</span></div>
            <span class="text-zinc-500 italic">${c.country || 'Global'}</span>
        </div>
        <div class="flex gap-4 items-start">
            <img src="https://img.icons8.com/fluency/96/charity.png" class="w-14 h-14 rounded-xl bg-zinc-800 p-2">
            <div class="flex-1 min-w-0">
                <h3 class="text-sm font-black text-white truncate">${c.title} ${isPro ? '⭐' : ''}</h3>
                <p class="text-[10px] text-zinc-400 mt-1 line-clamp-2">${c.description}</p>
            </div>
        </div>
        <div class="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div class="h-full bg-pink-500" style="width: ${progress}%"></div>
        </div>
        <div id="donors-${id}" class="flex -space-x-2 min-h-[24px]"></div>
        <div class="flex items-center justify-between border-t border-white/5 pt-3">
            <span class="text-[9px] font-black text-zinc-400">@${c.creatorName}</span>
            <button onclick="handleDonateCampaign('${id}', '${c.title}')" class="px-5 py-2 bg-white text-black rounded-xl text-[10px] font-black uppercase">Donate</button>
        </div>
    `;
    return card;
};

// --- 4. DONATION LOGIC ---
export const handleDonateCampaign = (id, title) => {
    activeTarget = { id, type: 'campaign' };
    document.getElementById('donate-target-name-display').innerText = title;
    document.getElementById('donate-input-amount').value = '';
    toggleModal('modern-donate-modal', true);
};

export const confirmDonation = async () => {
    const user = auth.currentUser;
    const amount = parseInt(document.getElementById('donate-input-amount').value);
    
    if (!user || isNaN(amount) || amount <= 0) return alert("Invalid Donation");

    try {
        const userRef = ref(db, `users/${user.uid}`);
        const snap = await get(userRef);
        const myTokens = snap.val()?.tokens || 0;

        if (myTokens < amount) return alert("Insufficient tokens!");

        const net = Math.floor(amount * 0.7);
        const fee = amount - net;

        // Deduct from me
        await update(userRef, { tokens: myTokens - amount });

        // Add to campaign
        const campRef = ref(db, `campaigns/${activeTarget.id}`);
        const cSnap = await get(campRef);
        await update(campRef, { raised: (cSnap.val()?.raised || 0) + net });

        // Record donor
        await set(ref(db, `campaign_donors/${activeTarget.id}/${user.uid}`), {
            uid: user.uid,
            avatar: snap.val()?.avatar || PRESETS[0],
            timestamp: Date.now()
        });

        alert("Success!");
        toggleModal('modern-donate-modal', false);
    } catch (e) { console.error(e); }
};
