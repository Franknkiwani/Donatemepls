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

// 1. BOOTSTRAP: Start loading data immediately for everyone (Guest or User)
let syncReady = { user: false, campaigns: false, buffer: false };

// Start the 3-second minimum buffer timer
setTimeout(() => { 
    syncReady.buffer = true; 
    checkReady(); 
}, 3000);

if (typeof loadCampaigns === 'function') {
    loadCampaigns().then(() => {
        syncReady.campaigns = true;
        checkReady();
    });
}

if (typeof loadUserFeed === 'function') loadUserFeed();
if (typeof switchView === 'function') switchView('campaigns');

// Master Ready Check
function checkReady() {
    // Only hide skeleton if User (if logged in), Campaigns, and the 3s Buffer are all done
    if (syncReady.campaigns && syncReady.buffer) {
        // If logged in, we also wait for syncReady.user. If guest, we ignore it.
        const isGuest = !auth.currentUser;
        if (isGuest || syncReady.user) {
            const loader = document.getElementById('master-loader');
            if (loader) {
                loader.classList.add('loader-fade-out');
                setTimeout(() => loader.remove(), 600);
            }
        }
    }
}

// --- MASTER AUTH & DATA SYNC ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const isAdmin = user.uid === "4xEDAzSt5javvSnW5mws2Ma8i8n1";

        // 1. USER DATA LISTENER & BAN GUARD
        onValue(ref(db, `users/${user.uid}`), (s) => {
            const d = s.val() || {};

            // --- THE NUCLEAR BAN GUARD ---
            if (d.banned) {
                document.body.innerHTML = ''; // Wipe everything immediately
                document.body.style.backgroundColor = 'black';
                document.body.innerHTML = `
                    <div class="h-screen bg-black flex flex-col items-center justify-center text-center p-6 font-sans">
                        <div class="p-8 border border-red-500/30 bg-red-500/5 rounded-[40px] max-w-sm">
                            <h1 class="text-red-600 text-5xl font-black mb-4 italic tracking-tighter">ACCESS REVOKED</h1>
                            <p class="text-zinc-500 text-[10px] uppercase tracking-[0.2em] font-bold mb-6">Security Protocol 403: UID Blacklisted</p>
                            <p class="text-white/80 text-xs font-medium leading-relaxed mb-8">
                                This account has been permanently suspended for platform abuse or reaching maximum security strikes.
                            </p>
                            <div class="flex flex-col gap-4">
                                <a href="mailto:support@yourdomain.com" class="inline-block w-full py-4 px-6 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[11px] uppercase rounded-full transition-all no-underline">
                                    Appeal Suspension
                                </a>
                                <button onclick="auth.signOut().then(()=>location.reload())" class="text-zinc-600 text-[9px] font-black uppercase tracking-widest">Sign Out</button>
                            </div>
                            <p class="mt-8 text-[8px] text-zinc-600 uppercase font-bold tracking-widest">Case ID: ${user.uid}</p>
                        </div>
                    </div>`;
                return;
            }

            // Sync User UI Elements
            const name = d.username || "User";
            const avatar = d.avatar || "https://img.icons8.com/fluency/48/user-male-circle.png";

            document.getElementById('header-handle') && (document.getElementById('header-handle').innerText = isAdmin ? `👑 @${name}` : `@${name}`);
            if(document.getElementById('header-pfp')) {
                document.getElementById('header-pfp').src = avatar;
                document.getElementById('header-pfp').classList.remove('hidden');
                document.getElementById('header-initial')?.classList.add('hidden');
            }
            
            // Token Sync
            const tokenElement = document.getElementById('token-count');
            if(tokenElement) {
                tokenElement.innerText = (d.tokens || 0).toLocaleString();
                if(isAdmin) tokenElement.className = "text-amber-500 font-black";
            }

            // Premium UI State
            const isPro = d.isPremium || isAdmin;
            document.getElementById('header-verified')?.classList.toggle('hidden', !isPro);
            document.getElementById('premium-management-zone')?.classList.toggle('hidden', !d.isPremium);
            document.querySelector('button[onclick="openUpgradeModal()"]')?.classList.toggle('hidden', isPro);

            // Flag as ready for skeleton exit
            syncReady.user = true;
            checkReady();
        });

        // 2. UI Visibility for Logged In
        ['user-tools', 'token-bar'].forEach(id => document.getElementById(id)?.classList.remove('hidden'));
        document.getElementById('login-btn')?.classList.add('hidden');

        // 3. User-Specific Listeners (Payouts & Presence)
        if (typeof setupPresence === 'function') setupPresence(user.uid);
        
        onValue(ref(db, `payouts`), (snapshot) => {
            const historyList = document.getElementById('payout-history-list');
            if(!historyList) return;
            historyList.innerHTML = '';
            let totalPaid = 0;
            
            Object.values(snapshot.val() || {}).filter(p => p.uid === user.uid).forEach(p => {
                if (p.status === 'completed' || p.status === 'paid') totalPaid += (p.netAmount || 0);
                const div = document.createElement('div');
                div.className = "flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5 mb-2";
                div.innerHTML = `<div><p class="text-[10px] font-black">$${p.netAmount.toFixed(2)}</p><p class="text-[8px] opacity-40">${new Date(p.timestamp).toLocaleDateString()}</p></div><span class="text-[8px] font-black uppercase ${p.status === 'paid' ? 'text-emerald-500' : 'text-amber-500'}">${p.status}</span>`;
                historyList.appendChild(div);
            });
            document.getElementById('total-withdrawn') && (document.getElementById('total-withdrawn').innerText = `$${totalPaid.toFixed(2)}`);
        });

    } else {
        // GUEST MODE: Hide user tools, show login
        ['user-tools', 'token-bar'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
        document.getElementById('login-btn')?.classList.remove('hidden');
        // Check ready now because syncReady.user will never be true for a guest
        checkReady(); 
    }
});


