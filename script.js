/* ════════════════════════════════════════════════════════════
   LUXORA UPDATES — script.js
   Sections: To-Do · Changes · Expenses · Fragrances · Ethanol ·
             Perfume Bottles · Testers · Boxes · Labels · Packaging
   Data: Firestore · Images: GitHub (public repo via raw URLs)
════════════════════════════════════════════════════════════ */

/* ───────── AUTH ───────── */
const ALLOWED_USERS = {
  "tirthmewada06@gmail.com":       "DOT@#2026",
  "dhruvprajapati34340@gmail.com": "DOT@#2026",
  "chitrodaom12@gmail.com":        "DOT@#2026",
};

const NAME_MAP = {
  "tirthmewada06@gmail.com":       "TIRTH",
  "dhruvprajapati34340@gmail.com": "DHRUV",
  "chitrodaom12@gmail.com":        "OM",
};

let currentUser = null;

/* ───────── EMAIL NOTIFICATIONS ───────── */
const NOTIFY_CONFIG = {
  url: "https://script.google.com/macros/s/AKfycbyBO7FsKOh62Py3lWbJLrn6BmDR_23Mjg1zMCuHVsDTLdmZ1tbsEHHC29_QEYMqXZk/exec",
  key: "Lx9-kP2mQ7vTz4Rw8Nb3"
};

/* ───────── FIREBASE REFS ───────── */
let db, collection, getDocs, doc, setDoc, deleteDoc, addDoc,
    onSnapshot, query, orderBy, getDoc, updateDoc;

/* ───────── APP STATE ───────── */
let todoItems    = [];
let changes      = [];
let expenseItems = [];
let fragHave     = [];
let fragAdd      = [];
let fragRemove   = [];
let ethonolItems = [];
let bottles      = [];
let testers      = [];

/* Boxes — one array per sub-tab */
let boxTesters = [];
let box20ml    = [];
let box50ml    = [];
let box100ml   = [];
let boxCombo   = [];

/* Labels — one array per sub-tab */
let labelTesters = [];
let label20ml    = [];
let label50ml    = [];
let label100ml   = [];
let labelCard    = [];
let labelSticker = [];

/* Packaging — one array per sub-tab */
let packBubble = [];
let packBag    = [];
let packPaper  = [];

/* Sub-tab state */
let currentFragTab      = "have";
let currentBoxTab       = "testers";
let currentLabelTab     = "testers";
let currentPackagingTab = "bubble";

let githubConfig = null;

/* ───────── MODAL STATE ───────── */
let modalSection   = null;
let modalEditId    = null;
let modalImageUrl  = "";
let modalUploading = false;

/* ───────── AMOUNT MODAL STATE ───────── */
let amountModalCtx  = null;

/* ───────── DATE PICKER STATE ───────── */
let datePickerTarget = null;
let datePickerView   = new Date();

/* ───────── CONFIRM MODAL STATE ───────── */
let confirmCallback = null;

/* ════════════════════════════════════════════════════════════
   WAIT FOR FIREBASE
════════════════════════════════════════════════════════════ */
window.addEventListener("firebase-ready", () => {
  db         = window.firebaseDB;
  collection = window.firebaseCollection;
  getDocs    = window.firebaseGetDocs;
  doc        = window.firebaseDoc;
  setDoc     = window.firebaseSetDoc;
  deleteDoc  = window.firebaseDeleteDoc;
  addDoc     = window.firebaseAddDoc;
  onSnapshot = window.firebaseOnSnapshot;
  query      = window.firebaseQuery;
  orderBy    = window.firebaseOrderBy;
  getDoc     = window.firebaseGetDoc;
  updateDoc  = window.firebaseUpdateDoc;
});

/* ───────── SESSION RESTORE ───────── */
document.addEventListener("DOMContentLoaded", () => {
  enhanceSelect(document.getElementById("todoFilter"));
  const saved = sessionStorage.getItem("luxora_updates_user");
  if (saved && ALLOWED_USERS[saved]) {
    currentUser = saved;
    bootApp();
  }
  document.getElementById("loginPassword").addEventListener("keydown", e => {
    if (e.key === "Enter") attemptLogin();
  });
  document.getElementById("loginEmail").addEventListener("keydown", e => {
    if (e.key === "Enter") attemptLogin();
  });
});

/* ════════════════════════════════════════════════════════════
   LOGIN / LOGOUT
════════════════════════════════════════════════════════════ */
function attemptLogin() {
  const email    = (document.getElementById("loginEmail").value || "").trim().toLowerCase();
  const password = (document.getElementById("loginPassword").value || "").trim();
  const errEl    = document.getElementById("loginError");

  if (!email)                           { errEl.textContent = "Please enter your email."; return; }
  if (!password)                        { errEl.textContent = "Please enter your password."; return; }
  if (!ALLOWED_USERS[email])            { errEl.textContent = "This email is not authorized."; return; }
  if (ALLOWED_USERS[email] !== password){ errEl.textContent = "Incorrect password."; return; }

  currentUser = email;
  sessionStorage.setItem("luxora_updates_user", email);
  errEl.textContent = "";
  bootApp();
}

function togglePw() {
  const i = document.getElementById("loginPassword");
  i.type = i.type === "password" ? "text" : "password";
}

function logout() {
  sessionStorage.removeItem("luxora_updates_user");
  currentUser = null;
  document.getElementById("app").style.display = "none";
  document.getElementById("loginScreen").style.display = "";
  document.getElementById("loginEmail").value = "";
  document.getElementById("loginPassword").value = "";
  document.getElementById("loginError").textContent = "";
  Object.values(unsubs).forEach(fn => { try { fn && fn(); } catch(_) {} });
  Object.keys(unsubs).forEach(k => delete unsubs[k]);
}

/* ════════════════════════════════════════════════════════════
   BOOT
════════════════════════════════════════════════════════════ */
async function bootApp() {
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("app").style.display = "none";
  document.getElementById("setupScreen").style.display = "none";

  const name = NAME_MAP[currentUser] || currentUser;
  document.getElementById("sidebarUser").textContent = "Signed in as " + name;

  await waitForFirebase();

  try {
    const cfgSnap = await getDoc(doc(db, "config", "github"));
    if (cfgSnap.exists()) {
      githubConfig = cfgSnap.data();
      document.getElementById("app").style.display = "";
      await initCollections();
      setupRealtimeListeners();
    } else {
      document.getElementById("setupScreen").style.display = "";
    }
  } catch (err) {
    console.error("Boot error:", err);
    document.getElementById("app").style.display = "";
    showToast("Firestore error — check console", "error");
  }
}

function waitForFirebase() {
  return new Promise(resolve => {
    if (window.firebaseInitialized) return resolve();
    const iv = setInterval(() => {
      if (window.firebaseInitialized) { clearInterval(iv); resolve(); }
    }, 50);
  });
}

/* ───────── SAVE GITHUB SETUP ───────── */
async function saveGithubSetup() {
  const token    = (document.getElementById("setupToken").value || "").trim();
  const owner    = (document.getElementById("setupOwner").value || "").trim();
  const repo     = (document.getElementById("setupRepo").value || "").trim();
  const branch   = (document.getElementById("setupBranch").value || "main").trim();
  const basePath = (document.getElementById("setupBasePath").value || "uploads").trim();
  const errEl    = document.getElementById("setupError");

  if (!token)  { errEl.textContent = "GitHub token is required."; return; }
  if (!owner)  { errEl.textContent = "GitHub username is required."; return; }
  if (!repo)   { errEl.textContent = "Repository name is required."; return; }

  errEl.textContent = "Saving…";

  try {
    const testRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: { "Authorization": `Bearer ${token}`, "Accept": "application/vnd.github+json" }
    });
    if (!testRes.ok) {
      errEl.textContent = "Could not access repo. Check token & repo name.";
      return;
    }

    await setDoc(doc(db, "config", "github"), { token, owner, repo, branch, basePath });
    githubConfig = { token, owner, repo, branch, basePath };

    document.getElementById("setupScreen").style.display = "none";
    document.getElementById("app").style.display = "";
    await initCollections();
    setupRealtimeListeners();
    showToast("Setup complete ✅", "success");
  } catch (err) {
    console.error(err);
    errEl.textContent = "Error: " + err.message;
  }
}

/* ════════════════════════════════════════════════════════════
   COLLECTIONS AUTO-CREATE
════════════════════════════════════════════════════════════ */
async function initCollections() {
  const required = [
    "todo_items",
    "new_changes",
    "expenses_items",
    "frag_have",
    "frag_add",
    "frag_remove",
    "ethonol_items",
    "perfume_bottles",
    "testers",
    "boxes_testers", "boxes_20ml", "boxes_50ml", "boxes_100ml", "boxes_combo",
    "labels_testers", "labels_20ml", "labels_50ml", "labels_100ml", "labels_card", "labels_sticker",
    "packaging_bubble", "packaging_bag", "packaging_paper"
  ];
  for (const colName of required) {
    try {
      const snap = await getDocs(collection(db, colName));
      if (snap.empty) {
        await addDoc(collection(db, colName), { _init: true, _createdAt: Date.now() });
      }
    } catch (err) {
      console.warn("Could not init", colName, err);
    }
  }
}

/* ════════════════════════════════════════════════════════════
   REALTIME LISTENERS
   Each Firestore collection writes to its OWN array so nothing
   gets overwritten when multiple sub-tabs exist.
════════════════════════════════════════════════════════════ */
const unsubs = {};

function setupRealtimeListeners() {
  const bind = (colName, setter, renderFn) => {
    if (unsubs[colName]) unsubs[colName]();
    unsubs[colName] = onSnapshot(collection(db, colName), (snap) => {
      const arr = [];
      snap.forEach(d => {
        const data = d.data();
        if (data._init) return;
        arr.push({ id: d.id, ...data });
      });
      arr.sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
      setter(arr);
      renderFn();
      renderStats();
    });
  };

  bind("todo_items",       v => todoItems      = v, renderTodo);
  bind("new_changes",      v => changes        = v, renderChanges);
  bind("expenses_items",   v => expenseItems   = v, renderExpenses);
  bind("frag_have",        v => fragHave       = v, renderFrags);
  bind("frag_add",         v => fragAdd        = v, renderFrags);
  bind("frag_remove",      v => fragRemove     = v, renderFrags);
  bind("ethonol_items",    v => ethonolItems   = v, renderEthonol);
  bind("perfume_bottles",  v => bottles        = v, renderBottles);
  bind("testers",          v => testers        = v, renderTesters);

  bind("boxes_testers",    v => boxTesters     = v, renderBoxes);
  bind("boxes_20ml",       v => box20ml        = v, renderBoxes);
  bind("boxes_50ml",       v => box50ml        = v, renderBoxes);
  bind("boxes_100ml",      v => box100ml       = v, renderBoxes);
  bind("boxes_combo",      v => boxCombo       = v, renderBoxes);

  bind("labels_testers",   v => labelTesters   = v, renderLabels);
  bind("labels_20ml",      v => label20ml      = v, renderLabels);
  bind("labels_50ml",      v => label50ml      = v, renderLabels);
  bind("labels_100ml",     v => label100ml     = v, renderLabels);
  bind("labels_card",      v => labelCard      = v, renderLabels);
  bind("labels_sticker",   v => labelSticker   = v, renderLabels);

  bind("packaging_bubble", v => packBubble     = v, renderPackaging);
  bind("packaging_bag",    v => packBag        = v, renderPackaging);
  bind("packaging_paper",  v => packPaper      = v, renderPackaging);
}

/* ════════════════════════════════════════════════════════════
   NAVIGATION
════════════════════════════════════════════════════════════ */
function switchView(view, el) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  const el2 = document.getElementById("view-" + view);
  if (el2) el2.classList.add("active");

  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  if (el) el.classList.add("active");

  document.querySelectorAll(".topbar-nav-link").forEach(a => a.classList.remove("active"));
  const tl = document.querySelector(`.topbar-nav-link[data-view="${view}"]`);
  if (tl) tl.classList.add("active");

  closeSidebar();
}

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("sidebarOverlay").classList.toggle("active");
}
function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebarOverlay").classList.remove("active");
}

/* ════════════════════════════════════════════════════════════
   STATS
════════════════════════════════════════════════════════════ */
function renderStats() {
  document.getElementById("statTodo").textContent    = todoItems.length;
  document.getElementById("statBottles").textContent = bottles.length;
  document.getElementById("statFrags").textContent   = fragHave.length;
}

/* ════════════════════════════════════════════════════════════
   UTIL — ML / L FORMATTING · ₹ FORMATTING
════════════════════════════════════════════════════════════ */
function formatMl(value) {
  const n = Number(value) || 0;
  if (n <= 0) return "0 ml";
  if (n < 1000) return `${n} ml`;
  const litres = n / 1000;
  const str = litres.toFixed(2).replace(/\.?0+$/, "");
  return `${str} L`;
}

function formatRupees(value) {
  const n = Number(value) || 0;
  return "₹" + n.toLocaleString("en-IN");
}

