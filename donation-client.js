import { ref, get } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { db, auth } from './firebase-config.js';

// This function opens the HTML modal you built
window.openDonateDossier = async (targetId, name, avatar, type) => {
    const modal = document.getElementById('modern-donate-modal');
    if (!modal) return;

    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    // Set temporary data while we fetch
    document.getElementById('donate-target-name').innerText = `@${name}`;
    document.getElementById('donate-target-img').src = avatar || 'https://img.icons8.com/fluency/96/user-male-circle.png';

    try {
        const path = type === 'campaign' ? `campaigns/${targetId}` : `users/${targetId}`;
        const snap = await get(ref(db, path));
        const data = snap.val() || {};

        document.getElementById('donate-target-bio').innerText = data.bio || data.description || "Active Member";
        document.getElementById('donate-stat-raised').innerText = `${(type === 'campaign' ? data.raised : data.totalReceivedTokens) || 0} TKN`;
        
        // Connect the "Confirm" button to the API call
        document.getElementById('confirm-donation-btn').onclick = () => window.executeTransmission(targetId, type);
    } catch (e) { console.error(e); }
};

// This function calls your Vercel API
window.executeTransmission = async (targetId, type) => {
    const amount = document.getElementById('donate-input-amount').value;
    const btn = document.getElementById('confirm-donation-btn');

    if (!amount || amount <= 0) return alert("Enter amount");

    btn.disabled = true;
    btn.innerText = "TRANSMITTING...";

    try {
        const idToken = await auth.currentUser.getIdToken();
        
        // THIS CALLS YOUR VERCEL API
        const response = await fetch('/api/donate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken, targetId, amount: parseInt(amount), type })
        });

        const res = await response.json();
        if (res.success) {
            alert("Success!");
            location.reload(); // Refresh to show new balance
        } else {
            alert(res.error);
        }
    } catch (err) {
        alert("Server Error");
    } finally {
        btn.disabled = false;
        btn.innerText = "Confirm Transmission";
    }
};

window.closeDonateModal = () => {
    document.getElementById('modern-donate-modal').classList.add('hidden');
    document.body.style.overflow = '';
};
