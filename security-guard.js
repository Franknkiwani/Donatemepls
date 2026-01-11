// --- BOT DETECTION: UNIQUE GUARD SYSTEM ---
let lastScrollTime = Date.now();
let scrollStrikes = 0;

const triggerSecurityGuard = (msg) => {
    const modal = document.getElementById('guard-modal');
    const msgLabel = document.getElementById('guard-msg');
    
    if (modal && msgLabel) {
        msgLabel.innerText = msg;
        modal.classList.remove('hidden');
        
        // Optional: Re-run Lucide icons if you use them
        if (window.lucide) window.lucide.createIcons();
    }
};

const handleFastActivity = (diff) => {
    // 25ms is the threshold. Scripts usually fire events at 1-5ms.
    if (diff < 25) { 
        scrollStrikes++;
        
        // Log to console to see it climbing
        console.log(`🛡️ Guard Strike: ${scrollStrikes}/8`);

        if (scrollStrikes > 8) {
            scrollStrikes = 0;
            triggerSecurityGuard("Automated scrolling behavior detected. Please interact naturally.");
            
            // Log to your Grok/Vercel audit trail
            if (window.logSecurityAction) {
                window.logSecurityAction('VELOCITY_LIMIT_EXCEEDED', { diff });
            }
        }
    } else {
        // Human decay: resets strikes if they scroll normally
        if (scrollStrikes > 0) scrollStrikes -= 0.2;
    }
};

// Desktop Scroll
window.addEventListener('wheel', () => {
    const now = Date.now();
    handleFastActivity(now - lastScrollTime);
    lastScrollTime = now;
}, { passive: true });

// Mobile Swipe
window.addEventListener('touchmove', () => {
    const now = Date.now();
    handleFastActivity(now - lastScrollTime);
    lastScrollTime = now;
}, { passive: true });

console.log("🛡️ Security Guard: Isolated & Monitoring...");
