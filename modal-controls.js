/**
 * UI & MODAL ENGINE
 * Handles all visual transitions and window controls
 */

// 1. Core Helper: Background Scroll Lock
const toggleScrollLock = (isLocked) => {
    if (isLocked) {
        document.body.classList.add('stop-scrolling');
    } else {
        document.body.classList.remove('stop-scrolling');
    }
};

// 2. Auth Modals
window.openAuthModal = () => document.getElementById('auth-modal')?.classList.remove('hidden');
window.closeAuthModal = () => document.getElementById('auth-modal')?.classList.add('hidden');

// 3. Profile & Settings
window.openProfile = () => {
    document.getElementById('profile-modal')?.classList.remove('hidden');
    toggleScrollLock(true);
};
window.closeProfile = () => {
    document.getElementById('profile-modal')?.classList.add('hidden');
    toggleScrollLock(false);
};

window.openAccountModal = () => {
    document.getElementById('account-modal')?.classList.remove('hidden');
    toggleScrollLock(true);
};
window.closeAccountModal = () => {
    document.getElementById('account-modal')?.classList.add('hidden');
    toggleScrollLock(false);
};

// 4. Upgrade & Token Shop
window.openUpgradeModal = () => {
    document.getElementById('upgrade-modal')?.classList.remove('hidden');
    if (typeof initPayPal === 'function') setTimeout(initPayPal, 100);
};
window.closeUpgradeModal = () => document.getElementById('upgrade-modal')?.classList.add('hidden');

window.openTokenModal = () => {
    document.getElementById('token-modal')?.classList.remove('hidden');
    toggleScrollLock(true);
};
window.closeTokenModal = () => {
    document.getElementById('token-modal')?.classList.add('hidden');
    toggleScrollLock(false);
    const container = document.getElementById('paypal-tokens-container');
    if (container) container.innerHTML = ''; 
};

window.selectPack = (btn, amount, tokens) => {
    document.querySelectorAll('.pack-option').forEach(el => el.classList.remove('border-amber-500', 'bg-amber-500/10'));
    btn.classList.add('border-amber-500', 'bg-amber-500/10');
    if (window.buyPack) window.buyPack(amount, tokens);
};

// 5. Withdrawal & Error Feedback
window.showErrorModal = (msg) => {
    const msgEl = document.getElementById('error-modal-msg');
    if(msgEl) msgEl.innerText = msg;
    document.getElementById('error-modal')?.classList.remove('hidden');
    toggleScrollLock(true);
    if (window.lucide) lucide.createIcons();
};
window.closeErrorModal = () => {
    document.getElementById('error-modal')?.classList.add('hidden');
    toggleScrollLock(false);
};

window.showWithdrawSuccess = (usdAmount) => {
    const usdEl = document.getElementById('payout-success-usd');
    if(usdEl) usdEl.innerText = `$${usdAmount.toFixed(2)}`;
    document.getElementById('withdraw-success-modal')?.classList.remove('hidden');
    toggleScrollLock(true);
    if (typeof confetti === 'function') confetti();
    if (window.lucide) lucide.createIcons();
};
window.closeWithdrawSuccess = () => {
    document.getElementById('withdraw-success-modal')?.classList.add('hidden');
    toggleScrollLock(false);
};

window.openWithdrawModal = () => {
    document.getElementById('withdraw-modal')?.classList.remove('hidden');
    toggleScrollLock(true);
};
window.closeWithdrawModal = () => {
    document.getElementById('withdraw-modal')?.classList.add('hidden');
    toggleScrollLock(false);
    const amt = document.getElementById('withdraw-amount');
    const email = document.getElementById('withdraw-email');
    if (amt) amt.value = '';
    if (email) email.value = '';
};

// 6. Campaign & Donation Modals
window.closeDonateModal = () => {
    document.getElementById('modern-donate-modal')?.classList.add('hidden');
    toggleScrollLock(false);
};
window.closeCreateModal = () => {
    document.getElementById('create-campaign-modal')?.classList.add('hidden');
    toggleScrollLock(false);
};

// 7. Global Footer & Hub Navigation
window.openSupportChat = () => {
    const el = document.getElementById('support-modal');
    if(el) {
        el.classList.remove('hidden');
        toggleScrollLock(true);
        if(window.lucide) lucide.createIcons();
    }
};
window.closeSupportChat = () => {
    document.getElementById('support-modal')?.classList.add('hidden');
    toggleScrollLock(false);
};

window.openExploreModal = () => {
    const el = document.getElementById('explore-modal');
    if(el) {
        el.classList.remove('hidden');
        toggleScrollLock(true);
        if (window.switchHubView) window.switchHubView('top-donors');
    }
};
window.closeExploreModal = () => {
    document.getElementById('explore-modal')?.classList.add('hidden');
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
    document.getElementById('wallet-modal')?.classList.add('hidden');
    toggleScrollLock(false);
};
