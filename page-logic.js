// --- page-logic.js ---
import { 
    onAuthStateChanged, signInWithPopup, GoogleAuthProvider, 
    signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import { 
    ref, update, onValue, get, set, push,
    query, orderByChild, limitToLast, endBefore 
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { auth, db } from './firebase-config.js';

// 1. CONFIG & STATE
const PLAN_ID = 'P-47S21200XM2944742NFPLPEA';
const ADMIN_UID = "4xEDAzSt5javvSnW5mws2Ma8i8n1";
const presets = [
    "https://img.pikbest.com/origin/10/25/30/74apIkbEsT5qB.jpg!w700wp",
    "https://thumbs.dreamstime.com/b/cool-neon-party-wolf-headphones-black-background-colorful-illustration-music-theme-modern-portrait-bright-vibrant-385601082.jpg",
    "https://wallpapers.com/images/hd/gaming-profile-pictures-tt8bbzdcf6zibhoi.jpg"
];

let syncReady = { user: false, campaigns: false, buffer: false };
window.tempAvatar = null;
window.authTab = 'login';

// 2. MASTER SYNC & UI WAKE-UP (BAN GUARD REMOVED)
setTimeout(() => { syncReady.buffer = true; checkReady(); }, 3000);

function checkReady() {
    if (syncReady.campaigns && syncReady.buffer) {
        if (!auth.currentUser || syncReady.user) {
            const loader = document.getElementById('master-loader');
            if (loader) {
                loader.classList.add('loader-fade-out');
                setTimeout(() => loader.remove(), 600);
            }
        }
    }
}

onAuthStateChanged(auth, async (user) => {
    // Content Loaders for everyone
    if (typeof loadCampaigns === 'function') {
        loadCampaigns().then(() => {
            setTimeout(() => { syncReady.campaigns = true; checkReady(); }, 500);
        });
    }
    if (typeof loadUserFeed === 'function') loadUserFeed();
    if (typeof switchView === 'function') switchView('campaigns');

    if (user) {
        const isAdmin = user.uid === ADMIN_UID;
        
        // --- REAL-TIME DATA LISTENER ---
        onValue(ref(db, `users/${user.uid}`), (s) => {
            const d = s.val() || {};
            const name = d.username || d.handle || "User";
            const avatar = d.avatar || d.profilepic || presets[0];

            // A. Update UI Elements
            if(document.getElementById('header-handle')) {
                document.getElementById('header-handle').innerText = isAdmin ? `👑 @${name}` : `@${name}`;
            }
            if(document.getElementById('header-pfp')) {
                document.getElementById('header-pfp').src = avatar;
                document.getElementById('header-pfp').classList.remove('hidden');
                document.getElementById('header-initial')?.classList.add('hidden');
            }

            // B. Profile & Modal Previews
            if(document.getElementById('modal-preview-img')) document.getElementById('modal-preview-img').src = avatar;
            if(document.getElementById('username-input')) document.getElementById('username-input').value = name;
            if(document.getElementById('pro-pfp-preview')) document.getElementById('pro-pfp-preview').src = avatar;
            if(document.getElementById('pro-name-preview')) document.getElementById('pro-name-preview').innerText = name;

            // C. Token Sync
            const tk = d.tokens || 0;
            if(document.getElementById('token-count')) {
                document.getElementById('token-count').innerText = tk.toLocaleString();
                if(isAdmin) document.getElementById('token-count').classList.add('text-amber-500');
            }
            if(document.getElementById('wallet-purchased-bal')) document.getElementById('wallet-purchased-bal').innerText = tk.toLocaleString();
            if(document.getElementById('wallet-earned-bal')) document.getElementById('wallet-earned-bal').innerText = (d.earnedTokens || 0).toLocaleString();

            // D. UI Adjustments
            const isPro = d.isPremium || isAdmin;
            document.getElementById('header-verified')?.classList.toggle('hidden', !isPro);
            document.querySelector('button[onclick="openUpgradeModal()"]')?.classList.toggle('hidden', isPro);

            syncReady.user = true;
            checkReady();
        });

        // --- PAYOUT HISTORY ---
        onValue(ref(db, `payouts`), (snapshot) => {
            const historyList = document.getElementById('payout-history-list');
            if(!historyList) return;
            historyList.innerHTML = '';
            let totalPaid = 0;
            Object.values(snapshot.val() || {}).filter(p => p.uid === user.uid).forEach(p => {
                if (p.status === 'paid' || p.status === 'completed') totalPaid += (p.netAmount || 0);
                const div = document.createElement('div');
                div.className = "flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5 mb-2";
                div.innerHTML = `<span class="text-[9px] font-black text-white">$${p.netAmount.toFixed(2)}</span><span class="text-[8px] font-black uppercase ${p.status === 'paid' ? 'text-emerald-500' : 'text-amber-500'}">${p.status}</span>`;
                historyList.appendChild(div);
            });
            if(document.getElementById('total-withdrawn')) document.getElementById('total-withdrawn').innerText = `$${totalPaid.toFixed(2)}`;
        });

        ['user-tools', 'token-bar'].forEach(id => document.getElementById(id)?.classList.remove('hidden'));
        document.getElementById('login-btn')?.classList.add('hidden');
        if (typeof setupPresence === 'function') setupPresence(user.uid);
        initPayPal();

    } else {
        ['user-tools', 'token-bar'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
        document.getElementById('login-btn')?.classList.remove('hidden');
        checkReady(); 
    }
});

// 3. AUTH & PROFILE
window.setAuthTab = (tab) => {
    window.authTab = tab;
    document.getElementById('reg-name-field')?.classList.toggle('hidden', tab === 'login');
    document.getElementById('tab-login').className = tab === 'login' ? 'pb-2 text-xs font-black uppercase border-b-2 border-amber-500' : 'pb-2 text-xs font-black uppercase text-zinc-500';
    document.getElementById('tab-register').className = tab === 'register' ? 'pb-2 text-xs font-black uppercase border-b-2 border-amber-500' : 'pb-2 text-xs font-black uppercase text-zinc-500';
};

window.handleAuthSubmit = async () => {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-pass').value;
    try {
        if (window.authTab === 'register') {
            const handle = document.getElementById('auth-username').value.trim();
            const res = await createUserWithEmailAndPassword(auth, email, pass);
            await set(ref(db, `users/${res.user.uid}`), { username: handle, tokens: 0, isPremium: false, avatar: presets[0] });
        } else { await signInWithEmailAndPassword(auth, email, pass); }
        closeAuthModal();
    } catch(e) { notify(e.message); }
};

window.saveProfileChanges = async () => {
    const user = auth.currentUser;
    if(!user) return;
    const newName = document.getElementById('username-input').value.trim();
    const snap = await get(ref(db, `users/${user.uid}`));
    const data = snap.val() || {};
    let updates = {};

    if (window.tempAvatar) updates.avatar = window.tempAvatar;
    if (newName && newName !== data.username) {
        const now = Date.now();
        const oneWeek = 7 * 24 * 60 * 60 * 1000;
        let history = (data.nameChanges || []).filter(ts => (now - ts) < oneWeek);
        if (!data.isPremium && history.length >= 2) return notify("Free users: Max 2 changes/week!");
        updates.username = newName;
        history.push(now);
        updates.nameChanges = history;
    }
    await update(ref(db, `users/${user.uid}`), updates);
    notify("Profile Updated!"); 
    closeProfile();
};

// 4. VERCEL UPLOAD HANDLER
document.getElementById('pfp-upload')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file || file.size > 2 * 1024 * 1024) return notify("Image too large (Max 2MB)");
    
    notify("Processing via Vercel...");
    const formData = new FormData();
    formData.append('image', file);

    try {
        const response = await fetch('/api/upload-pfp', { method: 'POST', body: formData });
        const data = await response.json();
        if (response.ok && data.link) {
            window.tempAvatar = data.link; 
            document.getElementById('modal-preview-img').src = data.link;
            notify("Verified! Click Update to save.");
        } else { notify(data.error || "Upload failed."); }
    } catch (err) { notify("Vercel connection error."); }
});