/* ════════════════════════════════════════════════════════════
   GITHUB IMAGE UPLOAD / DELETE
════════════════════════════════════════════════════════════ */
async function uploadImageToGitHub(file, sectionFolder) {
  if (!githubConfig) throw new Error("GitHub not configured");

  const { token, owner, repo, branch, basePath } = githubConfig;
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${basePath}/${sectionFolder}/${Date.now()}_${safeName}`;

  const base64 = await fileToBase64(file);
  const content = base64.split(",")[1];

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message: `Upload ${path}`, content, branch })
  });

  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    throw new Error(err.message || "GitHub upload failed");
  }

  return { path };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function resolveImageSrc(ref) {
  if (!ref) return "";
  if (ref.startsWith("http")) return ref;
  if (ref.startsWith("ghapi:")) {
    const path = ref.replace("ghapi:", "");
    if (!githubConfig) return "";
    const { owner, repo, branch } = githubConfig;
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  }
  return ref;
}

async function imageThumbHTML(ref, altText) {
  if (!ref) return `<div style="width:40px;height:40px;border-radius:8px;background:rgba(210,195,175,0.3);display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:0.6rem">—</div>`;
  const src = await resolveImageSrc(ref);
  if (!src) return `<div style="width:40px;height:40px;border-radius:8px;background:rgba(210,195,175,0.3);display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:0.6rem">ERR</div>`;
  return `<img src="${src}" alt="${altText||''}" style="width:40px;height:40px;object-fit:cover;border-radius:8px;cursor:pointer;border:1px solid rgba(210,195,175,0.5)" onclick="openLightbox('${src}')" />`;
}

function openLightbox(src) {
  document.getElementById("lightboxImg").src = src;
  document.getElementById("imgLightbox").style.display = "flex";
}
function closeLightbox() {
  document.getElementById("imgLightbox").style.display = "none";
}

async function deleteImageFromGitHub(ref) {
  if (!ref) return false;
  if (!githubConfig) return false;
  if (!ref.startsWith("ghapi:")) return false;

  const path = ref.replace("ghapi:", "").trim();
  if (!path) return false;

  const { token, owner, repo, branch } = githubConfig;

  const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
  const getRes = await fetch(getUrl, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json"
    }
  });

  if (getRes.status === 404) return true;

  if (!getRes.ok) {
    const err = await getRes.json().catch(() => ({}));
    throw new Error(err.message || `GitHub GET failed (${getRes.status})`);
  }

  const fileData = await getRes.json();
  const sha = fileData.sha;
  if (!sha) throw new Error("No SHA returned for file");

  const delUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const delRes = await fetch(delUrl, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message: `Delete ${path}`, sha, branch })
  });

  if (!delRes.ok) {
    const err = await delRes.json().catch(() => ({}));
    throw new Error(err.message || `GitHub DELETE failed (${delRes.status})`);
  }

  return true;
}

/* ════════════════════════════════════════════════════════════
   CUSTOM DATE PICKER
════════════════════════════════════════════════════════════ */
function openDatePicker(inputEl) {
  if (!inputEl) return;
  datePickerTarget = inputEl;

  const current = inputEl.value ? new Date(inputEl.value) : new Date();
  datePickerView = isNaN(current.getTime()) ? new Date() : current;

  document.getElementById("datePickerTitle").textContent = "Select Date";
  renderDatePicker();
  document.getElementById("datePickerModal").style.display = "flex";
}

function closeDatePicker() {
  document.getElementById("datePickerModal").style.display = "none";
  datePickerTarget = null;
}

function datePickerPrevMonth() {
  datePickerView.setMonth(datePickerView.getMonth() - 1);
  renderDatePicker();
}
function datePickerNextMonth() {
  datePickerView.setMonth(datePickerView.getMonth() + 1);
  renderDatePicker();
}
function datePickerToday() {
  if (datePickerTarget) datePickerTarget.value = new Date().toISOString().split("T")[0];
  closeDatePicker();
}
function datePickerClear() {
  if (datePickerTarget) datePickerTarget.value = "";
  closeDatePicker();
}

function renderDatePicker() {
  const monthEl = document.getElementById("datePickerMonth");
  const gridEl  = document.getElementById("datePickerGrid");

  const year  = datePickerView.getFullYear();
  const month = datePickerView.getMonth();

  monthEl.textContent = new Date(year, month, 1).toLocaleDateString("en-IN", {
    month: "long", year: "numeric"
  });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const today = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth();
  const todayD = today.getDate();

  let selY = null, selM = null, selD = null;
  if (datePickerTarget && datePickerTarget.value) {
    const sel = new Date(datePickerTarget.value);
    if (!isNaN(sel.getTime())) {
      selY = sel.getFullYear();
      selM = sel.getMonth();
      selD = sel.getDate();
    }
  }

  let html = "";
  for (let i = 0; i < firstDay; i++) html += `<div class="date-picker-day empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday    = (todayY === year && todayM === month && todayD === d);
    const isSelected = (selY === year && selM === month && selD === d);
    const cls = ["date-picker-day"];
    if (isToday)    cls.push("today");
    if (isSelected) cls.push("selected");
    html += `<button type="button" class="${cls.join(" ")}" onclick="datePickerPick(${year}, ${month}, ${d})">${d}</button>`;
  }
  gridEl.innerHTML = html;
}

function datePickerPick(y, m, d) {
  const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  if (datePickerTarget) datePickerTarget.value = iso;
  closeDatePicker();
}

/* ════════════════════════════════════════════════════════════
   CUSTOM CONFIRM MODAL
════════════════════════════════════════════════════════════ */
function openConfirmModal(title, message, onConfirm, confirmLabel = "Delete") {
  document.getElementById("confirmModalTitle").textContent   = title;
  document.getElementById("confirmModalMessage").textContent = message;

  const btn = document.getElementById("confirmModalConfirm");
  btn.textContent = confirmLabel;
  btn.style.background = confirmLabel.toLowerCase().includes("delete")
    ? "linear-gradient(135deg, var(--red), #e35f5f)"
    : "linear-gradient(135deg, var(--gold), var(--gold-light))";

  confirmCallback = onConfirm;
  document.getElementById("confirmModal").style.display = "flex";
}

function closeConfirmModal() {
  document.getElementById("confirmModal").style.display = "none";
  confirmCallback = null;
}

function confirmConfirmModal() {
  const cb = confirmCallback;
  closeConfirmModal();
  if (typeof cb === "function") cb();
}

/* ════════════════════════════════════════════════════════════
   AMOUNT MODAL — generic +/− prompt
════════════════════════════════════════════════════════════ */
function openAmountModal(ctx, direction) {
  amountModalCtx = { ...ctx, direction };

  const titleEl   = document.getElementById("amountModalTitle");
  const subEl     = document.getElementById("amountModalSub");
  const labelEl   = document.getElementById("amountModalLabel");
  const inputEl   = document.getElementById("amountModalInput");
  const confirmEl = document.getElementById("amountModalConfirm");

  const isMl = ctx.unit === "ml";
  const startLabel = isMl ? formatMl(ctx.start) : `${ctx.start}`;

  titleEl.textContent = direction > 0 ? "Add Stock" : "Log Usage";
  subEl.textContent   = `${ctx.name || "Item"} — current: ${startLabel}`;
  labelEl.textContent = isMl
    ? (direction > 0 ? "Amount to add (ml)" : "Amount used (ml)")
    : (direction > 0 ? "Quantity to add" : "Quantity used");

  inputEl.value = isMl ? "100" : "1";

  confirmEl.style.background = direction > 0
    ? "linear-gradient(135deg, var(--green), #2eb06a)"
    : "linear-gradient(135deg, var(--red), #e35f5f)";
  confirmEl.textContent = direction > 0 ? "Add" : "Confirm";

  updateAmountPreview();
  document.getElementById("amountModal").style.display = "flex";
  setTimeout(() => { inputEl.focus(); inputEl.select(); }, 50);
}

function closeAmountModal() {
  document.getElementById("amountModal").style.display = "none";
  amountModalCtx = null;
}

function amountModalChangeQty(delta) {
  if (!amountModalCtx) return;
  const inputEl = document.getElementById("amountModalInput");
  let val = Number(inputEl.value) || 0;
  const step = amountModalCtx.unit === "ml" ? 10 : 1;
  val = val + delta * step;
  if (val < 1) val = 1;
  inputEl.value = val;
  updateAmountPreview();
}

function updateAmountPreview() {
  if (!amountModalCtx) return;
  const inputEl   = document.getElementById("amountModalInput");
  const previewEl = document.getElementById("amountModalPreview");
  const amount    = Number(inputEl.value) || 0;
  const start     = Number(amountModalCtx.start) || 0;
  const isMl      = amountModalCtx.unit === "ml";

  let newVal = amountModalCtx.direction > 0 ? start + amount : start - amount;
  if (newVal < 0) newVal = 0;

  const fmt = v => isMl ? formatMl(v) : String(v);
  previewEl.innerHTML = `${fmt(start)} <span style="color:var(--text3);font-style:normal">→</span> <strong style="color:var(--gold)">${fmt(newVal)}</strong>`;
}

async function confirmAmountModal() {
  if (!amountModalCtx) return;
  const inputEl = document.getElementById("amountModalInput");
  const amount  = Number(inputEl.value);

  if (!amount || amount <= 0 || isNaN(amount)) {
    showToast("Enter a valid number", "error");
    return;
  }

  const start = Number(amountModalCtx.start) || 0;
  let newVal  = amountModalCtx.direction > 0 ? start + amount : start - amount;
  if (newVal < 0) newVal = 0;

  const update = {};
  update[amountModalCtx.field] = newVal;
  update.updatedAt = Date.now();
  update.updatedBy = NAME_MAP[currentUser] || currentUser;

  try {
    await updateDoc(doc(db, amountModalCtx.collection, amountModalCtx.docId), update);

    const isMl = amountModalCtx.unit === "ml";
    const fmt = v => isMl ? formatMl(v) : String(v);
    showToast(
      amountModalCtx.direction > 0
        ? `Added ${fmt(amount)} → now ${fmt(newVal)}`
        : `Used ${fmt(amount)} → now ${fmt(newVal)}`,
      "success"
    );
    notifyChange({
      collection: amountModalCtx.collection,
      action: amountModalCtx.direction > 0 ? "stock_added" : "stock_used",
      item: amountModalCtx.name || "Item",
      changes: [{ label: FIELD_LABELS[amountModalCtx.field] || amountModalCtx.field, from: fmt(start), to: fmt(newVal) }],
      details: [{ label: amountModalCtx.direction > 0 ? "Amount added" : "Amount used", value: fmt(amount) }]
    });
    closeAmountModal();
  } catch (err) {
    console.error(err);
    showToast("Update failed: " + err.message, "error");
  }
}

/* ════════════════════════════════════════════════════════════
   RENDER — TO-DO
════════════════════════════════════════════════════════════ */
async function renderTodo() {
  const tbody = document.getElementById("todoTbody");
  if (!tbody) return;
  const filter = document.getElementById("todoFilter")?.value || "";
  const list = filter ? todoItems.filter(t => t.status === filter) : todoItems;

  tbody.innerHTML = "";
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text3)">No tasks yet</td></tr>`;
    return;
  }

  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    const thumb = await imageThumbHTML(t.image, t.title);
    const prClass = t.priority === "HIGH" ? "out" : t.priority === "MEDIUM" ? "low" : "good";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="col-num">${i+1}</td>
      <td>${thumb}</td>
      <td class="col-name">${escapeHtml(t.title || "—")}</td>
      <td><span class="status-badge ${prClass}">${t.priority || "LOW"}</span></td>
      <td>${t.dueDate || "—"}</td>
      <td><span class="status-badge ${t.status === "DONE" ? "good" : "low"}">${t.status || "PENDING"}</span></td>
      <td style="color:var(--text3);font-size:0.78rem">${escapeHtml(t.notes || "")}</td>
      <td style="white-space:nowrap">
        <button class="edit-sale-btn" onclick="openModal('todo','${t.id}')" title="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="delete-sale-btn" onclick="confirmDelete('todo_items','${t.id}','task')" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

/* ════════════════════════════════════════════════════════════
   RENDER — CHANGES
════════════════════════════════════════════════════════════ */
async function renderChanges() {
  const tbody = document.getElementById("changeTbody");
  if (!tbody) return;
  const q = (document.getElementById("changeSearch")?.value || "").toLowerCase();
  const list = changes.filter(c =>
    !q || (c.title||"").toLowerCase().includes(q) || (c.description||"").toLowerCase().includes(q)
  );

  tbody.innerHTML = "";
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text3)">No changes logged yet</td></tr>`;
    return;
  }

  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    const thumb = await imageThumbHTML(c.image, c.title);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="col-num">${i+1}</td>
      <td>${thumb}</td>
      <td class="col-name">${escapeHtml(c.title || "—")}</td>
      <td><span class="status-badge good">${escapeHtml(c.category || "NEW")}</span></td>
      <td>${c.date || "—"}</td>
      <td style="color:var(--text3);font-size:0.78rem">${escapeHtml(c.description || "")}</td>
      <td style="white-space:nowrap">
        <button class="edit-sale-btn" onclick="openModal('change','${c.id}')" title="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="delete-sale-btn" onclick="confirmDelete('new_changes','${c.id}','change')" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

/* ════════════════════════════════════════════════════════════
   RENDER — EXPENSES
════════════════════════════════════════════════════════════ */
async function renderExpenses() {
  const grid = document.getElementById("expenseGrid");
  if (!grid) return;
  const q = (document.getElementById("expenseSearch")?.value || "").toLowerCase();
  const list = expenseItems.filter(e =>
    !q || (e.title||"").toLowerCase().includes(q)
  );

  grid.innerHTML = "";
  if (list.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text3)">No expenses yet — click "＋ Add Expense"</div>`;
    return;
  }

  for (const e of list) {
    const src = await resolveImageSrc(e.image);
    const isOnline = (e.payment || "").toLowerCase().includes("online");
    const statusGood = (e.status || "").toUpperCase() === "DONE";
    const priClass = e.priority === "HIGH" ? "out" : e.priority === "MEDIUM" ? "low" : "good";

    const card = document.createElement("div");
    card.className = "frag-card";
    card.innerHTML = `
      ${src
        ? `<img class="frag-card-img" src="${src}" onclick="openLightbox('${src}')" />`
        : `<div class="frag-card-emoji">💸</div>`}
      <div class="frag-card-name">${escapeHtml(e.title || "Untitled")}</div>
      <div style="font-family:var(--font-serif);font-style:italic;font-size:1.15rem;color:var(--gold);margin:4px 0">
        ${formatRupees(e.amount || 0)}
      </div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:center">
        <span class="status-badge ${isOnline ? "info" : "good"}">${isOnline ? "Online" : "Cash"}</span>
        <span class="status-badge ${statusGood ? "good" : "low"}">${e.status || "PENDING"}</span>
        <span class="status-badge ${priClass}">${e.priority || "MEDIUM"}</span>
      </div>
      ${e.date ? `<div style="font-size:0.66rem;color:var(--text3)">Date: ${e.date}</div>` : ""}
      ${e.notes ? `<div style="font-size:0.66rem;color:var(--text3);line-height:1.3">${escapeHtml(e.notes)}</div>` : ""}
      <div class="card-actions">
        <button class="edit-sale-btn" onclick="event.stopPropagation();openModal('expense','${e.id}')" title="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="delete-sale-btn" onclick="event.stopPropagation();confirmDelete('expenses_items','${e.id}','expense')" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    `;
    grid.appendChild(card);
  }
}

