    // 1. Importing tools from Google
    import { 
        onAuthStateChanged, signInWithPopup, GoogleAuthProvider, 
        signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword 
    } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
    import './wallet.js';
   import './chat.js';
import './modal-controls.js';
import './hub.js';
import './transactions.js';
import './User-Feed.js';
import './campaigns-feed.js';
import './security-guard.js';
import './page-logic.js';

    import { 
        ref, update, onValue, get, set, push,
        query, orderByChild, limitToLast, endBefore 
    } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";

    // 2. Importing the connection from your new file
    import { auth, db } from './firebase-config.js';

    // 3. YOUR IDS AND DATA KEPT EXACTLY AS THEY WERE:
    const PLAN_ID = 'P-47S21200XM2944742NFPLPEA';

    const presets = [
        "https://img.pikbest.com/origin/10/25/30/74apIkbEsT5qB.jpg!w700wp",
        "https://thumbs.dreamstime.com/b/cool-neon-party-wolf-headphones-black-background-colorful-illustration-music-theme-modern-portrait-bright-vibrant-385601082.jpg",
        "https://wallpapers.com/images/hd/gaming-profile-pictures-tt8bbzdcf6zibhoi.jpg"
    ];

    
// This version ONLY locks for Profile and Donation modals
const syncScrollLock = () => {
    const lockIds = ['profile-modal', 'modern-donate-modal', 'donation-success-modal'];
    const shouldLock = lockIds.some(id => {
        const el = document.getElementById(id);
        return el && !el.classList.contains('hidden');
    });
    document.body.style.overflow = shouldLock ? 'hidden' : '';
};

    // --- UTILS & THEME ---
    window.notify = (msg) => {
        const t = document.createElement('div');
        t.className = 'toast show'; t.innerText = msg;
        const box = document.getElementById('notify-box');
        if(box) box.appendChild(t);
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3000);
    };

    window.setTheme = (theme) => {
        document.body.className = theme;
        localStorage.setItem('user-theme', theme);
        document.querySelectorAll('.theme-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById(`btn-${theme}`);
        if(activeBtn) activeBtn.classList.add('active');
    };
    setTheme(localStorage.getItem('user-theme') || 'theme-dark');


    // --- AUTH LOGIC ---
    window.authTab = 'login';
    window.setAuthTab = (tab) => {
        window.authTab = tab;
        document.getElementById('reg-name-field').classList.toggle('hidden', tab === 'login');
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
                await set(ref(db, `users/${res.user.uid}`), { username: handle, tokens: 0, isPremium: false });
            } else { await signInWithEmailAndPassword(auth, email, pass); }
            closeAuthModal();
        } catch(e) { notify(e.message); }
    };
    window.triggerGoogle = () => signInWithPopup(auth, new GoogleAuthProvider()).then(closeAuthModal);
    window.handleLogout = () => signOut(auth).then(() => location.reload());

    // --- PROFILE & NAME CHANGE (WITH COOLDOWN) ---
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
            let history = (data.nameChanges || []).filter(timestamp => (now - timestamp) < oneWeek);

            if (!data.isPremium && history.length >= 2) {
                return notify("Free users: Only 2 name changes per week!");
            }
            
            updates.username = newName;
            history.push(now);
            updates.nameChanges = history;
        }

        await update(ref(db, `users/${user.uid}`), updates);
        notify("Profile Updated!"); 
        closeProfile();
    };

    // --- PAYPAL ---
    function initPayPal() {
        const target = document.getElementById(`paypal-button-container-${PLAN_ID}`) || document.getElementById('paypal-button-container-PRO');
        if (!window.paypal || !target || target.hasChildNodes()) return;
        window.paypal.Buttons({
            style: { shape: 'pill', color: 'gold', layout: 'vertical', label: 'subscribe' },
            createSubscription: (data, actions) => {
                return actions.subscription.create({ plan_id: PLAN_ID, custom_id: auth.currentUser.uid });
            },
            onApprove: async (data) => {
                await update(ref(db, `users/${auth.currentUser.uid}`), { isPremium: true, tokens: 20 });
                notify("Welcome to PRO!"); 
                closeUpgradeModal();
            }
        }).render(target);
    }

    // --- AVATAR PRESET GRID ---
    const grid = document.getElementById('avatar-grid');
    if(grid) {
        presets.forEach(url => {
            const img = document.createElement('img');
            img.src = url;
            img.className = "avatar-option w-full aspect-square object-cover rounded-xl cursor-pointer border-2 border-transparent hover:border-amber-500/50 transition-all";
            img.onclick = () => { 
                window.tempAvatar = url; 
                document.getElementById('modal-preview-img').src = url;
                document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected', 'border-amber-500'));
                img.classList.add('selected', 'border-amber-500');
            };
            grid.appendChild(img);
        });
    }