// 5. WITHDRAWAL & PAYPAL
document.getElementById('withdraw-amount')?.addEventListener('input', (e) => {
    const amount = parseInt(e.target.value) || 0;
    const gross = amount / 10;
    const fee = gross * 0.15;
    document.getElementById('calc-gross').innerText = `$${gross.toFixed(2)}`;
    document.getElementById('calc-fee').innerText = `-$${fee.toFixed(2)}`;
    document.getElementById('calc-net').innerText = `$${(gross - fee).toFixed(2)}`;
});

window.handleWithdrawSubmit = async () => {
    const user = auth.currentUser;
    const email = document.getElementById('withdraw-email').value.trim();
    const amount = parseInt(document.getElementById('withdraw-amount').value);
    if (!user || amount < 50) return notify("Min 50 Tokens");

    const btn = document.querySelector('button[onclick="handleWithdrawSubmit()"]');
    if(btn) btn.innerText = "Processing...";

    try {
        const idToken = await user.getIdToken(true);
        const res = await fetch('/api/withdraw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken, email, amount })
        });
        if (res.ok) { notify("Request Success!"); closeWithdrawModal(); }
    } catch (e) { notify("System error."); }
    finally { if(btn) btn.innerText = "Confirm Payout"; }
};

// 6. VIEW & SEARCH
window.switchView = (view) => {
    const isCamp = view === 'campaigns';
    document.getElementById('view-campaigns')?.classList.toggle('hidden', !isCamp);
    document.getElementById('view-community')?.classList.toggle('hidden', isCamp);
    document.getElementById('tab-campaigns').className = isCamp ? "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase bg-amber-500 text-black shadow-lg" : "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase text-zinc-500 hover:text-white";
    document.getElementById('tab-community').className = !isCamp ? "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase bg-emerald-500 text-black shadow-lg" : "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase text-zinc-500 hover:text-white";
};

window.searchUser = () => {
    const query = document.getElementById('user-search-input')?.value.toLowerCase().replace('@', '');
    document.querySelectorAll('#campaign-grid > div').forEach(card => card.classList.toggle('hidden', !card.innerText.toLowerCase().includes(query)));
    document.querySelectorAll('#user-feed-grid > div').forEach(card => {
        const handle = card.getAttribute('data-handle')?.toLowerCase() || "";
        card.classList.toggle('hidden', !handle.includes(query));
    });
};

// INITIALIZE PRESET GRID
const grid = document.getElementById('avatar-grid');
if(grid) {
    presets.forEach(url => {
        const img = document.createElement('img');
        img.src = url;
        img.className = "avatar-option w-full aspect-square object-cover rounded-xl cursor-pointer border-2 border-transparent hover:border-amber-500/50";
        img.onclick = () => { 
            window.tempAvatar = url; 
            document.getElementById('modal-preview-img').src = url;
            document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected', 'border-amber-500'));
            img.classList.add('selected', 'border-amber-500');
        };
        grid.appendChild(img);
    });
}

// LOGGING
window.logSecurityAction = async (actionType, metadata = {}) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
        const idToken = await user.getIdToken();
        await fetch('/api/security-audit', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken, actionType, metadata, timestamp: Date.now() })
        });
    } catch (e) { console.warn("AI Logging offline"); }
};
