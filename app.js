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

// Constants
const TARGET_PROGRAMS_4_YEARS = 500;

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

// --- TOUCH HAPTIC & CLICK SOUND SYNTHESIZER ---
let hapticAudioCtx = null;

function initHapticAudio() {
  if (!hapticAudioCtx) {
    hapticAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (hapticAudioCtx.state === "suspended") {
    hapticAudioCtx.resume();
  }
}

function triggerHapticFeedback() {
  // Physical device vibration (works on Android & supported touch browsers)
  if ("vibrate" in navigator) {
    try {
      navigator.vibrate(12);
    } catch (e) {}
  }

  // Synthesize short, gentle mechanical click sound
  try {
    initHapticAudio();
    if (!hapticAudioCtx) return;

    const osc = hapticAudioCtx.createOscillator();
    const gain = hapticAudioCtx.createGain();
    const now = hapticAudioCtx.currentTime;

    osc.type = "sine";
    // Pitch drops quickly to emulate a mechanical key tap
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.035);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    osc.connect(gain);
    gain.connect(hapticAudioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.035);
  } catch (e) {
    // Graceful fallback if audio context isn't permitted yet
  }
}

// Universal delegated listener for all buttons, tabs, links, and cards
document.addEventListener("click", (e) => {
  const clickable = e.target.closest("button, .neo-btn, .tab, .lang-card, .contact-card, .upload-item, [role='button'], a");
  if (clickable) {
    triggerHapticFeedback();
  }
}, { passive: true });

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

// --- ROMANTIC LOVE BGM (Gentle Acoustic Piano Synthesizer) ---
let audioCtx = null;
let isPlaying = false;
let isMuted = false;
let masterGain = null;
let melodyInterval = null;

const playPauseBtn = document.getElementById("playPauseBtn");
const playIcon = document.getElementById("playIcon");
const muteBtn = document.getElementById("muteBtn");
const muteIcon = document.getElementById("muteIcon");
const volumeSlider = document.getElementById("volumeSlider");
const waveVisualizer = document.getElementById("waveVisualizer");

const romanticChords = [
  [261.63, 329.63, 392.00, 493.88], // Cmaj7 (C4, E4, G4, B4)
  [220.00, 261.63, 329.63, 392.00], // Am7 (A3, C4, E4, G4)
  [174.61, 220.00, 261.63, 329.63], // Fmaj7 (F3, A3, C4, E4)
  [196.00, 246.94, 293.66, 392.00]  // G dominant (G3, B3, D4, G4)
];

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = volumeSlider ? volumeSlider.value : 0.4;
    masterGain.connect(audioCtx.destination);
  }
}

function playSoftNote(freq, startTime, duration) {
  if (!audioCtx || !masterGain) return;
  const osc = audioCtx.createOscillator();
  const noteGain = audioCtx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, startTime);

  noteGain.gain.setValueAtTime(0, startTime);
  noteGain.gain.linearRampToValueAtTime(0.2, startTime + 0.1);
  noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(noteGain);
  noteGain.connect(masterGain);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

function startLoveBGM() {
  let chordIndex = 0;
  let arpeggioStep = 0;

  melodyInterval = setInterval(() => {
    if (!isPlaying || !audioCtx) return;
    const now = audioCtx.currentTime;
    const currentChord = romanticChords[chordIndex];
    const note = currentChord[arpeggioStep];

    playSoftNote(note, now, 1.4);

    arpeggioStep = (arpeggioStep + 1) % currentChord.length;
    if (arpeggioStep === 0) {
      chordIndex = (chordIndex + 1) % romanticChords.length;
    }
  }, 450);
}

function stopLoveBGM() {
  if (melodyInterval) {
    clearInterval(melodyInterval);
    melodyInterval = null;
  }
}

if (playPauseBtn) {
  playPauseBtn.addEventListener("click", () => {
    initAudio();
    if (audioCtx.state === "suspended") audioCtx.resume();

    if (!isPlaying) {
      isPlaying = true;
      startLoveBGM();
      playIcon.textContent = "⏸";
      if (waveVisualizer) waveVisualizer.classList.add("playing");
    } else {
      isPlaying = false;
      stopLoveBGM();
      playIcon.textContent = "▶";
      if (waveVisualizer) waveVisualizer.classList.remove("playing");
    }
  });
}