/* ════════════════════════════════════════════════════════════
   RENDER — FRAGRANCES
════════════════════════════════════════════════════════════ */
function switchFragTab(tab, el) {
  currentFragTab = tab;
  document.querySelectorAll('#view-fragrances .size-chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  renderFrags();
}

async function renderFrags() {
  const grid = document.getElementById("fragGridUpdates");
  if (!grid) return;

  const sourceMap = { have: fragHave, add: fragAdd, remove: fragRemove };
  const colMap    = { have: "frag_have", add: "frag_add", remove: "frag_remove" };
  const col       = colMap[currentFragTab];

  const list = sourceMap[currentFragTab] || [];
  const q = (document.getElementById("fragSearch")?.value || "").toLowerCase();
  const filtered = list.filter(f =>
    !q || (f.name||"").toLowerCase().includes(q) || (f.brand||"").toLowerCase().includes(q)
  );

  grid.innerHTML = "";
  if (filtered.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text3)">Nothing here yet — click "＋ Add Fragrance"</div>`;
    return;
  }

  for (const f of filtered) {
    const src = await resolveImageSrc(f.image);
    const qty = Number(f.quantity) || 0;
    const badgeColor = currentFragTab === "have" ? "good" : currentFragTab === "add" ? "good" : "zero";
    const badgeLabel = currentFragTab === "have" ? "Have" : currentFragTab === "add" ? "To Add" : "To Remove";
    const card = document.createElement("div");
    card.className = "frag-card";
    card.innerHTML = `
      ${src
        ? `<img class="frag-card-img" src="${src}" onclick="openLightbox('${src}')" />`
        : `<div class="frag-card-emoji">🌸</div>`}
      <div class="frag-card-name">${escapeHtml(f.name || "Unnamed")}</div>
      <div style="font-size:0.68rem;color:var(--text3)">${escapeHtml(f.brand||"")}${f.sizes ? " · "+f.sizes : ""}</div>
      <div class="frag-stock-pill ${badgeColor}">${badgeLabel} · Qty: ${qty}</div>
      ${f.purchaseDate ? `<div style="font-size:0.66rem;color:var(--text3)">Bought: ${f.purchaseDate}</div>` : ""}
      <div class="card-actions">
        <button class="card-minus-btn" title="Use one" onclick="event.stopPropagation();openAmountModal({collection:'${col}',docId:'${f.id}',field:'quantity',start:${qty},unit:'qty',name:'${escapeAttr(f.name||"Fragrance")}'},-1)">−</button>
        <button class="card-plus-btn" title="Add one" onclick="event.stopPropagation();openAmountModal({collection:'${col}',docId:'${f.id}',field:'quantity',start:${qty},unit:'qty',name:'${escapeAttr(f.name||"Fragrance")}'},1)">+</button>
        <button class="edit-sale-btn" onclick="event.stopPropagation();openModal('frag','${f.id}')" title="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="delete-sale-btn" onclick="event.stopPropagation();confirmDelete('${col}','${f.id}','fragrance')" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    `;
    grid.appendChild(card);
  }
}

function fragCollection(tab) {
  return tab === "have" ? "frag_have" : tab === "add" ? "frag_add" : "frag_remove";
}

/* ════════════════════════════════════════════════════════════
   RENDER — ETHANOL
════════════════════════════════════════════════════════════ */
async function renderEthonol() {
  const grid = document.getElementById("ethonolGrid");
  if (!grid) return;
  const q = (document.getElementById("ethonolSearch")?.value || "").toLowerCase();
  const list = ethonolItems.filter(e => !q || (e.name||"").toLowerCase().includes(q));

  grid.innerHTML = "";
  if (list.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text3)">No ethanol entries yet — click "＋ Add Ethanol"</div>`;
    return;
  }

  for (const e of list) {
    const src = await resolveImageSrc(e.image);
    const currentMl = Number(e.ml) || 0;
    const card = document.createElement("div");
    card.className = "frag-card";
    card.innerHTML = `
      ${src
        ? `<img class="frag-card-img" src="${src}" onclick="openLightbox('${src}')" />`
        : `<div class="frag-card-emoji">⚗️</div>`}
      <div class="frag-card-name">${escapeHtml(e.name || "Unnamed")}</div>
      <div style="font-family:var(--font-serif);font-style:italic;font-size:1.15rem;color:var(--gold);margin:4px 0">
        ${formatMl(currentMl)}
      </div>
      ${e.purchaseDate ? `<div style="font-size:0.66rem;color:var(--text3)">Bought: ${e.purchaseDate}</div>` : ""}
      ${e.notes ? `<div style="font-size:0.66rem;color:var(--text3);line-height:1.3">${escapeHtml(e.notes)}</div>` : ""}
      <div class="card-actions">
        <button class="card-minus-btn" title="Log usage" onclick="event.stopPropagation();openAmountModal({collection:'ethonol_items',docId:'${e.id}',field:'ml',start:${currentMl},unit:'ml',name:'${escapeAttr(e.name||"Ethanol")}'},-1)">−</button>
        <button class="card-plus-btn" title="Add stock" onclick="event.stopPropagation();openAmountModal({collection:'ethonol_items',docId:'${e.id}',field:'ml',start:${currentMl},unit:'ml',name:'${escapeAttr(e.name||"Ethanol")}'},1)">+</button>
        <button class="edit-sale-btn" onclick="event.stopPropagation();openModal('ethonol','${e.id}')" title="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="delete-sale-btn" onclick="event.stopPropagation();confirmDelete('ethonol_items','${e.id}','ethanol')" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    `;
    grid.appendChild(card);
  }
}

/* ════════════════════════════════════════════════════════════
   RENDER — BOTTLES
════════════════════════════════════════════════════════════ */
async function renderBottles() {
  const grid = document.getElementById("bottleGrid");
  if (!grid) return;
  const q = (document.getElementById("bottleSearch")?.value || "").toLowerCase();
  const list = bottles.filter(b =>
    !q || (b.name||"").toLowerCase().includes(q) || (b.brand||"").toLowerCase().includes(q)
  );

  grid.innerHTML = "";
  if (list.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text3)">No bottles yet — click "＋ Add Bottle"</div>`;
    return;
  }

  for (const b of list) {
    const src = await resolveImageSrc(b.image);
    const qty = Number(b.quantity) || 0;
    const card = document.createElement("div");
    card.className = "frag-card";
    card.innerHTML = `
      ${src
        ? `<img class="frag-card-img" src="${src}" onclick="openLightbox('${src}')" />`
        : `<div class="frag-card-emoji">🧴</div>`}
      <div class="frag-card-name">${escapeHtml(b.name || "Unnamed")}</div>
      <div style="font-size:0.68rem;color:var(--text3)">${escapeHtml(b.brand||"")}${b.size ? " · "+b.size+"ml" : ""}</div>
      <div class="frag-stock-pill good">Qty: ${qty}</div>
      ${b.purchaseDate ? `<div style="font-size:0.66rem;color:var(--text3)">Bought: ${b.purchaseDate}</div>` : ""}
      <div class="card-actions">
        <button class="card-minus-btn" title="Use one" onclick="event.stopPropagation();openAmountModal({collection:'perfume_bottles',docId:'${b.id}',field:'quantity',start:${qty},unit:'qty',name:'${escapeAttr(b.name||"Bottle")}'},-1)">−</button>
        <button class="card-plus-btn" title="Add one" onclick="event.stopPropagation();openAmountModal({collection:'perfume_bottles',docId:'${b.id}',field:'quantity',start:${qty},unit:'qty',name:'${escapeAttr(b.name||"Bottle")}'},1)">+</button>
        <button class="edit-sale-btn" onclick="event.stopPropagation();openModal('bottle','${b.id}')" title="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="delete-sale-btn" onclick="event.stopPropagation();confirmDelete('perfume_bottles','${b.id}','bottle')" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    `;
    grid.appendChild(card);
  }
}

/* ════════════════════════════════════════════════════════════
   RENDER — TESTERS
════════════════════════════════════════════════════════════ */
async function renderTesters() {
  const grid = document.getElementById("testerGrid");
  if (!grid) return;
  const q = (document.getElementById("testerSearch")?.value || "").toLowerCase();
  const list = testers.filter(t =>
    !q || (t.name||"").toLowerCase().includes(q) || (t.brand||"").toLowerCase().includes(q)
  );

  grid.innerHTML = "";
  if (list.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text3)">No testers yet — click "＋ Add Tester"</div>`;
    return;
  }

  for (const t of list) {
    const src = await resolveImageSrc(t.image);
    const qty = Number(t.quantity) || 0;
    const card = document.createElement("div");
    card.className = "frag-card";
    card.innerHTML = `
      ${src
        ? `<img class="frag-card-img" src="${src}" onclick="openLightbox('${src}')" />`
        : `<div class="frag-card-emoji">💧</div>`}
      <div class="frag-card-name">${escapeHtml(t.name || "Unnamed")}</div>
      <div style="font-size:0.68rem;color:var(--text3)">${escapeHtml(t.brand||"")}${t.location ? " · "+t.location : ""}</div>
      <div class="frag-stock-pill good">Qty: ${qty}</div>
      ${t.purchaseDate ? `<div style="font-size:0.66rem;color:var(--text3)">Bought: ${t.purchaseDate}</div>` : ""}
      <div class="card-actions">
        <button class="card-minus-btn" title="Use one" onclick="event.stopPropagation();openAmountModal({collection:'testers',docId:'${t.id}',field:'quantity',start:${qty},unit:'qty',name:'${escapeAttr(t.name||"Tester")}'},-1)">−</button>
        <button class="card-plus-btn" title="Add one" onclick="event.stopPropagation();openAmountModal({collection:'testers',docId:'${t.id}',field:'quantity',start:${qty},unit:'qty',name:'${escapeAttr(t.name||"Tester")}'},1)">+</button>
        <button class="edit-sale-btn" onclick="event.stopPropagation();openModal('tester','${t.id}')" title="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="delete-sale-btn" onclick="event.stopPropagation();confirmDelete('testers','${t.id}','tester')" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    `;
    grid.appendChild(card);
  }
}

/* ════════════════════════════════════════════════════════════
   RENDER — BOXES (per-tab array)
════════════════════════════════════════════════════════════ */
function switchBoxTab(tab, el) {
  currentBoxTab = tab;
  document.querySelectorAll('#view-boxes .size-chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  renderBoxes();
}

async function renderBoxes() {
  const grid = document.getElementById("boxGrid");
  if (!grid) return;

  const q = (document.getElementById("boxSearch")?.value || "").toLowerCase();
  const col = boxCollectionForTab(currentBoxTab);

  const sourceMap = {
    testers: boxTesters,
    "20ml":  box20ml,
    "50ml":  box50ml,
    "100ml": box100ml,
    combo:   boxCombo
  };
  const list = (sourceMap[currentBoxTab] || []).filter(b =>
    !q || (b.name||"").toLowerCase().includes(q)
  );

  grid.innerHTML = "";
  if (list.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text3)">No boxes in this tab yet — click "＋ Add Box"</div>`;
    return;
  }

  for (const b of list) {
    const src = await resolveImageSrc(b.image);
    const qty = Number(b.quantity) || 0;
    const card = document.createElement("div");
    card.className = "frag-card";
    card.innerHTML = `
      ${src
        ? `<img class="frag-card-img" src="${src}" onclick="openLightbox('${src}')" />`
        : `<div class="frag-card-emoji">📦</div>`}
      <div class="frag-card-name">${escapeHtml(b.name || "Unnamed")}</div>
      ${b.sizes ? `<div style="font-size:0.68rem;color:var(--text3)">Sizes: ${escapeHtml(b.sizes)}</div>` : ""}
      ${b.purchaseDate ? `<div style="font-size:0.66rem;color:var(--text3)">Bought: ${b.purchaseDate}</div>` : ""}
      <div class="frag-stock-pill good">Qty: ${qty}</div>
      <div class="card-actions">
        <button class="card-minus-btn" title="Use one" onclick="event.stopPropagation();openAmountModal({collection:'${col}',docId:'${b.id}',field:'quantity',start:${qty},unit:'qty',name:'${escapeAttr(b.name||"Box")}'},-1)">−</button>
        <button class="card-plus-btn" title="Add one" onclick="event.stopPropagation();openAmountModal({collection:'${col}',docId:'${b.id}',field:'quantity',start:${qty},unit:'qty',name:'${escapeAttr(b.name||"Box")}'},1)">+</button>
        <button class="edit-sale-btn" onclick="event.stopPropagation();openModal('box','${b.id}')" title="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="delete-sale-btn" onclick="event.stopPropagation();confirmDelete('${col}','${b.id}','box')" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    `;
    grid.appendChild(card);
  }
}

function boxCollectionForTab(tab) {
  return tab === "testers" ? "boxes_testers"
       : tab === "20ml"    ? "boxes_20ml"
       : tab === "50ml"    ? "boxes_50ml"
       : tab === "100ml"   ? "boxes_100ml"
       :                     "boxes_combo";
}

/* ════════════════════════════════════════════════════════════
   RENDER — LABELS (per-tab array)
════════════════════════════════════════════════════════════ */
function switchLabelTab(tab, el) {
  currentLabelTab = tab;
  document.querySelectorAll('#view-labels .size-chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  renderLabels();
}

async function renderLabels() {
  const grid = document.getElementById("labelGrid");
  if (!grid) return;

  const q = (document.getElementById("labelSearch")?.value || "").toLowerCase();
  const col = labelCollectionForTab(currentLabelTab);

  const sourceMap = {
    testers: labelTesters,
    "20ml":  label20ml,
    "50ml":  label50ml,
    "100ml": label100ml,
    card:    labelCard,
    sticker: labelSticker
  };
  const list = (sourceMap[currentLabelTab] || []).filter(l =>
    !q || (l.name||"").toLowerCase().includes(q)
  );

  grid.innerHTML = "";
  if (list.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text3)">No labels in this tab yet — click "＋ Add Label"</div>`;
    return;
  }

  for (const l of list) {
    const src = await resolveImageSrc(l.image);
    const qty = Number(l.quantity) || 0;
    const card = document.createElement("div");
    card.className = "frag-card";
    card.innerHTML = `
      ${src
        ? `<img class="frag-card-img" src="${src}" onclick="openLightbox('${src}')" />`
        : `<div class="frag-card-emoji">🏷️</div>`}
      <div class="frag-card-name">${escapeHtml(l.name || "Unnamed")}</div>
      ${l.sizes ? `<div style="font-size:0.68rem;color:var(--text3)">Sizes: ${escapeHtml(l.sizes)}</div>` : ""}
      ${l.purchaseDate ? `<div style="font-size:0.66rem;color:var(--text3)">Bought: ${l.purchaseDate}</div>` : ""}
      <div class="frag-stock-pill good">Qty: ${qty}</div>
      <div class="card-actions">
        <button class="card-minus-btn" title="Use one" onclick="event.stopPropagation();openAmountModal({collection:'${col}',docId:'${l.id}',field:'quantity',start:${qty},unit:'qty',name:'${escapeAttr(l.name||"Label")}'},-1)">−</button>
        <button class="card-plus-btn" title="Add one" onclick="event.stopPropagation();openAmountModal({collection:'${col}',docId:'${l.id}',field:'quantity',start:${qty},unit:'qty',name:'${escapeAttr(l.name||"Label")}'},1)">+</button>
        <button class="edit-sale-btn" onclick="event.stopPropagation();openModal('label','${l.id}')" title="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="delete-sale-btn" onclick="event.stopPropagation();confirmDelete('${col}','${l.id}','label')" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    `;
    grid.appendChild(card);
  }
}

function labelCollectionForTab(tab) {
  return tab === "testers" ? "labels_testers"
       : tab === "20ml"    ? "labels_20ml"
       : tab === "50ml"    ? "labels_50ml"
       : tab === "100ml"   ? "labels_100ml"
       : tab === "card"    ? "labels_card"
       :                     "labels_sticker";
}

