// wallet.js
import { ref, onValue } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { auth, db } from './firebase-config.js';

window.openMyWallet = () => {
    const user = auth.currentUser;
    if (!user) return window.openAuthModal();

    const modal = document.getElementById('wallet-modal');
    modal.classList.remove('hidden');

    // Real-time listener for balance
    const balanceRef = ref(db, `users/${user.uid}/tokens`);
    onValue(balanceRef, (snap) => {
        const tokens = snap.val() || 0;
        document.getElementById('wallet-purchased-bal').innerText = tokens;
        document.getElementById('token-count').innerText = tokens; // Sync with top bar if visible
    });
};

window.closeWalletModal = () => {
    document.getElementById('wallet-modal').classList.add('hidden');
};
