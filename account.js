import { ref, get } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { auth, db } from './firebase-config.js';

// --- OPEN MY ACCOUNT MODAL ---
window.openMyAccount = async () => {
    const user = auth.currentUser;
    if (!user) return typeof window.openAuthModal === 'function' ? window.openAuthModal() : console.log("Auth modal missing");

    const modal = document.getElementById('myaccount-modal');
    if (modal) modal.classList.remove('hidden');

    try {
        // 1. Fetch User Data
        const userSnap = await get(ref(db, `users/${user.uid}`));
        const userData = userSnap.val() || {};

        // 2. Update UI Elements
        const pfp = document.getElementById('myaccount-pfp-display');
        const handle = document.getElementById('myaccount-handle-display');
        
        if (pfp) pfp.src = userData.avatar || 'https://via.placeholder.com/150';
        if (handle) handle.innerText = `@${userData.username || 'User'}`;

        // 3. Fetch logs for Activity Feed
        const logsSnap = await get(ref(db, `logs/${user.uid}`)); 
        renderMyAccountActivity(logsSnap.val() || {});

    } catch (err) {
        console.error("MyAccount Load Error:", err);
    }
};

// --- RENDER ACTIVITY FEED ---
const renderMyAccountActivity = (logs) => {
    const container = document.getElementById('myaccount-activity-container');
    if (!container) return;

    container.innerHTML = `<h4 class="text-[10px] font-black text-zinc-500 uppercase mb-3 italic">Transaction Activity</h4>`;

    const items = Object.values(logs).reverse(); // Most recent first

    if (items.length === 0) {
        container.innerHTML += `<p class="text-[9px] text-zinc-600 uppercase font-bold py-4 text-center">No transactions found</p>`;
        return;
    }

    items.forEach(log => {
        const isReceived = log.type === 'received';
        const div = document.createElement('div');
        div.className = "flex justify-between items-center p-3 mb-2 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors";
        
        div.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg flex items-center justify-center ${isReceived ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}">
                    <i data-lucide="${isReceived ? 'arrow-down-left' : 'arrow-up-right'}" class="w-4 h-4"></i>
                </div>
                <div>
                    <p class="text-[10px] font-black uppercase text-white leading-tight">${isReceived ? 'From' : 'To'} ${log.targetName || 'System'}</p>
                    <p class="text-[7px] font-bold text-zinc-500 uppercase tracking-tighter">${new Date(log.timestamp).toLocaleDateString()}</p>
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

window.closeMyAccount = () => {
    document.getElementById('myaccount-modal')?.classList.add('hidden');
};