if (volumeSlider) {
  volumeSlider.addEventListener("input", (e) => {
    if (masterGain) masterGain.gain.value = isMuted ? 0 : e.target.value;
  });
}

if (muteBtn) {
  muteBtn.addEventListener("click", () => {
    isMuted = !isMuted;
    if (masterGain) masterGain.gain.value = isMuted ? 0 : (volumeSlider ? volumeSlider.value : 0.4);
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
  openLoginBtn.addEventListener("click", () => {
    if (authModal) authModal.classList.remove("hidden");
  });
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
      if (authError) authError.classList.add("hidden");
      await signInWithPopup(auth, provider);
      if (authModal) authModal.classList.add("hidden");
    } catch (err) {
      if (authError) {
        authError.textContent = err.message;
        authError.classList.remove("hidden");
      }
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
    if (landing) {
      landing.classList.add("hidden");
      landing.style.display = "none";
    }
    if (authModal) authModal.classList.add("hidden");

    if (appSection) {
      appSection.classList.remove("hidden");
      appSection.style.display = "block";
    }

    if (displayName) displayName.textContent = user.displayName || user.email.split("@")[0];
    if (user.photoURL && userAvatar) {
      userAvatar.src = user.photoURL;
      userAvatar.style.display = "block";
      if (defaultAvatar) defaultAvatar.style.display = "none";
    }

    // Default to Dashboard tab
    document.querySelectorAll(".nav-tabs .tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    const dashTab = document.querySelector('.nav-tabs .tab[data-tab="dashboard"]');
    const dashPanel = document.getElementById("dashboard");
    if (dashTab) dashTab.classList.add("active");
    if (dashPanel) dashPanel.classList.add("active");

    populateLangSelect();
    renderLanguages();
    listenToUserData(user.uid);
  } else {
    currentUser = null;
    userPrograms = [];
    if (landing) {
      landing.classList.remove("hidden");
      landing.style.display = "flex";
    }
    if (appSection) {
      appSection.classList.add("hidden");
      appSection.style.display = "none";
    }
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
  const filteredSection = document.getElementById("langFilteredSection");
  const titleElem = document.getElementById("selectedLangTitle");
  const listElem = document.getElementById("langFilteredList");

  if (!filteredSection || !titleElem || !listElem) return;

  const matched = userPrograms.filter(
    (p) => (p.lang || "").trim().toLowerCase() === langName.trim().toLowerCase()
  );

  titleElem.textContent = `${langName} Programs (${matched.length})`;
  listElem.innerHTML = "";

  if (matched.length === 0) {
    listElem.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 20px;">
        No programs uploaded under <strong>${sanitize(langName)}</strong> yet. 
        Go to the <strong>Upload</strong> tab to add one!
      </div>
    `;
  } else {
    matched.forEach((p) => {
      const item = document.createElement("div");
      item.className = "upload-item neo-raised";
      item.style.marginBottom = "12px";
      item.innerHTML = `
        <div class="upload-info">
          <h4>${sanitize(p.title)}</h4>
          <span>${sanitize(p.topic)} • Semester ${p.semester}</span>
        </div>
        <button class="neo-btn primary">View Code</button>
      `;
      item.querySelector("button").addEventListener("click", () => openViewer(p));
      listElem.appendChild(item);
    });
  }

  filteredSection.classList.remove("hidden");
  renderLanguages();
  filteredSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

if (closeLangFilterBtn) {
  closeLangFilterBtn.addEventListener("click", () => {
    activeLanguageFilter = null;
    if (langFilteredSection) langFilteredSection.classList.add("hidden");
    renderLanguages();
  });
}

// --- STREAK CALCULATION ---
function calculateStreak() {
  if (userPrograms.length === 0) return 0;

  const uploadDates = new Set();
  userPrograms.forEach((p) => {
    if (p.createdAt?.toDate) {
      uploadDates.add(p.createdAt.toDate().toISOString().split("T")[0]);
    } else if (p.createdAt?.seconds) {
      uploadDates.add(new Date(p.createdAt.seconds * 1000).toISOString().split("T")[0]);
    }
  });

  const today = new Date();
  let currentStreak = 0;
  let checkDate = new Date(today);

  const todayStr = checkDate.toISOString().split("T")[0];
  if (!uploadDates.has(todayStr)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const dateStr = checkDate.toISOString().split("T")[0];
    if (uploadDates.has(dateStr)) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return currentStreak;
}

// --- UPDATE UI & LEVEL PROGRESSION ---
function updateUI() {
  const totalProgramsElem = document.getElementById("totalPrograms");
  if (totalProgramsElem) totalProgramsElem.textContent = userPrograms.length;
  
  const uniqueLangs = new Set(userPrograms.map((p) => (p.lang || "").toLowerCase())).size;
  const totalLanguagesElem = document.getElementById("totalLanguages");
  if (totalLanguagesElem) totalLanguagesElem.textContent = uniqueLangs;

  const mastery = Math.min(100, Math.round((userPrograms.length / TARGET_PROGRAMS_4_YEARS) * 100));
  
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

  // Developer Level Title
  const levelBadge = document.getElementById("levelBadge");
  if (levelBadge) {
    const count = userPrograms.length;
    if (count >= 500) {
      levelBadge.textContent = "Level MAX: 10x Tech Lead 👑";
    } else if (count >= 250) {
      levelBadge.textContent = "Level 4: Senior Hacker ⚡";
    } else if (count >= 100) {
      levelBadge.textContent = "Level 3: Code Warrior ⚔️";
    } else if (count >= 50) {
      levelBadge.textContent = "Level 2: Bug Hunter 🛡️";
    } else {
      levelBadge.textContent = "Level 1: Novice Coder 🐣";
    }
  }

  const streakDaysElem = document.getElementById("streakDays");
  if (streakDaysElem) streakDaysElem.textContent = calculateStreak();

  // Recent list
  const recentList = document.getElementById("recentList");
  if (recentList) {
    recentList.innerHTML = "";
    if (userPrograms.length === 0) {
      recentList.innerHTML = `<li style="color: var(--text-muted); cursor: default;">No uploads yet. Hit <strong>Upload New Code</strong> to get started!</li>`;
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

  // Upload Tab List
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

// --- RENDER LANGUAGES ---
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
    const count = userPrograms.filter(
      (p) => (p.lang || "").trim().toLowerCase() === lang.name.trim().toLowerCase()
    ).length;

    const createLanguageCard = () => {
      const card = document.createElement("div");
      card.className = "lang-card neo-raised";
      card.setAttribute("role", "button");
      card.style.cursor = "pointer";
      card.title = `Click to view ${lang.name} programs`;

      if (activeLanguageFilter && activeLanguageFilter.toLowerCase() === lang.name.toLowerCase()) {
        card.style.boxShadow = "inset 4px 4px 8px var(--shadow-dark), inset -4px -4px 8px var(--shadow-light)";
      }

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

    carouselElem.appendChild(createLanguageCard());
    gridElem.appendChild(createLanguageCard());
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

// --- LOGICAL 364-DAY CONTRIBUTION HEATMAP ---
function renderHeatmap() {
  const heatmap = document.getElementById("heatmap");
  if (!heatmap) return;
  heatmap.innerHTML = "";

  const countsByDate = {};
  userPrograms.forEach((p) => {
    let dateObj = null;
    if (p.createdAt?.toDate) {
      dateObj = p.createdAt.toDate();
    } else if (p.createdAt?.seconds) {
      dateObj = new Date(p.createdAt.seconds * 1000);
    }
    if (dateObj) {
      const dateStr = dateObj.toISOString().split("T")[0];
      countsByDate[dateStr] = (countsByDate[dateStr] || 0) + 1;
    }
  });

  const totalDays = 52 * 7;
  const today = new Date();

  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const count = countsByDate[dateStr] || 0;

    const cell = document.createElement("div");
    cell.className = "heat-cell";

    if (count >= 5) {
      cell.classList.add("l4");
    } else if (count >= 3) {
      cell.classList.add("l3");
    } else if (count >= 2) {
      cell.classList.add("l2");
    } else if (count === 1) {
      cell.classList.add("l1");
    }

    cell.title = `${dateStr}: ${count} program${count === 1 ? "" : "s"} uploaded`;
    heatmap.appendChild(cell);
  }
}

// --- SEMESTER LOGICAL TRACKER ---
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
