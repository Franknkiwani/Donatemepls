// 1. DATABASE & AUTH IMPORTS (Crucial for a separate file)
import { auth, db } from '../firebase-config.js'; 
import { ref, get } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";

// --- WALLET CORE FUNCTIONS ---

window.openWalletModal = async () => {
    const el = document.getElementById('wallet-modal');
    const user = auth.currentUser;
    if(!el || !user) return;

    el.classList.remove('hidden');
    
    // Fixed: Added 'window.' check to prevent crash if not moved yet
    if(window.toggleScrollLock) window.toggleScrollLock(true);

    try {
        const snap = await get(ref(db, `users/${user.uid}`));
        const data = snap.val() || {};

        const totalTokens = Number(data.tokens || 0);
        const earned = Number(data.totalEarned || 0);
        const purchased = Math.max(0, totalTokens - earned);
        
        const purchasedBal = document.getElementById('wallet-purchased-bal');
        const earnedBal = document.getElementById('wallet-earned-bal');
        
        if(purchasedBal) purchasedBal.innerText = purchased;
        if(earnedBal) earnedBal.innerText = earned;

        window.switchWalletTab('received');
    } catch (error) {
        console.error("Wallet Load Error:", error);
    }
};

window.closeWalletModal = () => {
    const el = document.getElementById('wallet-modal');
    if(el) {
        el.classList.add('hidden');
        if(window.toggleScrollLock) window.toggleScrollLock(false);
    }
};

// --- WITHDRAW LOGIC ---

window.triggerWithdraw = async () => {
    const user = auth.currentUser;
    const earnedElement = document.getElementById('wallet-earned-bal');
    if(!earnedElement) return;

    const earnedVal = parseInt(earnedElement.innerText);
    
    if(earnedVal < 100) {
        alert("Minimum withdrawal is 100 tokens.");
        return;
    }

    const email = prompt("Enter your PayPal email for payout:");
    if(!email) return;

    try {
        const idToken = await user.getIdToken();
        const res = await fetch('/api/withdraw', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                idToken,
                email,
                amount: earnedVal
            })
        });

        const result = await res.json();
        if(result.success) {
            alert(`Payout Submitted! Net: $${result.netAmount.toFixed(2)}`);
            window.openWalletModal(); 
        } else {
            alert(result.error || "Withdrawal failed.");
        }
    } catch (err) {
        console.error("Withdraw Error:", err);
    }
};

window.switchWalletTab = async (tab) => {
    const container = document.getElementById('wallet-history-content');
    const user = auth.currentUser;
    if(!container || !user) return;
    
    const tabReceived = document.getElementById('tab-btn-received');
    const tabPurchased = document.getElementById('tab-btn-purchased');
    const activeStyle = 'text-blue-500 border-b-2 border-blue-500 pb-2 text-[10px] font-black uppercase';
    const inactiveStyle = 'text-zinc-500 pb-2 text-[10px] font-black uppercase';

    if(tabReceived) tabReceived.className = tab === 'received' ? activeStyle : inactiveStyle;
    if(tabPurchased) tabPurchased.className = tab === 'purchased' ? activeStyle : inactiveStyle;

    container.innerHTML = `<div class="p-10 flex justify-center"><div class="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>`;

    if (tab === 'received') {
        try {
            const snap = await get(ref(db, `donations`));
            const allTx = snap.val() || {};
            
            const userSnap = await get(ref(db, `users/${user.uid}`));
            const myName = userSnap.val()?.username;

            const received = Object.values(allTx)
                .filter(tx => tx.toUid === user.uid || tx.toName === myName)
                .sort((a, b) => b.timestamp - a.timestamp);

            if (received.length === 0) {
                container.innerHTML = `<p class="text-center py-10 text-[9px] text-zinc-600 font-black uppercase tracking-widest">No signals received</p>`;
                return;
            }

            container.innerHTML = '';
            for (const tx of received) {
                await renderWalletHistoryItem(tx, container);
            }
        } catch (err) {
            container.innerHTML = `<p class="text-center py-10 text-[9px] text-red-500 font-black uppercase tracking-widest">Error loading history</p>`;
        }
    } else {
        container.innerHTML = `<p class="text-center py-10 text-[9px] text-zinc-600 font-black uppercase tracking-widest">Purchase history coming soon</p>`;
    }
};

const renderWalletHistoryItem = async (tx, container) => {
    if(!tx.fromUid) return; 

    const senderSnap = await get(ref(db, `users/${tx.fromUid}`));
    const s = senderSnap.val() || {};
    const isPrem = s.isPremium === true || s.premium === true;

    // Helper Safeguards
    const badge = (typeof window.getVerifiedBadge === 'function') ? window.getVerifiedBadge() : '';
    const time = (typeof window.getRelativeTime === 'function') ? window.getRelativeTime(tx.timestamp) : 'Recently';
    const avatar = s.avatar || (window.presets ? window.presets[0] : '');

    const item = document.createElement('div');
    item.className = "flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-[1.5rem] mb-2";
    
    item.innerHTML = `
        <div class="flex items-center gap-3">
            <div class="relative">
                <img src="${avatar}" class="w-10 h-10 rounded-full object-cover border border-white/10 shadow-lg">
                ${isPrem ? `
                    <div class="absolute -right-1 -bottom-1 bg-blue-500 rounded-full p-0.5 border-2 border-[#0a0a0a]">
                        ${badge}
                    </div>
                ` : ''}
            </div>
            <div>
                <p class="text-[10px] font-black text-white uppercase italic tracking-tight">@${s.username || 'User'}</p>
                <p class="text-[8px] text-zinc-500 font-bold uppercase">${time}</p>
            </div>
        </div>
        <div class="flex flex-col items-end gap-2">
            <span class="text-xs font-black text-emerald-400">+$${tx.amount}</span>
            <button onclick="window.closeWalletModal(); if(window.handleTip) window.handleTip('${tx.fromUid}', '${s.username}', '${s.avatar}')" 
                    class="px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600 border border-blue-500/20 text-blue-400 hover:text-white text-[8px] font-black uppercase rounded-xl transition-all active:scale-90">
                Donate Back
            </button>
        </div>
    `;
    container.appendChild(item);
};
