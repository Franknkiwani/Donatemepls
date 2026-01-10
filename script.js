    // 1. Importing tools from Google
    import { 
        onAuthStateChanged, signInWithPopup, GoogleAuthProvider, 
        signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword 
    } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
    
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

    // --- MODAL CONTROLS ---
    window.openAuthModal = () => document.getElementById('auth-modal').classList.remove('hidden');
    window.closeAuthModal = () => document.getElementById('auth-modal').classList.add('hidden');
    
    window.openProfile = () => {
        document.getElementById('profile-modal').classList.remove('hidden');
        document.body.classList.add('stop-scrolling');
    };

    window.closeProfile = () => {
        document.getElementById('profile-modal').classList.add('hidden');
        document.body.classList.remove('stop-scrolling');
    };

    window.openUpgradeModal = () => {
        document.getElementById('upgrade-modal').classList.remove('hidden');
        setTimeout(initPayPal, 100);
    };
    
    window.closeUpgradeModal = () => document.getElementById('upgrade-modal').classList.add('hidden');

    // --- TOKEN MODAL LOGIC ---
    window.openTokenModal = () => {
        document.getElementById('token-modal').classList.remove('hidden');
        // Using the same class for consistency
        document.body.classList.add('stop-scrolling'); 
    };

    window.closeTokenModal = () => {
        document.getElementById('token-modal').classList.add('hidden');
        document.body.classList.remove('stop-scrolling'); 
        document.getElementById('paypal-tokens-container').innerHTML = ''; 
    };

    window.selectPack = (btn, amount, tokens) => {
        document.querySelectorAll('.pack-option').forEach(el => el.classList.remove('border-amber-500', 'bg-amber-500/10'));
        btn.classList.add('border-amber-500', 'bg-amber-500/10');
        window.buyPack(amount, tokens);
    };


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

// Modal Controllers
window.showErrorModal = (msg) => {
    const msgEl = document.getElementById('error-modal-msg');
    if(msgEl) msgEl.innerText = msg;
    document.getElementById('error-modal').classList.remove('hidden');
    document.body.classList.add('stop-scrolling');
    if (window.lucide) lucide.createIcons();
};

window.closeErrorModal = () => {
    document.getElementById('error-modal').classList.add('hidden');
    document.body.classList.remove('stop-scrolling');
};

window.showWithdrawSuccess = (usdAmount) => {
    const usdEl = document.getElementById('payout-success-usd');
    if(usdEl) usdEl.innerText = `$${usdAmount.toFixed(2)}`;
    document.getElementById('withdraw-success-modal').classList.remove('hidden');
    document.body.classList.add('stop-scrolling');
    if (typeof confetti === 'function') confetti();
    if (window.lucide) lucide.createIcons();
};

window.closeWithdrawSuccess = () => {
    document.getElementById('withdraw-success-modal').classList.add('hidden');
    document.body.classList.remove('stop-scrolling');
};

window.openWithdrawModal = () => {
    document.getElementById('withdraw-modal').classList.remove('hidden');
    document.body.classList.add('stop-scrolling');
};

