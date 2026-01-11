// account.js
import { ref, get, update } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { auth, db } from './firebase-config.js';

// Configuration for this specific view
const AVATAR_PRESETS = [
    "https://img.pikbest.com/origin/10/25/30/74apIkbEsT5qB.jpg!w700wp",
    "https://thumbs.dreamstime.com/b/cool-neon-party-wolf-headphones-black-background-colorful-illustration-music-theme-modern-portrait-bright-vibrant-385601082.jpg",
    "https://wallpapers.com/images/hd/gaming-profile-pictures-tt8bbzdcf6zibhoi.jpg"
];

// --- UNIQUE FUNCTION FOR BOTTOM NAV ---
window.openAccountModal = async () => {
    const user = auth.currentUser;
    if (!user) return window.openAuthModal();

    const modal = document.getElementById('profile-modal');
    if (!modal) return;

    modal.classList.remove('hidden');

    try {
        const snap = await get(ref(db, `users/${user.uid}`));
        const data = snap.val() || {};

        // Populate the specific fields in this modal
        const mainImg = document.getElementById('profile-main-img');
        const nameInput = document.getElementById('username-input');
        const handleDisplay = document.getElementById('profile-handle-display');

        if (mainImg) mainImg.src = data.avatar || AVATAR_PRESETS[0];
        if (nameInput) nameInput.value = data.username || "";
        if (handleDisplay) handleDisplay.innerText = `@${data.username || 'User'}`;

        renderNavProfileGrid(data.avatar);
        
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        console.error("Nav Profile Sync Error:", err);
    }
};

const renderNavProfileGrid = (currentAvatar) => {
    const grid = document.getElementById('avatar-grid');
    if (!grid) return;

    // Preserve the upload button, clear the rest
    const uploadBtn = grid.querySelector('div[onclick*="pfp-upload"]');
    grid.innerHTML = '';
    if (uploadBtn) grid.appendChild(uploadBtn);

    AVATAR_PRESETS.forEach(url => {
        const item = document.createElement('div');
        const active = url === currentAvatar;
        
        item.className = `relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all hover:scale-105 ${
            active ? 'border-amber-500 shadow-lg shadow-amber-500/20' : 'border-white/5'
        }`;
        item.innerHTML = `<img src="${url}" class="w-full h-full object-cover">`;
        
        item.onclick = () => {
            window.tempNavAvatar = url; // Unique temp variable
            document.getElementById('profile-main-img').src = url;
            grid.querySelectorAll('.aspect-square').forEach(el => el.classList.remove('border-amber-500', 'shadow-lg'));
            item.classList.add('border-amber-500', 'shadow-lg');
        };
        grid.appendChild(item);
    });
};

window.saveNavProfileChanges = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const newName = document.getElementById('username-input').value.trim().replace('@', '');
    const updates = {};

    if (window.tempNavAvatar) updates.avatar = window.tempNavAvatar;
    if (newName) {
        updates.username = newName;
        updates.usernameLower = newName.toLowerCase();
    }

    try {
        await update(ref(db, `users/${user.uid}`), updates);
        window.notify?.("Account Updated Successfully");
        window.closeProfile();
    } catch (e) {
        window.notify?.("Error updating account");
    }
};
