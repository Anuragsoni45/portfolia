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
  onSnapshot, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyDRWwNScrVRg7bv3SrNLkPfcfa3xpdyJMg",
  authDomain: "gen-lang-client-0194737155.firebaseapp.com",
  projectId: "gen-lang-client-0194737155",
  storageBucket: "gen-lang-client-0194737155.firebasestorage.app",
  messagingSenderId: "320756767536",
  appId: "1:320756767536:web:2c9fce5e45a38a6363c6f5",
  measurementId: "G-Z8PVPNFN6S"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// State
let currentUser = null;
let userPrograms = [];
let unsubscribe = null;
let pendingFileCode = "";
let viewingDocId = null;
let activeLanguageFilter = null;

let languagesList = [
  { name: "C", ext: "c", icon: "⚙️" },
  { name: "Python", ext: "py", icon: "🐍" },
  { name: "Java", ext: "java", icon: "☕" },
  { name: "HTML", ext: "html", icon: "🌐" },
  { name: "CSS", ext: "css", icon: "🎨" }
];

// Load user's custom saved languages
const savedCustomLangs = localStorage.getItem("custom_languages");
if (savedCustomLangs) {
  try {
    languagesList = JSON.parse(savedCustomLangs);
  } catch (e) {
    console.error("Failed to parse stored languages", e);
  }
}

// DOM Elements
const landing = document.getElementById("landing");
const appSection = document.getElementById("app");
const openLoginBtn = document.getElementById("openLoginBtn");
const authModal = document.getElementById("authModal");
const googleSignInBtn = document.getElementById("googleSignInBtn");
const authError = document.getElementById("authError");
const logoutBtn = document.getElementById("logoutBtn");
const displayName = document.getElementById("displayName");
const userAvatar = document.getElementById("userAvatar");
const defaultAvatar = document.getElementById("defaultAvatar");
const themeToggle = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");

// Modals & Forms
const metaModal = document.getElementById("metaModal");
const viewerModal = document.getElementById("viewerModal");
const langModal = document.getElementById("langModal");
const metaForm = document.getElementById("metaForm");
const langForm = document.getElementById("langForm");
const progLang = document.getElementById("progLang");
const viewerTitle = document.getElementById("viewerTitle");
const viewerCode = document.getElementById("viewerCode");
const deleteCodeBtn = document.getElementById("deleteCodeBtn");
const copyCodeBtn = document.getElementById("copyCodeBtn");
const addLanguageBtn = document.getElementById("addLanguageBtn");

// Filter View Elements
const langFilteredSection = document.getElementById("langFilteredSection");
const selectedLangTitle = document.getElementById("selectedLangTitle");
const langFilteredList = document.getElementById("langFilteredList");
const closeLangFilterBtn = document.getElementById("closeLangFilterBtn");

// Drag & Drop
const dropZone = document.getElementById("dropZone");
const browseBtn = document.getElementById("browseBtn");
const fileInput = document.getElementById("fileInput");

// Carousel Controls
const carousel = document.getElementById("languageCarousel");
const carouselPrev = document.getElementById("carouselPrev");
const carouselNext = document.getElementById("carouselNext");

if (carouselPrev && carouselNext && carousel) {
  carouselPrev.addEventListener("click", () => {
    carousel.scrollBy({ left: -220, behavior: "smooth" });
  });
  carouselNext.addEventListener("click", () => {
    carousel.scrollBy({ left: 220, behavior: "smooth" });
  });
}

// --- AUDIO PLAYER (Web Audio API Synthesizer) ---
let audioCtx = null;
let isPlaying = false;
let isMuted = false;
let gainNode = null;
let osc = null;

const playPauseBtn = document.getElementById("playPauseBtn");
const playIcon = document.getElementById("playIcon");
const muteBtn = document.getElementById("muteBtn");
const muteIcon = document.getElementById("muteIcon");
const volumeSlider = document.getElementById("volumeSlider");
const waveVisualizer = document.getElementById("waveVisualizer");

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    gainNode = audioCtx.createGain();
    gainNode.gain.value = volumeSlider.value;
    gainNode.connect(audioCtx.destination);
  }
}

if (playPauseBtn) {
  playPauseBtn.addEventListener("click", () => {
    initAudio();
    if (audioCtx.state === "suspended") audioCtx.resume();
    
    if (!isPlaying) {
      osc = audioCtx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(220, audioCtx.currentTime);
      osc.connect(gainNode);
      osc.start();
      isPlaying = true;
      playIcon.textContent = "⏸";
      waveVisualizer.classList.add("playing");
    } else {
      if (osc) osc.stop();
      isPlaying = false;
      playIcon.textContent = "▶";
      waveVisualizer.classList.remove("playing");
    }
  });
}

