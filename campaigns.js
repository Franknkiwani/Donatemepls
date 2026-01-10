Import { auth, db } from './firebase-config.js';
import { ref, set, push, get, update, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- 1. Global State & Config ---
let selectedCampaignImg = "https://images.hive.blog/p/NTy4GV6ooFRmaCXZ8UYgPhoud1kjiNX8QokLEZtbBKLuLWQ9yt7K3o4MTgeicR2JF9fLXTD4sRt27d8vG5aiRCoDjrf24e3CMD5msbfdUbX1MzSVDjCMsn17K2A775iLEM4LvckBAcG8CU92RjLTtvsDiS6HzSxeXpvTZjux?format=match&mode=fit";
const IMGUR_CLIENT_ID = '891e5bb4aa94282';
let contentIsAiFlag = false; 

// --- 2. Helper: Custom Studio Success Modal ---
const studioReport = (type, msg, customTitle = "Studio Success") => {
    if (type === 'success') {
        const modal = document.getElementById('studio-success-modal');
        const titleEl = document.getElementById('studio-success-title');
        const msgEl = document.getElementById('studio-success-msg');
        if (modal && titleEl && msgEl) {
            titleEl.innerText = customTitle;
            msgEl.innerText = msg;
            modal.classList.remove('hidden');
        } else { notify("✅ " + msg); }
    } else {
        if(window.showErrorModal) { window.showErrorModal(msg); } 
        else { notify("❌ " + msg); }
    }
};

window.closeStudioSuccess = () => document.getElementById('studio-success-modal').classList.add('hidden');

// --- 3. UI Reset & Reach Math ---
window.resetStudioData = () => {
    ['cp-title', 'cp-desc', 'cp-goal', 'reach-input-manual', 'reach-slider'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = (id.includes('reach')) ? 0 : '';
    });
    selectedCampaignImg = "https://images.hive.blog/p/NTy4GV6ooFRmaCXZ8UYgPhoud1kjiNX8QokLEZtbBKLuLWQ9yt7K3o4MTgeicR2JF9fLXTD4sRt27d8vG5aiRCoDjrf24e3CMD5msbfdUbX1MzSVDjCMsn17K2A775iLEM4LvckBAcG8CU92RjLTtvsDiS6HzSxeXpvTZjux?format=match&mode=fit";
    const preview = document.getElementById('cp-preview-img');
    if(preview) {
        preview.src = selectedCampaignImg;
        preview.classList.remove('animate-pulse', 'blur-sm');
    }
    contentIsAiFlag = false; 
    window.updateReachMath(0);
};

window.updateReachMath = (val) => {
    const tokens = parseInt(val) || 0;
    const views = tokens * 3; 
    const slider = document.getElementById('reach-slider');
    const input = document.getElementById('reach-input-manual');
    if(slider) slider.value = tokens;
    if(input) input.value = tokens;
    
    document.getElementById('reach-display').innerHTML = `${views.toLocaleString()} <span class="text-xs text-zinc-500 font-black">Reach</span>`;
    document.getElementById('cost-display').innerHTML = `${tokens.toLocaleString()} <span class="text-xs text-zinc-500 font-black">Tokens</span>`;
};

// --- 4. AI & Image Handling (Imgur with Loading States) ---
window.uploadCampaignImage = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const previewImg = document.getElementById('cp-preview-img');
    const uploadBtn = document.getElementById('upload-trigger-btn');
    
    // UI Loading State Start
    if(uploadBtn) { uploadBtn.innerText = "🛰️ Processing..."; uploadBtn.disabled = true; }
    if(previewImg) {
        previewImg.classList.add('animate-pulse', 'blur-md', 'brightness-50');
    }

    const formData = new FormData();
    formData.append('image', file);

    try {
        const response = await fetch('https://api.imgur.com/3/image', {
            method: 'POST',
            headers: { Authorization: `Client-ID ${IMGUR_CLIENT_ID}` },
            body: formData
        });

        const data = await response.json();
        if (data.success) {
            selectedCampaignImg = data.data.link;
            
            // Create a temporary image object to detect when the link is ACTUALLY loaded
            const tempImg = new Image();
            tempImg.onload = () => {
                if(previewImg) {
                    previewImg.src = selectedCampaignImg;
                    previewImg.classList.remove('animate-pulse', 'blur-md', 'brightness-50');
                }
            };
            tempImg.src = selectedCampaignImg;
            // Success notification removed as requested
        } else {
            throw new Error("Imgur Reject");
        }
    } catch (err) {
        if(previewImg) previewImg.classList.remove('animate-pulse', 'blur-md', 'brightness-50');
        studioReport('error', "Upload failed. Image might be too large.");
    } finally {
        if(uploadBtn) { uploadBtn.innerText = "📸 Custom Upload"; uploadBtn.disabled = false; }
    }
};