// --- SECURE VERCEL UPLOAD HANDLER ---
document.getElementById('pfp-upload')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 1. Client-side Size Validation
    if (file.size > 2 * 1024 * 1024) {
        return notify("Image too large (Max 2MB)");
    }
    
    notify("Processing via Vercel...");
    
    // Create FormData for the file
    const formData = new FormData();
    formData.append('image', file);

    try {
        // 2. Replace '/api/upload-pfp' with your actual Vercel endpoint path
        const response = await fetch('/api/upload-pfp', {
            method: 'POST',
            // Note: We don't send the Client-ID here anymore. 
            // Vercel handles it using Environment Variables for safety.
            body: formData
        });

        const data = await response.json();

        if (response.ok && data.link) {
            const link = data.link;
            
            // 3. Update UI and global state
            window.tempAvatar = link; 
            document.getElementById('modal-preview-img').src = link;
            
            notify("Verified! Click 'Update Profile' to apply.");
        } else {
            notify(data.error || "Upload failed via Vercel.");
        }
    } catch (err) {
        notify("Vercel connection error.");
        console.error("Upload Error:", err);
    }
});

// --- 0. CONFIG & PRESETS ---
const communityPresets = [
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=James"
];

let activeTarget = { id: null, type: null };

// --- 1. DYNAMIC SEARCH (CAMPAIGNS & USERS) ---
window.searchUser = () => {
    const query = document.getElementById('user-search-input')?.value.toLowerCase().replace('@', '').replace('#', '');
    
    // Search Campaigns (checks title, desc, tags, country)
    const campaignCards = document.querySelectorAll('#campaign-grid > div');
    campaignCards.forEach(card => {
        const text = card.innerText.toLowerCase();
        card.classList.toggle('hidden', !text.includes(query));
    });

    // Search Users
    const userCards = document.querySelectorAll('#user-feed-grid > div');
    userCards.forEach(card => {
        const handle = card.getAttribute('data-handle')?.toLowerCase() || "";
        const email = card.getAttribute('data-email')?.toLowerCase() || "";
        card.classList.toggle('hidden', !(handle.includes(query) || email.includes(query)));
    });
};


document.getElementById('donate-input-amount')?.addEventListener('input', (e) => {
    const amount = parseInt(e.target.value) || 0;
    const net = Math.floor(amount * 0.7);
    const notice = document.getElementById('fee-notice');
    if(notice) {
        notice.innerText = amount > 0 ? `Recipient receives: ${net} (30% fee applied)` : '';
        notice.className = "text-[10px] font-bold text-pink-500 mt-2 italic";
    }
});


// --- 3. VIEW SWITCHER ---
window.switchView = (view) => {
    const campView = document.getElementById('view-campaigns');
    const commView = document.getElementById('view-community');
    const campBtn = document.getElementById('tab-campaigns');
    const commBtn = document.getElementById('tab-community');

    if (view === 'campaigns') {
        if(campBtn) campBtn.className = "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase bg-amber-500 text-black shadow-lg";
        if(commBtn) commBtn.className = "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase text-zinc-500 hover:text-white";
        campView?.classList.remove('hidden');
        commView?.classList.add('hidden');
    } else {
        if(commBtn) commBtn.className = "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase bg-emerald-500 text-black shadow-lg";
        if(campBtn) campBtn.className = "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase text-zinc-500 hover:text-white";
        commView?.classList.remove('hidden');
        campView?.classList.add('hidden');
    }
};