/* ════════════════════════════════════════════════════════════
   RENDER — PACKAGING (per-tab array)
════════════════════════════════════════════════════════════ */
function switchPackagingTab(tab, el) {
  currentPackagingTab = tab;
  document.querySelectorAll('#view-packaging .size-chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  renderPackaging();
}

async function renderPackaging() {
  const grid = document.getElementById("packagingGrid");
  if (!grid) return;

  const q = (document.getElementById("packagingSearch")?.value || "").toLowerCase();
  const col = packagingCollectionForTab(currentPackagingTab);

  const sourceMap = {
    bubble: packBubble,
    bag:    packBag,
    paper:  packPaper
  };
  const list = (sourceMap[currentPackagingTab] || []).filter(p =>
    !q || (p.name||"").toLowerCase().includes(q)
  );

  grid.innerHTML = "";
  if (list.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text3)">Nothing here yet — click "＋ Add Item"</div>`;
    return;
  }

  for (const p of list) {
    const src = await resolveImageSrc(p.image);
    const qty = Number(p.quantity) || 0;
    const card = document.createElement("div");
    card.className = "frag-card";
    card.innerHTML = `
      ${src
        ? `<img class="frag-card-img" src="${src}" onclick="openLightbox('${src}')" />`
        : `<div class="frag-card-emoji">🛍️</div>`}
      <div class="frag-card-name">${escapeHtml(p.name || "Unnamed")}</div>
      ${p.purchaseDate ? `<div style="font-size:0.66rem;color:var(--text3)">Bought: ${p.purchaseDate}</div>` : ""}
      <div class="frag-stock-pill good">Qty: ${qty}</div>
      <div class="card-actions">
        <button class="card-minus-btn" title="Use one" onclick="event.stopPropagation();openAmountModal({collection:'${col}',docId:'${p.id}',field:'quantity',start:${qty},unit:'qty',name:'${escapeAttr(p.name||"Item")}'},-1)">−</button>
        <button class="card-plus-btn" title="Add one" onclick="event.stopPropagation();openAmountModal({collection:'${col}',docId:'${p.id}',field:'quantity',start:${qty},unit:'qty',name:'${escapeAttr(p.name||"Item")}'},1)">+</button>
        <button class="edit-sale-btn" onclick="event.stopPropagation();openModal('packaging','${p.id}')" title="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="delete-sale-btn" onclick="event.stopPropagation();confirmDelete('${col}','${p.id}','item')" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    `;
    grid.appendChild(card);
  }
}

function packagingCollectionForTab(tab) {
  return tab === "bubble" ? "packaging_bubble"
       : tab === "bag"    ? "packaging_bag"
       :                    "packaging_paper";
}

/* ════════════════════════════════════════════════════════════
   DELETE — custom confirm + GitHub image cleanup
════════════════════════════════════════════════════════════ */
function confirmDelete(colName, id, label = "item") {
  const cap = label.charAt(0).toUpperCase() + label.slice(1);
  openConfirmModal(
    "Delete " + cap + "?",
    "This will permanently delete this " + label + " (and its image from GitHub). This action cannot be undone.",
    async () => {
      const removed = findItemByCollection(colName, id);

      if (removed && removed.image) {
        try {
          await deleteImageFromGitHub(removed.image);
        } catch (imgErr) {
          console.warn("Image delete failed (continuing with doc delete):", imgErr);
        }
      }

      try {
        await deleteDoc(doc(db, colName, id));
        showToast("Deleted ✅", "success");
        notifyChange({
          collection: colName,
          action: "deleted",
          item: itemLabel(removed) || cap,
          details: describeFields(removed || {})
        });
      } catch (err) {
        console.error(err);
        showToast("Delete failed: " + err.message, "error");
      }
    },
    "Delete"
  );
}

/* ════════════════════════════════════════════════════════════
   MODAL — OPEN
════════════════════════════════════════════════════════════ */
async function openModal(section, id = null) {
  modalSection  = section;
  modalEditId   = id;
  modalImageUrl = "";

  const titleEl = document.getElementById("modalTitle");
  const bodyEl  = document.getElementById("modalBody");

  let fields = [];
  let titleText = "";
  let currentItem = null;

  if (id) {
    const col = collectionForSection(section);
    const snap = await getDoc(doc(db, col, id));
    if (snap.exists()) currentItem = { id, ...snap.data() };
  }

  if (section === "todo") {
    titleText = id ? "Edit Task" : "Add Task";
    fields = [
      { key: "title",    label: "Title *",     type: "text",     value: currentItem?.title || "" },
      { key: "priority", label: "Priority",    type: "select",   value: currentItem?.priority || "MEDIUM", options: ["HIGH","MEDIUM","LOW"] },
      { key: "dueDate",  label: "Due Date",    type: "date",     value: currentItem?.dueDate || "" },
      { key: "status",   label: "Status",      type: "select",   value: currentItem?.status || "PENDING", options: ["PENDING","DONE"] },
      { key: "notes",    label: "Notes",       type: "textarea", value: currentItem?.notes || "" },
    ];
  } else if (section === "change") {
    titleText = id ? "Edit Change" : "Add Change";
    fields = [
      { key: "title",       label: "Title *",     type: "text",     value: currentItem?.title || "" },
      { key: "category",    label: "Category",    type: "select",   value: currentItem?.category || "NEW", options: ["NEW","UPDATE","FIX","REMOVED"] },
      { key: "date",        label: "Date",        type: "date",     value: currentItem?.date || new Date().toISOString().split("T")[0] },
      { key: "description", label: "Description", type: "textarea", value: currentItem?.description || "" },
    ];
  } else if (section === "expense") {
    titleText = id ? "Edit Expense" : "Add Expense";
    fields = [
      { key: "title",   label: "Title *",         type: "text",     value: currentItem?.title || "" },
      { key: "amount",  label: "Amount (₹) *",    type: "number",   value: currentItem?.amount || "" },
      { key: "notes",   label: "Notes *",         type: "textarea", value: currentItem?.notes || "" },
      { key: "payment", label: "Mode of Payment *", type: "select",
        value: currentItem?.payment || "Paid Cash",
        options: ["Paid Cash", "Paid Online"] },
      { key: "date",     label: "Date",           type: "date",     value: currentItem?.date || new Date().toISOString().split("T")[0] },
      { key: "priority", label: "Priority",       type: "select",   value: currentItem?.priority || "MEDIUM", options: ["HIGH","MEDIUM","LOW"] },
      { key: "status",   label: "Status",         type: "select",   value: currentItem?.status || "PENDING", options: ["PENDING","DONE"] },
    ];
  } else if (section === "frag") {
    titleText = id ? "Edit Fragrance" : "Add Fragrance";
    fields = [
      { key: "name",         label: "Name *",        type: "text",     value: currentItem?.name || "" },
      { key: "brand",        label: "Brand",         type: "text",     value: currentItem?.brand || "" },
      { key: "sizes",        label: "Available ML",  type: "text",     value: currentItem?.sizes || "", placeholder: "e.g. 50ml, 100ml, 200ml" },
      { key: "quantity",     label: "Quantity",      type: "qty",      value: currentItem?.quantity || 1 },
      { key: "purchaseDate", label: "Purchase Date", type: "date",     value: currentItem?.purchaseDate || "" },
      { key: "notes",        label: "Notes",         type: "textarea", value: currentItem?.notes || "" },
    ];
    if (!id) {
      fields.unshift({
        key: "fragTab", label: "Add To *", type: "select",
        value: currentFragTab, options: ["have","add","remove"],
        optionLabels: { have: "📦 We Have", add: "🟢 To Add", remove: "🔴 To Remove" }
      });
    }
  } else if (section === "ethonol") {
    titleText = id ? "Edit Ethanol" : "Add Ethanol";
    fields = [
      { key: "name",         label: "Name *",         type: "text",     value: currentItem?.name || "", placeholder: "e.g. Ethanol Batch A" },
      { key: "ml",           label: "Available (ml)", type: "qty",      value: currentItem?.ml || 500 },
      { key: "purchaseDate", label: "Purchase Date",  type: "date",     value: currentItem?.purchaseDate || "" },
      { key: "notes",        label: "Notes",          type: "textarea", value: currentItem?.notes || "" },
    ];
  } else if (section === "bottle") {
    titleText = id ? "Edit Bottle" : "Add Bottle";
    fields = [
      { key: "name",         label: "Name *",        type: "text",     value: currentItem?.name || "" },
      { key: "brand",        label: "Brand",         type: "text",     value: currentItem?.brand || "" },
      { key: "size",         label: "Size (ml)",     type: "select",   value: currentItem?.size || "50",
        options: ["20","30","50","100"],
        optionLabels: { "20": "20 ml", "30": "30 ml", "50": "50 ml", "100": "100 ml" } },
      { key: "quantity",     label: "Quantity",      type: "qty",      value: currentItem?.quantity || 1 },
      { key: "purchaseDate", label: "Purchase Date", type: "date",     value: currentItem?.purchaseDate || "" },
      { key: "notes",        label: "Notes",         type: "textarea", value: currentItem?.notes || "" },
    ];
  } else if (section === "tester") {
    titleText = id ? "Edit Tester" : "Add Tester";
    fields = [
      { key: "name",         label: "Name *",        type: "text",     value: currentItem?.name || "" },
      { key: "brand",        label: "Brand",         type: "text",     value: currentItem?.brand || "" },
      { key: "quantity",     label: "Quantity",      type: "qty",      value: currentItem?.quantity || 1 },
      { key: "purchaseDate", label: "Purchase Date", type: "date",     value: currentItem?.purchaseDate || "" },
      { key: "location",     label: "Location",      type: "text",     value: currentItem?.location || "" },
      { key: "notes",        label: "Notes",         type: "textarea", value: currentItem?.notes || "" },
    ];
  } else if (section === "box") {
    titleText = id ? "Edit Box" : "Add Box";
    fields = [
      { key: "name",         label: "Name *",        type: "text",     value: currentItem?.name || "" },
      { key: "quantity",     label: "Quantity",      type: "qty",      value: currentItem?.quantity || 1 },
      { key: "purchaseDate", label: "Purchase Date", type: "date",     value: currentItem?.purchaseDate || "" },
      { key: "sizes",        label: "Sizes",         type: "text",     value: currentItem?.sizes || "", placeholder: "e.g. small, medium, large" },
      { key: "notes",        label: "Notes",         type: "textarea", value: currentItem?.notes || "" },
    ];
    if (!id) {
      fields.unshift({
        key: "boxTab", label: "Add To *", type: "select",
        value: currentBoxTab, options: ["testers","20ml","50ml","100ml","combo"],
        optionLabels: { testers: "Testers", "20ml": "20 ml", "50ml": "50 ml", "100ml": "100 ml", combo: "Combo Box" }
      });
    }
  } else if (section === "label") {
    titleText = id ? "Edit Label" : "Add Label";
    fields = [
      { key: "name",         label: "Name *",        type: "text",     value: currentItem?.name || "" },
      { key: "quantity",     label: "Quantity",      type: "qty",      value: currentItem?.quantity || 1 },
      { key: "purchaseDate", label: "Purchase Date", type: "date",     value: currentItem?.purchaseDate || "" },
      { key: "sizes",        label: "Sizes",         type: "text",     value: currentItem?.sizes || "", placeholder: "e.g. small, medium" },
      { key: "notes",        label: "Notes",         type: "textarea", value: currentItem?.notes || "" },
    ];
    if (!id) {
      fields.unshift({
        key: "labelTab", label: "Add To *", type: "select",
        value: currentLabelTab, options: ["testers","20ml","50ml","100ml","card","sticker"],
        optionLabels: { testers: "Testers", "20ml": "20 ml", "50ml": "50 ml", "100ml": "100 ml", card: "Thank You Card", sticker: "Sticker" }
      });
    }
  } else if (section === "packaging") {
    titleText = id ? "Edit Packaging" : "Add Packaging";
    fields = [
      { key: "name",         label: "Name *",        type: "text",     value: currentItem?.name || "" },
      { key: "quantity",     label: "Quantity",      type: "qty",      value: currentItem?.quantity || 1 },
      { key: "purchaseDate", label: "Purchase Date", type: "date",     value: currentItem?.purchaseDate || "" },
      { key: "notes",        label: "Notes",         type: "textarea", value: currentItem?.notes || "" },
    ];
    if (!id) {
      fields.unshift({
        key: "packagingTab", label: "Add To *", type: "select",
        value: currentPackagingTab, options: ["bubble","bag","paper"],
        optionLabels: { bubble: "Bubble Roll", bag: "Packing Bag", paper: "Paper Hand Bag" }
      });
    }
  }

  titleEl.textContent = titleText;

  let html = "";
  for (const f of fields) {
    if (f.type === "select") {
      const opts = f.options.map(o => {
        const lbl = f.optionLabels ? f.optionLabels[o] : o;
        return `<option value="${o}" ${String(f.value)===String(o) ? "selected" : ""}>${lbl}</option>`;
      }).join("");
      html += `
        <div class="edit-row">
          <label>${f.label}</label>
          <select class="field-input" data-key="${f.key}">${opts}</select>
        </div>`;
    } else if (f.type === "textarea") {
      html += `
        <div class="edit-row">
          <label>${f.label}</label>
          <textarea class="field-input" data-key="${f.key}" rows="3" placeholder="${f.placeholder||''}">${escapeHtml(f.value)}</textarea>
        </div>`;
    } else if (f.type === "qty") {
      html += `
        <div class="edit-row">
          <label>${f.label}</label>
          <div class="qty-control">
            <button class="qty-btn" type="button" onclick="modalChangeQty('${f.key}',-1)">−</button>
            <input type="number" data-key="${f.key}" value="${escapeHtml(String(f.value))}" min="0" />
            <button class="qty-btn" type="button" onclick="modalChangeQty('${f.key}',1)">+</button>
          </div>
        </div>`;
    } else if (f.type === "date") {
      html += `
        <div class="edit-row">
          <label>${f.label}</label>
          <div class="date-input-wrap">
            <input class="field-input" type="text" readonly data-key="${f.key}"
                   value="${escapeHtml(String(f.value))}"
                   placeholder="Select date…"
                   onclick="openDatePicker(this)" />
            <svg class="date-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          </div>
        </div>`;
    } else {
      html += `
        <div class="edit-row">
          <label>${f.label}</label>
          <input class="field-input" type="${f.type}" data-key="${f.key}"
                 value="${escapeHtml(String(f.value))}"
                 placeholder="${f.placeholder||''}" />
        </div>`;
    }
  }

  if (section === "expense") {
    html += `
      <div id="expenseWarn" style="display:none;padding:10px 14px;background:rgba(217,79,79,0.08);border:1px solid rgba(217,79,79,0.25);border-radius:10px;font-size:0.78rem;color:var(--red);margin-top:4px;line-height:1.4"></div>
    `;
  }

  html += `
    <div class="edit-row" style="margin-top:6px;border-top:1px solid rgba(210,195,175,0.35);padding-top:14px">
      <label>${section === "expense" ? "Receipt Image" : "Image"}</label>
      <div id="modalImgPreview" style="margin-bottom:8px"></div>
      <input type="file" id="modalImgInput" accept="image/*" class="field-input" onchange="handleModalImageSelect(event)" />
      <div id="modalImgStatus" style="font-size:0.74rem;color:var(--text3);margin-top:6px"></div>
    </div>
  `;

  bodyEl.innerHTML = html;
  enhanceAllSelects(bodyEl);

  if (section === "expense") {
    bodyEl.querySelectorAll("[data-key]").forEach(el => {
      el.addEventListener("input", updateExpenseWarning);
      el.addEventListener("change", updateExpenseWarning);
    });
  }

  if (currentItem?.image) {
    modalImageUrl = currentItem.image;
    renderModalImagePreview();
  }
  if (section === "expense") updateExpenseWarning();

  document.getElementById("genericModal").style.display = "flex";
}

