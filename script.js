    // 1. Importing tools from Google
    import { 
        onAuthStateChanged, signInWithPopup, GoogleAuthProvider, 
        signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword 
    } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
    import './wallet.js';
   import './chat.js';
import './modal-controls.js';
import './hub.js';
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

// --- MASTER DATA SYNC (WITH SKELETON AUTO-EXIT) ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        const isAdmin = user.uid === "4xEDAzSt5javvSnW5mws2Ma8i8n1";
        
        // Track readiness for skeleton exit
        let syncReady = { user: false, campaigns: false };
        const checkReady = () => {
            if (syncReady.user && syncReady.campaigns) {
                const loader = document.getElementById('master-loader'); // Use your loader's ID
                if (loader) {
                    loader.classList.add('loader-fade-out');
                    setTimeout(() => loader.remove(), 600);
                }
            }
        };

        // 1. User Data Listener & UI Sync
        onValue(ref(db, `users/${user.uid}`), (s) => {
            const d = s.val() || {};

            // --- THE BAN GUARD ---
            if (d.banned) {
                document.getElementById('master-loader')?.remove(); // Kill loader if banned
                document.body.innerHTML = `
                    <div class="h-screen bg-black flex flex-col items-center justify-center text-center p-6 font-sans">
                        <div class="p-8 border border-red-500/30 bg-red-500/5 rounded-[40px] max-w-sm">
                            <h1 class="text-red-600 text-5xl font-black mb-4 italic tracking-tighter">ACCESS REVOKED</h1>
                            <p class="text-zinc-500 text-[10px] uppercase tracking-[0.2em] font-bold mb-6">Security Protocol 403: UID Blacklisted</p>
                            <p class="text-white/80 text-xs font-medium leading-relaxed mb-8">
                                This account has been permanently suspended for platform abuse or reaching maximum security strikes.
                            </p>
                            <a href="/support" class="inline-block w-full py-4 px-6 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[11px] uppercase rounded-full transition-all transform hover:scale-105 no-underline">
                                Appeal Suspension
                            </a>
                            <p class="mt-4 text-[8px] text-zinc-600 uppercase font-bold tracking-widest">Case ID: ${user.uid.substring(0, 10)}</p>
                        </div>
                    </div>`;
                return;
            }

            const name = d.username || "User";
            const avatar = d.avatar || presets[0];

            // Update Header & Modals
            const hHandle = document.getElementById('header-handle');
            const hPfp = document.getElementById('header-pfp');
            const hInit = document.getElementById('header-initial');
            const uInput = document.getElementById('username-input');
            const mPreview = document.getElementById('modal-preview-img');
            const mInit = document.getElementById('modal-preview-initial'); 
            const proPfp = document.getElementById('pro-pfp-preview');      
            const proName = document.getElementById('pro-name-preview');

            if(hHandle) hHandle.innerText = isAdmin ? `👑 @${name}` : `@${name}`;
            if(hPfp) { hPfp.src = avatar; hPfp.classList.remove('hidden'); }
            if(hInit) hInit.classList.add('hidden');
            if(uInput) uInput.value = name;
            if(mPreview) { mPreview.src = avatar; mPreview.classList.remove('hidden'); }
            if(mInit) mInit.classList.add('hidden'); 
            if(proPfp) { proPfp.src = avatar; proPfp.classList.remove('hidden'); }
            if(proName) proName.innerText = name;

            // Tokens & Security
            const tokenElement = document.getElementById('token-count');
            if(tokenElement) {
                tokenElement.innerText = d.tokens || 0;
                if(isAdmin) tokenElement.classList.add('text-amber-500');
            }
            if(d.tokens > 10000) window.logSecurityAction('WHALE_ACCOUNT_SYNC', { tokens: d.tokens, user: name });

            // Premium Logic
            const hVerified = document.getElementById('header-verified');
            const mgmtZone = document.getElementById('premium-management-zone');
            const upgradeNavBtn = document.querySelector('button[onclick="openUpgradeModal()"]');
            if(d.isPremium || isAdmin) {
                if(hVerified) hVerified.classList.remove('hidden');
                if(mgmtZone && d.isPremium) mgmtZone.classList.remove('hidden');
                if(upgradeNavBtn) upgradeNavBtn.classList.add('hidden');
            } else {
                if(hVerified) hVerified.classList.add('hidden');
                if(mgmtZone) mgmtZone.classList.add('hidden');
                if(upgradeNavBtn) upgradeNavBtn.classList.remove('hidden');
            }

            syncReady.user = true;
            checkReady();
        });

        // 2. Initial UI Visibility
        ['user-tools', 'token-bar'].forEach(id => document.getElementById(id)?.classList.remove('hidden'));
        document.getElementById('login-btn')?.classList.add('hidden');

        // 3. Community Loaders
        if (typeof setupPresence === 'function') setupPresence(user.uid);
        if (typeof loadUserFeed === 'function') loadUserFeed();
        if (typeof loadCampaigns === 'function') {
            loadCampaigns();
            // Assuming loadCampaigns fetches data, we trigger readiness after a slight delay
            // or you can move this line inside your loadCampaigns success callback
            setTimeout(() => { syncReady.campaigns = true; checkReady(); }, 800);
        }
        if (typeof switchView === 'function') switchView('campaigns');

        // 4. Payout Listener (History)
        onValue(ref(db, `payouts`), (snapshot) => {
            const allPayouts = snapshot.val() || {};
            const historyList = document.getElementById('payout-history-list');
            const historyContainer = document.getElementById('payout-history-container');
            if(historyList) historyList.innerHTML = '';

            let totalPaid = 0; let pendingCount = 0; let hasHistory = false;
            Object.values(allPayouts).filter(p => p.uid === user.uid).sort((a,b) => b.timestamp - a.timestamp).forEach(p => {
                hasHistory = true; 
                if (p.status === 'completed' || p.status === 'paid') totalPaid += (p.netAmount || 0);
                if (p.status === 'pending') pendingCount++;
                if(historyList) {
                    const div = document.createElement('div');
                    div.className = "flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5 mb-2";
                    const statusColor = (p.status === 'completed' || p.status === 'paid') ? 'text-emerald-500' : 'text-amber-500';
                    div.innerHTML = `<div class="flex flex-col"><span class="text-[9px] font-black text-white uppercase">$${p.netAmount.toFixed(2)}</span><span class="text-[8px] text-zinc-500">${new Date(p.timestamp).toLocaleDateString()}</span></div><span class="text-[8px] font-black uppercase ${statusColor}">${p.status}</span>`;
                    historyList.appendChild(div);
                }
            });
            if(hasHistory && historyContainer) historyContainer.classList.remove('hidden');
            if(document.getElementById('total-withdrawn')) document.getElementById('total-withdrawn').innerText = `$${totalPaid.toFixed(2)}`;
            if(document.getElementById('pending-count')) document.getElementById('pending-count').innerText = pendingCount;
        });

        // 5. Security Action Logger
        let actionCount = 0;
        window.logSecurityAction = async (actionType, metadata = {}) => {
            actionCount++;
            const isHighValue = (metadata.amount && metadata.amount > 1000) || (metadata.tokens && metadata.tokens > 5000);
            if (isHighValue || actionCount > 15 || actionType === 'ADMIN_ACTION') {
                try {
                    const idToken = await user.getIdToken();
                    await fetch('/api/security-audit', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ idToken, actionType, metadata, severity: isHighValue ? 'high' : 'info' })
                    });
                    if(actionCount > 15) actionCount = 0; 
                } catch (e) { console.error("Audit Fail"); }
            }
        };
    } else {
        // If logged out, remove loader immediately to show landing/login
        document.getElementById('master-loader')?.remove();
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
