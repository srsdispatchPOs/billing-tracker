// 1. YOUR SECURE DATABASE CONNECTION (Standard Script Format)
const firebaseConfig = {
    apiKey: "AIzaSyA3zCFtlTIBPV8JUR9j7UiNGdIIcMPKpT8",
    authDomain: "billing-tracker-a9471.firebaseapp.com",
    databaseURL: "https://billing-tracker-a9471-default-rtdb.firebaseio.com",
    projectId: "billing-tracker-a9471",
    storageBucket: "billing-tracker-a9471.appspot.com",
    messagingSenderId: "994482566196",
    appId: "1:994482566196:web:3936c5988b3ca40b714661"
};

// Initialize Firebase using the global window objects (No 'import' statements needed)
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

// Generate a random unique ID for this specific browser tab session
const mySessionId = "session_" + Math.random().toString(36).substr(2, 9);

// 1.5 AUTHENTICATION ENGINE
auth.onAuthStateChanged((user) => {
    const loginOverlay = document.getElementById('login-overlay');
    const userDisplay = document.getElementById('user-display');
    
    if (user) {
        // User is logged in! Drop the gate and reveal dashboard
        loginOverlay.classList.add('hidden');
        userDisplay.innerText = `Logged in as: ${user.email}`;
        switchView('intake'); // Default to entry view
    } else {
        // No user logged in. Force screen visibility
        loginOverlay.classList.remove('hidden');
    }
});

// Run when user hits "Secure Login"
function handleLogin(e) {
    if (e) e.preventDefault(); // <-- This stops the page from erasing and reloading!
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            alert("Login successful!");
        })
        .catch(error => {
            alert("Access Denied: " + error.message);
        });
}

// Run when user hits "Sign Out"
function logout() {
    auth.signOut().then(() => {
        document.getElementById('login-form').reset();
        alert("Logged out successfully.");
    });
}

// 2. INTERFACE VIEWS MANAGER (BULLETPROOF VERSION)
function switchView(viewName, e) {
    // 1. Hide all sections and remove active styling from buttons
    document.querySelectorAll('.view-section').forEach(section => section.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    // 2. Show the exact view requested safely
    const targetView = document.getElementById(`${viewName}-view`);
    if (targetView) {
        targetView.classList.remove('hidden');
    }
    
    // 3. Highlight the clicked button ONLY if a real click event happened
    if (e && e.target) {
        e.target.classList.add('active');
    } else {
        // Fallback: Find the matching sidebar nav button by its view name text if loaded programmatically
        const navButtons = document.querySelectorAll('.nav-btn');
        navButtons.forEach(btn => {
            if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${viewName}'`)) {
                btn.classList.add('active');
            }
        });
    }
    
    // 4. Trigger data loading safely based on the active tab
    if (viewName === 'billing') { 
        loadBillingQueue(); 
    } else if (viewName === 'history') { 
        loadPaymentHistory(); 
    }
}

function toggleCardFields() {
    const method = document.getElementById('payment-method').value;
    const cardFields = document.getElementById('card-fields');
    if (method === 'Credit Card') {
        cardFields.style.display = 'block';
    } else {
        cardFields.style.display = 'none';
    }
}

// 3. INTAKE FORM HANDLING (WRITING TO DB)
function handleFormSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('cust-name').value;
    const service = document.getElementById('cust-service').value;
    const price = document.getElementById('cust-price').value;
    const method = document.getElementById('payment-method').value;
    const notes = document.getElementById('cust-notes').value;
    
    // Construct transaction payload
    let transactionData = {
        dateAdded: new Date().toLocaleString(),
        customerName: name,
        serviceProvided: service,
        priceCharged: parseFloat(price).toFixed(2),
        paymentMethod: method,
        paymentStatus: "Pending Billing",
        officeNotes: notes || "None",
        submittedBySession: mySessionId, // <-- tag the submitter's unique session ID
        // Default sensitive data fields to empty
        cardNumber: "N/A",
        cardExp: "N/A",
        cardCvv: "N/A"
    };

    // Populate sensitive data conditionally if card is selected
    if (method === 'Credit Card') {
        transactionData.cardNumber = document.getElementById('card-num').value;
        transactionData.cardExp = document.getElementById('card-exp').value;
        transactionData.cardCvv = document.getElementById('card-cvv').value;
    }

    // Push new unique entry to Firebase Database under 'transactions'
    database.ref('transactions').push(transactionData)
        .then(() => {
            alert("Customer sent to billing queue successfully!");
            document.getElementById('intake-form').reset();
            toggleCardFields();
        })
        .catch(error => alert("Submission error: " + error.message));
}