function updateExpenseWarning() {
  const warnEl = document.getElementById("expenseWarn");
  if (!warnEl) return;

  const getVal = (k) => {
    const el = document.querySelector(`#modalBody [data-key="${k}"]`);
    return el ? el.value : "";
  };

  const payment = (getVal("payment") || "").toLowerCase();
  const notes   = (getVal("notes")   || "").trim();

  const problems = [];
  if (!notes) problems.push("Notes is required");
  if (payment.includes("online") && !modalImageUrl) problems.push("Receipt image is required for online payments");

  if (problems.length) {
    warnEl.style.display = "block";
    warnEl.textContent = "⚠ " + problems.join(" · ");
  } else {
    warnEl.style.display = "none";
    warnEl.textContent = "";
  }
}

function modalChangeQty(key, delta) {
  const input = document.querySelector(`#modalBody [data-key="${key}"]`);
  if (!input) return;
  let val = Number(input.value) || 0;
  val += delta;
  if (val < 0) val = 0;
  input.value = val;
}

function collectionForSection(section) {
  return {
    todo:      "todo_items",
    change:    "new_changes",
    expense:   "expenses_items",
    frag:      fragCollection(currentFragTab),
    ethonol:   "ethonol_items",
    bottle:    "perfume_bottles",
    tester:    "testers",
    box:       boxCollectionForTab(currentBoxTab),
    label:     labelCollectionForTab(currentLabelTab),
    packaging: packagingCollectionForTab(currentPackagingTab)
  }[section];
}

/* ───────── MODAL IMAGE HANDLING ───────── */
async function handleModalImageSelect(ev) {
  const file = ev.target.files[0];
  if (!file) return;

  const statusEl = document.getElementById("modalImgStatus");
  statusEl.textContent = "Uploading to GitHub…";
  modalUploading = true;

  const folderMap = {
    todo:      "todo",
    change:    "changes",
    expense:   "expenses",
    frag:      "fragrances",
    ethonol:   "ethonol",
    bottle:    "bottles",
    tester:    "testers",
    box:       "boxes",
    label:     "labels",
    packaging: "packaging"
  };
  const folder = folderMap[modalSection] || "misc";

  try {
    const { path } = await uploadImageToGitHub(file, folder);
    modalImageUrl = "ghapi:" + path;
    statusEl.textContent = "✅ Uploaded";
    renderModalImagePreview();
    if (modalSection === "expense") updateExpenseWarning();
  } catch (err) {
    console.error(err);
    statusEl.textContent = "❌ Upload failed: " + err.message;
    showToast("Image upload failed", "error");
  } finally {
    modalUploading = false;
  }
}

