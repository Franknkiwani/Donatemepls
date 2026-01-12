import { ref, get } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { auth, db } from './firebase-config.js';

window.openMyAccount = async () => {
    const user = auth.currentUser;
    if (!user) return window.openAuthModal ? window.openAuthModal() : null;

    const modal = document.getElementById('myaccount-modal');
    modal.classList.remove('hidden');

    try {
        const userSnap = await get(ref(db, `users/${user.uid}`));
        const userData = userSnap.val() || {};

        // Update UI using synchronized IDs
        document.getElementById('myaccount-img').src = userData.avatar || 'https://via.placeholder.com/150';
        document.getElementById('myaccount-handle').innerText = `@${userData.username || 'User'}`;

        const logsSnap = await get(ref(db, `logs/${user.uid}`)); 
        renderMyAccountActivity(logsSnap.val() || {});

    } catch (err) {
        console.error("MyAccount Sync Error:", err);
    }
};

const renderMyAccountActivity = (logs) => {
    const container = document.getElementById('myaccount-feed');
    container.innerHTML = `<h4 class="text-[10px] font-black text-zinc-500 uppercase mb-4 italic">Activity History</h4>`;

    const items = Object.values(logs).reverse();
    if (items.length === 0) {
        container.innerHTML += `<p class="text-[9px] text-zinc-600 text-center py-10 uppercase font-bold">No history found</p>`;
        return;
    }

    items.forEach(log => {
        const isReceived = log.type === 'received';
        const div = document.createElement('div');
        div.className = "flex justify-between items-center p-4 mb-3 bg-white/[0.03] rounded-2xl border border-white/5";
        div.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg flex items-center justify-center ${isReceived ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}">
                    <i data-lucide="${isReceived ? 'arrow-down-left' : 'arrow-up-right'}" class="w-4 h-4"></i>
                </div>
                <div>
                    <p class="text-[10px] font-black uppercase text-white">${isReceived ? 'From' : 'To'} ${log.targetName}</p>
                    <p class="text-[8px] font-bold text-zinc-500 uppercase">${new Date(log.timestamp).toLocaleDateString()}</p>
                </div>
            </div>
            <div class="text-right text-xs font-black ${isReceived ? 'text-emerald-500' : 'text-white'}">
                ${isReceived ? '+' : '-'}${log.amount}
            </div>`;
        container.appendChild(div);
    });
    if (window.lucide) lucide.createIcons();
};

window.closeMyAccount = () => document.getElementById('myaccount-modal').classList.add('hidden');
