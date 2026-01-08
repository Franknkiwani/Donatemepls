// Inside admin.html script
onAuthStateChanged(auth, async (user) => {
    const adminUid = "4xEDAzSt5javvSnW5mws2Ma8i8n1";
    
    if (!user || user.uid !== adminUid) {
        // Kick them out if they aren't you
        window.location.href = "index.html"; 
        return;
    }

    // Load your 1 Million balance display
    const snap = await get(ref(db, `users/${adminUid}/tokens`));
    document.getElementById('vault-balance').innerText = snap.val();
});