async function renderModalImagePreview() {
  const box = document.getElementById("modalImgPreview");
  if (!box) return;
  const src = await resolveImageSrc(modalImageUrl);
  if (!src) { box.innerHTML = ""; return; }
  box.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px">
      <img src="${src}" style="width:80px;height:80px;object-fit:cover;border-radius:10px;border:1px solid rgba(210,195,175,0.5)" />
      <button class="toolbar-btn clear-btn" onclick="clearModalImage()" style="padding:6px 12px;font-size:0.75rem">Remove Image</button>
    </div>`;
}

function clearModalImage() {
  modalImageUrl = "";
  document.getElementById("modalImgPreview").innerHTML = "";
  document.getElementById("modalImgInput").value = "";
  document.getElementById("modalImgStatus").textContent = "";
  if (modalSection === "expense") updateExpenseWarning();
}

/* ════════════════════════════════════════════════════════════
   MODAL — SAVE
════════════════════════════════════════════════════════════ */
async function saveModal() {
  if (modalUploading) { showToast("Please wait for image upload…", "error"); return; }

  const bodyEl = document.getElementById("modalBody");
  const inputs = bodyEl.querySelectorAll("[data-key]");
  const data   = {};

  for (const inp of inputs) {
    const key = inp.dataset.key;
    let val = inp.value;
    if (inp.type === "number" && val !== "") val = parseFloat(val);
    data[key] = val;
  }

  const requiredMap = {
    todo:      "title",
    change:    "title",
    expense:   "title",
    frag:      "name",
    ethonol:   "name",
    bottle:    "name",
    tester:    "name",
    box:       "name",
    label:     "name",
    packaging: "name"
  };
  const reqKey = requiredMap[modalSection];
  if (reqKey && (!data[reqKey] || !data[reqKey].toString().trim())) {
    showToast("Please fill in required fields", "error");
    return;
  }

  if (modalSection === "expense") {
    const notes = (data.notes || "").toString().trim();
    const isOnline = (data.payment || "").toLowerCase().includes("online");

    if (!notes) {
      showToast("Notes is required for every expense", "error");
      updateExpenseWarning();
      return;
    }
    if (isOnline && !modalImageUrl) {
      showToast("Receipt image is required for online payments", "error");
      updateExpenseWarning();
      return;
    }
  }

  data.image = modalImageUrl || "";

  let targetCollection = collectionForSection(modalSection);

  if (modalSection === "frag" && data.fragTab) {
    targetCollection = fragCollection(data.fragTab);
    delete data.fragTab;
  } else if (modalSection === "box" && data.boxTab) {
    targetCollection = boxCollectionForTab(data.boxTab);
    delete data.boxTab;
  } else if (modalSection === "label" && data.labelTab) {
    targetCollection = labelCollectionForTab(data.labelTab);
    delete data.labelTab;
  } else if (modalSection === "packaging" && data.packagingTab) {
    targetCollection = packagingCollectionForTab(data.packagingTab);
    delete data.packagingTab;
  }

  if (modalEditId) {
    data.updatedAt = Date.now();
    data.updatedBy = NAME_MAP[currentUser] || currentUser;
  } else {
    data.createdAt = Date.now();
    data.createdBy = NAME_MAP[currentUser] || currentUser;
  }

  try {
    if (modalEditId) {
      let before = null;
      try {
        const snapBefore = await getDoc(doc(db, targetCollection, modalEditId));
        if (snapBefore.exists()) before = snapBefore.data();
      } catch (_) {}

      if (before && before.image && before.image !== data.image) {
        try {
          await deleteImageFromGitHub(before.image);
        } catch (imgErr) {
          console.warn("Old image delete failed:", imgErr);
        }
      }

      await setDoc(doc(db, targetCollection, modalEditId), data, { merge: true });
      showToast("Saved ✅", "success");
      const changed = diffFields(before, data);
      if (changed.length) {
        notifyChange({ collection: targetCollection, action: "edited", item: itemLabel(data), changes: changed });
      }
    } else {
      await addDoc(collection(db, targetCollection), data);
      showToast("Added ✅", "success");
      notifyChange({ collection: targetCollection, action: "added", item: itemLabel(data), details: describeFields(data) });
    }
    closeModal();
  } catch (err) {
    console.error(err);
    showToast("Save failed: " + err.message, "error");
  }
}

function closeModal() {
  document.getElementById("genericModal").style.display = "none";
  document.getElementById("modalBody").innerHTML = "";
  modalSection = null;
  modalEditId  = null;
  modalImageUrl = "";
}

/* ════════════════════════════════════════════════════════════
   MZ AROMAS PRICE LIST
════════════════════════════════════════════════════════════ */
const MZ_PRICE_LIST = [
  { s:1,   name:"AJMAL AURAM SPL",                       mz:12000, half:6000,  ml10:1220 },
  { s:2,   name:"AJMAL BLU",                              mz:4200,  half:2100,  ml10:440  },
  { s:3,   name:"AJMAL BLUE MOON",                        mz:4400,  half:2200,  ml10:460  },
  { s:4,   name:"AJMAL DUBAI OUD",                        mz:16200, half:8100,  ml10:1640 },
  { s:5,   name:"AJMAL MUSK RIJALI GOLD",                 mz:11000, half:5500,  ml10:1120 },
  { s:6,   name:"AJMAL MUSK RIJALI SPL",                  mz:16600, half:8300,  ml10:1680 },
  { s:7,   name:"AJMAL MUSK ROSE",                        mz:4800,  half:2400,  ml10:500  },
  { s:8,   name:"AJMAL RAIN DROP",                        mz:4800,  half:2400,  ml10:500  },
  { s:9,   name:"AL REHAB OUD ROSE",                      mz:5800,  half:2900,  ml10:600  },
  { s:10,  name:"AL HARMAIN MADINA",                      mz:5200,  half:2600,  ml10:540  },
  { s:11,  name:"AL NUAIM CHOCOLATE MUSK",                mz:1800,  half:900,   ml10:200  },
  { s:12,  name:"AL NUAIM ORIGINAL XX",                   mz:3400,  half:1700,  ml10:360  },
  { s:13,  name:"AL REHAB ASEEL",                         mz:4400,  half:2200,  ml10:460  },
  { s:14,  name:"AL REHAB LOVELY",                        mz:3000,  half:1500,  ml10:320  },
  { s:15,  name:"AL REHAB SABAYA",                        mz:3600,  half:1800,  ml10:380  },
  { s:16,  name:"AL REHAB TYPE CHELSEA",                  mz:4000,  half:2000,  ml10:420  },
  { s:17,  name:"AL REHAB TYPE SOFTY",                    mz:2800,  half:1400,  ml10:300  },
  { s:18,  name:"ALLURE HOMME SPORTS",                    mz:3400,  half:1700,  ml10:360  },
  { s:19,  name:"AL-NUAIM KASHMIRI OUD",                  mz:10400, half:5200,  ml10:1060 },
  { s:20,  name:"AL-NUAIM KASHMIRI OUD SUPER",            mz:6000,  half:3000,  ml10:620  },
  { s:21,  name:"AL-NUAIM NAZNEEN",                       mz:3600,  half:1800,  ml10:380  },
  { s:22,  name:"AL-NUAIM OUDH",                          mz:6200,  half:3100,  ml10:640  },
  { s:23,  name:"AL-REHAB SHADHA",                        mz:4000,  half:2000,  ml10:420  },
  { s:24,  name:"AL-REHAB TYPE LORDS",                    mz:4800,  half:2400,  ml10:500  },
  { s:25,  name:"AMOUAGE GOLD POUR FEMME",                mz:6600,  half:3300,  ml10:680  },
  { s:26,  name:"AMOUAGE JUBILATION XXV",                 mz:6200,  half:3100,  ml10:640  },
  { s:27,  name:"AMOUAGE REFLECTION",                     mz:5400,  half:2700,  ml10:560  },
  { s:28,  name:"ANTONIO BANDERAS BLUE SEDUCTION",        mz:6000,  half:3000,  ml10:620  },
  { s:29,  name:"AQUA BREEZE",                            mz:4000,  half:2000,  ml10:420  },
  { s:30,  name:"ARABIAN OUD KALEMAT OUD",                mz:5000,  half:2500,  ml10:520  },
  { s:31,  name:"ARABIYAT LAMSAT HARRIR",                 mz:4400,  half:2200,  ml10:460  },
  { s:32,  name:"ARD AL ZAAFARAN DIRHAM",                 mz:3800,  half:1900,  ml10:400  },
  { s:33,  name:"ARMAF CLUB DE NUIT ICONIC",              mz:4800,  half:2400,  ml10:500  },
  { s:34,  name:"ARMAF CLUB DE NUIT INTENSE",             mz:10000, half:5000,  ml10:1020 },
  { s:35,  name:"ARMAF CLUB DE NUIT UNTOLD",              mz:4000,  half:2000,  ml10:420  },
  { s:36,  name:"ARMAF CLUB DE NUIT WOMEN",               mz:4800,  half:2400,  ml10:500  },
  { s:37,  name:"ARMAF DUBAI CHOCOLATE",                  mz:5400,  half:2700,  ml10:560  },
  { s:38,  name:"ARMANI AQUA DI GIO",                     mz:3400,  half:1700,  ml10:360  },
  { s:39,  name:"ARMANI AQUA DI GIO PROFUMO",             mz:5000,  half:2500,  ml10:520  },
  { s:40,  name:"ARMANI CODE",                            mz:4200,  half:2100,  ml10:440  },
  { s:41,  name:"ARMANI MY WAY",                          mz:4800,  half:2400,  ml10:500  },
  { s:42,  name:"ARMANI SI PASSION",                      mz:4800,  half:2400,  ml10:500  },
  { s:43,  name:"ARMANI SI ROSE SIGNATURE",               mz:5600,  half:2800,  ml10:580  },
  { s:44,  name:"ARMANI STRONGER WITH YOU INTENSELY",     mz:5400,  half:2700,  ml10:560  },
  { s:45,  name:"ATTARFULL LG",                           mz:2200,  half:1100,  ml10:240  },
  { s:46,  name:"AVON GOLD RARE",                         mz:6000,  half:3000,  ml10:620  },
  { s:47,  name:"AZZARO CHROME",                          mz:2600,  half:1300,  ml10:280  },
  { s:48,  name:"AZZARO MOST WANTED",                     mz:6000,  half:3000,  ml10:620  },
  { s:49,  name:"BATH AND BODY WORKS DAHLIA",             mz:4200,  half:2100,  ml10:440  },
  { s:50,  name:"BATH AND BODY WORKS INTO THE NIGHTS",    mz:3600,  half:1800,  ml10:380  },
  { s:51,  name:"BATH AND BODY WORKS PINK CHIFFON",       mz:3400,  half:1700,  ml10:360  },
  { s:52,  name:"BATH AND BODY WORKS VAMPIRE BLOOD",      mz:5200,  half:2600,  ml10:540  },
  { s:53,  name:"BLACK MASK",                             mz:4400,  half:2200,  ml10:460  },
  { s:54,  name:"BLACKBERRY MUSK WOMEN (CREATION)",       mz:4400,  half:2200,  ml10:460  },
  { s:55,  name:"BLUE DE INFUSION (CREATION)",            mz:4200,  half:2100,  ml10:440  },
  { s:56,  name:"BLUEBERRY MUSK",                         mz:4600,  half:2300,  ml10:480  },
  { s:57,  name:"BOND NO.9 NEW YORK OUD SPL",             mz:10000, half:5000,  ml10:1020 },
  { s:58,  name:"BOND NO.9 NEW YORK OUD SUPER",           mz:6400,  half:3200,  ml10:660  },
  { s:59,  name:"BRITNEY SPEARS MIDNIGHT",                mz:3400,  half:1700,  ml10:360  },
  { s:60,  name:"BRUT",                                   mz:2800,  half:1400,  ml10:300  },
  { s:61,  name:"BURBERRY BODY",                          mz:4000,  half:2000,  ml10:420  },
  { s:62,  name:"BURBERRY FOR HER",                       mz:4400,  half:2200,  ml10:460  },
  { s:63,  name:"BVLGARI AQUA",                           mz:5400,  half:2700,  ml10:560  },
  { s:64,  name:"BVLGARI BLACK VINTAGE",                  mz:3000,  half:1500,  ml10:320  },
  { s:65,  name:"BVLGARI TYGAR",                          mz:12000, half:6000,  ml10:1220 },
  { s:66,  name:"CAROLINA HERRERA 212 MEN SPL",           mz:6000,  half:3000,  ml10:620  },
  { s:67,  name:"CAROLINA HERRERA BAD BOY",               mz:5000,  half:2500,  ml10:520  },
  { s:68,  name:"CAROLINA HERRERA GOOD GIRL",             mz:4200,  half:2100,  ml10:440  },
  { s:69,  name:"CAROLINA HERRERA GOOD GIRL RED VELVET",  mz:5000,  half:2500,  ml10:520  },
  { s:70,  name:"CARTIER PASHA DE CARTIER",               mz:4000,  half:2000,  ml10:420  },
  { s:71,  name:"CARTIER ROADSTER",                       mz:6000,  half:3000,  ml10:620  },
  { s:72,  name:"CHANEL BLUE DE CHANEL",                  mz:5000,  half:2500,  ml10:520  },
  { s:73,  name:"CHANEL COCO MADEMOISELLE",               mz:4800,  half:2400,  ml10:500  },
  { s:74,  name:"CHANEL NO. 5",                           mz:3200,  half:1600,  ml10:340  },
  { s:75,  name:"CHERRY SPL",                             mz:2400,  half:1200,  ml10:260  },
  { s:76,  name:"CK ETERNITY WOMEN / ETERNA",             mz:2800,  half:1400,  ml10:300  },
  { s:77,  name:"CK ONE",                                 mz:3600,  half:1800,  ml10:380  },
  { s:78,  name:"COBRA",                                  mz:2600,  half:1300,  ml10:280  },
  { s:79,  name:"CREED GREEN IRISH TWEED",                mz:5000,  half:2500,  ml10:520  },
  { s:80,  name:"D&G LIGHT BLUE MEN INTENSE",             mz:4800,  half:2400,  ml10:500  },
  { s:81,  name:"D&G THE KING",                           mz:4600,  half:2300,  ml10:480  },
  { s:82,  name:"D&G THE ONE",                            mz:6000,  half:3000,  ml10:620  },
  { s:83,  name:"DANA",                                   mz:3000,  half:1500,  ml10:320  },
  { s:84,  name:"DARK CHOCOLATE",                         mz:1800,  half:900,   ml10:200  },
  { s:85,  name:"DAVIDOFF COOL WATER MEN MZ",             mz:3000,  half:1500,  ml10:320  },
  { s:86,  name:"DAVIDOFF COOL WATER MEN SPL",            mz:3600,  half:1800,  ml10:380  },
  { s:87,  name:"DAVIDOFF COOL WATER WOMEN",              mz:3200,  half:1600,  ml10:340  },
  { s:88,  name:"DERRAH LINK BLANC",                      mz:5200,  half:2600,  ml10:540  },
  { s:89,  name:"DG GORE GARDEN BLOOM",                   mz:1600,  half:800,   ml10:180  },
  { s:90,  name:"DIOR FAHRENHEIT",                        mz:3400,  half:1700,  ml10:360  },
  { s:91,  name:"DIOR HOMME INTENSE",                     mz:4800,  half:2400,  ml10:500  },
  { s:92,  name:"DIOR HOMME INTENSE SPL",                 mz:8000,  half:4000,  ml10:820  },
  { s:93,  name:"DIOR HOMME SPORTS",                      mz:4600,  half:2300,  ml10:480  },
  { s:94,  name:"DIOR JADORE",                            mz:3200,  half:1600,  ml10:340  },
  { s:95,  name:"DIOR MISS DIOR CHERIE",                  mz:4000,  half:2000,  ml10:420  },
  { s:96,  name:"DIOR POIZON",                            mz:3200,  half:1600,  ml10:340  },
  { s:97,  name:"DIOR SAUVAGE",                           mz:5000,  half:2500,  ml10:520  },
  { s:98,  name:"DIOR SAUVAGE ELIXIR",                    mz:8000,  half:4000,  ml10:820  },
  { s:99,  name:"DIOR SAUVAGE ELIXIR SUPER",              mz:5000,  half:2500,  ml10:520  },
  { s:100, name:"DIPTYQUE TAM DAO",                       mz:5800,  half:2900,  ml10:600  },
  { s:101, name:"DOVE PINK",                              mz:1800,  half:900,   ml10:200  },
  { s:102, name:"DOVE WHITE",                             mz:1800,  half:900,   ml10:200  },
  { s:103, name:"DUNHILL DESIRE BLUE",                    mz:3400,  half:1700,  ml10:360  },
  { s:104, name:"DUNHILL DESIRE RED",                     mz:4200,  half:2100,  ml10:440  },
  { s:105, name:"DUNHILL ICON ABSOLUTE",                  mz:7800,  half:3900,  ml10:800  },
  { s:106, name:"ESCADA TAJ SUNSET",                      mz:3600,  half:1800,  ml10:380  },
  { s:107, name:"ESTEE LAUDER BEAUTIFUL BELLE PRM",       mz:11400, half:5700,  ml10:1160 },
  { s:108, name:"ESTEE LAUDER PLEASURE",                  mz:3800,  half:1900,  ml10:400  },
  { s:109, name:"FANTASIA SHK",                           mz:5000,  half:2500,  ml10:520  },
  { s:110, name:"FERRARI BLACK",                          mz:3600,  half:1800,  ml10:380  },
  { s:111, name:"FIXATURE",                               mz:6000,  half:3000,  ml10:620  },
  { s:112, name:"GISSAH AKOYA",                           mz:8000,  half:4000,  ml10:820  },
  { s:113, name:"GISSAH HUDSON VALLEY",                   mz:9400,  half:4700,  ml10:960  },
  { s:114, name:"GISSAH IMPERIAL VALLEY",                 mz:10000, half:5000,  ml10:1020 },
  { s:115, name:"GISSAH LA LUNA",                         mz:6000,  half:3000,  ml10:620  },
  { s:116, name:"GIVENCHY AMARIAGE",                      mz:2600,  half:1300,  ml10:280  },
  { s:117, name:"GIVENCHY BLUE",                          mz:4400,  half:2200,  ml10:460  },
  { s:118, name:"GIVENCHY GENTLEMEN",                     mz:4000,  half:2000,  ml10:420  },
  { s:119, name:"GOLD SANDAL",                            mz:3600,  half:1800,  ml10:380  },
  { s:120, name:"GOLDEN DUST",                            mz:3000,  half:1500,  ml10:320  },
  { s:121, name:"GREEN AJMERI",                           mz:8000,  half:4000,  ml10:820  },
  { s:122, name:"GUCCI FLORA",                            mz:3600,  half:1800,  ml10:380  },
  { s:123, name:"GUCCI FLORA BY GUCCI EAU",               mz:5000,  half:2500,  ml10:520  },
  { s:124, name:"GUCCI FLORA GORGEOUS GARDENIA",          mz:4400,  half:2200,  ml10:460  },
  { s:125, name:"GUCCI GUILTY POUR HOMME",                mz:4000,  half:2000,  ml10:420  },
  { s:126, name:"GUERLAIN SAMSARA",                       mz:5800,  half:2900,  ml10:600  },
  { s:127, name:"GUESS SEDUCTIVE",                        mz:4400,  half:2200,  ml10:460  },
  { s:128, name:"HUGO BOSS PREMIUM",                      mz:6400,  half:3200,  ml10:660  },
  { s:129, name:"HUGO BOSS WOMEN",                        mz:3200,  half:1600,  ml10:340  },
  { s:130, name:"IBRAHIM AL QURAISHI BLUE OUD",           mz:20000, half:10000, ml10:2020 },
  { s:131, name:"ICEBERG",                                mz:2800,  half:1400,  ml10:300  },
  { s:132, name:"INITIO OUD FOR GREATNESS",               mz:9000,  half:4500,  ml10:920  },
  { s:133, name:"ISSEY MIYAKE MEN",                       mz:4000,  half:2000,  ml10:420  },
  { s:134, name:"ISSEY MIYAKE MEN PREMIUM",               mz:5800,  half:2900,  ml10:600  },
  { s:135, name:"JAGUAR BLACK",                           mz:4000,  half:2000,  ml10:420  },
  { s:136, name:"JOOP",                                   mz:2600,  half:1300,  ml10:280  },
  { s:137, name:"JOVAN MUSK",                             mz:3200,  half:1600,  ml10:340  },
  { s:138, name:"JPG LE MALE",                            mz:3200,  half:1600,  ml10:340  },
  { s:139, name:"JPG LE MALE ELIXIR",                     mz:5000,  half:2500,  ml10:520  },
  { s:140, name:"JPG ULTRA MALE",                         mz:4000,  half:2000,  ml10:420  },
  { s:141, name:"KASTURI",                                mz:4400,  half:2200,  ml10:460  },
  { s:142, name:"KAYALI VANILLA 28",                      mz:5800,  half:2900,  ml10:600  },
  { s:143, name:"KESAR CHANDAN",                          mz:6000,  half:3000,  ml10:620  },
  { s:144, name:"KHADLAJ HAREEM AL SULTAN",               mz:4400,  half:2200,  ml10:460  },
  { s:145, name:"KHALIS PERFUMES JAWAD AL LAYL",          mz:3600,  half:1800,  ml10:380  },
  { s:146, name:"KILLIAN ANGEL'S SHARE",                  mz:4400,  half:2200,  ml10:460  },
  { s:147, name:"KUNAFA CHOCOLATE",                       mz:5000,  half:2500,  ml10:520  },
  { s:148, name:"LABBAIK",                                mz:2000,  half:1000,  ml10:220  },
  { s:149, name:"LACOSTE WHITE L.12.12",                  mz:4200,  half:2100,  ml10:440  },
  { s:150, name:"LANCOME LA VIE EST BELLE FLORALE SPL",   mz:7000,  half:3500,  ml10:720  },
  { s:151, name:"LANCOME POEME",                          mz:2800,  half:1400,  ml10:300  },
  { s:152, name:"LATAFFAH BADEE AL OUD",                  mz:9000,  half:4500,  ml10:920  },
  { s:153, name:"LATAFFAH KHAMRAH",                       mz:4400,  half:2200,  ml10:460  },
  { s:154, name:"LATTAFA AMEER AL OUD MZ",                mz:3600,  half:1800,  ml10:380  },
  { s:155, name:"LATTAFA AMEER AL OUD SPL",               mz:4600,  half:2300,  ml10:480  },
  { s:156, name:"LATTAFA ANA ABIYEDH",                    mz:7000,  half:3500,  ml10:720  },
  { s:157, name:"LATTAFA ANA ABIYEDH ROUGE",              mz:4000,  half:2000,  ml10:420  },
  { s:158, name:"LATTAFA ASAD",                           mz:10000, half:5000,  ml10:1020 },
  { s:159, name:"LATTAFA FAKHAR",                         mz:4400,  half:2200,  ml10:460  },
  { s:160, name:"LATTAFA KHAMRAH QAHWA",                  mz:5400,  half:2700,  ml10:560  },
  { s:161, name:"LATTAFA KHAMRAH WAHA",                   mz:9000,  half:4500,  ml10:920  },
  { s:162, name:"LATTAFA NAJDIA",                         mz:6000,  half:3000,  ml10:620  },
  { s:163, name:"LATTAFA OUD MOOD",                       mz:6000,  half:3000,  ml10:620  },
  { s:164, name:"LATTAFA RAMZ SILVER",                    mz:4000,  half:2000,  ml10:420  },
  { s:165, name:"LATTAFA RAVE NOW",                       mz:4800,  half:2400,  ml10:500  },
  { s:166, name:"LATTAFA VELVET OUD",                     mz:4600,  half:2300,  ml10:480  },
  { s:167, name:"LATTAFA YARA",                           mz:3600,  half:1800,  ml10:380  },
  { s:168, name:"LV AFTERNOON SWIM",                      mz:9000,  half:4500,  ml10:920  },
  { s:169, name:"LV CITY OF STARS",                       mz:5600,  half:2800,  ml10:580  },
  { s:170, name:"LV IMAGINATION",                         mz:6000,  half:3000,  ml10:620  },
  { s:171, name:"LV IMAGINATION SPL",                     mz:12000, half:6000,  ml10:1220 },
  { s:172, name:"LV OMBRE NOMADE",                        mz:6600,  half:3300,  ml10:680  },
  { s:173, name:"MAGNET",                                 mz:3600,  half:1800,  ml10:380  },
  { s:174, name:"MAISON CRIVELLI OUD MARACUJA",           mz:8000,  half:4000,  ml10:820  },
  { s:175, name:"MAJMUA 100",                             mz:18000, half:9000,  ml10:1820 },
  { s:176, name:"MAJMUA ECO (ONLY KG)",                   mz:1200,  half:600,   ml10:140  },
  { s:177, name:"MANCERA AQUA WOOD",                      mz:6000,  half:3000,  ml10:620  },
  { s:178, name:"MANCERA BLACK VANILLA",                  mz:3000,  half:1500,  ml10:320  },
  { s:179, name:"MANCERA RED TOBACCO",                    mz:6800,  half:3400,  ml10:700  },
  { s:180, name:"MANCERA RED TOBACCO PREMIUM",            mz:12000, half:6000,  ml10:1220 },
  { s:181, name:"MARC ANTONIO BORIS GANYMEDE",            mz:10000, half:5000,  ml10:1020 },
  { s:182, name:"MARJAAN MZ",                             mz:3000,  half:1500,  ml10:320  },
  { s:183, name:"MFK BACCARAT ROUGE 540",                 mz:4000,  half:2000,  ml10:420  },
  { s:184, name:"MFK OUD SATIN MOOD",                     mz:4200,  half:2100,  ml10:440  },
  { s:185, name:"MFK OUD SATIN MOOD SPL",                 mz:6600,  half:3300,  ml10:680  },
  { s:186, name:"MIXED FRUIT",                            mz:3200,  half:1600,  ml10:340  },
  { s:187, name:"MONT BLANC EXPLORER",                    mz:4800,  half:2400,  ml10:500  },
  { s:188, name:"MONT BLANC LEGEND",                      mz:4800,  half:2400,  ml10:500  },
  { s:189, name:"MONTALE ARABIAN TONKA",                  mz:5200,  half:2600,  ml10:540  },
  { s:190, name:"MONTALE HONEY AOUD",                     mz:7000,  half:3500,  ml10:720  },
  { s:191, name:"MUSK AL GHAZAL (CREATION)",              mz:6400,  half:3200,  ml10:660  },
  { s:192, name:"MUSK AL TAHARA JAMID WHITE",             mz:6000,  half:3000,  ml10:620  },
  { s:193, name:"NASEEM MUSK SAFI",                       mz:17000, half:8500,  ml10:1720 },
  { s:194, name:"NASEEM TYPE LAEQA",                      mz:3800,  half:1900,  ml10:400  },
  { s:195, name:"NASEEM TYPE LAMSA",                      mz:3400,  half:1700,  ml10:360  },
  { s:196, name:"OPEN",                                   mz:5800,  half:2900,  ml10:600  },
  { s:197, name:"OUD COLLECTION",                         mz:6000,  half:3000,  ml10:620  },
  { s:198, name:"OUD LAVENDAR",                           mz:7000,  half:3500,  ml10:720  },
  { s:199, name:"OUD PREMIUM",                            mz:38000, half:19000, ml10:3820 },
  { s:200, name:"OUD SENSATION (CREATION)",               mz:6200,  half:3100,  ml10:640  },
  { s:201, name:"OUDH MZ (CREATION)",                     mz:5600,  half:2800,  ml10:580  },
  { s:202, name:"PACO RABANNE BLACK XS",                  mz:3600,  half:1800,  ml10:380  },
  { s:203, name:"PACO RABANNE INVICTUS",                  mz:4400,  half:2200,  ml10:460  },
  { s:204, name:"PACO RABANNE INVICTUS AQUA",             mz:5600,  half:2800,  ml10:580  },
  { s:205, name:"PACO RABANNE LADY MILLION",              mz:4800,  half:2400,  ml10:500  },
  { s:206, name:"PACO RABANNE ONE MILLION",               mz:3800,  half:1900,  ml10:400  },
  { s:207, name:"PACO RABANNE ONE MILLION ELIXIR",        mz:5000,  half:2500,  ml10:520  },
  { s:208, name:"PACO RABANNE ONE MILLION LUCKY",         mz:4800,  half:2400,  ml10:500  },
  { s:209, name:"PACO RABANNE PHANTOM",                   mz:6600,  half:3300,  ml10:680  },
  { s:210, name:"PARLE BISCUIT",                          mz:1800,  half:900,   ml10:200  },
  { s:211, name:"PATEL NECK",                             mz:5800,  half:2900,  ml10:600  },
  { s:212, name:"PENHALIGONS THE BLAZING MR SAM",         mz:7200,  half:3600,  ml10:740  },
  { s:213, name:"PUBERTY GOLD",                           mz:9000,  half:4500,  ml10:920  },
  { s:214, name:"PUBERTY SPL",                            mz:22000, half:11000, ml10:2220 },
  { s:215, name:"PURPLE OUD MZ",                          mz:7200,  half:3600,  ml10:740  },
  { s:216, name:"RAJNIGANDHA FLOWER",                     mz:2000,  half:1000,  ml10:220  },
  { s:217, name:"RALPH LAUREN POLO SPORTS",               mz:3200,  half:1600,  ml10:340  },
  { s:218, name:"RASASI BLUE LADY",                       mz:2600,  half:1300,  ml10:280  },
  { s:219, name:"RASASI DEHNAL OUD NOKHBA",               mz:12000, half:6000,  ml10:1220 },
  { s:220, name:"RASASI ERGA MEN",                        mz:5000,  half:2500,  ml10:520  },
  { s:221, name:"RASASI FATTAN",                          mz:4000,  half:2000,  ml10:420  },
  { s:222, name:"RASASI HAWAS",                           mz:6200,  half:3100,  ml10:640  },
  { s:223, name:"RASASI HAWAS BLACK",                     mz:10000, half:5000,  ml10:1020 },
  { s:224, name:"RASASI HAWAS ELIXIR",                    mz:5000,  half:2500,  ml10:520  },
  { s:225, name:"RASASI HAWAS FIRE",                      mz:10000, half:5000,  ml10:1020 },
  { s:226, name:"RASASI HAWAS ICE",                       mz:6600,  half:3300,  ml10:680  },
  { s:227, name:"RASASI HAWAS LONDON",                    mz:8400,  half:4200,  ml10:860  },
  { s:228, name:"RASASI LA YUQAWAM POUR HOMME",           mz:4600,  half:2300,  ml10:480  },
  { s:229, name:"RASASI ROYAL BLACK",                     mz:7200,  half:3600,  ml10:740  },
  { s:230, name:"RED SPAIN",                              mz:3600,  half:1800,  ml10:380  },
  { s:231, name:"REDBULL DRINK",                          mz:3000,  half:1500,  ml10:320  },
  { s:232, name:"REEF 33",                                mz:12000, half:6000,  ml10:1220 },
  { s:233, name:"RIIFFS BLEU ABSOLU",                     mz:5000,  half:2500,  ml10:520  },
  { s:234, name:"RIIFFS IMPERIAL ROUGE",                  mz:4800,  half:2400,  ml10:500  },
  { s:235, name:"RIIFFS LOVE'S WAY",                      mz:4800,  half:2400,  ml10:500  },
  { s:236, name:"ROBERTO CAVALLI TIGER OUD",              mz:9200,  half:4600,  ml10:940  },
  { s:237, name:"ROJA DOVE SWEETIE AOUD",                 mz:8000,  half:4000,  ml10:820  },
  { s:238, name:"ROJA DOVE SWEETIE AOUD PREMIUM",         mz:12000, half:6000,  ml10:1220 },
  { s:239, name:"ROMANCE",                                mz:2600,  half:1300,  ml10:280  },
  { s:240, name:"ROSE (STRONG)",                          mz:3000,  half:1500,  ml10:320  },
  { s:241, name:"ROYAL MIRAGE (BROWN)",                   mz:5000,  half:2500,  ml10:520  },
  { s:242, name:"SABAH",                                  mz:3000,  half:1500,  ml10:320  },
  { s:243, name:"SAFFRON TOBACCO",                        mz:6000,  half:3000,  ml10:620  },
  { s:244, name:"SENSUAL",                                mz:3600,  half:1800,  ml10:380  },
  { s:245, name:"SHL GOD OF FIRE",                        mz:6000,  half:3000,  ml10:620  },
  { s:246, name:"SURRATI EHSAS AL ARABIA",                mz:5600,  half:2800,  ml10:580  },
  { s:247, name:"SWEET HEART",                            mz:2600,  half:1300,  ml10:280  },
  { s:248, name:"SWISS ARABIAN RASHEEQA",                 mz:4600,  half:2300,  ml10:480  },
  { s:249, name:"SWISS ARABIAN SAPIL SOLID",              mz:4400,  half:2200,  ml10:460  },
  { s:250, name:"SWISS ARABIAN SHAGAF OUD",               mz:6000,  half:3000,  ml10:620  },
  { s:251, name:"SWISS ARABIAN TYPE JANNAT UL FIRDAUS SPL", mz:4800, half:2400, ml10:500  },
  { s:252, name:"TERRE D HERMES",                         mz:4000,  half:2000,  ml10:420  },
  { s:253, name:"TOMFORD LOST CHERRY",                    mz:3000,  half:1500,  ml10:320  },
  { s:254, name:"TOMFORD OMBRE LEATHER",                  mz:5000,  half:2500,  ml10:520  },
  { s:255, name:"TOMFORD OUD WOOD",                       mz:5400,  half:2700,  ml10:560  },
  { s:256, name:"TOMFORD TOBACCO VANILLA",                mz:3800,  half:1900,  ml10:400  },
  { s:257, name:"TOMFORD TUSCAN LEATHER",                 mz:4600,  half:2300,  ml10:480  },
  { s:258, name:"VERSACE BRIGHT CRYSTAL",                 mz:3800,  half:1900,  ml10:400  },
  { s:259, name:"VERSACE EROS",                           mz:4200,  half:2100,  ml10:440  },
  { s:260, name:"VERSACE RED JEANS",                      mz:4000,  half:2000,  ml10:420  },
  { s:261, name:"VICTORIA SECRET BOMBSHELL",              mz:2800,  half:1400,  ml10:300  },
  { s:262, name:"VICTORIA SECRET PURE SEDUCTION",         mz:3000,  half:1500,  ml10:320  },
  { s:263, name:"VIKTOR & ROLF SPICEBOMB",                mz:4800,  half:2400,  ml10:500  },
  { s:264, name:"VILLAIN BLACK (CREATION)",               mz:4400,  half:2200,  ml10:460  },
  { s:265, name:"WHITE LONDON",                           mz:2600,  half:1300,  ml10:280  },
  { s:266, name:"WHITE MUSK",                             mz:2600,  half:1300,  ml10:280  },
  { s:267, name:"WHITE OUD MZ",                           mz:7000,  half:3500,  ml10:720  },
  { s:268, name:"WOODLAND (CREATION)",                    mz:19000, half:9500,  ml10:1920 },
  { s:269, name:"WOODLAND SPL (CREATION)",                mz:28000, half:14000, ml10:2820 },
  { s:270, name:"WOODY BY ARABIAN OUD",                   mz:10000, half:5000,  ml10:1020 },
  { s:271, name:"XERJOFF ERBA PURA",                      mz:7000,  half:3500,  ml10:720  },
  { s:272, name:"XERJOFF NAXOS",                          mz:5800,  half:2900,  ml10:600  },
  { s:273, name:"XERJOFF NIO",                            mz:4000,  half:2000,  ml10:420  },
  { s:274, name:"YARDLEY GENTLEMEN",                      mz:3600,  half:1800,  ml10:380  },
  { s:275, name:"YSL BLACK OPIUM",                        mz:4400,  half:2200,  ml10:460  },
  { s:276, name:"YSL CAFTAN",                             mz:8000,  half:4000,  ml10:820  },
  { s:277, name:"YSL LIBRE WOMEN",                        mz:6400,  half:3200,  ml10:660  },
  { s:278, name:"YSL Y",                                  mz:4400,  half:2200,  ml10:460  },
  { s:279, name:"ZAM ZAM",                                mz:2800,  half:1400,  ml10:300  },
  { s:280, name:"ZARA FRUITY",                            mz:4400,  half:2200,  ml10:460  },
  { s:281, name:"ZARA GARDENIA",                          mz:4400,  half:2200,  ml10:460  },
  { s:282, name:"ZARA LISBOA",                            mz:3400,  half:1700,  ml10:360  },
  { s:283, name:"ZARA MAN UOMO",                          mz:3800,  half:1900,  ml10:400  },
  { s:284, name:"ZARA ORCHID",                            mz:3000,  half:1500,  ml10:320  },
  { s:285, name:"ZARA RED TEMPTATION",                    mz:4000,  half:2000,  ml10:420  },
  { s:286, name:"ZARA SEOUL",                             mz:4400,  half:2200,  ml10:460  },
  { s:287, name:"ZARA SUBLIME EPOQUE",                    mz:5000,  half:2500,  ml10:520  },
  { s:288, name:"ZARA TOBACCO",                           mz:3800,  half:1900,  ml10:400  }
];

let priceListRows   = [];
let priceListBuilt  = false;

function openPriceList() {
  const modal = document.getElementById("priceListModal");
  if (!modal) return;

  if (!priceListBuilt) buildPriceListTable();
  modal.style.display = "flex";

  const searchEl = document.getElementById("priceListSearch");
  if (searchEl) {
    searchEl.value = "";
    filterPriceList("");
    setTimeout(() => searchEl.focus(), 100);
  }
}

function closePriceList() {
  document.getElementById("priceListModal").style.display = "none";
}

function buildPriceListTable() {
  const tbody = document.getElementById("priceListTbody");
  if (!tbody) return;

  const frag = document.createDocumentFragment();

  MZ_PRICE_LIST.forEach(item => {
    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";
    tr.innerHTML = `
      <td style="font-family:var(--font-serif);font-style:italic;color:var(--gold)">${item.s}</td>
      <td class="col-name">${escapeHtml(item.name)}</td>
      <td style="text-align:right;font-weight:600;color:var(--gold)">${formatRupees(item.mz)}</td>
      <td style="text-align:right;color:var(--text2)">${formatRupees(item.half)}</td>
      <td style="text-align:right;color:var(--text2)">${formatRupees(item.ml10)}</td>
    `;
    tr._search = item.name.toLowerCase();
    tr.addEventListener("click", () => {
      closePriceList();
      setTimeout(() => openModal("frag"), 100);
      setTimeout(() => {
        const nameInput = document.querySelector('#modalBody [data-key="name"]');
        if (nameInput) {
          nameInput.value = item.name;
          nameInput.focus();
        }
      }, 220);
    });
    frag.appendChild(tr);
  });

  tbody.innerHTML = "";
  tbody.appendChild(frag);
  priceListRows = Array.from(tbody.children);
  priceListBuilt = true;
  updatePriceCount(MZ_PRICE_LIST.length);
}

function filterPriceList(q) {
  const ql = (q || "").trim().toLowerCase();
  let visible = 0;

  for (let i = 0; i < priceListRows.length; i++) {
    const row = priceListRows[i];
    const match = !ql || row._search.indexOf(ql) !== -1;
    row.style.display = match ? "" : "none";
    if (match) visible++;
  }
  updatePriceCount(visible);
}

function updatePriceCount(n) {
  const el = document.getElementById("priceListCount");
  if (el) el.textContent = `${n} fragrance${n === 1 ? "" : "s"}`;
}

/* ════════════════════════════════════════════════════════════
   EXPORT EXCEL
════════════════════════════════════════════════════════════ */
function exportAllExcel() {
  if (typeof XLSX === "undefined") { showToast("Excel lib not loaded", "error"); return; }
  const wb = XLSX.utils.book_new();

  const todoRows = [["Title","Priority","Due","Status","Notes","Created By"]];
  todoItems.forEach(t => todoRows.push([t.title||"", t.priority||"", t.dueDate||"", t.status||"", t.notes||"", t.createdBy||""]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(todoRows), "To-Do");

  const cRows = [["Title","Category","Date","Description","By"]];
  changes.forEach(c => cRows.push([c.title||"", c.category||"", c.date||"", c.description||"", c.createdBy||""]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cRows), "Changes");

  const exRows = [["Title","Amount","Payment","Date","Priority","Status","Notes"]];
  expenseItems.forEach(e => exRows.push([e.title||"", e.amount||0, e.payment||"", e.date||"", e.priority||"", e.status||"", e.notes||""]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(exRows), "Expenses");

  const fRows = [["Status","Name","Brand","Available ML","Quantity","Purchase Date","Notes"]];
  fragHave.forEach(f   => fRows.push(["HAVE",     f.name||"", f.brand||"", f.sizes||"", f.quantity||0, f.purchaseDate||"", f.notes||""]));
  fragAdd.forEach(f    => fRows.push(["TO ADD",   f.name||"", f.brand||"", f.sizes||"", f.quantity||0, f.purchaseDate||"", f.notes||""]));
  fragRemove.forEach(f => fRows.push(["TO REMOVE",f.name||"", f.brand||"", f.sizes||"", f.quantity||0, f.purchaseDate||"", f.notes||""]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fRows), "Fragrances");

  const eRows = [["Name","Available (formatted)","Available (ml)","Purchase Date","Notes"]];
  ethonolItems.forEach(e => eRows.push([e.name||"", formatMl(e.ml||0), Number(e.ml)||0, e.purchaseDate||"", e.notes||""]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(eRows), "Ethanol");

  const bRows = [["Name","Brand","Size(ml)","Qty","Purchase Date","Notes"]];
  bottles.forEach(b => bRows.push([b.name||"", b.brand||"", b.size||"", b.quantity||0, b.purchaseDate||"", b.notes||""]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bRows), "Bottles");

  const tRows = [["Name","Brand","Qty","Purchase Date","Location","Notes"]];
  testers.forEach(t => tRows.push([t.name||"", t.brand||"", t.quantity||0, t.purchaseDate||"", t.location||"", t.notes||""]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tRows), "Testers");

  XLSX.writeFile(wb, "LUXORA_UPDATES.xlsx");
  showToast("Excel exported ✅", "success");
}

/* ════════════════════════════════════════════════════════════
   CUSTOM DROPDOWNS
════════════════════════════════════════════════════════════ */
let openCSelect = null;

function enhanceAllSelects(root) {
  (root || document).querySelectorAll("select").forEach(enhanceSelect);
}

function enhanceSelect(sel) {
  if (!sel || sel.dataset.csReady) return;
  sel.dataset.csReady = "1";

  const isFilter = sel.classList.contains("month-filter-select");

  const wrap = document.createElement("div");
  wrap.className = "cselect" + (isFilter ? " cselect-filter" : "");
  sel.parentNode.insertBefore(wrap, sel);
  wrap.appendChild(sel);
  sel.classList.add("cselect-native");
  sel.tabIndex = -1;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = (isFilter ? "month-filter-select" : "field-input") + " cselect-btn";
  btn.setAttribute("aria-haspopup", "listbox");
  btn.setAttribute("aria-expanded", "false");
  btn.innerHTML =
    `<span class="cselect-label"></span>` +
    `<svg class="cselect-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
  wrap.appendChild(btn);

  const refreshLabel = () => {
    const o = sel.options[sel.selectedIndex];
    btn.querySelector(".cselect-label").textContent = o ? o.textContent : "";
  };
  refreshLabel();

  btn.addEventListener("click", () => {
    if (openCSelect && openCSelect.btn === btn) closeCSelect();
    else openCSelectMenu(wrap, sel, btn, refreshLabel);
  });

  btn.addEventListener("keydown", e => {
    const isOpen = openCSelect && openCSelect.btn === btn;
    if (!isOpen) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openCSelectMenu(wrap, sel, btn, refreshLabel);
      }
      return;
    }
    if (e.key === "ArrowDown")      { e.preventDefault(); moveCSelectActive(1); }
    else if (e.key === "ArrowUp")   { e.preventDefault(); moveCSelectActive(-1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickCSelect(openCSelect.active); }
    else if (e.key === "Escape")    { e.preventDefault(); e.stopPropagation(); closeCSelect(); }
    else if (e.key === "Tab")       { closeCSelect(); }
  });
}

