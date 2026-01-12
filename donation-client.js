import { ref, get } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { db, auth } from './firebase-config.js';

// --- 1. THE BRIDGES ---
// Called from the User Feed
window.handleTip = (uid, name, avatar) => {
    window.openDonateDossier(uid, name, avatar, 'user');
};

// Called from the Campaign Grid
window.handleCampaignDonate = (id, title, image) => {
    window.openDonateDossier(id, title, image, 'campaign');
};

// --- 2. MODAL CONTROLLER ---
window.openDonateDossier = async (targetId, name, avatar, type) => {
    const modal = document.getElementById('modern-donate-modal');
    if (!modal) return;

    // Show Modal
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Set Initial UI (Fast)
    document.getElementById('donate-target-name').innerText = type === 'campaign' ? name : `@${name}`;
    document.getElementById('donate-target-img').src = avatar || 'https://img.icons8.com/fluency/96/user-male-circle.png';
    document.getElementById('donate-target-bio').innerText = "Establishing secure link...";
    document.getElementById('donate-stat-raised').innerText = "0 TKN";
    document.getElementById('donate-stat-donors').innerText = "0";

    try {
        // Determine Data Path
        const path = type === 'campaign' ? `campaigns/${targetId}` : `users/${targetId}`;
        const snap = await get(ref(db, path));
        const data = snap.val() || {};

        // Update Bio/Description
        const bioText = type === 'campaign' ? data.description : data.bio;
        document.getElementById('donate-target-bio').innerText = bioText || (type === 'campaign' ? "No description provided." : "Active Member");

        // Update Raised Amount
        // Campaigns use 'raised', Users use 'totalReceivedTokens'
        const raisedVal = type === 'campaign' ? (data.raised || 0) : (data.totalReceivedTokens || 0);
        document.getElementById('donate-stat-raised').innerText = `${Number(raisedVal).toLocaleString()} TKN`;

        // Update Supporter/Donor Count
        // Check for 'donorCount' or the length of a 'donors' object
        let donorCount = 0;
        if (data.donorCount) {
            donorCount = data.donorCount;
        } else if (data.donors) {
            donorCount = Object.keys(data.donors).length;
        }
        document.getElementById('donate-stat-donors').innerText = donorCount.toLocaleString();
        
        // Refresh Lucide icons if any were injected
        if (window.lucide) window.lucide.createIcons();

        // Bind the Payment Button
        document.getElementById('confirm-donation-btn').onclick = () => window.executeTransmission(targetId, type);

    } catch (e) {
        console.error("Dossier Load Error:", e);
        document.getElementById('donate-target-bio').innerText = "Error loading target data.";
    }
};

// --- 3. API TRANSMITTER ---
window.executeTransmission = async (targetId, type) => {
    const amountInput = document.getElementById('donate-input-amount');
    const amount = amountInput ? parseInt(amountInput.value) : 0;
    const btn = document.getElementById('confirm-donation-btn');

    if (!amount || amount <= 0) return alert("Please enter a valid amount");

    btn.disabled = true;
    const originalText = btn.innerText;
    btn.innerText = "TRANSMITTING...";

    try {
        const idToken = await auth.currentUser.getIdToken();
        
        const response = await fetch('/api/donate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken, targetId, amount, type })
        });

        const res = await response.json();

        if (res.success) {
            window.closeDonateModal();
            
            // Show Success Modal
            const successModal = document.getElementById('donation-success-modal');
            if (successModal) {
                document.getElementById('success-net-amount').innerText = res.netSent || (amount * 0.7);
                document.getElementById('success-gross-amount').innerText = amount;
                document.getElementById('success-fee-amount').innerText = (amount - (res.netSent || amount * 0.7)).toFixed(0);
                successModal.classList.remove('hidden');
                successModal.style.display = 'flex';
            }
        } else {
            alert(res.error || "Transaction failed");
            btn.disabled = false;
            btn.innerText = originalText;
        }
    } catch (err) {
        alert("Server connection error");
        btn.disabled = false;
        btn.innerText = originalText;
    }
};

window.closeDonateModal = () => {
    const modal = document.getElementById('modern-donate-modal');
    if(modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
    document.body.style.overflow = '';
};

window.closeSuccessModal = () => {
    document.getElementById('donation-success-modal').classList.add('hidden');
    location.reload(); 
};