window.generateAIContent = async () => {
    const title = document.getElementById('cp-title').value.trim();
    const descField = document.getElementById('cp-desc');
    const aiBtn = document.getElementById('ai-gen-btn');
    if (!title || title.length < 5) return studioReport('error', "Enter a heading first!");
    aiBtn.innerText = "✨ Thinking..."; aiBtn.disabled = true;

    try {
        const response = await fetch('/api/generate', { 
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: title }) 
        });
        const data = await response.json();
        if (data.text) {
            descField.value = data.text;
            contentIsAiFlag = true; 
            notify("✨ Description Generated!");
        }
    } catch (err) { studioReport('error', "AI Bridge failed."); }
    finally { aiBtn.innerText = "✨ AI Auto-Write"; aiBtn.disabled = false; }
};

window.selectPreset = (url, el) => {
    selectedCampaignImg = url;
    const preview = document.getElementById('cp-preview-img');
    if(preview) preview.src = url;
    document.querySelectorAll('.preset-option').forEach(img => img.classList.replace('border-blue-500', 'border-transparent'));
    el.classList.replace('border-transparent', 'border-blue-500');
};

// --- 5. Tab & Lifecycle ---
window.openCreateCampaignModal = () => {
    document.getElementById('campaign-studio-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    window.switchStudioTab('create');
};

window.closeStudio = () => {
    document.getElementById('campaign-studio-modal').classList.add('hidden');
    document.body.style.overflow = '';
    window.resetStudioData(); 
};

window.switchStudioTab = (tab) => {
    const createView = document.getElementById('studio-create-view');
    const manageView = document.getElementById('studio-manage-view');
    const createBtn = document.getElementById('tab-btn-create');
    const manageBtn = document.getElementById('tab-btn-manage');
    const activeClass = "px-10 py-4 rounded-xl text-[11px] font-black uppercase tracking-widest bg-blue-600 text-white transition-all";
    const idleClass = "px-10 py-4 rounded-xl text-[11px] font-black uppercase tracking-widest text-zinc-500 transition-all";

    if(tab === 'create') {
        if(createView) createView.classList.remove('hidden'); 
        if(manageView) manageView.classList.add('hidden');
        if(createBtn) createBtn.className = activeClass; 
        if(manageBtn) manageBtn.className = idleClass;
    } else {
        if(createView) createView.classList.add('hidden'); 
        if(manageView) manageView.classList.remove('hidden');
        if(manageBtn) manageBtn.className = activeClass; 
        if(createBtn) createBtn.className = idleClass;
        window.loadMyCampaigns(); 
    }
};

// --- 6. Premium Check & Creation ---
window.checkPremiumVisibility = async (el) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
        const userSnap = await get(ref(db, `users/${user.uid}`));
        const isPremium = userSnap.val()?.isPremium || false;

        if (el.value === 'private' && !isPremium) {
            studioReport('error', "Private Campaigns are for Premium Members only!");
            el.value = 'public';
            document.getElementById('premium-lock-icon').innerHTML = '<span class="text-red-500 text-[10px]">🔒</span>';
        } else if (el.value === 'private' && isPremium) {
            document.getElementById('premium-lock-icon').innerHTML = '<span class="text-emerald-500 text-[10px]">💎</span>';
        } else {
            document.getElementById('premium-lock-icon').innerHTML = '<span class="text-blue-500 text-[10px]">🌐</span>';
        }
    } catch(e) { console.error(e); }
};

window.createNewCampaign = async () => {
    const user = auth.currentUser;
    if (!user) return studioReport('error', "Login first");

    const title = document.getElementById('cp-title').value.trim();
    const desc = document.getElementById('cp-desc').value.trim();
    const goal = parseInt(document.getElementById('cp-goal').value);
    const boostBudget = parseInt(document.getElementById('reach-slider').value) || 0;
    
    const visibility = document.getElementById('cp-visibility')?.value || 'public';
    const durationDays = parseInt(document.getElementById('cp-duration')?.value) || 7; 

    if (!title || !desc || isNaN(goal)) return studioReport('error', "Fill all fields");

    try {
        const userRef = ref(db, `users/${user.uid}`);
        const userSnap = await get(userRef);
        const userData = userSnap.val();

        if ((userData?.tokens || 0) < boostBudget) throw new Error("Not enough tokens!");
        
        const newRef = push(ref(db, 'campaigns'));
        const now = Date.now();
        const deadline = now + (durationDays * 24 * 60 * 60 * 1000);

        await set(newRef, {
            id: newRef.key,
            creator: user.uid,
            creatorName: userData?.username || "Member",
            creatorAvatar: userData?.avatar || "", 
            creatorIsPremium: userData?.isPremium || false,
            title, description: desc, goal, raised: 0,
            imageUrl: selectedCampaignImg, 
            tokensBudget: boostBudget,
            viewsActive: 0,
            category: document.getElementById('cp-category')?.value || 'General',
            deadline: deadline,
            timestamp: now,
            visibility: visibility, 
            isAiGenerated: contentIsAiFlag, 
            status: 'active'
        });

        if (boostBudget > 0) {
            await update(userRef, { tokens: (userData.tokens || 0) - boostBudget });
        }

        window.closeStudio();
        studioReport('success', `Mission Live!`, "Launch Success");

    } catch (e) { studioReport('error', e.message); }
};