function openCSelectMenu(wrap, sel, btn, refreshLabel) {
  closeCSelect();

  const menu = document.createElement("div");
  menu.className = "cselect-menu";
  menu.setAttribute("role", "listbox");

  Array.from(sel.options).forEach((opt, i) => {
    const item = document.createElement("div");
    item.className = "cselect-opt" + (i === sel.selectedIndex ? " selected" : "");
    item.setAttribute("role", "option");
    item.dataset.index = i;
    item.textContent = opt.textContent;
    item.addEventListener("click", () => pickCSelect(i));
    menu.appendChild(item);
  });

  const r     = btn.getBoundingClientRect();
  const below = window.innerHeight - r.bottom - 10;
  const above = r.top - 10;
  const up    = below < 170 && above > below;
  const maxH  = Math.max(120, Math.min(260, up ? above : below));

  menu.style.minWidth  = r.width + "px";
  menu.style.maxHeight = maxH + "px";
  menu.style.left      = r.left + "px";
  if (up) menu.style.bottom = (window.innerHeight - r.top + 6) + "px";
  else    menu.style.top    = (r.bottom + 6) + "px";

  document.body.appendChild(menu);

  const overflow = r.left + menu.offsetWidth - (window.innerWidth - 8);
  if (overflow > 0) menu.style.left = Math.max(8, r.left - overflow) + "px";

  wrap.classList.add("open");
  btn.setAttribute("aria-expanded", "true");

  openCSelect = { wrap, btn, menu, sel, refreshLabel, active: Math.max(0, sel.selectedIndex) };
  highlightCSelect();

  const sel_ = menu.querySelector(".cselect-opt.selected");
  if (sel_) menu.scrollTop = Math.max(0, sel_.offsetTop - menu.clientHeight / 2 + sel_.offsetHeight / 2);

  document.addEventListener("pointerdown", cselectOutside, true);
  window.addEventListener("scroll", cselectScroll, true);
  window.addEventListener("resize", closeCSelect);
}