if (volumeSlider) {
  volumeSlider.addEventListener("input", (e) => {
    if (gainNode) gainNode.gain.value = isMuted ? 0 : e.target.value;
  });
}

if (muteBtn) {
  muteBtn.addEventListener("click", () => {
    isMuted = !isMuted;
    if (gainNode) gainNode.gain.value = isMuted ? 0 : volumeSlider.value;
    muteIcon.textContent = isMuted ? "🔇" : "🔊";
  });
}

// --- THEME TOGGLE ---
if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    const isDark = document.body.classList.contains("dark-mode");
    themeIcon.textContent = isDark ? "☀️" : "🌙";
  });
}

// --- MODAL CONTROLS ---
document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = document.getElementById(btn.dataset.close);
    if (target) target.classList.add("hidden");
  });
});

if (openLoginBtn) {
  openLoginBtn.addEventListener("click", () => authModal.classList.remove("hidden"));
}

// --- ADD LANGUAGE ---
if (addLanguageBtn) {
  addLanguageBtn.addEventListener("click", () => {
    if (langModal) langModal.classList.remove("hidden");
  });
}

if (langForm) {
  langForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const nameInput = document.getElementById("newLangName");
    const extInput = document.getElementById("newLangExt");
    const name = nameInput.value.trim();
    const ext = extInput.value.trim().toLowerCase().replace(".", "");

    if (!name) return;

    if (!languagesList.some((l) => l.name.toLowerCase() === name.toLowerCase())) {
      languagesList.push({
        name: name,
        ext: ext || name.toLowerCase().slice(0, 3),
        icon: "💻"
      });
      localStorage.setItem("custom_languages", JSON.stringify(languagesList));
    }

    populateLangSelect();
    renderLanguages();
    langForm.reset();
    langModal.classList.add("hidden");
  });
}

// --- GOOGLE AUTHENTICATION ---
if (googleSignInBtn) {
  googleSignInBtn.addEventListener("click", async () => {
    try {
      authError.classList.add("hidden");
      await signInWithPopup(auth, provider);
      authModal.classList.add("hidden");
    } catch (err) {
      authError.textContent = err.message;
      authError.classList.remove("hidden");
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    if (unsubscribe) unsubscribe();
    await signOut(auth);
  });
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    if (landing) landing.classList.add("hidden");
    if (appSection) appSection.classList.remove("hidden");

    if (displayName) displayName.textContent = user.displayName || user.email.split("@")[0];
    if (user.photoURL && userAvatar) {
      userAvatar.src = user.photoURL;
      userAvatar.style.display = "block";
      if (defaultAvatar) defaultAvatar.style.display = "none";
    }

    populateLangSelect();
    renderLanguages();
    listenToUserData(user.uid);
  } else {
    currentUser = null;
    userPrograms = [];
    if (landing) landing.classList.remove("hidden");
    if (appSection) appSection.classList.add("hidden");
  }
});

// --- FIRESTORE USER ISOLATION ---
function listenToUserData(userId) {
  const q = query(
    collection(db, "programs"),
    where("userId", "==", userId)
  );

  unsubscribe = onSnapshot(q, (snapshot) => {
    userPrograms = [];
    snapshot.forEach((d) => userPrograms.push({ id: d.id, ...d.data() }));

    userPrograms.sort((a, b) => {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });

    updateUI();
  }, (err) => {
    console.error("Firestore Listen Error:", err);
  });
}

function sanitize(text) {
  const div = document.createElement("div");
  div.textContent = text || "";
  return div.innerHTML;
}

