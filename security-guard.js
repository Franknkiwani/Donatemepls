// --- BOT DETECTION: SCROLL & SWIPE GUARD ---
let lastScrollTime = Date.now();
let scrollStrikes = 0;

const handleFastActivity = (diff) => {
    if (diff < 15) { // Inhumanly fast
        scrollStrikes++;
        if (scrollStrikes > 25) {
            scrollStrikes = 0;
            if (window.showErrorModal) {
                window.showErrorModal("Unusual activity detected. Please scroll naturally.");
            }
            // Logic to ping your Grok AI / Vercel endpoint
            if (window.logSecurityAction) {
                window.logSecurityAction('BOT_SCROLL_DETECTED', { timing: diff });
            }
        }
    } else {
        if (scrollStrikes > 0) scrollStrikes--;
    }
};

window.addEventListener('wheel', (e) => {
    const now = Date.now();
    handleFastActivity(now - lastScrollTime);
    lastScrollTime = now;
}, { passive: true });

window.addEventListener('touchmove', () => {
    const now = Date.now();
    handleFastActivity(now - lastScrollTime);
    lastScrollTime = now;
}, { passive: true });
