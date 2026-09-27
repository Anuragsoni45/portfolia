import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// --- PASTE YOUR FIREBASE WEB CONFIG HERE ---
const firebaseConfig = {
  apiKey: "AIzaSyDRWwNScrVRg7bv3SrNLkPfcfa3xpdyJMg",
  authDomain: "gen-lang-client-0194737155.firebaseapp.com",
  projectId: "gen-lang-client-0194737155",
  storageBucket: "gen-lang-client-0194737155.firebasestorage.app",
  messagingSenderId: "320756767536",
  appId: "1:320756767536:web:2c9fce5e45a38a6363c6f5",
  measurementId: "G-Z8PVPNFN6S"
};

// Initialize Services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// DOM References
const loginBtn = document.getElementById("loginBtn");
const heroLoginBtn = document.getElementById("heroLoginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userProfile = document.getElementById("userProfile");
const userName = document.getElementById("userName");
const userAvatar = document.getElementById("userAvatar");
const guestHero = document.getElementById("guestHero");
const dashboard = document.getElementById("dashboard");
const projectForm = document.getElementById("projectForm");
const projectList = document.getElementById("projectList");
const recordCount = document.getElementById("recordCount");
const loadingIndicator = document.getElementById("loadingIndicator");

let unsubscribeSnapshot = null;

// Sanitize user inputs to prevent Cross-Site Scripting (XSS)
function sanitizeText(str) {
  const temp = document.createElement("div");
  temp.textContent = str;
  return temp.innerHTML;
}

// Authentication Actions
async function handleLogin() {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    alert("Authentication failed: " + error.message);
  }
}

async function handleLogout() {
  try {
    if (unsubscribeSnapshot) unsubscribeSnapshot();
    await signOut(auth);
  } catch (error) {
    alert("Sign out failed: " + error.message);
  }
}

loginBtn.addEventListener("click", handleLogin);
heroLoginBtn.addEventListener("click", handleLogin);
logoutBtn.addEventListener("click", handleLogout);

// Listen to Auth State Changes
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Render Authenticated State
    guestHero.classList.add("hidden");
    dashboard.classList.remove("hidden");
    userProfile.classList.remove("hidden");
    loginBtn.classList.add("hidden");

    userName.textContent = user.displayName || user.email;
    userAvatar.src = user.photoURL || "https://api.dicebear.com/7.x/identicon/svg?seed=" + user.uid;

    loadUserData(user.uid);
  } else {
    // Render Guest State
    guestHero.classList.remove("hidden");
    dashboard.classList.add("hidden");
    userProfile.classList.add("hidden");
    loginBtn.classList.remove("hidden");
    projectList.innerHTML = "";
    recordCount.textContent = "0 entries";
  }
});

// Real-time Isolated Data Loader
function loadUserData(userId) {
  loadingIndicator.classList.remove("hidden");
  
  // Scoped strictly to the authenticated user's ID
  const q = query(
    collection(db, "projects"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );

  unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
    loadingIndicator.classList.add("hidden");
    projectList.innerHTML = "";
    recordCount.textContent = `${snapshot.size} entries`;

    if (snapshot.empty) {
      projectList.innerHTML = `<p style="color: var(--text-muted); margin-top: 1rem;">No records saved yet. Create your first one above!</p>`;
      return;
    }

    snapshot.forEach((docItem) => {
      const data = docItem.data();
      const div = document.createElement("div");
      div.className = "project-item";
      div.innerHTML = `
        <div>
          <span class="project-tag">${sanitizeText(data.category)}</span>
          <h3>${sanitizeText(data.title)}</h3>
          <p style="color: var(--text-muted); font-size: 0.9rem;">${sanitizeText(data.description)}</p>
        </div>
        <button class="btn btn-danger" data-id="${docItem.id}">Delete</button>
      `;

      div.querySelector(".btn-danger").addEventListener("click", () => {
        deleteProject(docItem.id);
      });

      projectList.appendChild(div);
    });
  }, (error) => {
    loadingIndicator.classList.add("hidden");
    console.error("Firestore access error:", error);
  });
}

// Add Item
projectForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  const title = document.getElementById("projectTitle").value.trim();
  const category = document.getElementById("projectCategory").value;
  const description = document.getElementById("projectDescription").value.trim();

  if (!title || !description) return;

  try {
    await addDoc(collection(db, "projects"), {
      userId: user.uid,
      title: title,
      category: category,
      description: description,
      createdAt: serverTimestamp()
    });
    projectForm.reset();
  } catch (error) {
    alert("Error saving record: " + error.message);
  }
});

// Delete Item
async function deleteProject(id) {
  try {
    await deleteDoc(doc(db, "projects", id));
  } catch (error) {
    alert("Error deleting record: " + error.message);
  }
}