// --- LANGUAGE FILTER HANDLERS ---
function selectLanguage(langName) {
  activeLanguageFilter = langName;
  if (!langFilteredSection || !selectedLangTitle || !langFilteredList) return;

  const matched = userPrograms.filter(
    (p) => (p.lang || "").toLowerCase() === langName.toLowerCase()
  );

  selectedLangTitle.textContent = `${langName} Programs (${matched.length})`;
  langFilteredList.innerHTML = "";

  if (matched.length === 0) {
    langFilteredList.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 20px;">
        No programs uploaded in <strong>${sanitize(langName)}</strong> yet. 
        Head over to the <strong>Upload</strong> tab to add one!
      </div>
    `;
  } else {
    matched.forEach((p) => {
      const item = document.createElement("div");
      item.className = "upload-item neo-raised";
      item.innerHTML = `
        <div class="upload-info">
          <h4>${sanitize(p.title)}</h4>
          <span>${sanitize(p.topic)} • Semester ${p.semester}</span>
        </div>
        <button class="neo-btn primary">View Code</button>
      `;
      item.querySelector("button").addEventListener("click", () => openViewer(p));
      langFilteredList.appendChild(item);
    });
  }

  langFilteredSection.classList.remove("hidden");
  langFilteredSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

if (closeLangFilterBtn) {
  closeLangFilterBtn.addEventListener("click", () => {
    activeLanguageFilter = null;
    if (langFilteredSection) langFilteredSection.classList.add("hidden");
  });
}

// --- DASHBOARD & STATS UPDATE ---
function updateUI() {
  const totalProgramsElem = document.getElementById("totalPrograms");
  if (totalProgramsElem) totalProgramsElem.textContent = userPrograms.length;
  
  const uniqueLangs = new Set(userPrograms.map((p) => (p.lang || "").toLowerCase())).size;
  const totalLanguagesElem = document.getElementById("totalLanguages");
  if (totalLanguagesElem) totalLanguagesElem.textContent = uniqueLangs;

  const mastery = Math.min(100, Math.round((userPrograms.length / 100) * 100));
  const masteryPercentElem = document.getElementById("masteryPercent");
  if (masteryPercentElem) masteryPercentElem.textContent = `${mastery}%`;
  
  const masteryBar = document.getElementById("masteryBar");
  if (masteryBar) masteryBar.style.width = `${mastery}%`;
  
  const masteryText = document.getElementById("masteryText");
  if (masteryText) masteryText.textContent = userPrograms.length;
  
  const circlePercent = document.getElementById("circlePercent");
  if (circlePercent) circlePercent.textContent = `${mastery}%`;
  
  const circleFill = document.getElementById("circleFill");
  if (circleFill) {
    const circleOffset = 326.7 - (326.7 * mastery) / 100;
    circleFill.style.strokeDashoffset = circleOffset;
  }

  // Recent list
  const recentList = document.getElementById("recentList");
  if (recentList) {
    recentList.innerHTML = "";
    if (userPrograms.length === 0) {
      recentList.innerHTML = `<li style="color: var(--text-muted); cursor: default;">No uploads yet. Go to the Upload tab to add your first file!</li>`;
    } else {
      userPrograms.slice(0, 5).forEach((prog) => {
        const li = document.createElement("li");
        li.innerHTML = `
          <span><strong>${sanitize(prog.title)}</strong> (${sanitize(prog.lang)})</span>
          <span class="recent-meta">Sem ${prog.semester}</span>
        `;
        li.addEventListener("click", () => openViewer(prog));
        recentList.appendChild(li);
      });
    }
  }

  // Render Upload Tab List
  const uploadList = document.getElementById("uploadList");
  if (uploadList) {
    uploadList.innerHTML = "";
    if (userPrograms.length === 0) {
      uploadList.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 16px;">No code uploaded yet.</p>`;
    } else {
      userPrograms.forEach((p) => {
        const item = document.createElement("div");
        item.className = "upload-item neo-raised";
        item.innerHTML = `
          <div class="upload-info">
            <h4>${sanitize(p.title)}</h4>
            <span>${sanitize(p.topic)} • ${sanitize(p.lang)} • Semester ${p.semester}</span>
          </div>
          <button class="neo-btn">View Code</button>
        `;
        item.querySelector("button").addEventListener("click", () => openViewer(p));
        uploadList.appendChild(item);
      });
    }
  }

  renderLanguages();
  if (activeLanguageFilter) selectLanguage(activeLanguageFilter);
  renderHeatmap();
  renderSemesters();
}

// --- TAB SWITCHING ---
document.querySelectorAll(".nav-tabs .tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-tabs .tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("pressed");
    setTimeout(() => btn.classList.remove("pressed"), 150);
    btn.classList.add("active");
    const target = document.getElementById(btn.dataset.tab);
    if (target) target.classList.add("active");
  });
});

// --- RENDER LANGUAGES WITH CLICK HANDLERS ---
function populateLangSelect() {
  if (!progLang) return;
  progLang.innerHTML = "";
  languagesList.forEach((l) => {
    const opt = document.createElement("option");
    opt.value = l.name;
    opt.textContent = l.name;
    progLang.appendChild(opt);
  });
}

function renderLanguages() {
  const carouselElem = document.getElementById("languageCarousel");
  const gridElem = document.getElementById("languageGrid");
  if (!carouselElem || !gridElem) return;

  carouselElem.innerHTML = "";
  gridElem.innerHTML = "";

  languagesList.forEach((lang) => {
    const count = userPrograms.filter((p) => (p.lang || "").toLowerCase() === lang.name.toLowerCase()).length;
    
    // Create card element
    const createCard = () => {
      const card = document.createElement("div");
      card.className = "lang-card neo-raised";
      card.style.cursor = "pointer";
      card.innerHTML = `
        <div class="lang-icon">${lang.icon}</div>
        <h4>${sanitize(lang.name)}</h4>
        <div class="lang-stats">
          <span>${count} Programs</span>
        </div>
      `;
      card.addEventListener("click", () => selectLanguage(lang.name));
      return card;
    };

    carouselElem.appendChild(createCard());
    gridElem.appendChild(createCard());
  });
}

