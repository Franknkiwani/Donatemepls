
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
import './auth-sync.js';
import './account.js';
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

// --- MASTER DATA SYNC (WITH SKELETON AUTO-EXIT & BUFFER) ---
let syncReady = { user: false, campaigns: false, buffer: false };

// 1. Start the 3-second minimum buffer timer immediately
setTimeout(() => { 
    syncReady.buffer = true; 
    checkReady(); 
}, 3000);

// --- BULLETPROOF MASTER DATA SYNC & ICON VERIFICATION ---
function checkReady() {
    if (syncReady.campaigns && syncReady.buffer) {
        const isGuest = !auth.currentUser;
        
        // Only proceed if it's a guest OR if the logged-in user data is fully synced
        if (isGuest || syncReady.user) {
            const loader = document.getElementById('master-loader');
            
            if (loader) {
                let retryCount = 0;
                
                // ICON RETRY LOOP: Ensures icons are rendered under the loader before showing UI
                const forceIcons = setInterval(() => {
                    if (window.lucide) {
                        // Attempt to paint icons
                        lucide.createIcons();
                        
                        // Verification check
                        const remainingIcons = document.querySelectorAll('i[data-lucide]').length;
                        const renderedSVGs = document.querySelectorAll('nav svg').length;

                        // SUCCESS CONDITION: No empty <i> tags left OR at least one SVG is found
                        // We also stop after 10 attempts (1 second) so the loader never gets stuck
                        if (remainingIcons === 0 || renderedSVGs > 0 || retryCount > 10) {
                            clearInterval(forceIcons);
                            
                            // 1. Start the visual fade out
                            loader.classList.add('loader-fade-out');
                            
                            // 2. Remove loader from the DOM once transition finishes
                            setTimeout(() => {
                                if (loader.parentNode) {
                                    loader.remove();
                                }
                            }, 600);
                        }
                    }
                    retryCount++;
                }, 100); // Check every 100ms
            }
        }
    }
}



// --- GROK AI SECURITY ACTION LOGGER (VERCEL ROUTE) ---
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