// --- UNIFIED FREE UPLOAD, SPINNER & VERCEL SYNC ---

// Helper to toggle the UI lock
const toggleUploadSpinner = (show) => {
    const spinner = document.getElementById('upload-spinner-modal');
    if (!spinner) return;
    if (show) {
        spinner.classList.remove('hidden');
        document.body.classList.add('stop-scrolling'); // Lock background
    } else {
        spinner.classList.add('hidden');
        document.body.classList.remove('stop-scrolling'); // Unlock background
    }
};

window.handleFreeUpload = () => {
    const user = auth.currentUser;
    if (!user) return notify("Please login first");
    document.getElementById('pfp-upload').click();
};

document.getElementById('pfp-upload').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 1. Client-side Validation
    if (file.size > 2 * 1024 * 1024) return notify("Image too large (Max 2MB)");
    
    // 2. Start Processing
    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onloadstart = () => toggleUploadSpinner(true);

    reader.onload = async () => {
        const base64Image = reader.result;
        
        // Update Local Preview Immediately
        const previewImg = document.getElementById('modal-preview-img');
        if (previewImg) previewImg.src = base64Image;

        try {
            // 3. Vercel / Imgur Sync
            const response = await fetch('/api/upload-pfp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: base64Image })
            });

            const data = await response.json();

            if (response.ok && data.link) {
                // Success: Secure the cloud link
                window.tempAvatar = data.link; 
                notify("Cloud Sync Ready! Click Update to save.");
            } else {
                // Fail: Inform user but keep local preview as backup
                console.error("Vercel Error:", data);
                notify("Cloud sync failed. Saved to local session only.");
            }
        } catch (err) {
            notify("Network error. Could not reach cloud.");
            console.error(err);
        } finally {
            // 4. Always hide spinner regardless of success/fail
            toggleUploadSpinner(false);
        }
    };

    reader.onerror = () => {
        toggleUploadSpinner(false);
        notify("Error reading file.");
    };
};



    window.buyPack = (amount, tokens) => {
        const container = document.getElementById('paypal-tokens-container');
        container.innerHTML = ''; 

        window.paypal.Buttons({
            style: { shape: 'pill', color: 'gold', layout: 'vertical', label: 'pay' },
            createOrder: (data, actions) => {
                return actions.order.create({
                    intent: "CAPTURE",
                    purchase_units: [{
                        description: `${tokens} Token Pack`,
                        amount: { currency_code: "USD", value: amount.toString() },
                        custom_id: auth.currentUser.uid 
                    }]
                });
            },
            onApprove: async (data, actions) => {
                const details = await actions.order.capture();
                const userRef = ref(db, `users/${auth.currentUser.uid}`);
                const snap = await get(userRef);
                const currentTokens = snap.val()?.tokens || 0;
                
                await update(userRef, { tokens: currentTokens + tokens });
                notify(`Success! ${tokens} tokens added.`);
                closeTokenModal();
            },
            onError: (err) => {
                console.error("PayPal Error:", err);
                notify("Payment failed to initialize.");
            }
        }).render('#paypal-tokens-container');
    };

    lucide.createIcons();
