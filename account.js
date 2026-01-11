// account.js
import { ref, get, update, onValue } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { auth, db } from './firebase-config.js';

// --- CONFIG ---
const presets = [
    "https://img.pikbest.com/origin/10/25/30/74apIkbEsT5qB.jpg!w700wp",
    "https://thumbs.dreamstime.com/b/cool-neon-party-wolf-headphones-black-background-colorful-illustration-music-theme-modern-portrait-bright-vibrant-385601082.jpg",
    "https://wallpapers.com/images/hd/gaming-profile-pictures-tt8bbzdcf6zibhoi.jpg"
];

// --- CORE FUNCTIONS ---

window.openAccountModal = async () => {
    const user = auth.currentUser;
    if (!user) return window.openAuthModal();

    const modal = document.getElementById('profile-modal');
    modal.classList.remove('hidden');
    
    // Sync UI with DB
    const snap = await get(ref(db, `users/${user.uid}`));
    const data = snap.val() || {};

    document.getElementById('profile-main-img').src = data.avatar || presets[0];
    document.getElementById('username-input').value = data.username || "";
    
    renderPresets(data.avatar);
    if (window.lucide) window.lucide.createIcons();
};

window.closeProfile = () => {
    document.getElementById('profile-modal').classList.add('hidden');
};

const renderPresets = (currentAvatar) => {
    const grid = document.getElementById('avatar-grid');
    if (!grid) return;

    // Keep the upload button (first child), clear others
    const uploadBtn = grid.querySelector('div[onclick*="pfp-upload"]');
    grid.innerHTML = '';
    if (uploadBtn) grid.appendChild(uploadBtn);

    presets.forEach(url => {
        const div = document.createElement('div');
        const isSelected = url === currentAvatar;
        
        div.className = `relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all hover:scale-105 ${isSelected ? 'border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'border-white/5'}`;
        div.innerHTML = `<img src="${url}" class="w-full h-full object-cover">`;
        
        div.onclick = () => {
            window.tempAvatar = url;
            document.getElementById('profile-main-img').src = url;
            grid.querySelectorAll('.aspect-square').forEach(el => el.classList.remove('border-amber-500', 'shadow-[0_0_15px_rgba(245,158,11,0.3)]'));
            div.classList.add('border-amber-500', 'shadow-[0_0_15px_rgba(245,158,11,0.3)]');
        };
        grid.appendChild(div);
    });
};

window.saveProfileChanges = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const newName = document.getElementById('username-input').value.trim().replace('@', '');
    const snap = await get(ref(db, `users/${user.uid}`));
    const data = snap.val() || {};
    
    let updates = {};

    if (window.tempAvatar) updates.avatar = window.tempAvatar;

    if (newName && newName !== data.username) {
        if (newName.length < 3) return window.notify("Name too short!");
        
        const now = Date.now();
        const oneWeek = 7 * 24 * 60 * 60 * 1000;
        let history = (data.nameChanges || []).filter(ts => (now - ts) < oneWeek);

        if (!data.isPremium && history.length >= 2) {
            return window.notify("Free limit: 2 names per week");
        }

        updates.username = newName;
        updates.usernameLower = newName.toLowerCase();
        history.push(now);
        updates.nameChanges = history;
    }

    if (Object.keys(updates).length === 0) return window.closeProfile();

    try {
        await update(ref(db, `users/${user.uid}`), updates);
        window.notify("Profile Updated");
        window.closeProfile();
    } catch (e) {
        window.notify("Update failed");
    }
};
