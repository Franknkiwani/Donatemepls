import { auth } from './firebase-config.js';

// --- CHAT STORAGE & API-BASED REDIRECT ENGINE ---
const CHAT_STORAGE_KEY = 'grok_chat_history';

// 1. Storage Logic
const saveMessage = (role, text) => {
    const history = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || '[]');
    history.push({ role, text, timestamp: Date.now() });
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(history));
};

const loadChatHistory = () => {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    
    const history = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || '[]');
    const oneDay = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const validHistory = history.filter(msg => (now - msg.timestamp) < oneDay);
    
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(validHistory));
    
    container.innerHTML = ''; // Clear for fresh load
    if (validHistory.length > 0) {
        validHistory.forEach(msg => renderMessage(msg.role, msg.text));
    } else {
        window.triggerInitialPoll(); 
    }
};

// 2. UI Rendering
const renderMessage = (role, text) => {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    const isUser = role === 'user';
    const html = isUser ? `
        <div class="flex justify-end gap-3 max-w-[90%] ml-auto animate-in fade-in slide-in-from-right-4 duration-300 mb-4">
            <div class="bg-blue-600 p-4 rounded-2xl rounded-tr-none shadow-xl">
                <p class="text-[11px] text-white leading-relaxed font-medium">${text}</p>
            </div>
        </div>
    ` : `
        <div class="flex gap-4 max-w-[90%] animate-in fade-in slide-in-from-left-4 duration-300 mb-4">
            <div class="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                <span class="text-[10px] font-black text-blue-400">G</span>
            </div>
            <div class="bg-white/5 border border-white/5 p-4 rounded-2xl rounded-tl-none">
                <p class="text-[11px] text-zinc-300 leading-relaxed font-medium">${text}</p>
            </div>
        </div>`;
    container.insertAdjacentHTML('beforeend', html);
    container.scrollTop = container.scrollHeight;
};

window.appendMessage = (role, text) => {
    saveMessage(role, text);
    renderMessage(role, text);
};

// 3. Protocol Selection
window.triggerInitialPoll = () => {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    const pollHtml = `
        <div id="initial-poll" class="bg-zinc-900 border border-blue-500/30 p-6 rounded-[32px] my-4 animate-in zoom-in duration-500 text-center">
            <h3 class="text-[10px] font-black text-white uppercase mb-1 tracking-widest italic">Uplink Established</h3>
            <p class="text-[8px] text-zinc-500 uppercase mb-4 font-bold tracking-tighter">Choose your interaction protocol</p>
            <div class="flex flex-col gap-2">
                <button onclick="selectPath('ai')" class="w-full py-3 bg-blue-600 text-white text-[10px] font-black uppercase rounded-xl active:scale-95 transition-all">Chat with AI (Instant)</button>
                <button onclick="selectPath('human')" class="w-full py-3 bg-white/5 text-zinc-300 border border-white/10 text-[10px] font-black uppercase rounded-xl active:scale-95 transition-all">Request Human Agent</button>
            </div>
        </div>`;
    container.insertAdjacentHTML('beforeend', pollHtml);
    container.scrollTop = container.scrollHeight;
};

window.selectPath = async (choice) => {
    if (choice === 'ai') {
        document.getElementById('initial-poll')?.remove();
        window.appendMessage('bot', "Grok AI active. How can I help you today?");
    } else {
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'INITIATE_HANDOFF',
                    userId: auth.currentUser?.uid,
                    username: document.getElementById('header-handle')?.innerText 
                })
            });
            const data = await response.json();
            if (data.redirect) window.location.href = data.redirect;
        } catch (e) {
            window.location.href = '/support'; 
        }
    }
};

window.sendChatMessage = async () => {
    const input = document.getElementById('chat-input');
    const msgContainer = document.getElementById('chat-messages');
    const btn = document.getElementById('chat-send-btn');
    const userText = input?.value.trim();

    if (!userText || !auth.currentUser) return;

    window.appendMessage('user', userText);
    input.value = '';
    btn.disabled = true;

    const tid = 'load-' + Date.now();
    msgContainer.insertAdjacentHTML('beforeend', `<div id="${tid}" class="flex gap-2 p-4 animate-pulse"><div class="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></div></div>`);
    msgContainer.scrollTop = msgContainer.scrollHeight;

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                prompt: userText,
                userId: auth.currentUser.uid,
                username: document.getElementById('header-handle')?.innerText 
            })
        });

        const data = await response.json();
        document.getElementById(tid)?.remove();

        if (data.redirect || data.text === "HANDOFF_REQUEST") {
            window.appendMessage('bot', "Transferring you to a human agent...");
            setTimeout(() => { window.location.href = data.redirect || '/support'; }, 1000);
        } else {
            window.appendMessage('bot', data.text);
        }
    } catch (e) {
        document.getElementById(tid)?.remove();
        renderMessage('bot', "Connection Error.");
    } finally {
        btn.disabled = false;
        msgContainer.scrollTop = msgContainer.scrollHeight;
    }
};

// Start logic when DOM is ready
document.addEventListener('DOMContentLoaded', loadChatHistory);