window.closeWithdrawModal = () => {
    document.getElementById('withdraw-modal').classList.add('hidden');
    document.body.classList.remove('stop-scrolling');
    document.getElementById('withdraw-amount').value = '';
    document.getElementById('withdraw-email').value = '';
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

// --- 2. MODAL CONTROLS ---
window.closeDonateModal = () => {
    document.getElementById('modern-donate-modal')?.classList.add('hidden');
    document.body.classList.remove('stop-scrolling');
};

window.closeCreateModal = () => {
    document.getElementById('create-campaign-modal')?.classList.add('hidden');
    document.body.classList.remove('stop-scrolling');
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
// --- 4. CAMPAIGN FEED (THEME-SYNCED + SHUFFLE + INFINITE + SKELETONS) ---

let lastVisibleTimestamp = null;
let isFetching = false;
let reachedEnd = false;

/**
 * MASTER SKELETON GENERATOR
 * Fills the loader with themed shimmer cards immediately on start
 */
const injectSkeletons = () => {
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

// Helper: Custom Skeleton Exit Signal
window.signalDataReady = (type) => {
    const loader = document.getElementById('master-loader');
    if (loader) {
        loader.classList.add('loader-fade-out');
        setTimeout(() => loader.remove(), 600);
    }
};

// Helper: Shuffle the 5-pack for visual variety
const shuffleBatch = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

// Helper: Real-time Countdown Text
const getRemainingTime = (deadline) => {
    const diff = deadline - Date.now();
    if (diff <= 0) return "EXPIRED";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff / (1000 * 60)) % 60);
    return `${hours}H ${mins}M LEFT`;
};

/**
 * Main Loader - Optimized Batching (5 at a time)
 */
const loadCampaigns = async (isInitial = true) => {
    if (isFetching || (reachedEnd && !isInitial)) return;
    
    const grid = document.getElementById('campaign-grid');
    if (!grid) return;

    isFetching = true;

    if (isInitial) {
        grid.innerHTML = '';
        lastVisibleTimestamp = null;
        reachedEnd = false;
        injectSkeletons(); // Start the shimmer animation
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

        // Process batch
        let items = Object.keys(data).map(id => ({ id, ...data[id] }));
        
        // Sort for tracking, then shuffle for display
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

/**
 * THE RENDER ENGINE (Theme Integrated)
 */
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
                ${c.isAiGenerated ? '<div class="absolute inset-0 bg-purple-500/10 mix-blend-overlay"></div>' : ''}
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                    <h3 class="text-sm font-black uppercase truncate tracking-tight" style="color: var(--text-main)">${c.title}</h3>
                    ${c.isAiGenerated ? '<span class="text-[7px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-md font-black uppercase border border-purple-500/30">✨ AI</span>' : ''}
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
                    ${isPro ? '<img src="https://img.icons8.com/color/48/verified-badge.png" class="absolute -right-1 -bottom-1 w-3 h-3 bg-zinc-900 rounded-full">' : ''}
                </div>
                <span class="text-[9px] font-black uppercase" style="color: var(--text-dim)">@${c.creatorName || 'Member'}</span>
            </button>
            <div class="flex items-center gap-2">
                <button onclick="shareMission('${id}', '${c.title.replace(/'/g, "\\'")}')" class="p-2.5 rounded-xl border transition-all" style="background: var(--input-bg); border-color: var(--border)">
                    <img src="https://img.icons8.com/material-outlined/24/ffffff/share.png" class="w-3.5 h-3.5 opacity-70" style="filter: var(--theme-icon-filter)">
                </button>
                <button onclick="handleDonateCampaign('${id}', '${c.title.replace(/'/g, "\\'")}')" class="px-5 py-2.5 bg-white text-black rounded-xl text-[10px] font-black uppercase hover:scale-105 active:scale-95 transition-all shadow-md">Donate</button>
            </div>
        </div>
    `;
    container.appendChild(card);
    if(window.loadDonors) loadDonors(id);
};

// --- SCROLL LISTENER ---
window.addEventListener('scroll', () => {
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 200) {
        loadCampaigns(false);
    }
});

// --- UTILITIES & TOOLS ---

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

// --- 5. USER FEED ---
const loadUserFeed = () => {
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
            card.setAttribute('data-email', u.email || "");
            card.className = `p-5 rounded-[24px] border relative transition-all ${isPro ? 'border-pink-500/30 bg-white/5' : 'border-white/5 bg-zinc-900/40'}`;
            
            card.innerHTML = `
                <div class="flex items-start gap-4">
                    <div onclick="viewCreatorProfile('${uid}')" class="w-12 h-12 rounded-full border-2 ${isPro ? 'border-pink-500' : 'border-zinc-800'} p-0.5 overflow-hidden cursor-pointer">
                        <img src="${u.avatar || communityPresets[0]}" class="w-full h-full object-cover rounded-full">
                    </div>
                    <div class="flex-1">
                        <div class="flex justify-between items-center">
                            <span class="font-black text-xs text-white uppercase italic">@${u.username}</span>
                            <span class="text-xs">${u.mood === 'happy' ? '😊' : u.mood === 'sad' ? '😔' : '😐'}</span>
                        </div>
                        <p class="text-[9px] text-zinc-400 mt-1 italic line-clamp-2">${u.bio || 'Sharing the energy!'}</p>
                        <div class="flex items-center gap-2 mt-2">
                             <span class="text-[8px] bg-white/5 px-2 py-0.5 rounded text-zinc-500 font-bold uppercase">${u.country || 'Global'}</span>
                        </div>
                    </div>
                </div>
                <button onclick="handleTip('${uid}', '${u.username}', '${u.avatar}')" class="w-full mt-4 py-2 bg-emerald-500 text-black text-[10px] font-black uppercase rounded-xl hover:bg-emerald-400 transition-all">Tip User</button>
            `;
            feedGrid.appendChild(card);
        });
    });
};

// --- 6. TIMER & PROFILE REDIRECT ---
const startCountdown = (id, deadline) => {
    const timerInterval = setInterval(() => {
        const el = document.getElementById(`timer-${id}`);
        if (!el) return clearInterval(timerInterval);
        const diff = deadline - Date.now();
        if (diff <= 0) {
            el.innerText = "ENDED";
            loadCampaigns(); // Trigger archive logic
            return clearInterval(timerInterval);
        }
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        el.innerText = `${d}d ${h}h ${m}m ${s}s`;
    }, 1000);
};

window.viewCreatorProfile = async (targetUid) => {
    const user = auth.currentUser;
    if (!user) return notify("Login required");
    const snap = await get(ref(db, `users/${user.uid}`));
    if (snap.val()?.isPremium) {
        window.location.href = `profile.html?id=${targetUid}`;
    } else {
        notify("PRO required to view profiles!");
        if(window.openUpgradeModal) openUpgradeModal();
    }
};
// --- 7. TRANSACTIONS & DONOR LOGGING (SYNCED WITH HUB) ---

window.closeSuccessModal = () => {
    document.getElementById('donation-success-modal').classList.add('hidden');
    document.body.classList.remove('stop-scrolling');
};

window.confirmDonation = async () => {
    const user = auth.currentUser;
    if (!user) return notify("Login required to donate!");

    const amountInput = document.getElementById('donate-input-amount');
    const amount = parseInt(amountInput.value);
    const btn = document.getElementById('confirm-donation-btn');
    const ADMIN_UID = "4xEDAzSt5javvSnW5mws2Ma8i8n1";

    if (!amount || amount <= 0) return notify("Enter a valid amount");

    let adminSecret = null;
    if (user.uid === ADMIN_UID) {
        adminSecret = await requestAdminSecret();
        if (!adminSecret) return; 
    }

    btn.disabled = true;
    btn.innerHTML = `<span class="animate-pulse">Transmitting Signal...</span>`;

    try {
        const idToken = await user.getIdToken(true);

        const response = await fetch('/api/donate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                idToken,
                targetId: activeTarget.id,
                amount: amount,
                type: activeTarget.type,
                adminSecret: adminSecret 
            })
        });

        const result = await response.json();

        if (!response.ok) {
            if (result.error?.includes("BANNED")) {
                location.reload();
                return;
            }
            throw new Error(result.error || "Transaction failed");
        }

        // --- SUCCESS UI & HUB REFRESH ---
        document.getElementById('success-net-amount').innerText = result.netSent;
        document.getElementById('success-gross-amount').innerText = amount;
        
        closeDonateModal(); 
        document.getElementById('donation-success-modal').classList.remove('hidden'); 
        document.body.classList.add('stop-scrolling');
        
        if(typeof confetti === 'function') confetti();
        amountInput.value = '';

        // REFRESH THE HUB: If the hub is open, show the new live donation immediately
        if (typeof window.switchHubView === 'function') {
            // We wait 1 second for DB propagation then refresh the 'live' view
            setTimeout(() => window.switchHubView('live'), 1000);
        }

    } catch (e) { 
        console.error("Donation Error:", e);
        notify(e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Confirm Transfer";
    }
};


// --- 8. GLOBAL HANDLERS ---
window.handleTip = async (uid, username, avatar) => {
    activeTarget = { id: uid, type: 'user' };
    
    // 1. Basic UI Setup
    document.getElementById('donate-target-name-display').innerText = `@${username}`;
    document.getElementById('donate-target-img').src = avatar || communityPresets[0];
    document.getElementById('donate-input-amount').value = '';
    document.getElementById('fee-notice').innerText = '';

    try {
        // 2. Fetch Premium status and Stats
        const [viewerSnap, targetSnap] = await Promise.all([
            get(ref(db, `users/${auth.currentUser.uid}`)),
            get(ref(db, `users/${uid}`))
        ]);

        const viewerData = viewerSnap.val() || {};
        const targetData = targetSnap.val() || {};
        const isViewerPro = viewerData.isPremium || (auth.currentUser.uid === "4xEDAzSt5javvSnW5mws2Ma8i8n1");

        // 3. Populate Stats
        document.getElementById('stat-raised-val').innerText = targetData.totalRaised || 0;
        document.getElementById('stat-donors-val').innerText = targetData.donorCount || 0;

        // 4. Handle the Glassy Lock
        const lockOverlay = document.getElementById('stats-premium-lock');
        isViewerPro ? lockOverlay.classList.add('hidden') : lockOverlay.classList.remove('hidden');

    } catch (e) { console.error("Stats Error:", e); }

    document.getElementById('modern-donate-modal').classList.remove('hidden');
    document.body.classList.add('stop-scrolling');
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.handleDonateCampaign = async (id, title) => {
    activeTarget = { id: id, type: 'campaign' };
    
    document.getElementById('donate-target-name-display').innerText = title;
    document.getElementById('donate-target-img').src = "https://img.icons8.com/fluency/96/charity.png";
    document.getElementById('donate-input-amount').value = '';
    document.getElementById('fee-notice').innerText = '';

    try {
        // 1. Fetch Premium status and Campaign stats
        const [viewerSnap, campSnap] = await Promise.all([
            get(ref(db, `users/${auth.currentUser.uid}`)),
            get(ref(db, `campaigns/${id}`))
        ]);

        const viewerData = viewerSnap.val() || {};
        const campData = campSnap.val() || {};
        const isViewerPro = viewerData.isPremium || (auth.currentUser.uid === "4xEDAzSt5javvSnW5mws2Ma8i8n1");

        // 2. Populate Stats (Matches user field names or uses campaign defaults)
        document.getElementById('stat-raised-val').innerText = campData.raised || 0;
        document.getElementById('stat-donors-val').innerText = campData.donorsCount || 0;

        // 3. Handle the Glassy Lock (Same logic as User Tipping)
        const lockOverlay = document.getElementById('stats-premium-lock');
        isViewerPro ? lockOverlay.classList.add('hidden') : lockOverlay.classList.remove('hidden');

    } catch (e) { console.error("Campaign Stats Error:", e); }

    document.getElementById('modern-donate-modal').classList.remove('hidden');
    document.body.classList.add('stop-scrolling');
    if (typeof lucide !== 'undefined') lucide.createIcons();
};


// --- 9. INITIALIZE ---
loadCampaigns();
loadUserFeed();
switchView('campaigns');

const cBtn = document.getElementById('confirm-donation-btn');
if(cBtn) cBtn.onclick = window.confirmDonation;
// --- 1. Global State & Config ---
let selectedCampaignImg = "https://images.hive.blog/p/NTy4GV6ooFRmaCXZ8UYgPhoud1kjiNX8QokLEZtbBKLuLWQ9yt7K3o4MTgeicR2JF9fLXTD4sRt27d8vG5aiRCoDjrf24e3CMD5msbfdUbX1MzSVDjCMsn17K2A775iLEM4LvckBAcG8CU92RjLTtvsDiS6HzSxeXpvTZjux?format=match&mode=fit";
const IMGUR_CLIENT_ID = '891e5bb4aa94282';
let contentIsAiFlag = false; 

// --- 2. Helper: Custom Studio Success Modal ---
const studioReport = (type, msg, customTitle = "Studio Success") => {
    if (type === 'success') {
        const modal = document.getElementById('studio-success-modal');
        const titleEl = document.getElementById('studio-success-title');
        const msgEl = document.getElementById('studio-success-msg');
        if (modal && titleEl && msgEl) {
            titleEl.innerText = customTitle;
            msgEl.innerText = msg;
            modal.classList.remove('hidden');
        } else { notify("✅ " + msg); }
    } else {
        if(window.showErrorModal) { window.showErrorModal(msg); } 
        else { notify("❌ " + msg); }
    }
};

window.closeStudioSuccess = () => document.getElementById('studio-success-modal').classList.add('hidden');

// --- 3. UI Reset & Reach Math ---
window.resetStudioData = () => {
    ['cp-title', 'cp-desc', 'cp-goal', 'reach-input-manual', 'reach-slider'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = (id.includes('reach')) ? 0 : '';
    });
    selectedCampaignImg = "https://images.hive.blog/p/NTy4GV6ooFRmaCXZ8UYgPhoud1kjiNX8QokLEZtbBKLuLWQ9yt7K3o4MTgeicR2JF9fLXTD4sRt27d8vG5aiRCoDjrf24e3CMD5msbfdUbX1MzSVDjCMsn17K2A775iLEM4LvckBAcG8CU92RjLTtvsDiS6HzSxeXpvTZjux?format=match&mode=fit";
    const preview = document.getElementById('cp-preview-img');
    if(preview) {
        preview.src = selectedCampaignImg;
        preview.classList.remove('animate-pulse', 'blur-sm');
    }
    contentIsAiFlag = false; 
    window.updateReachMath(0);
};

window.updateReachMath = (val) => {
    const tokens = parseInt(val) || 0;
    const views = tokens * 3; 
    const slider = document.getElementById('reach-slider');
    const input = document.getElementById('reach-input-manual');
    if(slider) slider.value = tokens;
    if(input) input.value = tokens;
    
    document.getElementById('reach-display').innerHTML = `${views.toLocaleString()} <span class="text-xs text-zinc-500 font-black">Reach</span>`;
    document.getElementById('cost-display').innerHTML = `${tokens.toLocaleString()} <span class="text-xs text-zinc-500 font-black">Tokens</span>`;
};

// --- 4. AI & Image Handling (Imgur with Loading States) ---
window.uploadCampaignImage = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const previewImg = document.getElementById('cp-preview-img');
    const uploadBtn = document.getElementById('upload-trigger-btn');
    
    // UI Loading State Start
    if(uploadBtn) { uploadBtn.innerText = "🛰️ Processing..."; uploadBtn.disabled = true; }
    if(previewImg) {
        previewImg.classList.add('animate-pulse', 'blur-md', 'brightness-50');
    }

    const formData = new FormData();
    formData.append('image', file);

    try {
        const response = await fetch('https://api.imgur.com/3/image', {
            method: 'POST',
            headers: { Authorization: `Client-ID ${IMGUR_CLIENT_ID}` },
            body: formData
        });

        const data = await response.json();
        if (data.success) {
            selectedCampaignImg = data.data.link;
            
            // Create a temporary image object to detect when the link is ACTUALLY loaded
            const tempImg = new Image();
            tempImg.onload = () => {
                if(previewImg) {
                    previewImg.src = selectedCampaignImg;
                    previewImg.classList.remove('animate-pulse', 'blur-md', 'brightness-50');
                }
            };
            tempImg.src = selectedCampaignImg;
            // Success notification removed as requested
        } else {
            throw new Error("Imgur Reject");
        }
    } catch (err) {
        if(previewImg) previewImg.classList.remove('animate-pulse', 'blur-md', 'brightness-50');
        studioReport('error', "Upload failed. Image might be too large.");
    } finally {
        if(uploadBtn) { uploadBtn.innerText = "📸 Custom Upload"; uploadBtn.disabled = false; }
    }
};

window.generateAIContent = async () => {
    const title = document.getElementById('cp-title').value.trim();
    const descField = document.getElementById('cp-desc');
    const aiBtn = document.getElementById('ai-gen-btn');
    if (!title || title.length < 5) return studioReport('error', "Enter a heading first!");
    aiBtn.innerText = "✨ Thinking..."; aiBtn.disabled = true;

    try {
        const response = await fetch('/api/generate', { 
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: title }) 
        });
        const data = await response.json();
        if (data.text) {
            descField.value = data.text;
            contentIsAiFlag = true; 
            notify("✨ Description Generated!");
        }
    } catch (err) { studioReport('error', "AI Bridge failed."); }
    finally { aiBtn.innerText = "✨ AI Auto-Write"; aiBtn.disabled = false; }
};

window.selectPreset = (url, el) => {
    selectedCampaignImg = url;
    const preview = document.getElementById('cp-preview-img');
    if(preview) preview.src = url;
    document.querySelectorAll('.preset-option').forEach(img => img.classList.replace('border-blue-500', 'border-transparent'));
    el.classList.replace('border-transparent', 'border-blue-500');
};

// --- 5. Tab & Lifecycle ---
window.openCreateCampaignModal = () => {
    document.getElementById('campaign-studio-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    window.switchStudioTab('create');
};

window.closeStudio = () => {
    document.getElementById('campaign-studio-modal').classList.add('hidden');
    document.body.style.overflow = '';
    window.resetStudioData(); 
};

window.switchStudioTab = (tab) => {
    const createView = document.getElementById('studio-create-view');
    const manageView = document.getElementById('studio-manage-view');
    const createBtn = document.getElementById('tab-btn-create');
    const manageBtn = document.getElementById('tab-btn-manage');
    const activeClass = "px-10 py-4 rounded-xl text-[11px] font-black uppercase tracking-widest bg-blue-600 text-white transition-all";
    const idleClass = "px-10 py-4 rounded-xl text-[11px] font-black uppercase tracking-widest text-zinc-500 transition-all";

    if(tab === 'create') {
        if(createView) createView.classList.remove('hidden'); 
        if(manageView) manageView.classList.add('hidden');
        if(createBtn) createBtn.className = activeClass; 
        if(manageBtn) manageBtn.className = idleClass;
    } else {
        if(createView) createView.classList.add('hidden'); 
        if(manageView) manageView.classList.remove('hidden');
        if(manageBtn) manageBtn.className = activeClass; 
        if(createBtn) createBtn.className = idleClass;
        window.loadMyCampaigns(); 
    }
};

// --- 6. Premium Check & Creation ---
window.checkPremiumVisibility = async (el) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
        const userSnap = await get(ref(db, `users/${user.uid}`));
        const isPremium = userSnap.val()?.isPremium || false;

        if (el.value === 'private' && !isPremium) {
            studioReport('error', "Private Campaigns are for Premium Members only!");
            el.value = 'public';
            document.getElementById('premium-lock-icon').innerHTML = '<span class="text-red-500 text-[10px]">🔒</span>';
        } else if (el.value === 'private' && isPremium) {
            document.getElementById('premium-lock-icon').innerHTML = '<span class="text-emerald-500 text-[10px]">💎</span>';
        } else {
            document.getElementById('premium-lock-icon').innerHTML = '<span class="text-blue-500 text-[10px]">🌐</span>';
        }
    } catch(e) { console.error(e); }
};

window.createNewCampaign = async () => {
    const user = auth.currentUser;
    if (!user) return studioReport('error', "Login first");

    const title = document.getElementById('cp-title').value.trim();
    const desc = document.getElementById('cp-desc').value.trim();
    const goal = parseInt(document.getElementById('cp-goal').value);
    const boostBudget = parseInt(document.getElementById('reach-slider').value) || 0;
    
    const visibility = document.getElementById('cp-visibility')?.value || 'public';
    const durationDays = parseInt(document.getElementById('cp-duration')?.value) || 7; 

    if (!title || !desc || isNaN(goal)) return studioReport('error', "Fill all fields");

    try {
        const userRef = ref(db, `users/${user.uid}`);
        const userSnap = await get(userRef);
        const userData = userSnap.val();

        if ((userData?.tokens || 0) < boostBudget) throw new Error("Not enough tokens!");
        
        const newRef = push(ref(db, 'campaigns'));
        const now = Date.now();
        const deadline = now + (durationDays * 24 * 60 * 60 * 1000);

        await set(newRef, {
            id: newRef.key,
            creator: user.uid,
            creatorName: userData?.username || "Member",
            creatorAvatar: userData?.avatar || "", 
            creatorIsPremium: userData?.isPremium || false,
            title, description: desc, goal, raised: 0,
            imageUrl: selectedCampaignImg, 
            tokensBudget: boostBudget,
            viewsActive: 0,
            category: document.getElementById('cp-category')?.value || 'General',
            deadline: deadline,
            timestamp: now,
            visibility: visibility, 
            isAiGenerated: contentIsAiFlag, 
            status: 'active'
        });

        if (boostBudget > 0) {
            await update(userRef, { tokens: (userData.tokens || 0) - boostBudget });
        }

        window.closeStudio();
        studioReport('success', `Mission Live!`, "Launch Success");

    } catch (e) { studioReport('error', e.message); }
};

// --- 7. Management & Boost (Live 1:3 Math) ---
window.updateBoostLiveMath = (val) => {
    const tokens = parseInt(val) || 0;
    const views = tokens * 3;
    const display = document.getElementById('boost-live-reach');
    if(display) display.innerText = `${views.toLocaleString()} Views`;
};

window.loadMyCampaigns = () => {
    const user = auth.currentUser;
    if(!user) return;
    const container = document.getElementById('my-campaigns-list');
    onValue(ref(db, 'campaigns'), (snap) => {
        if(!container) return;
        container.innerHTML = '';
        const data = snap.val();
        if(!data) return;
        Object.values(data).filter(c => c.creator === user.uid).forEach(c => {
            const tokensLeft = Math.max(0, (c.tokensBudget || 0) - (c.viewsActive || 0));
            const div = document.createElement('div');
            div.className = "bg-white/5 border border-white/10 p-6 rounded-[32px] mb-4 space-y-4";
            div.innerHTML = `
                <div class="flex justify-between items-start">
                    <div class="flex items-center gap-3">
                        <img src="${c.imageUrl}" class="w-12 h-12 rounded-xl object-cover border border-white/10">
                        <div>
                            <h4 class="text-white font-black text-xs uppercase truncate w-32">${c.title}</h4>
                            <span class="text-[7px] font-black uppercase italic ${c.visibility === 'public' ? 'text-emerald-500' : 'text-amber-500'}">
                                ● ${c.visibility || 'public'}
                            </span>
                        </div>
                    </div>
                    <button onclick="handleDeleteRequest('${c.id}')" class="text-red-500 p-2 hover:bg-red-500/10 rounded-full transition-all">✕</button>
                </div>
                <div class="bg-black/30 p-4 rounded-2xl">
                    <div class="flex justify-between text-[10px] font-black uppercase mb-2">
                        <span class="text-zinc-500">Reach Used: ${c.viewsActive || 0}</span>
                        <span class="text-blue-500">${(tokensLeft * 3).toLocaleString()} Reach Left</span>
                    </div>
                    <div class="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                        <div class="h-full bg-blue-500" style="width: ${c.tokensBudget > 0 ? (tokensLeft/c.tokensBudget)*100 : 0}%"></div>
                    </div>
                </div>
                <button onclick="handleBoostRequest('${c.id}')" class="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-2xl text-[10px] font-black uppercase text-white shadow-lg transition-all active:scale-95">⚡ Add Reach Boost</button>
            `;
            container.appendChild(div);
        });
    });
};

window.handleDeleteRequest = (id) => {
    const modal = document.getElementById('delete-modal');
    if(!modal) return;
    modal.classList.remove('hidden');
    document.getElementById('confirm-delete-btn').onclick = async () => {
        await set(ref(db, `campaigns/${id}`), null);
        modal.classList.add('hidden');
        studioReport('success', "Mission Terminated.", "Deleted");
    };
};

window.handleBoostRequest = (id) => {
    const modal = document.getElementById('boost-modal');
    if(!modal) return;
    const boostInput = document.getElementById('boost-modal-input');
    const boostLive = document.getElementById('boost-live-reach');
    if(boostInput) boostInput.value = '';
    if(boostLive) boostLive.innerText = '0 Views';
    
    modal.classList.remove('hidden');
    document.getElementById('confirm-boost-btn').onclick = async () => {
        const amount = parseInt(boostInput.value);
        if(!amount || amount <= 0) return studioReport('error', "Enter tokens");
        try {
            const userRef = ref(db, `users/${auth.currentUser.uid}`);
            const userSnap = await get(userRef);
            if(userSnap.val().tokens < amount) return studioReport('error', "Insufficient Tokens");
            const campRef = ref(db, `campaigns/${id}`);
            const cSnap = await get(campRef);
            await update(userRef, { tokens: userSnap.val().tokens - amount });
            await update(campRef, { tokensBudget: (cSnap.val().tokensBudget || 0) + amount });
            modal.classList.add('hidden');
            studioReport('success', "Reach Refueled!", "Boost Active");
        } catch(e) { studioReport('error', "Boost failed"); }
    };
};

window.closeDeleteModal = () => document.getElementById('delete-modal').classList.add('hidden');
window.closeBoostModal = () => document.getElementById('boost-modal').classList.add('hidden');

// --- CHAT STORAGE & API-BASED REDIRECT ENGINE ---
const CHAT_STORAGE_KEY = 'grok_chat_history';

// 1. Storage Logic
const saveMessage = (role, text) => {
    const history = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || '[]');
    history.push({ role, text, timestamp: Date.now() });
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(history));
};

const loadChatHistory = () => {
    const history = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || '[]');
    const oneDay = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const validHistory = history.filter(msg => (now - msg.timestamp) < oneDay);
    
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(validHistory));
    
    if (validHistory.length > 0) {
        validHistory.forEach(msg => renderMessage(msg.role, msg.text));
    } else {
        window.triggerInitialPoll(); 
    }
};

// 2. UI Rendering
const renderMessage = (role, text) => {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    const isUser = role === 'user';
    const html = isUser ? `
        <div class="flex justify-end gap-3 max-w-[90%] ml-auto animate-in fade-in slide-in-from-right-4 duration-300">
            <div class="bg-blue-600 p-4 rounded-2xl rounded-tr-none shadow-xl">
                <p class="text-[11px] text-white leading-relaxed font-medium">${text}</p>
            </div>
        </div>
    ` : `
        <div class="flex gap-4 max-w-[90%] animate-in fade-in slide-in-from-left-4 duration-300">
            <div class="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                <span class="text-[10px] font-black text-blue-400">G</span>
            </div>
            <div class="bg-white/5 border border-white/5 p-4 rounded-2xl rounded-tl-none">
                <p class="text-[11px] text-zinc-300 leading-relaxed font-medium">${text}</p>
            </div>
        </div>`;
    container.insertAdjacentHTML('beforeend', html);
    container.scrollTop = container.scrollHeight;
};

window.appendMessage = (role, text) => {
    saveMessage(role, text);
    renderMessage(role, text);
};

// 3. Protocol Selection (Initial Poll)
window.triggerInitialPoll = () => {
    const container = document.getElementById('chat-messages');
    const pollHtml = `
        <div id="initial-poll" class="bg-zinc-900 border border-blue-500/30 p-6 rounded-[32px] my-4 animate-in zoom-in duration-500 text-center">
            <h3 class="text-[10px] font-black text-white uppercase mb-1 tracking-widest italic">Uplink Established</h3>
            <p class="text-[8px] text-zinc-500 uppercase mb-4 font-bold tracking-tighter">Choose your interaction protocol</p>
            <div class="flex flex-col gap-2">
                <button onclick="selectPath('ai')" class="w-full py-3 bg-blue-600 text-white text-[10px] font-black uppercase rounded-xl active:scale-95 transition-all">Chat with AI (Instant)</button>
                <button onclick="selectPath('human')" class="w-full py-3 bg-white/5 text-zinc-300 border border-white/10 text-[10px] font-black uppercase rounded-xl active:scale-95 transition-all">Request Human Agent</button>
            </div>
        </div>`;
    container.insertAdjacentHTML('beforeend', pollHtml);
    container.scrollTop = container.scrollHeight;
};

// 4. Redirect Logic (Communicates with API)
window.selectPath = async (choice) => {
    if (choice === 'ai') {
        document.getElementById('initial-poll')?.remove();
        window.appendMessage('bot', "Grok AI active. How can I help you today?");
    } else {
        // TELL API TO SETUP TICKET AND REDIRECT
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'INITIATE_HANDOFF',
                    userId: auth.currentUser?.uid,
                    username: document.getElementById('header-handle')?.innerText 
                })
            });
            const data = await response.json();
            if (data.redirect) window.location.href = data.redirect;
        } catch (e) {
            window.location.href = '/support'; // Fallback if API fails
        }
    }
};

// 5. Core Chat Send Function
window.sendChatMessage = async () => {
    const input = document.getElementById('chat-input');
    const msgContainer = document.getElementById('chat-messages');
    const btn = document.getElementById('chat-send-btn');
    const userText = input.value.trim();

    if (!userText) return;

    window.appendMessage('user', userText);
    input.value = '';
    btn.disabled = true;

    const tid = 'load-' + Date.now();
    msgContainer.insertAdjacentHTML('beforeend', `<div id="${tid}" class="flex gap-2 p-4 animate-pulse"><div class="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></div></div>`);
    msgContainer.scrollTop = msgContainer.scrollHeight;

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                prompt: userText,
                userId: auth.currentUser?.uid,
                username: document.getElementById('header-handle')?.innerText 
            })
        });

        const data = await response.json();
        document.getElementById(tid)?.remove();

        // If the AI triggers a handoff or provides a redirect URL
        if (data.redirect || data.text === "HANDOFF_REQUEST") {
            window.appendMessage('bot', "Transferring you to a human agent...");
            setTimeout(() => { window.location.href = data.redirect || '/support'; }, 1000);
        } else {
            window.appendMessage('bot', data.text);
        }
    } catch (e) {
        document.getElementById(tid)?.remove();
        renderMessage('bot', "Connection Error.");
    } finally {
        btn.disabled = false;
        msgContainer.scrollTop = msgContainer.scrollHeight;
    }
};

