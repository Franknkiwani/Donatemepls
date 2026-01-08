import { db } from './firebase-config.js';
import { ref, query, orderByChild, limitToFirst, startAfter, get } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";

let lastCampaignTS = null;
let hasMoreCamps = true;

export async function loadCampaigns(isInitial = false) {
    if (!hasMoreCamps && !isInitial) return;
    const grid = document.getElementById('campaign-grid');
    
    let q = query(ref(db, 'campaigns'), orderByChild('timestamp'), limitToFirst(6));
    if (lastCampaignTS) {
        q = query(ref(db, 'campaigns'), orderByChild('timestamp'), startAfter(lastCampaignTS), limitToFirst(6));
    }

    const snapshot = await get(q);
    // ... rest of your rendering logic
}
