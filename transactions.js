import { ref, get } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { auth, db } from './firebase-config.js';

// --- STATE MANAGER ---
// This stores who we are currently tipping/donating to
let activeTarget = { id: null, type: null };

// --- HELPERS ---
const notify = (msg) => {
    if (window.showErrorModal) window.showErrorModal(msg);
    else alert(msg);
};

// --- TRANSACTION LOGIC ---

window.closeSuccessModal = () => {
    document.getElementById('donation-success-modal')?.classList.add('hidden');
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
        // Assumes requestAdminSecret exists globally or in this file
        if (window.requestAdminSecret) {
            adminSecret = await window.requestAdminSecret();
            if (!adminSecret) return; 
        }
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

        // --- SUCCESS UI ---
        const netEl = document.getElementById('success-net-amount');
        const grossEl = document.getElementById('success-gross-amount');
        if (netEl) netEl.innerText = result.netSent;
        if (grossEl) grossEl.innerText = amount;
        
        if (window.closeDonateModal) window.closeDonateModal(); 
        document.getElementById('donation-success-modal')?.classList.remove('hidden'); 
        document.body.classList.add('stop-scrolling');
        
        if(typeof confetti === 'function') confetti();
        amountInput.value = '';

        // Refresh Hub
        if (typeof window.switchHubView === 'function') {
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

// --- GLOBAL HANDLERS (Tipping & Donating) ---

window.handleTip = async (uid, username, avatar) => {
    activeTarget = { id: uid, type: 'user' };
    
    document.getElementById('donate-target-name-display').innerText = `@${username}`;
    document.getElementById('donate-target-img').src = avatar || "https://img.pikbest.com/origin/10/25/30/74apIkbEsT5qB.jpg!w700wp";
    document.getElementById('donate-input-amount').value = '';
    
    try {
        const [viewerSnap, targetSnap] = await Promise.all([
            get(ref(db, `users/${auth.currentUser.uid}`)),
            get(ref(db, `users/${uid}`))
        ]);

        const viewerData = viewerSnap.val() || {};
        const targetData = targetSnap.val() || {};
        const isViewerPro = viewerData.isPremium || (auth.currentUser.uid === "4xEDAzSt5javvSnW5mws2Ma8i8n1");

        document.getElementById('stat-raised-val').innerText = targetData.totalRaised || 0;
        document.getElementById('stat-donors-val').innerText = targetData.donorCount || 0;

        const lockOverlay = document.getElementById('stats-premium-lock');
        if (lockOverlay) isViewerPro ? lockOverlay.classList.add('hidden') : lockOverlay.classList.remove('hidden');

    } catch (e) { console.error("Stats Error:", e); }

    document.getElementById('modern-donate-modal')?.classList.remove('hidden');
    document.body.classList.add('stop-scrolling');
    if (window.lucide) lucide.createIcons();
};

window.handleDonateCampaign = async (id, title) => {
    activeTarget = { id: id, type: 'campaign' };
    
    document.getElementById('donate-target-name-display').innerText = title;
    document.getElementById('donate-target-img').src = "https://img.icons8.com/fluency/96/charity.png";
    document.getElementById('donate-input-amount').value = '';

    try {
        const [viewerSnap, campSnap] = await Promise.all([
            get(ref(db, `users/${auth.currentUser.uid}`)),
            get(ref(db, `campaigns/${id}`))
        ]);

        const viewerData = viewerSnap.val() || {};
        const campData = campSnap.val() || {};
        const isViewerPro = viewerData.isPremium || (auth.currentUser.uid === "4xEDAzSt5javvSnW5mws2Ma8i8n1");

        document.getElementById('stat-raised-val').innerText = campData.raised || 0;
        document.getElementById('stat-donors-val').innerText = campData.donorsCount || 0;

        const lockOverlay = document.getElementById('stats-premium-lock');
        if (lockOverlay) isViewerPro ? lockOverlay.classList.add('hidden') : lockOverlay.classList.remove('hidden');

    } catch (e) { console.error("Campaign Stats Error:", e); }

    document.getElementById('modern-donate-modal')?.classList.remove('hidden');
    document.body.classList.add('stop-scrolling');
    if (window.lucide) lucide.createIcons();
};

// Bind the button
const cBtn = document.getElementById('confirm-donation-btn');
if(cBtn) cBtn.onclick = window.confirmDonation;