document.addEventListener('DOMContentLoaded', loadChatHistory);
// --- MODAL SYSTEM CONTROLS ---

const toggleScrollLock = (isLocked) => {
    if (isLocked) {
        document.body.classList.add('stop-scrolling');
    } else {
        document.body.classList.remove('stop-scrolling');
    }
};

window.openSupportChat = () => {
    const el = document.getElementById('support-modal');
    if(el) {
        el.classList.remove('hidden');
        toggleScrollLock(true);
        if(window.lucide) lucide.createIcons();
    }
};

window.closeSupportChat = () => {
    document.getElementById('support-modal').classList.add('hidden');
    toggleScrollLock(false);
};

window.openExploreModal = () => {
    const el = document.getElementById('explore-modal');
    if(el) {
        el.classList.remove('hidden');
        toggleScrollLock(true);
        window.switchHubView('top-donors');
    }
};

window.closeExploreModal = () => {
    document.getElementById('explore-modal').classList.add('hidden');
    toggleScrollLock(false);
};

window.openWalletModal = () => {
    const el = document.getElementById('wallet-modal');
    if(el) {
        el.classList.remove('hidden');
        const bal = document.getElementById('token-count')?.innerText || "0";
        const walletDisplay = document.getElementById('wallet-token-count');
        if(walletDisplay) walletDisplay.innerText = bal;
        toggleScrollLock(true);
    }
};

window.closeWalletModal = () => {
    document.getElementById('wallet-modal').classList.add('hidden');
    toggleScrollLock(false);
};

window.openAccountModal = () => {
    const el = document.getElementById('account-modal');
    if(el) {
        el.classList.remove('hidden');
        toggleScrollLock(true);
    }
};

window.closeAccountModal = () => {
    document.getElementById('account-modal').classList.add('hidden');
    toggleScrollLock(false);
};

// --- HUB ENGINE ---

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

// Centralized badge to ensure it's identical everywhere
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
                    // FIX: Ensure both 'isPremium' and 'premium' keys are checked
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
