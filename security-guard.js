// --- SMART BOT DETECTION: HUMAN-REMEMBERING GUARD ---
let lastScrollTime = Date.now();
let scrollStrikes = 0;
let lastDiffs = [];

// Check if the user has already proven they are human in a previous session
const isVerifiedHuman = () => localStorage.getItem('guard_verified_human') === 'true';

const triggerSecurityGuard = (msg) => {
    // If already verified, never show the modal again
    if (isVerifiedHuman()) return;

    const modal = document.getElementById('guard-modal');
    const msgLabel = document.getElementById('guard-msg');
    
    if (modal && msgLabel) {
        msgLabel.innerText = msg;
        modal.classList.remove('hidden');

        // Logic to verify human when they close the modal
        // We assume if they can find the close button and click it, they are human
        const closeBtn = modal.querySelector('button');
        if (closeBtn) {
            closeBtn.onclick = () => {
                localStorage.setItem('guard_verified_human', 'true');
                modal.classList.add('hidden');
                console.log("🛡️ Guard: Human verified. System standing down.");
            };
        }
    }
};

const handleFastActivity = (diff) => {
    // Skip everything if they are verified
    if (isVerifiedHuman()) return;

    if (diff < 12) { 
        scrollStrikes++;
        
        lastDiffs.push(diff);
        if (lastDiffs.length > 5) lastDiffs.shift();
        
        const isRoboticallyConsistent = lastDiffs.every(d => d === lastDiffs[0]) && lastDiffs.length > 4;

        if (scrollStrikes > 30 || isRoboticallyConsistent) {
            scrollStrikes = 0;
            triggerSecurityGuard("Unusual activity detected. Please click close to verify you are human.");
        }
    } else {
        scrollStrikes = Math.max(0, scrollStrikes - 2);
    }
};

window.addEventListener('wheel', () => {
    if (isVerifiedHuman()) return; 
    const now = Date.now();
    const diff = now - lastScrollTime;
    if (diff > 2) {
        handleFastActivity(diff);
        lastScrollTime = now;
    }
}, { passive: true });

window.addEventListener('touchmove', () => {
    if (isVerifiedHuman()) return;
    const now = Date.now();
    const diff = now - lastScrollTime;
    if (diff > 5) {
        handleFastActivity(diff);
        lastScrollTime = now;
    }
}, { passive: true });

console.log(isVerifiedHuman() ? "🛡️ Guard: Trusted User Session" : "🛡️ Guard: Monitoring Active");
