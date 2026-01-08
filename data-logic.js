import { db, auth } from './firebase-config.js';
import { ref, onValue, get, set, update, query, orderByChild } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";

// --- CONFIG & CONSTANTS ---
const COMMUNITY_PRESETS = [
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=James"
];

let activeTarget = { id: null, type: null };

// --- 1. CAMPAIGN FEED & ARCHIVING ---
export const loadCampaigns = () => {
    const grid = document.getElementById('campaign-grid');
    if (!grid) return;

    onValue(ref(db, 'campaigns'), (snapshot) => {
        const campaigns = snapshot.val();
        grid.innerHTML = '';
        if(!campaigns) return;

        Object.keys(campaigns).forEach(id => {
            const c = campaigns[id];
            const now = Date.now();
            
            // Auto-Archive Expired
            if (c.deadline && now > c.deadline) {
                set(ref(db, `archived_campaigns/${id}`), { ...c, status: 'expired' });
                set(ref(db, `campaigns/${id}`), null);
                return;
            }

            const progress = Math.min((c.raised / c.goal) * 100, 100);
            const isPro = c.creatorIsPremium || false;
            
            const card = document.createElement('div');
            card.className = `p-6 rounded-[32px] border relative flex flex-col gap-4 transition-all mb-4 ${isPro ? 'border-pink-500/50 shadow-[0_0_20px_rgba(236,72,153,0.1)] bg-white/5' : 'border-white/5 bg-zinc-900/40'}`;

            card.innerHTML = `
                <div class="flex justify-between items-center text-[8px] font-black uppercase">
                    <div class="px-2 py-1 rounded-full bg-black/40 text-pink-500 border border-pink-500/20">Ends: <span id="timer-${id}">...</span></div>
                    <span class="text-zinc-500 italic">${c.country || 'Global'}</span>
                </div>
                <div class="flex gap-4 items-start">
                    <div class="w-14 h-14 rounded-xl bg-zinc-800 flex-shrink-0 border border-white/10 overflow-hidden">
                        <img src="https://img.icons8.com/fluency/96/charity.png" class="w-full h-full p-2">
                    </div>
                    <div class="flex-1 min-w-0">
                        <h3 class="text-sm font-black uppercase text-white truncate">${c.title}</h3>
                        <p class="text-[10px] text-zinc-400 mt-2 leading-relaxed">${c.description}</p>
                    </div>
                </div>
                <div class="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div class="h-full bg-gradient-to-r from-pink-500 to-rose-400" style="width: ${progress}%"></div>
                </div>
                <div class="flex items-center justify-between mt-2">
                    <button onclick="viewCreatorProfile('${c.creator}')" class="text-[9px] font-black uppercase text-zinc-400 flex items-center gap-1">@${c.creatorName || 'Member'}</button>
                    <button onclick="handleDonateCampaign('${id}', '${c.title}')" class="px-5 py-2 bg-white text-black rounded-xl text-[10px] font-black uppercase">Donate</button>
                </div>
            `;
            grid.appendChild(card);
            if(c.deadline) startCountdown(id, c.deadline);
        });
    });
};

// --- 2. USER FEED & TIPS ---
export const loadUserFeed = () => {
    const feedGrid = document.getElementById('user-feed-grid');
    if (!feedGrid) return;

    onValue(ref(db, 'users'), (snapshot) => {
        const users = snapshot.val();
        feedGrid.innerHTML = '';
        if (!users) return;
        
        Object.keys(users).forEach(uid => {
            const u = users[uid];
            const isPro = u.isPremium || false;
            const card = document.createElement('div');
            card.setAttribute('data-handle', u.username || "");
            card.className = `p-5 rounded-[24px] border relative transition-all ${isPro ? 'border-pink-500/30 bg-white/5' : 'border-white/5 bg-zinc-900/40'}`;
            
            card.innerHTML = `
                <div class="flex items-start gap-4">
                    <img src="${u.avatar || COMMUNITY_PRESETS[0]}" class="w-12 h-12 rounded-full border-2 ${isPro ? 'border-pink-500' : 'border-zinc-800'}">
                    <div class="flex-1">
                        <span class="font-black text-xs text-white uppercase italic">@${u.username}</span>
                        <p class="text-[9px] text-zinc-400 mt-1 line-clamp-2">${u.bio || 'Sharing the energy!'}</p>
                    </div>
                </div>
                <button onclick="handleTip('${uid}', '${u.username}', '${u.avatar}')" class="w-full mt-4 py-2 bg-emerald-500 text-black text-[10px] font-black uppercase rounded-xl">Tip User</button>
            `;
            feedGrid.appendChild(card);
        });
    });
};