function highlightCSelect() {
  if (!openCSelect) return;
  openCSelect.menu.querySelectorAll(".cselect-opt").forEach((el, i) => {
    el.classList.toggle("active", i === openCSelect.active);
  });
  const el = openCSelect.menu.children[openCSelect.active];
  if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
}

function moveCSelectActive(delta) {
  if (!openCSelect) return;
  const n = openCSelect.sel.options.length;
  openCSelect.active = (openCSelect.active + delta + n) % n;
  highlightCSelect();
}

function pickCSelect(i) {
  if (!openCSelect) return;
  const { sel, refreshLabel, btn } = openCSelect;
  const changed = sel.selectedIndex !== i;
  sel.selectedIndex = i;
  refreshLabel();
  closeCSelect();
  btn.focus({ preventScroll: true });
  if (changed) sel.dispatchEvent(new Event("change", { bubbles: true }));
}

function closeCSelect() {
  if (!openCSelect) return;
  const { wrap, btn, menu } = openCSelect;
  wrap.classList.remove("open");
  btn.setAttribute("aria-expanded", "false");
  menu.remove();
  openCSelect = null;
  document.removeEventListener("pointerdown", cselectOutside, true);
  window.removeEventListener("scroll", cselectScroll, true);
  window.removeEventListener("resize", closeCSelect);
}

function cselectOutside(e) {
  if (!openCSelect) return;
  if (openCSelect.menu.contains(e.target) || openCSelect.btn.contains(e.target)) return;
  closeCSelect();
}

function cselectScroll(e) {
  if (openCSelect && openCSelect.menu.contains(e.target)) return;
  closeCSelect();
}

/* ════════════════════════════════════════════════════════════
   EMAIL NOTIFICATIONS
════════════════════════════════════════════════════════════ */
const COLLECTION_LABELS = {
  todo_items:        "To-Do List",
  new_changes:       "New Changes",
  expenses_items:    "Expenses",
  frag_have:         "Fragrances - We Have",
  frag_add:          "Fragrances - To Add",
  frag_remove:       "Fragrances - To Remove",
  ethonol_items:     "Ethanol",
  perfume_bottles:   "Perfume Bottles",
  testers:           "Testers",
  boxes_testers:     "Boxes - Testers",
  boxes_20ml:        "Boxes - 20 ml",
  boxes_50ml:        "Boxes - 50 ml",
  boxes_100ml:       "Boxes - 100 ml",
  boxes_combo:       "Boxes - Combo",
  labels_testers:    "Labels - Testers",
  labels_20ml:       "Labels - 20 ml",
  labels_50ml:       "Labels - 50 ml",
  labels_100ml:      "Labels - 100 ml",
  labels_card:       "Labels - Thank You Card",
  labels_sticker:    "Labels - Sticker",
  packaging_bubble:  "Packaging - Bubble Roll",
  packaging_bag:     "Packaging - Packing Bag",
  packaging_paper:   "Packaging - Paper Hand Bag"
};

const FIELD_LABELS = {
  title: "Title", name: "Name", priority: "Priority", dueDate: "Due Date",
  status: "Status", notes: "Notes", brand: "Brand", size: "Size (ml)",
  quantity: "Quantity", purchaseDate: "Purchase Date", location: "Location",
  category: "Category", date: "Date", description: "Description",
  sizes: "Available ML", ml: "Available (ml)", image: "Image",
  amount: "Amount", payment: "Payment Mode"
};

const NOTIFY_SKIP_KEYS = new Set([
  "id","_init","_createdAt","createdAt","createdBy","updatedAt","updatedBy",
  "fragTab","boxTab","labelTab","packagingTab"
]);

function itemLabel(x) {
  return (x && (x.title || x.name)) || "Untitled";
}

function findItemByCollection(col, id) {
  const map = {
    todo_items: todoItems,
    new_changes: changes,
    expenses_items: expenseItems,
    frag_have: fragHave, frag_add: fragAdd, frag_remove: fragRemove,
    ethonol_items: ethonolItems,
    perfume_bottles: bottles,
    testers: testers,
    boxes_testers: boxTesters, boxes_20ml: box20ml, boxes_50ml: box50ml,
    boxes_100ml: box100ml, boxes_combo: boxCombo,
    labels_testers: labelTesters, labels_20ml: label20ml, labels_50ml: label50ml,
    labels_100ml: label100ml, labels_card: labelCard, labels_sticker: labelSticker,
    packaging_bubble: packBubble, packaging_bag: packBag, packaging_paper: packPaper
  };
  return (map[col] || []).find(x => x.id === id) || null;
}

function notifyNorm(v) {
  return v == null ? "" : String(v).trim();
}

function describeFields(obj) {
  const out = [];
  Object.keys(obj || {}).forEach(k => {
    if (NOTIFY_SKIP_KEYS.has(k)) return;
    const v = notifyNorm(obj[k]);
    if (!v) return;
    out.push({ label: FIELD_LABELS[k] || k, value: k === "image" ? "attached" : v });
  });
  return out;
}

function diffFields(before, after) {
  const out = [];
  Object.keys(after || {}).forEach(k => {
    if (NOTIFY_SKIP_KEYS.has(k)) return;
    const a = notifyNorm(before ? before[k] : "");
    const b = notifyNorm(after[k]);
    if (a === b) return;
    if (k === "image") {
      out.push({ label: "Image", from: a ? "previous image" : "none", to: b ? "new image" : "removed" });
    } else {
      out.push({ label: FIELD_LABELS[k] || k, from: a || "(empty)", to: b || "(empty)" });
    }
  });
  return out;
}

async function notifyChange(info) {
  if (!NOTIFY_CONFIG.url) {
    console.info("Email notification skipped: NOTIFY_CONFIG.url is empty.");
    return;
  }
  try {
    const payload = {
      key:      NOTIFY_CONFIG.key,
      action:   info.action,
      section:  COLLECTION_LABELS[info.collection] || info.collection,
      item:     String(info.item || "").slice(0, 200),
      by:       NAME_MAP[currentUser] || currentUser || "Someone",
      byEmail:  currentUser || "",
      changes:  (info.changes || []).slice(0, 20).map(c => ({
                  label: c.label, from: String(c.from).slice(0, 300), to: String(c.to).slice(0, 300) })),
      details:  (info.details || []).slice(0, 20).map(d => ({
                  label: d.label, value: String(d.value).slice(0, 300) })),
      ts:       Date.now()
    };
    await fetch(NOTIFY_CONFIG.url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      keepalive: true
    });
  } catch (err) {
    console.warn("Email notification failed:", err);
    showToast("Saved, but the email notification failed", "error");
  }
}

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s) {
  if (s == null) return "";
  return String(s)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function showToast(msg, type = "") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast show" + (type ? " " + type : "");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = "toast"; }, 3000);
}

/* ════════════════════════════════════════════════════════════
   GLOBAL EXPOSE
════════════════════════════════════════════════════════════ */
window.attemptLogin           = attemptLogin;
window.togglePw               = togglePw;
window.logout                 = logout;
window.saveGithubSetup        = saveGithubSetup;
window.switchView             = switchView;
window.toggleSidebar          = toggleSidebar;
window.closeSidebar           = closeSidebar;
window.switchFragTab          = switchFragTab;
window.switchBoxTab           = switchBoxTab;
window.switchLabelTab         = switchLabelTab;
window.switchPackagingTab     = switchPackagingTab;

window.openModal              = openModal;
window.closeModal             = closeModal;
window.saveModal              = saveModal;
window.modalChangeQty         = modalChangeQty;
window.handleModalImageSelect = handleModalImageSelect;
window.clearModalImage        = clearModalImage;

window.openDatePicker         = openDatePicker;
window.closeDatePicker        = closeDatePicker;
window.datePickerPrevMonth    = datePickerPrevMonth;
window.datePickerNextMonth    = datePickerNextMonth;
window.datePickerToday        = datePickerToday;
window.datePickerClear        = datePickerClear;
window.datePickerPick         = datePickerPick;

window.openAmountModal        = openAmountModal;
window.closeAmountModal       = closeAmountModal;
window.confirmAmountModal     = confirmAmountModal;
window.amountModalChangeQty   = amountModalChangeQty;

window.openConfirmModal       = openConfirmModal;
window.closeConfirmModal      = closeConfirmModal;
window.confirmConfirmModal    = confirmConfirmModal;
window.confirmDelete          = confirmDelete;

window.openLightbox           = openLightbox;
window.closeLightbox          = closeLightbox;
window.exportAllExcel         = exportAllExcel;
window.deleteImageFromGitHub  = deleteImageFromGitHub;

window.openPriceList          = openPriceList;
window.closePriceList         = closePriceList;
window.filterPriceList        = filterPriceList;

window.renderTodo             = renderTodo;
window.renderChanges          = renderChanges;
window.renderExpenses         = renderExpenses;
window.renderFrags            = renderFrags;
window.renderEthonol          = renderEthonol;
window.renderBottles          = renderBottles;
window.renderTesters          = renderTesters;
window.renderBoxes            = renderBoxes;
window.renderLabels           = renderLabels;
window.renderPackaging        = renderPackaging;
