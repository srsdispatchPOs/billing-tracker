// 1. YOUR SECURE DATABASE CONNECTION
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA3zCFtlTIBPV8JUR9j7UiNGdIIcMPKpT8",
  authDomain: "billing-tracker-a9471.firebaseapp.com",
  projectId: "billing-tracker-a9471",
  storageBucket: "billing-tracker-a9471.firebasestorage.app",
  messagingSenderId: "994482566196",
  appId: "1:994482566196:web:3936c5988b3ca40b714661",
  measurementId: "G-VWQ5WLQZNL"
};

// 1.5 AUTHENTICATION ENGINE
// This listener runs automatically whenever the application loads or state changes
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
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    auth.signInWithEmailAndPassword(email, password)
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// 2. INTERFACE VIEWS MANAGER
function switchView(viewName) {
    document.querySelectorAll('.view-section').forEach(section => section.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(`${viewName}-view`).classList.remove('hidden');
    event.target.classList.add('active');
    
    if (viewName === 'billing') { loadBillingQueue(); }
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
    
    // Construct transaction payload
    let transactionData = {
        dateAdded: new Date().toLocaleString(),
        customerName: name,
        serviceProvided: service,
        priceCharged: parseFloat(price).toFixed(2),
        paymentMethod: method,
        paymentStatus: "Pending Billing",
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

// 4. DATA SYNCHRONIZATION AND RENDER (READING FROM DB)
function loadBillingQueue() {
    const tbody = document.getElementById('billing-queue-tbody');
    
    // Sync entries with status 'Pending Billing' in real-time
    database.ref('transactions').orderByChild('paymentStatus').equalTo('Pending Billing')
    .on('value', (snapshot) => {
        tbody.innerHTML = "";
        if (!snapshot.exists()) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#7f8c8d;">No pending transactions in queue.</td></tr>`;
            return;
        }
        
        snapshot.forEach((childSnapshot) => {
            const id = childSnapshot.key;
            const data = childSnapshot.val();
            
            let pinfo = "";
            if (data.paymentMethod === 'Credit Card') {
                pinfo = `<strong>Card:</strong> ${data.cardNumber}<br><small>Exp: ${data.cardExp} | CVV: ${data.cardCvv}</small>`;
            } else {
                pinfo = `<em>Invoice Client</em>`;
            }

            const row = `
                <tr>
                    <td>${data.dateAdded.split(',')[0]}</td>
                    <td><strong>${data.customerName}</strong></td>
                    <td>${data.serviceProvided}</td>
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