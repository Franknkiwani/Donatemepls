// --- BOT DETECTION: SCROLL & SWIPE GUARD ---
let lastScrollTime = Date.now();
let scrollStrikes = 0;

/**
 * EXCLUSIVE TO BOT DETECTION
 * This specifically targets the "Bot Detected" modal in your HTML
 */
const triggerSecurityLock = (msg) => {
    const modal = document.getElementById('error-modal');
    const msgLabel = document.getElementById('error-msg');
    
    if (modal && msgLabel) {
        msgLabel.innerText = msg;
        modal.classList.remove('hidden');
        console.warn("🚨 SECURITY ALERT: Inhuman velocity detected.");
    }
};

const handleFastActivity = (diff) => {
    // 30ms threshold
    if (diff < 30) { 
        scrollStrikes++;
        
        // Debugging logs
        console.log(`⚠️ Bot Strike: ${scrollStrikes}/10`);

        if (scrollStrikes > 10) {
            scrollStrikes = 0;
            triggerSecurityLock("Unusual scrolling speed detected. Please scroll naturally.");
        }
    } else {
        // Human speed decay
        if (scrollStrikes > 0) scrollStrikes -= 0.5;
    }
};

// --- LISTENERS ---
window.addEventListener('wheel', () => {
    const now = Date.now();
    handleFastActivity(now - lastScrollTime);
    lastScrollTime = now;
}, { passive: true });

window.addEventListener('touchmove', () => {
    const now = Date.now();
    handleFastActivity(now - lastScrollTime);
    lastScrollTime = now;
}, { passive: true });

console.log("🛡️ Security Guard Active: Monitoring Pulse...");
