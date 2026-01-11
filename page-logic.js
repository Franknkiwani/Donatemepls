/**
 * PAGE-LOGIC.JS
 * Consolidated logic: Auth, Profile Sync, PayPal, Withdrawals, & Uploads
 */
import { 
    onAuthStateChanged, signInWithPopup, GoogleAuthProvider, 
    signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import { 
    ref, update, onValue, get, set, push,
    query, orderByChild, limitToLast, endBefore 
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { auth, db } from './firebase-config.js';

// --- 1. CONFIG & GLOBAL STATE ---
const PLAN_ID = 'P-47S21200XM2944742NFPLPEA';
const ADMIN_UID = "4xEDAzSt5javvSnW5mws2Ma8i8n1";
const presets = [
    "https://img.pikbest.com/origin/10/25/30/74apIkbEsT5qB.jpg!w700wp",
    "https://thumbs.dreamstime.com/b/cool-neon-party-wolf-headphones-black-background-colorful-illustration-music-theme-modern-portrait-bright-vibrant-385601082.jpg",
    "https://wallpapers.com/images/hd/gaming-profile-pictures-tt8bbzdcf6zibhoi.jpg"
];

let syncReady = { user: false, campaigns: false, buffer: false };
window.tempAvatar = null;

// --- 2. MASTER DATA SYNC & UI WAKE-UP ---
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
        
        // --- REAL-TIME DATA SYNC ---
        onValue(ref(db, `users/${user.uid}`), (s) => {
            const d = s.val() || {};
            const name = d.handle || d.username || "User";
            const avatar = d.profilepic || d.avatar || presets[0];

            // A. Header Sync
            if(document.getElementById('header-handle')) {
                document.getElementById('header-handle').innerText = isAdmin ? `👑 @${name}` : `@${name}`;
            }
            if(document.getElementById('header-pfp')) {
                document.getElementById('header-pfp').src = avatar;
                document.getElementById('header-pfp').classList.remove('hidden');
                document.getElementById('header-initial')?.classList.add('hidden');
            }

            // B. Profile & Premium Modal Previews
            if(document.getElementById('modal-preview-img')) document.getElementById('modal-preview-img').src = avatar;
            if(document.getElementById('username-input')) document.getElementById('username-input').value = name;
            if(document.getElementById('pro-pfp-preview')) document.getElementById('pro-pfp-preview').src = avatar;
            if(document.getElementById('pro-name-preview')) document.getElementById('pro-name-preview').innerText = name;

            // C. Token & Balance Sync
            const tokens = d.tokens || 0;
            const earned = d.earnedTokens || 0;
            if(document.getElementById('token-count')) {
                document.getElementById('token-count').innerText = tokens.toLocaleString();
                if(isAdmin) document.getElementById('token-count').classList.add('text-amber-500');
            }
            if(document.getElementById('wallet-purchased-bal')) document.getElementById('wallet-purchased-bal').innerText = tokens.toLocaleString();
            if(document.getElementById('wallet-earned-bal')) document.getElementById('wallet-earned-bal').innerText = earned.toLocaleString();

            // D. Pro Status Logic
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
                div.innerHTML = `<span class="text-[9px] font-black text-white uppercase">$${p.netAmount.toFixed(2)}</span><span class="text-[8px] font-black uppercase ${p.status === 'paid' ? 'text-emerald-500' : 'text-amber-500'}">${p.status}</span>`;
                historyList.appendChild(div);
            });
            if(document.getElementById('total-withdrawn')) document.getElementById('total-withdrawn').innerText = `$${totalPaid.toFixed(2)}`;
        });

        ['user-tools', 'token-bar'].forEach(id => document.getElementById(id)?.classList.remove('hidden'));
        document.getElementById('login-btn')?.classList.add('hidden');
        if (typeof setupPresence === 'function') setupPresence(user.uid);
    } else {
        ['user-tools', 'token-bar'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
        document.getElementById('login-btn')?.classList.remove('hidden');
        checkReady(); 
    }
});

// --- 3. PROFILE UPDATES & PFP UPLOAD ---
window.saveProfileChanges = async () => {
    const user = auth.currentUser;
    if(!user) return;
    const newName = document.getElementById('username-input').value.trim();
    let updates = {};
    if (window.tempAvatar) updates.profilepic = window.tempAvatar;
    if (newName) updates.handle = newName;

    await update(ref(db, `users/${user.uid}`), updates);
    notify("Profile Updated!"); 
    closeProfile();
};

const toggleUploadSpinner = (show) => {
    const spinner = document.getElementById('upload-spinner-modal');
    if (spinner) spinner.classList.toggle('hidden', !show);
    document.body.style.overflow = show ? 'hidden' : '';
};

document.getElementById('pfp-upload').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file || file.size > 2 * 1024 * 1024) return notify("Max 2MB required");
    
    toggleUploadSpinner(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
        try {
            const response = await fetch('/api/upload-pfp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: reader.result })
            });
            const data = await response.json();
            if (data.link) {
                window.tempAvatar = data.link;
                document.getElementById('modal-preview-img').src = data.link;
                notify("Cloud Sync Ready!");
            }
        } catch (err) { notify("Sync Failed"); }
        finally { toggleUploadSpinner(false); }
    };
};

// --- 4. WITHDRAWALS ---
document.getElementById('withdraw-amount')?.addEventListener('input', (e) => {
    const tokens = parseInt(e.target.value) || 0;
    const gross = tokens / 10;
    const fee = gross * 0.15;
    document.getElementById('calc-gross').innerText = `$${gross.toFixed(2)}`;
    document.getElementById('calc-fee').innerText = `-$${fee.toFixed(2)}`;
    document.getElementById('calc-net').innerText = `$${(gross - fee).toFixed(2)}`;
});

window.handleWithdrawSubmit = async () => {
    const user = auth.currentUser;
    const email = document.getElementById('withdraw-email').value;
    const amount = parseInt(document.getElementById('withdraw-amount').value);
    
    if (amount < 50) return notify("Min 50 Tokens");
    
    let adminSecret = null;
    if (user.uid === ADMIN_UID) adminSecret = await requestAdminSecret();

    try {
        const idToken = await user.getIdToken();
        const res = await fetch('/api/withdraw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken, email, amount, adminSecret })
        });
        if (res.ok) { notify("Success!"); closeWithdrawModal(); }
    } catch (e) { notify("Error processing withdrawal"); }
};

// --- 5. PAYPAL PURCHASE ---
window.buyPack = (amount, tokens) => {
    const container = document.getElementById('paypal-tokens-container');
    container.innerHTML = ''; 
    window.paypal.Buttons({
        style: { shape: 'pill', color: 'gold', layout: 'vertical' },
        createOrder: (data, actions) => actions.order.create({
            purchase_units: [{ amount: { value: amount.toString() }, custom_id: auth.currentUser.uid }]
        }),
        onApprove: async (data, actions) => {
            await actions.order.capture();
            const userRef = ref(db, `users/${auth.currentUser.uid}`);
            const snap = await get(userRef);
            await update(userRef, { tokens: (snap.val()?.tokens || 0) + tokens });
            notify(`Success! ${tokens} added.`);
            closeTokenModal();
        }
    }).render('#paypal-tokens-container');
};

// --- 6. GLOBAL HELPERS ---
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

lucide.createIcons();
