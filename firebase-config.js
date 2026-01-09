// --- FIREBASE CORE CONFIGURATION ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyDFHskUWiyHhZke3KT9kkOtFI_gPsKfiGo",
    authDomain: "itzhoyoo-f9f7e.firebaseapp.com",
    databaseURL: "https://itzhoyoo-f9f7e-default-rtdb.firebaseio.com",
    projectId: "itzhoyoo-f9f7e",
    appId: "1:1094792075584:web:d49e9c3f899d3cd31082a5"
};

// Initialize Firebase Services
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

// --- GLOBAL SYSTEM CONSTANTS ---
// Centralizing these here makes your other scripts much cleaner!
export const ADMIN_UID = "4xEDAzSt5javvSnW5mws2Ma8i8n1";
export const PAYPAL_PLAN_ID = 'P-47S21200XM2944742NFPLPEA';

// Preset Avatars used across the app
export const AVATAR_PRESETS = [
    "https://img.pikbest.com/origin/10/25/30/74apIkbEsT5qB.jpg!w700wp",
    "https://thumbs.dreamstime.com/b/cool-neon-party-wolf-headphones-black-background-colorful-illustration-music-theme-modern-portrait-bright-vibrant-385601082.jpg",
    "https://wallpapers.com/images/hd/gaming-profile-pictures-tt8bbzdcf6zibhoi.jpg"
];