// --- COMPLETE WITHDRAWAL LOGIC (MODAL VERIFIED + VAULT ROUTING) ---

const ADMIN_UID = "4xEDAzSt5javvSnW5mws2Ma8i8n1";

// Custom Admin Verification Modal Controller
window.requestAdminSecret = () => {
    return new Promise((resolve) => {
        const modal = document.getElementById('admin-verify-modal');
        const input = document.getElementById('admin-secret-field');
        const confirmBtn = document.getElementById('confirm-verify-btn');
        const cancelBtn = document.getElementById('cancel-verify-btn');
        
        modal.classList.remove('hidden');
        input.value = '';
        input.focus();

        const cleanup = (val) => {
            modal.classList.add('hidden');
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
            resolve(val);
        };

        confirmBtn.onclick = () => cleanup(input.value.trim());
        cancelBtn.onclick = () => cleanup(null);
    });
};

// Real-time Math for UI
document.getElementById('withdraw-amount')?.addEventListener('input', (e) => {
    const tokens = parseInt(e.target.value) || 0;
    const gross = tokens / 10;
    const fee = gross * 0.15; 
    const net = gross - fee;

    const grossEl = document.getElementById('calc-gross');
    const feeEl = document.getElementById('calc-fee');
    const netEl = document.getElementById('calc-net');

    if(grossEl) grossEl.innerText = `$${gross.toFixed(2)}`;
    if(feeEl) feeEl.innerText = `-$${fee.toFixed(2)}`;
    if(netEl) netEl.innerText = `$${net.toFixed(2)}`;
});

window.handleWithdrawSubmit = async () => {
    const user = auth.currentUser;
    const emailEl = document.getElementById('withdraw-email');
    const amountEl = document.getElementById('withdraw-amount');
    
    const email = emailEl?.value?.trim();
    const amount = parseInt(amountEl?.value);
    const btn = document.querySelector('button[onclick="handleWithdrawSubmit()"]');

    if (!user) return;
    if (!email || !email.includes('@')) return showErrorModal("Invalid PayPal email");
    if (isNaN(amount) || amount < 50) return showErrorModal("Min 50 Tokens ($5.00)");

    // --- 1. NEAT ADMIN VERIFICATION ---
    let adminSecret = null;
    if (user.uid === ADMIN_UID) {
        adminSecret = await requestAdminSecret();
        if (!adminSecret) return; // Cancelled
    }

    if(btn) {
        btn.disabled = true;
        btn.innerText = "Processing...";
    }

    try {
        const idToken = await user.getIdToken(true);

        // --- 2. SEND TO VERCEL API ---
        const response = await fetch('/api/withdraw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken, email, amount, adminSecret })
        });

        const text = await response.text();
        let result = JSON.parse(text);

        if (!response.ok) throw new Error(result.error || "Withdrawal failed");

        // --- 3. SUCCESS UI FLOW ---
        closeWithdrawModal();
        showWithdrawSuccess(result.netAmount);

    } catch (e) { 
        console.error("Withdrawal Error:", e);
        showErrorModal(e.message); 
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.innerText = "Confirm Payout";
        }
    }
};

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