// --- 7. Management & Boost (Live 1:3 Math) ---
window.updateBoostLiveMath = (val) => {
    const tokens = parseInt(val) || 0;
    const views = tokens * 3;
    const display = document.getElementById('boost-live-reach');
    if(display) display.innerText = `${views.toLocaleString()} Views`;
};

window.loadMyCampaigns = () => {
    const user = auth.currentUser;
    if(!user) return;
    const container = document.getElementById('my-campaigns-list');
    onValue(ref(db, 'campaigns'), (snap) => {
        if(!container) return;
        container.innerHTML = '';
        const data = snap.val();
        if(!data) return;
        Object.values(data).filter(c => c.creator === user.uid).forEach(c => {
            const tokensLeft = Math.max(0, (c.tokensBudget || 0) - (c.viewsActive || 0));
            const div = document.createElement('div');
            div.className = "bg-white/5 border border-white/10 p-6 rounded-[32px] mb-4 space-y-4";
            div.innerHTML = `
                <div class="flex justify-between items-start">
                    <div class="flex items-center gap-3">
                        <img src="${c.imageUrl}" class="w-12 h-12 rounded-xl object-cover border border-white/10">
                        <div>
                            <h4 class="text-white font-black text-xs uppercase truncate w-32">${c.title}</h4>
                            <span class="text-[7px] font-black uppercase italic ${c.visibility === 'public' ? 'text-emerald-500' : 'text-amber-500'}">
                                ● ${c.visibility || 'public'}
                            </span>
                        </div>
                    </div>
                    <button onclick="handleDeleteRequest('${c.id}')" class="text-red-500 p-2 hover:bg-red-500/10 rounded-full transition-all">✕</button>
                </div>
                <div class="bg-black/30 p-4 rounded-2xl">
                    <div class="flex justify-between text-[10px] font-black uppercase mb-2">
                        <span class="text-zinc-500">Reach Used: ${c.viewsActive || 0}</span>
                        <span class="text-blue-500">${(tokensLeft * 3).toLocaleString()} Reach Left</span>
                    </div>
                    <div class="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                        <div class="h-full bg-blue-500" style="width: ${c.tokensBudget > 0 ? (tokensLeft/c.tokensBudget)*100 : 0}%"></div>
                    </div>
                </div>
                <button onclick="handleBoostRequest('${c.id}')" class="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-2xl text-[10px] font-black uppercase text-white shadow-lg transition-all active:scale-95">⚡ Add Reach Boost</button>
            `;
            container.appendChild(div);
        });
    });
};

window.handleDeleteRequest = (id) => {
    const modal = document.getElementById('delete-modal');
    if(!modal) return;
    modal.classList.remove('hidden');
    document.getElementById('confirm-delete-btn').onclick = async () => {
        await set(ref(db, `campaigns/${id}`), null);
        modal.classList.add('hidden');
        studioReport('success', "Mission Terminated.", "Deleted");
    };
};

window.handleBoostRequest = (id) => {
    const modal = document.getElementById('boost-modal');
    if(!modal) return;
    const boostInput = document.getElementById('boost-modal-input');
    const boostLive = document.getElementById('boost-live-reach');
    if(boostInput) boostInput.value = '';
    if(boostLive) boostLive.innerText = '0 Views';
    
    modal.classList.remove('hidden');
    document.getElementById('confirm-boost-btn').onclick = async () => {
        const amount = parseInt(boostInput.value);
        if(!amount || amount <= 0) return studioReport('error', "Enter tokens");
        try {
            const userRef = ref(db, `users/${auth.currentUser.uid}`);
            const userSnap = await get(userRef);
            if(userSnap.val().tokens < amount) return studioReport('error', "Insufficient Tokens");
            const campRef = ref(db, `campaigns/${id}`);
            const cSnap = await get(campRef);
            await update(userRef, { tokens: userSnap.val().tokens - amount });
            await update(campRef, { tokensBudget: (cSnap.val().tokensBudget || 0) + amount });
            modal.classList.add('hidden');
            studioReport('success', "Reach Refueled!", "Boost Active");
        } catch(e) { studioReport('error', "Boost failed"); }
    };
};

window.closeDeleteModal = () => document.getElementById('delete-modal').classList.add('hidden');
window.closeBoostModal = () => document.getElementById('boost-modal').classList.add('hidden');