// 4. DATA SYNCHRONIZATION AND RENDER (READING FROM DB WITH AUDIO ALERT)
let lastCount = 0; // Tracks the queue size so it only dings on NEW entries

function loadBillingQueue() {
    const tbody = document.getElementById('billing-queue-tbody');
    
    // Sync entries with status 'Pending Billing' in real-time
    database.ref('transactions').orderByChild('paymentStatus').equalTo('Pending Billing')
    .on('value', (snapshot) => {
        tbody.innerHTML = "";
        if (!snapshot.exists()) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#7f8c8d;">No pending transactions in queue.</td></tr>`;
            lastCount = 0; // Reset count if queue clears out
            return;
        }
        
        // --- BULLETPROOF EXCLUSIONARY AUDIO CHIME LOGIC ---
        const currentCount = snapshot.numChildren();
        if (currentCount > lastCount && lastCount !== 0) {
            
            // Get the absolute newest transaction added to the database
            let newestTx = null;
            snapshot.forEach((childSnapshot) => {
                newestTx = childSnapshot.val(); 
            });

            // Play sound ONLY if the transaction came from a DIFFERENT browser session
            if (newestTx && newestTx.submittedBySession !== mySessionId) {
                const alertSound = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-84.wav");
                alertSound.play().catch(error => console.log("Audio waiting for user click: ", error));
            }
        }
        lastCount = currentCount; // Update baseline count
        // --------------------------------------------------
        
        snapshot.forEach((childSnapshot) => {
            const id = childSnapshot.key;
            const data = childSnapshot.val();
            
            // Format how the payment data displays in the queue
            let pinfo = "";
            if (data.paymentMethod === 'Credit Card') {
                pinfo = `<strong>Card:</strong> ${data.cardNumber}<br><small>Exp: ${data.cardExp} | CVV: ${data.cardCvv}</small>`;
            } else {
                pinfo = `<em>${data.paymentMethod}</em>`;
            }

            // Fallback safety check in case older test entries don't have the notes field yet
            const displayNotes = data.officeNotes ? data.officeNotes : "None";

            const row = `
                <tr>
                    <td>${data.dateAdded.split(',')[0]}</td>
                    <td><strong>${data.customerName}</strong></td>
                    <td>
                        <strong>${data.serviceProvided}</strong><br>
                        <small style="color:#7f8c8d;">Notes: ${displayNotes}</small>
                    </td>
                    <td><strong>$${data.priceCharged}</strong></td>
                    <td>${pinfo}</td>
                    <td>
                        <button class="wipe-btn" onclick="processAndWipeCard('${id}')">Confirm & Wipe Card</button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    });
}

// 5. THE DATA PURGE ACTION (DELETING THE CARD FROM THE TRACKER COMPLETELY)
function processAndWipeCard(id) {
    if (confirm("Are you sure you want to mark this as Paid and permanently wipe card data? This cannot be undone.")) {
        // Explicitly rewrite specific keys to completely purge card data fields
        database.ref(`transactions/${id}`).update({
            paymentStatus: "Paid",
            cardNumber: "WIPED_BY_BILLING",
            cardExp: "XX/XX",
            cardCvv: "XXX"
        })
        .then(() => alert("Transaction marked Paid. Sensitive data permanently deleted."))
        .catch(error => alert("Error updating record: " + error.message));
    }
}

// 6. HISTORICAL ARCHIVE ENGINE (STREAMLINED VIEW)
function loadPaymentHistory() {
    const tbody = document.getElementById('history-tbody');
    
    // Sync entries with status 'Paid'
    database.ref('transactions').orderByChild('paymentStatus').equalTo('Paid')
    .on('value', (snapshot) => {
        tbody.innerHTML = "";
        if (!snapshot.exists()) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:#7f8c8d;">No historical transactions found.</td></tr>`;
            return;
        }
        
        snapshot.forEach((childSnapshot) => {
            const data = childSnapshot.val();
            const displayNotes = data.officeNotes ? data.officeNotes : "None";
            
            const row = `
                <tr>
                    <td><strong>${data.customerName}</strong></td>
                    <td>
                        <strong>${data.serviceProvided}</strong><br>
                        <small style="color:#7f8c8d;">Notes: ${displayNotes}</small>
                    </td>
                    <td><span style="background:#e8f8f5;color:#2ecc71;padding:4px 8px;border-radius:4px;font-size:12px;font-weight:bold;">Paid</span></td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    });
}