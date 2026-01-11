// --- BOT DETECTION: SCROLL & SWIPE GUARD ---
let lastScrollTime = Date.now();
let scrollStrikes = 0;

/**
 * Directly manipulates the Error Modal in the DOM
 */
const triggerBotModal = (msg) => {
    const modal = document.getElementById('error-modal');
    const msgLabel = document.getElementById('error-msg');
    
    if (modal && msgLabel) {
        msgLabel.innerText = msg;
        modal.classList.remove('hidden');
        
        // Console warning for debugging
        console.warn("🛡️ Security Guard: Bot Modal Triggered.");

        // Optional: Vibration for mobile devices
        if (navigator.vibrate) navigator.vibrate(200);
    }
};

/**
 * Logic to differentiate between a human flick and a bot script
 */
const handleFastActivity = (diff) => {
    // 30ms is extremely fast (Humans usually average 60ms-100ms per scroll event)
    if (diff < 30) { 
        scrollStrikes++;
        
        // View progress in F12 Console while testing
        console.log(`⚠️ Security Strike: ${scrollStrikes}/10`);

        if (scrollStrikes > 10) {
            scrollStrikes = 0;
            triggerBotModal("Unusual activity detected. Please scroll naturally to continue.");
            
            // Log to your Grok AI / Vercel endpoint if active
            if (window.logSecurityAction) {
                window.logSecurityAction('BOT_SCROLL_DETECTED', { speed: diff });
            }
        }
    } else {
        // Slow decay: If the user scrolls at a human pace, strikes go down
        if (scrollStrikes > 0) scrollStrikes -= 0.5;
    }
};

// --- EVENT LISTENERS ---

// Monitors Mouse Wheel / Trackpad
window.addEventListener('wheel', () => {
    const now = Date.now();
    handleFastActivity(now - lastScrollTime);
    lastScrollTime = now;
}, { passive: true });

// Monitors Finger Swiping on Mobile
window.addEventListener('touchmove', () => {
    const now = Date.now();
    handleFastActivity(now - lastScrollTime);
    lastScrollTime = now;
}, { passive: true });

console.log("🛡️ Security Guard: Monitoring scroll velocity...");
