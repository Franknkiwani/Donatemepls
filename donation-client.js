import { ref, get } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { db, auth } from './firebase-config.js';

/**
 * 1. THE BRIDGE: Connects Feed Buttons to the Modal
 * Attached to window so onclick="handleTip" works
 */
window.handleTip = (uid, name, avatar) => {
    // We pass 'user' as the default type from the user feed
    window.openDonateDossier(uid, name, avatar, 'user');
};

/**
 * 2. MODAL CONTROLLER: Opens and populates the modal
 */
window.openDonateDossier = async (targetId, name, avatar, type) => {
    const modal = document.getElementById('modern-donate-modal');
    if (!modal) return;

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Lock scroll

    // Set temporary data while we fetch
    document.getElementById('donate-target-name').innerText = `@${name}`;
    document.getElementById('donate-target-img').src = avatar || 'https://img.icons8.com/fluency/96/user-male-circle.png';
    
    // Reset input and notice
    const amountInput = document.getElementById('donate-input-amount');
    const notice = document.getElementById('fee-notice');
    if(amountInput) amountInput.value = '';
    if(notice) notice.innerText = '';

    // LIVE FEE CALCULATION (Moved here from main script)
    if (amountInput) {
        amountInput.oninput = (e) => {
            const amount = parseInt(e.target.value) || 0;
            const net = Math.floor(amount * 0.7); // 70% to recipient
            if(notice) {
                notice.innerText = amount > 0 ? `Recipient receives: ${net} (30% fee applied)` : '';
                notice.className = "text-[10px] font-bold text-emerald-500 mt-2 italic";
            }
        };
    }

    try {
        const path = type === 'campaign' ? `campaigns/${targetId}` : `users/${targetId}`;
        const snap = await get(ref(db, path));
        const data = snap.val() || {};

        document.getElementById('donate-target-bio').innerText = data.bio || data.description || "Active Member";
        
        const raised = type === 'campaign' ? (data.raised || 0) : (data.totalReceivedTokens || 0);
        document.getElementById('donate-stat-raised').innerText = `${raised.toLocaleString()} TKN`;
        
        // Connect the "Confirm" button
        document.getElementById('confirm-donation-btn').onclick = () => window.executeTransmission(targetId, type);
    } catch (e) { 
        console.error("Fetch error:", e); 
    }
};

/**
 * 3. API TRANSMITTER: Sends the data to Vercel
 */
window.executeTransmission = async (targetId, type) => {
    const amountInput = document.getElementById('donate-input-amount');
    const amount = amountInput ? amountInput.value : 0;
    const btn = document.getElementById('confirm-donation-btn');

    if (!amount || amount <= 0) {
        if(window.notify) window.notify("Please enter a valid amount");
        else alert("Enter amount");
        return;
    }

    btn.disabled = true;
    const originalText = btn.innerText;
    btn.innerText = "TRANSMITTING...";

    try {
        const user = auth.currentUser;
        if (!user) throw new Error("Please login to donate");

        const idToken = await user.getIdToken();
        
        // CALL VERCEL
        const response = await fetch('/api/donate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken, targetId, amount: parseInt(amount), type })
        });

        const res = await response.json();

        if (res.success) {
            if(window.showCustomAlert) {
                window.showCustomAlert("Success", `Sent ${res.netSent} tokens!`, "success");
            } else {
                alert("Success!");
            }
            
            // Close modal and refresh after short delay
            setTimeout(() => {
                window.closeDonateModal();
                location.reload(); 
            }, 1500);
        } else {
            throw new Error(res.error || "Transaction failed");
        }
    } catch (err) {
        if(window.showCustomAlert) window.showCustomAlert("Error", err.message, "error");
        else alert(err.message);
        btn.disabled = false;
        btn.innerText = originalText;
    }
};

window.closeDonateModal = () => {
    const modal = document.getElementById('modern-donate-modal');
    if(modal) modal.classList.add('hidden');
    document.body.style.overflow = ''; // Unlock scroll
};
