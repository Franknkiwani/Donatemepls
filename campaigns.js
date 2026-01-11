// campaigns.js
import { auth, db } from './firebase-config.js';
import { ref, set, push, get, update, onValue } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";

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
        } else { window.notify ? window.notify("✅ " + msg) : alert(msg); }
    } else {
        if(window.showErrorModal) { window.showErrorModal(msg); } 
        else { window.notify ? window.notify("❌ " + msg) : alert(msg); }
    }
};

// --- 3. UI Logic Functions ---
window.closeStudioSuccess = () => document.getElementById('studio-success-modal').classList.add('hidden');

window.resetStudioData = () => {
    ['cp-title', 'cp-desc', 'cp-goal', 'reach-input-manual', 'reach-slider'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = (id.includes('reach')) ? 0 : '';
    });
    selectedCampaignImg = "https://images.hive.blog/p/NTy4GV6ooFRmaCXZ8UYgPhoud1kjiNX8QokLEZtbBKLuLWQ9yt7K3o4MTgeicR2JF9fLXTD4sRt27d8vG5aiRCoDjrf24e3CMD5msbfdUbX1MzSVDjCMsn17K2A775iLEM4LvckBAcG8CU92RjLTtvsDiS6HzSxeXpvTZjux?format=match&mode=fit";
    const preview = document.getElementById('cp-preview-img');
    if(preview) {
        preview.src = selectedCampaignImg;
        preview.classList.remove('animate-pulse', 'blur-md', 'brightness-50');
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
    
    const rd = document.getElementById('reach-display');
    const cd = document.getElementById('cost-display');
    if(rd) rd.innerHTML = `${views.toLocaleString()} <span class="text-xs text-zinc-500 font-black">Reach</span>`;
    if(cd) cd.innerHTML = `${tokens.toLocaleString()} <span class="text-xs text-zinc-500 font-black">Tokens</span>`;
};

// --- 4. AI & Image Handling ---
window.uploadCampaignImage = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const previewImg = document.getElementById('cp-preview-img');
    const uploadBtn = document.getElementById('upload-trigger-btn');
    if(uploadBtn) { uploadBtn.innerText = "🛰️ Processing..."; uploadBtn.disabled = true; }
    if(previewImg) previewImg.classList.add('animate-pulse', 'blur-md', 'brightness-50');

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
            if(previewImg) {
                previewImg.src = selectedCampaignImg;
                previewImg.classList.remove('animate-pulse', 'blur-md', 'brightness-50');
            }
        } else { throw new Error("Imgur Reject"); }
    } catch (err) {
        if(previewImg) previewImg.classList.remove('animate-pulse', 'blur-md', 'brightness-50');
        studioReport('error', "Upload failed.");
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
            if(window.notify) window.notify("✨ Description Generated!");
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

// --- 5. Modal Lifecycle ---
window.openCreateCampaignModal = () => {
    const modal = document.getElementById('campaign-studio-modal');
    if(modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        window.switchStudioTab('create');
    }
};

window.closeStudio = () => {
    const modal = document.getElementById('campaign-studio-modal');
    if(modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
        window.resetStudioData(); 
    }
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

// --- 6. Database Actions ---
window.createNewCampaign = async () => {
    const user = auth.currentUser;
    if (!user) return studioReport('error', "Login first");
    
    const title = document.getElementById('cp-title').value.trim();
    const desc = document.getElementById('cp-desc').value.trim();
    const goal = parseInt(document.getElementById('cp-goal').value);
    const boostBudget = parseInt(document.getElementById('reach-slider').value) || 0;
    
    if (!title || !desc || isNaN(goal)) return studioReport('error', "Fill all fields");

    try {
        const userRef = ref(db, `users/${user.uid}`);
        const userSnap = await get(userRef);
        const userData = userSnap.val();
        
        if ((userData?.tokens || 0) < boostBudget) throw new Error("Not enough tokens!");
        
        const newRef = push(ref(db, 'campaigns'));
        await set(newRef, {
            id: newRef.key,
            creator: user.uid,
            creatorName: userData?.username || "Member",
            creatorAvatar: userData?.avatar || "",
            title, description: desc, goal, raised: 0,
            imageUrl: selectedCampaignImg, 
            tokensBudget: boostBudget,
            viewsActive: 0,
            status: 'active',
            timestamp: Date.now(),
            deadline: Date.now() + (7 * 24 * 60 * 60 * 1000) // Default 7 days
        });

        if (boostBudget > 0) {
            await update(userRef, { tokens: (userData.tokens || 0) - boostBudget });
        }
        
        window.closeStudio();
        studioReport('success', `Mission Live!`, "Launch Success");
        
        // Refresh grid if loadCampaigns exists in script.js
        if(window.loadCampaigns) window.loadCampaigns(true);
        
    } catch (e) { studioReport('error', e.message); }
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
            const div = document.createElement('div');
            div.className = "bg-white/5 border border-white/10 p-6 rounded-[32px] mb-4 space-y-4";
            div.innerHTML = `
                <div class="flex justify-between items-start">
                    <div class="flex items-center gap-3">
                        <img src="${c.imageUrl}" class="w-12 h-12 rounded-xl object-cover">
                        <h4 class="text-white font-black text-xs uppercase">${c.title}</h4>
                    </div>
                    <button onclick="handleDeleteRequest('${c.id}')" class="text-red-500">✕</button>
                </div>
                <button onclick="handleBoostRequest('${c.id}')" class="w-full py-3 bg-blue-600 rounded-2xl text-[10px] text-white font-black uppercase">⚡ Add Reach Boost</button>
            `;
            container.appendChild(div);
        });
    });
};

window.handleDeleteRequest = (id) => {
    if(confirm("Delete Mission?")) set(ref(db, `campaigns/${id}`), null);
};

window.handleBoostRequest = (id) => {
    const modal = document.getElementById('boost-modal');
    if(!modal) return;
    modal.classList.remove('hidden');
    document.getElementById('confirm-boost-btn').onclick = async () => {
        const amount = parseInt(document.getElementById('boost-modal-input').value);
        if(!amount || amount <= 0) return;
        const userRef = ref(db, `users/${auth.currentUser.uid}`);
        const userSnap = await get(userRef);
        if(userSnap.val().tokens < amount) return studioReport('error', "No tokens");
        await update(userRef, { tokens: userSnap.val().tokens - amount });
        const campRef = ref(db, `campaigns/${id}`);
        const cSnap = await get(campRef);
        await update(campRef, { tokensBudget: (cSnap.val().tokensBudget || 0) + amount });
        modal.classList.add('hidden');
        if(window.notify) window.notify("⚡ Boost Applied!");
    };
};

// Final Bridge Initialization
console.log("🚀 Studio Engine: Connected and Ready.");
