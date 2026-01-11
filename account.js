import { ref, get, query, orderByChild, equalTo, limitToLast } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { auth, db } from './firebase-config.js';

window.openMyAccount = async () => {
    const user = auth.currentUser;
    if (!user) return window.openAuthModal();

    const modal = document.getElementById('profile-modal');
    modal.classList.remove('hidden');

    try {
        // 1. Fetch User Stats
        const userSnap = await get(ref(db, `users/${user.uid}`));
        const userData = userSnap.val() || {};

        // 2. Update Basic Info
        document.getElementById('profile-main-img').src = userData.avatar || 'https://via.placeholder.com/150';
        document.getElementById('profile-handle-display').innerText = `@${userData.username || 'User'}`;

        // 3. Fetch Transaction History (Sent & Received)
        // We query the 'donations' node for any records involving this user
        const logsSnap = await get(ref(db, `logs/${user.uid}`)); 
        const logs = logsSnap.val() || {};

        renderActivityFeed(logs);

    } catch (err) {
        console.error("Account Load Error:", err);
    }
};

const renderActivityFeed = (logs) => {
    const container = document.getElementById('manage-subscription-btn'); // Using your existing ID for the list
    container.classList.remove('hidden');
    container.innerHTML = `<h4 class="text-[10px] font-black text-zinc-500 uppercase mb-3">Activity History</h4>`;

    const items = Object.values(logs).reverse(); // Newest first

    if (items.length === 0) {
        container.innerHTML += `<p class="text-[9px] text-zinc-600 uppercase font-bold">No transactions found</p>`;
        return;
    }

    items.forEach(log => {
        const isReceived = log.type === 'received';
        const div = document.createElement('div');
        div.className = "flex justify-between items-center p-3 mb-2 bg-white/5 rounded-xl border border-white/5";
        
        div.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg flex items-center justify-center ${isReceived ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}">
                    <i data-lucide="${isReceived ? 'arrow-down-left' : 'arrow-up-right'}" class="w-4 h-4"></i>
                </div>
                <div>
                    <p class="text-[10px] font-black uppercase text-white">${isReceived ? 'Received from' : 'Sent to'} ${log.targetName}</p>
                    <p class="text-[8px] font-bold text-zinc-500 uppercase">${new Date(log.timestamp).toLocaleDateString()}</p>
                </div>
            </div>
            <div class="text-right">
                <p class="text-xs font-black ${isReceived ? 'text-emerald-500' : 'text-white'}">
                    ${isReceived ? '+' : '-'}${log.amount} 
                </p>
                <p class="text-[7px] font-black text-zinc-600 uppercase">Tokens</p>
            </div>
        `;
        container.appendChild(div);
    });

    if (window.lucide) lucide.createIcons();
};

window.closeProfile = () => {
    document.getElementById('profile-modal').classList.add('hidden');
};