// --- 3. TRANSACTIONS (DONATIONS & TIPS) ---
export const confirmDonation = async () => {
    const user = auth.currentUser;
    const amount = parseInt(document.getElementById('donate-input-amount').value);
    if (!user || isNaN(amount) || amount <= 0) return alert("Invalid Amount");

    try {
        const userRef = ref(db, `users/${user.uid}`);
        const snap = await get(userRef);
        const myTokens = snap.val()?.tokens || 0;

        if (myTokens < amount) return alert("Insufficient tokens!");

        const netAmount = Math.floor(amount * 0.7);
        const feeAmount = amount - netAmount;

        // Deduct from Sender
        await update(userRef, { tokens: myTokens - amount });

        if (activeTarget.type === 'user') {
            const tRef = ref(db, `users/${activeTarget.id}`);
            const tSnap = await get(tRef);
            await update(tRef, { tokens: (tSnap.val()?.tokens || 0) + netAmount });
        } else {
            const cRef = ref(db, `campaigns/${activeTarget.id}`);
            const cSnap = await get(cRef);
            await update(cRef, { raised: (cSnap.val()?.raised || 0) + netAmount });
        }

        alert("Donation Successful!");
        document.getElementById('modern-donate-modal').classList.add('hidden');
    } catch (e) { alert(e.message); }
};

// --- 4. WITHDRAWALS ---
export const handleWithdrawSubmit = async () => {
    const user = auth.currentUser;
    const email = document.getElementById('withdraw-email').value.trim();
    const amount = parseInt(document.getElementById('withdraw-amount').value);

    if (!user || isNaN(amount) || amount < 50) return alert("Min. 50 Tokens required");

    try {
        const userRef = ref(db, `users/${user.uid}`);
        const snap = await get(userRef);
        const currentTokens = snap.val()?.tokens || 0;

        if (currentTokens < amount) return alert("Insufficient tokens!");

        await update(userRef, { tokens: currentTokens - amount });

        const payoutId = Date.now();
        await set(ref(db, `payouts/${payoutId}_${user.uid}`), {
            uid: user.uid,
            paypal: email,
            tokens: amount,
            netAmount: (amount / 10) * 0.7,
            status: 'pending',
            timestamp: payoutId
        });

        alert("Request sent!");
        document.getElementById('withdraw-modal').classList.add('hidden');
    } catch (e) { alert(e.message); }
};

// --- 5. UTILS ---
const startCountdown = (id, deadline) => {
    const timerInterval = setInterval(() => {
        const el = document.getElementById(`timer-${id}`);
        if (!el) return clearInterval(timerInterval);
        const diff = deadline - Date.now();
        if (diff <= 0) {
            el.innerText = "ENDED";
            return clearInterval(timerInterval);
        }
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        el.innerText = `${d}d ${h}h ${m}s`;
    }, 1000);
};

export const handleTip = (uid, username, avatar) => {
    activeTarget = { id: uid, type: 'user' };
    document.getElementById('donate-target-name-display').innerText = `@${username}`;
    document.getElementById('donate-target-img').src = avatar || COMMUNITY_PRESETS[0];
    document.getElementById('modern-donate-modal').classList.remove('hidden');
};

export const handleDonateCampaign = (id, title) => {
    activeTarget = { id, type: 'campaign' };
    document.getElementById('donate-target-name-display').innerText = title;
    document.getElementById('modern-donate-modal').classList.remove('hidden');
};
