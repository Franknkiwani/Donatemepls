import { ref, get, update, remove } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import { auth, db } from './firebase-config.js';

// --- 1. OPEN DASHBOARD & SYNC DATA ---
window.openMyAccount = async () => {
    const user = auth.currentUser;
    if (!user) return window.openAuthModal ? window.openAuthModal() : null;

    const modal = document.getElementById('myaccount-modal');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    try {
        const userSnap = await get(ref(db, `users/${user.uid}`));
        const userData = userSnap.val() || {};

        // Update Identity UI
        document.getElementById('myaccount-img').src = userData.avatar || 'https://via.placeholder.com/150';
        document.getElementById('myaccount-handle-input').value = userData.username || '';
        document.getElementById('myaccount-bio-input').value = userData.bio || '';
        document.getElementById('myaccount-email').innerText = user.email;
        document.getElementById('myaccount-tokens').innerText = `${(userData.tokens || 0).toLocaleString()} Tokens`;

        // Sync Mood Buttons Visual
        if (userData.mood) {
            document.querySelectorAll('.mood-btn').forEach(btn => btn.classList.remove('bg-white/10', 'scale-110'));
            const activeMood = document.getElementById(`mood-${userData.mood}`);
            if(activeMood) activeMood.classList.add('bg-white/10', 'scale-110');
        }

        // Sync Global Toggles
        if (userData.settings) {
            document.getElementById('set-compact-mode').checked = userData.settings.compactMode || false;
            document.getElementById('set-private-tokens').checked = userData.settings.privateTokens || false;
        }

        // Load Dynamic Feeds
        loadMySentRequests(user.uid);
        const logsSnap = await get(ref(db, `logs/${user.uid}`)); 
        renderMyAccountActivity(logsSnap.val() || {});

    } catch (err) {
        console.error("MyAccount Sync Error:", err);
    }
};

// --- 2. IDENTITY & BIO UPDATES ---
window.updateAccountIdentity = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const newHandle = document.getElementById('myaccount-handle-input').value.trim();
    const newBio = document.getElementById('myaccount-bio-input').value.trim();
    
    if (!newHandle) return window.notify("Handle is required");

    try {
        await update(ref(db, `users/${user.uid}`), { 
            username: newHandle,
            bio: newBio 
        });
        window.notify("Profile Updated!");
    } catch (e) { window.notify("Update failed"); }
};

window.updateMood = async (moodType) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
        await update(ref(db, `users/${user.uid}`), { mood: moodType });
        document.querySelectorAll('.mood-btn').forEach(btn => btn.classList.remove('bg-white/10', 'scale-110'));
        document.getElementById(`mood-${moodType}`).classList.add('bg-white/10', 'scale-110');
        window.notify(`Mood: ${moodType}`);
    } catch (e) { console.error(e); }
};

// --- 3. GLOBAL SETTINGS & SECURITY ---
window.toggleGlobalSetting = async (key, value) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
        await update(ref(db, `users/${user.uid}/settings`), { [key]: value });
        if (key === 'compactMode') document.body.classList.toggle('compact-view', value);
        window.notify("Setting Saved");
    } catch (e) { console.error(e); }
};

window.sendPasswordReset = async () => {
    const user = auth.currentUser;
    try {
        await sendPasswordResetEmail(auth, user.email);
        window.notify("Reset link sent to email!");
    } catch (e) { window.notify("Error: " + e.message); }
};

// --- 4. SENT REQUESTS TRACKER ---
const loadMySentRequests = async (myUid) => {
    const container = document.getElementById('myaccount-requests-sent');
    const requestsRef = ref(db, `requests`);
    const snap = await get(requestsRef);
    const allData = snap.val() || {};

    container.innerHTML = '';
    let found = false;

    Object.entries(allData).forEach(([targetUid, targetRequests]) => {
        Object.entries(targetRequests).forEach(([reqId, req]) => {
            if (req.senderUid === myUid) {
                found = true;
                const div = document.createElement('div');
                div.className = "p-4 bg-white/5 rounded-2xl border border-white/5 flex justify-between items-center animate-in fade-in";
                div.innerHTML = `
                    <div class="flex flex-col">
                        <span class="text-[10px] font-black text-white uppercase tracking-tighter">To @${req.targetName || 'User'}</span>
                        <span class="text-[8px] text-zinc-500 font-bold uppercase">${req.tokenAmount} Tokens • ${req.status}</span>
                    </div>
                    <button onclick="cancelRequest('${targetUid}', '${reqId}')" class="p-2 text-zinc-600 hover:text-red-500 transition-colors">
                        <i data-lucide="x-circle" class="w-4 h-4"></i>
                    </button>`;
                container.appendChild(div);
            }
        });
    });

    if (!found) container.innerHTML = `<p class="text-[9px] text-zinc-600 italic text-center py-4 uppercase font-black">No Sent Requests</p>`;
    if (window.lucide) lucide.createIcons();
};

window.cancelRequest = async (targetUid, reqId) => {
    if (!confirm("Cancel this request?")) return;
    try {
        await remove(ref(db, `requests/${targetUid}/${reqId}`));
        window.notify("Request Cancelled");
        loadMySentRequests(auth.currentUser.uid);
    } catch (e) { window.notify("Error cancelling"); }
};

// --- 5. ACTIVITY RENDERER ---
const renderMyAccountActivity = (logs) => {
    const container = document.getElementById('myaccount-feed');
    container.innerHTML = '';

    const items = Object.values(logs).reverse();
    if (items.length === 0) {
        container.innerHTML = `<p class="text-[9px] text-zinc-600 text-center py-10 uppercase font-bold">No history found</p>`;
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

window.closeMyAccount = () => {
    document.getElementById('myaccount-modal').classList.add('hidden');
    document.body.style.overflow = '';
};
