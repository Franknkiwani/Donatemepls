// --- BOT DETECTION: SCROLL & SWIPE GUARD ---
let lastScrollTime = Date.now();
let scrollStrikes = 0;

const handleFastActivity = (diff) => {
    // If activity is faster than 15ms (inhumanly fast)
    if (diff < 15) {
        scrollStrikes++;
        if (scrollStrikes > 25) {
            scrollStrikes = 0;
            // Use your existing error modal
            if (window.showErrorModal) {
                window.showErrorModal("Unusual activity detected. Please scroll naturally.");
            } else {
                alert("Unusual activity detected.");
            }
            
            // Log to your Grok AI endpoint on Vercel
            if (window.logSecurityAction) {
                window.logSecurityAction('BOT_SCROLL_DETECTED', { timing: diff });
            }
        }
    } else {
        // Slow down the strike count if they start scrolling normally
        if (scrollStrikes > 0) scrollStrikes--;
    }
};

// Listen for Mouse Wheel
window.addEventListener('wheel', (e) => {
    const now = Date.now();
    const diff = now - lastScrollTime;
    handleFastActivity(diff);
    lastScrollTime = now;
}, { passive: true });

// Listen for Touch Swipes (Mobile Bots)
window.addEventListener('touchmove', () => {
    const now = Date.now();
    const diff = now - lastScrollTime;
    handleFastActivity(diff);
    lastScrollTime = now;
}, { passive: true });
