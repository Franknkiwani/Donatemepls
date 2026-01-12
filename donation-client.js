import { ref, get } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { db, auth } from './firebase-config.js';

// --- 1. THE BRIDGES (Connecting to your other scripts) ---

// Matches handleDonateCampaign(id, title) in your campaign.js
window.handleDonateCampaign = (id, title) => {
    // We pass an empty string for avatar; the fetch logic below will grab the real imageUrl from DB
    window.openDonateDossier(id, title, '', 'campaign');
};

// Matches handleTip(uid, name, avatar) in your user feed
window.handleTip = (uid, name, avatar) => {
    window.openDonateDossier(uid, name, avatar, 'user');
};

// --- 2. MODAL CONTROLLER ---
window.openDonateDossier = async (targetId, name, avatar, type) => {
    const modal = document.getElementById('modern-donate-modal');
    if (!modal) return console.error("Modal #modern-donate-modal not found in HTML");

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
        const raisedVal = type === 'campaign' ? (data.raised || 0) : (data.totalReceivedTokens || 0);
        document.getElementById('donate-stat-raised').innerText = `${Number(raisedVal).toLocaleString()} TKN`;

        // Update Supporter/Donor Count
        let donorCount = data.donorCount || (data.donors ? Object.keys(data.donors).length : 0);
        document.getElementById('donate-stat-donors').innerText = donorCount.toLocaleString();
        
        // If it's a campaign and we didn't have an image, use the one from DB
        if (type === 'campaign' && data.imageUrl) {
            document.getElementById('donate-target-img').src = data.imageUrl;
        }

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
        const user = auth.currentUser;
        if (!user) throw new Error("Please log in first");
        
        const idToken = await user.getIdToken();
        
        const response = await fetch('/api/donate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken, targetId, amount, type })
        });

        const res = await response.json();

        if (res.success) {
            window.closeDonateModal();
            
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
        alert(err.message || "Server connection error");
        btn.disabled = false;
        btn.innerText = originalText;
    }
};

// --- 4. CLOSING LOGIC ---
window.closeDonateModal = () => {
    const modal = document.getElementById('modern-donate-modal');
    if(modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
    document.body.style.overflow = '';
};

window.closeSuccessModal = () => {
    const successModal = document.getElementById('donation-success-modal');
    if(successModal) {
        successModal.classList.add('hidden');
        successModal.style.display = 'none';
    }
    location.reload(); 
};

// --- 5. EVENT LISTENERS FOR CLOSABILITY ---

// Close on Backdrop Click
window.addEventListener('click', (e) => {
    const donateModal = document.getElementById('modern-donate-modal');
    const successModal = document.getElementById('donation-success-modal');
    
    if (e.target === donateModal) window.closeDonateModal();
    if (e.target === successModal) window.closeSuccessModal();
});

// Close on Escape Key
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        window.closeDonateModal();
        // We don't reload on escape for success modal to avoid accidental refreshes
        const successModal = document.getElementById('donation-success-modal');
        if (successModal) successModal.classList.add('hidden');
    }
});