// --- FILE UPLOADS ---
if (browseBtn && fileInput) {
  browseBtn.addEventListener("click", (e) => {
    e.preventDefault();
    fileInput.click();
  });

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) handleFileRead(file);
    fileInput.value = "";
  });
}

if (dropZone) {
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });

  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileRead(e.dataTransfer.files[0]);
    }
  });
}

function handleFileRead(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    pendingFileCode = e.target.result;
    
    const cleanName = file.name.replace(/\.[^/.]+$/, "");
    document.getElementById("progTitle").value = cleanName;
    document.getElementById("progTopic").value = "General Assignment";

    const ext = file.name.split(".").pop().toLowerCase();
    const matched = languagesList.find((l) => (l.ext || "").toLowerCase() === ext);
    if (matched && progLang) {
      progLang.value = matched.name;
    }

    if (metaModal) metaModal.classList.remove("hidden");
  };
  reader.readAsText(file);
}

// --- SAVE TO FIRESTORE ---
if (metaForm) {
  metaForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) {
      alert("Please sign in first.");
      return;
    }

    const title = document.getElementById("progTitle").value.trim();
    const topic = document.getElementById("progTopic").value.trim();
    const semester = parseInt(document.getElementById("progSemester").value, 10);
    const lang = document.getElementById("progLang").value;

    try {
      await addDoc(collection(db, "programs"), {
        userId: currentUser.uid,
        title: title,
        topic: topic,
        semester: semester,
        lang: lang,
        code: pendingFileCode || "// No raw code provided",
        createdAt: serverTimestamp()
      });

      metaModal.classList.add("hidden");
      metaForm.reset();
      pendingFileCode = "";
    } catch (err) {
      alert("Save failed: " + err.message);
    }
  });
}

// --- CODE VIEWER ---
function openViewer(prog) {
  viewingDocId = prog.id;
  if (viewerTitle) viewerTitle.textContent = `${prog.title} (${prog.lang})`;
  if (viewerCode) {
    viewerCode.textContent = prog.code;
    viewerCode.className = `language-${(prog.lang || "c").toLowerCase()}`;
    if (window.Prism) Prism.highlightElement(viewerCode);
  }
  if (viewerModal) viewerModal.classList.remove("hidden");
}

if (copyCodeBtn) {
  copyCodeBtn.addEventListener("click", () => {
    if (viewerCode) {
      navigator.clipboard.writeText(viewerCode.textContent);
      copyCodeBtn.textContent = "Copied!";
      setTimeout(() => (copyCodeBtn.textContent = "Copy"), 1500);
    }
  });
}

if (deleteCodeBtn) {
  deleteCodeBtn.addEventListener("click", async () => {
    if (viewingDocId && confirm("Are you sure you want to delete this program?")) {
      try {
        await deleteDoc(doc(db, "programs", viewingDocId));
        if (viewerModal) viewerModal.classList.add("hidden");
        viewingDocId = null;
      } catch (err) {
        alert("Delete failed: " + err.message);
      }
    }
  });
}

// --- HEATMAP & JOURNEY ---
function renderHeatmap() {
  const heatmap = document.getElementById("heatmap");
  if (!heatmap) return;
  heatmap.innerHTML = "";
  for (let i = 0; i < 52 * 7; i++) {
    const cell = document.createElement("div");
    cell.className = "heat-cell";
    if (i % 9 === 0 && userPrograms.length > 0) cell.classList.add("l1");
    if (i % 25 === 0 && userPrograms.length > 2) cell.classList.add("l3");
    heatmap.appendChild(cell);
  }
}

function renderSemesters() {
  const milestones = document.getElementById("semesterMilestones");
  const cards = document.getElementById("semesterCards");
  if (!milestones || !cards) return;

  milestones.innerHTML = "";
  cards.innerHTML = "";

  for (let sem = 1; sem <= 8; sem++) {
    const count = userPrograms.filter((p) => p.semester === sem).length;
    
    const ms = document.createElement("div");
    ms.className = `milestone ${count > 0 ? "done" : ""}`;
    ms.textContent = `Sem ${sem}: ${count}`;
    milestones.appendChild(ms);

    const sc = document.createElement("div");
    sc.className = "sem-card neo-raised";
    sc.innerHTML = `
      <h4>Semester ${sem}</h4>
      <div class="count">${count}</div>
      <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">programs logged</p>
    `;
    cards.appendChild(sc);
  }
}
