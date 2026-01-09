// ui-manager.js

// --- NOTIFICATIONS ---
export const notify = (msg) => {
    const t = document.createElement('div');
    t.className = 'toast show'; t.innerText = msg;
    const box = document.getElementById('notify-box');
    if(box) box.appendChild(t);
    setTimeout(() => { 
        t.classList.remove('show'); 
        setTimeout(() => t.remove(), 400); 
    }, 3000);
};

// --- MODAL CONTROLLERS ---
export const toggleModal = (id, show = true) => {
    const el = document.getElementById(id);
    if (!el) return;
    
    if (show) {
        el.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // Stop background scrolling
    } else {
        el.classList.add('hidden');
        document.body.style.overflow = ''; // Resume scrolling
    }
};

// --- SCROLL LOCK GUARD (Specific for overlapping modals) ---
export const syncScrollLock = () => {
    const lockIds = ['profile-modal', 'modern-donate-modal', 'donation-success-modal'];
    const shouldLock = lockIds.some(id => {
        const el = document.getElementById(id);
        return el && !el.classList.contains('hidden');
    });
    document.body.style.overflow = shouldLock ? 'hidden' : '';
};

// --- EXPOSE TO HTML ---
// We attach these to 'window' so your existing <button onclick="..."> works.
window.notify = notify;
window.toggleModal = toggleModal;
window.openAuthModal = () => toggleModal('auth-modal', true);
window.closeAuthModal = () => toggleModal('auth-modal', false);
window.openProfile = () => toggleModal('profile-modal', true);
window.closeProfile = () => toggleModal('profile-modal', false);
