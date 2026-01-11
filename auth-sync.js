/**
 * AUTH-SYNC.JS 
 * Complete Standalone Authentication, Data Sync & Upgrade Module
 */

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import { ref, onValue, update } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { auth, db } from './firebase-config.js';

// --- GLOBAL SETTINGS & UPGRADE CONFIG ---
const PLAN_ID = 'P-47S21200XM2944742NFPLPEA';
const presets = window.presets || [
    "https://img.pikbest.com/origin/10/25/30/74apIkbEsT5qB.jpg!w700wp",
    "https://thumbs.dreamstime.com/b/cool-neon-party-wolf-headphones-black-background-colorful-illustration-music-theme-modern-portrait-bright-vibrant-385601082.jpg",
    "https://wallpapers.com/images/hd/gaming-profile-pictures-tt8bbzdcf6zibhoi.jpg"
];

// --- UPGRADE MODAL ENGINE & PAYPAL ---
window.openUpgradeModal = () => {
    const modal = document.getElementById('upgrade-modal');
    if (modal) {
        modal.classList.remove('hidden');
        // Ensure PayPal button renders once modal is visible
        setTimeout(initUpgradePayPal, 200);
    }
};

window.closeUpgradeModal = () => {
    document.getElementById('upgrade-modal')?.classList.add('hidden');
};

function initUpgradePayPal() {
    const target = document.getElementById(`paypal-button-container-${PLAN_ID}`) || 
                   document.getElementById('paypal-button-container-PRO');
    
    // Prevent rendering duplicates
    if (!window.paypal || !target || target.hasChildNodes()) return;

    window.paypal.Buttons({
        style: { shape: 'pill', color: 'gold', layout: 'vertical', label: 'subscribe' },
        createSubscription: (data, actions) => {
            return actions.subscription.create({ 
                plan_id: PLAN_ID, 
                custom_id: auth.currentUser?.uid 
            });
        },
        onApprove: async (data) => {
            try {
                const user = auth.currentUser;
                if(!user) return;

                // 1. Permanent Database Upgrade
                await update(ref(db, `users/${user.uid}`), { 
                    isPremium: true, 
                    tokens: 20 
                });

                // 2. Vercel Security Action Logger
                if (typeof window.logSecurityAction === 'function') {
                    await window.logSecurityAction('SUBSCRIPTION_SUCCESS', {
                        subID: data.subscriptionID,
                        plan: PLAN_ID
                    });
                }
                
                if(typeof window.notify === 'function') window.notify("Welcome to PRO!"); 
                window.closeUpgradeModal();
            } catch (err) {
                console.error("Upgrade Sync Error:", err);
            }
        }
    }).render(target);
}

