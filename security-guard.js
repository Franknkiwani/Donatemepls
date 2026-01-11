// --- BOT DETECTION: SCROLL & SWIPE GUARD ---
let lastScrollTime = Date.now();
let scrollStrikes = 0;

const handleFastActivity = (diff) => {
    // 30ms is the 'sweet spot' for detection (Human flicks are ~50ms+)
    if (diff < 30) { 
        scrollStrikes++;
        
        // Log this so you can see it working in the F12 Console
        console.log(`Strike ${scrollStrikes}/10 (Timing: ${diff}ms)`);

        if (scrollStrikes > 10) {
            scrollStrikes = 0;
            
            // Check if the main script has provided the modal function
            if (typeof window.showErrorModal === 'function') {
                window.showErrorModal("Unusual scrolling speed detected. Please scroll naturally.");
            }
        }
    } else {
        // Slowly reduce strikes if the user scrolls at a normal pace
        if (scrollStrikes > 0) scrollStrikes -= 0.5;
    }
};

// Mouse Scroll
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

console.log("✅ Security Guard module loaded.");