// --- MASTER AUTH & DATA SYNC LISTENER ---
onAuthStateChanged(auth, async (user) => {
    
    // Initial Load Logic
    if (typeof window.loadCampaigns === 'function') {
        window.loadCampaigns().then(() => {
            setTimeout(() => { 
                if(window.syncReady) window.syncReady.campaigns = true; 
                if(window.checkReady) window.checkReady(); 
            }, 500);
        });
    }
    if (typeof window.loadUserFeed === 'function') window.loadUserFeed();
    if (typeof window.switchView === 'function') window.switchView('campaigns');

    if (user) {
        const isAdmin = user.uid === "4xEDAzSt5javvSnW5mws2Ma8i8n1";
        
        // --- USER DATA LISTENER ---
        onValue(ref(db, `users/${user.uid}`), (s) => {
            const d = s.val() || {};

            // 1. Security: Ban Check
            if (d.banned) {
                const ts = Date.now();
                const rawHash = btoa(`${user.uid}|${ts}|${d.banReason || "SECURITY"}`).replace(/=/g, '');
                window.location.href = `/bannedaccount/${user.uid}?code=SEC-0x${rawHash.toUpperCase()}`;
                return;
            }

            // 2. Identity Sync (UI & Upgrade Modal Previews)
            const name = d.username || "User";
            const avatar = d.avatar || presets[0];

            // Name updates
            document.querySelectorAll('.user-name-display').forEach(el => el.innerText = name);
            if(document.getElementById('upgrade-username-preview')) document.getElementById('upgrade-username-preview').innerText = name;
            
            const handleEl = document.getElementById('header-handle');
            if(handleEl) handleEl.innerText = isAdmin ? `👑 @${name}` : `@${name}`;
            if(document.getElementById('username-input')) document.getElementById('username-input').value = name;

            // Avatar updates
            const pfpTargets = ['header-pfp', 'modal-preview-img', 'profile-main-img', 'upgrade-pfp-preview'];
            pfpTargets.forEach(id => {
                const img = document.getElementById(id);
                if(img) { img.src = avatar; img.classList.remove('hidden'); }
            });
            document.getElementById('header-initial')?.classList.add('hidden');

            // 3. Tokens & Pro Status
            const tokenElement = document.getElementById('token-count');
            if(tokenElement) {
                tokenElement.innerText = (d.tokens || 0).toLocaleString();
                if(isAdmin) tokenElement.classList.add('text-amber-500');
            }

            const isPro = d.isPremium || isAdmin;
            if(document.getElementById('header-verified')) document.getElementById('header-verified').classList.toggle('hidden', !isPro);
            
            // 4. Manage/Cancel Subscription Logic
            const upgradeBtn = document.querySelector('button[onclick="openUpgradeModal()"]');
            const manageBtn = document.getElementById('manage-subscription-btn');

            if (isPro && !isAdmin) {
                if(upgradeBtn) upgradeBtn.classList.add('hidden');
                if(manageBtn) {
                    manageBtn.classList.remove('hidden');
                    manageBtn.innerHTML = `
                        <a href="https://www.paypal.com/myaccount/autopay/" target="_blank" 
                           class="flex items-center gap-1.5 px-4 py-2 bg-white/5 rounded-lg border border-white/10 text-[10px] font-black text-amber-500 uppercase hover:bg-amber-500/10 transition-all">
                           <i data-lucide="settings-2" class="w-3 h-3"></i> Manage / Cancel PRO
                        </a>`;
                    if(window.lucide) lucide.createIcons();
                }
            } else {
                if(upgradeBtn) upgradeBtn.classList.toggle('hidden', isPro);
                if(manageBtn) manageBtn.classList.add('hidden');
            }

            // Signal Loader
            if(window.syncReady) window.syncReady.user = true;
            if(window.checkReady) window.checkReady();
        });

        // --- PAYOUTS LISTENER ---
        onValue(ref(db, `payouts`), (snapshot) => {
            const historyList = document.getElementById('payout-history-list');
            if(!historyList) return;
            
            historyList.innerHTML = '';
            let totalPaid = 0;
            const userPayouts = Object.values(snapshot.val() || {}).filter(p => p.uid === user.uid);
            
            userPayouts.forEach(p => {
                const amount = parseFloat(p.netAmount || 0);
                const isFinal = p.status === 'paid' || p.status === 'completed';
                if (isFinal) totalPaid += amount;

                const div = document.createElement('div');
                div.className = "flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5 mb-2";
                div.innerHTML = `
                    <div class="flex flex-col">
                        <span class="text-[9px] font-black text-white uppercase">$${amount.toFixed(2)}</span>
                        <span class="text-[7px] text-zinc-500 uppercase">${p.timestamp ? new Date(p.timestamp).toLocaleDateString() : 'Recent'}</span>
                    </div>
                    <span class="text-[8px] font-black uppercase ${isFinal ? 'text-emerald-500' : 'text-amber-500'}">
                        ${p.status}
                    </span>`;
                historyList.appendChild(div);
            });

            if(document.getElementById('total-withdrawn')) document.getElementById('total-withdrawn').innerText = `$${totalPaid.toFixed(2)}`;
        });

        // Toggle UI
        ['user-tools', 'token-bar'].forEach(id => document.getElementById(id)?.classList.remove('hidden'));
        document.getElementById('login-btn')?.classList.add('hidden');
        if (typeof window.setupPresence === 'function') window.setupPresence(user.uid);

    } else {
        // Guest Logic
        ['user-tools', 'token-bar'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
        document.getElementById('login-btn')?.classList.remove('hidden');
        if(window.syncReady) window.syncReady.user = true; 
        if(window.checkReady) window.checkReady(); 
    }
});
