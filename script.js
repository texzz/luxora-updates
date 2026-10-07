/* ════════════════════════════════════════════════════════════
   LUXORA UPDATES — script.js
   Sections: To-Do · Bottles · Testers · Changes · Fragrances · Ethanol
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

/* ───────── EMAIL NOTIFICATIONS (Google Apps Script relay) ─────────
   1. Deploy email-notifier.gs as a Web App (steps are inside that file).
   2. Paste the Web App URL (ends with /exec) and the SAME secret key below.
   Leave url empty to switch notifications off.                          */
const NOTIFY_CONFIG = {
  url: "https://script.google.com/macros/s/AKfycbyBO7FsKOh62Py3lWbJLrn6BmDR_23Mjg1zMCuHVsDTLdmZ1tbsEHHC29_QEYMqXZk/exec",   // e.g. "https://script.google.com/macros/s/AKfycb.../exec"
  key: "Lx9-kP2mQ7vTz4Rw8Nb3"    // must match SHARED_KEY inside email-notifier.gs
};

/* ───────── FIREBASE REFS ───────── */
let db, collection, getDocs, doc, setDoc, deleteDoc, addDoc,
    onSnapshot, query, orderBy, getDoc, updateDoc;

/* ───────── APP STATE ───────── */
let todoItems    = [];
let bottles      = [];
let testers      = [];
let changes      = [];
let fragHave     = [];
let fragAdd      = [];
let fragRemove   = [];
let ethonolItems = [];

let currentFragTab = "have";
let githubConfig   = null;

/* ───────── GENERIC MODAL STATE ───────── */
let modalSection   = null;
let modalEditId    = null;
let modalImageUrl  = "";
let modalUploading = false;

/* ───────── AMOUNT MODAL STATE ───────── */
let amountModalCtx  = null;   // { collection, docId, field, start, unit, name, step }

/* ───────── DATE PICKER STATE ───────── */
let datePickerTarget = null;  // input element that receives the chosen date
let datePickerView   = new Date();  // current month being viewed

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
    "perfume_bottles",
    "testers",
    "new_changes",
    "frag_have",
    "frag_add",
    "frag_remove",
    "ethonol_items"
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

  bind("todo_items",      v => todoItems    = v, renderTodo);
  bind("perfume_bottles", v => bottles      = v, renderBottles);
  bind("testers",         v => testers      = v, renderTesters);
  bind("new_changes",     v => changes      = v, renderChanges);
  bind("frag_have",       v => fragHave     = v, renderFrags);
  bind("frag_add",        v => fragAdd      = v, renderFrags);
  bind("frag_remove",     v => fragRemove   = v, renderFrags);
  bind("ethonol_items",   v => ethonolItems = v, renderEthonol);
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
   UTIL — ML / L FORMATTING
════════════════════════════════════════════════════════════ */
function formatMl(value) {
  const n = Number(value) || 0;
  if (n <= 0) return "0 ml";
  if (n < 1000) return `${n} ml`;
  const litres = n / 1000;
  const str = litres.toFixed(2).replace(/\.?0+$/, "");
  return `${str} L`;
}

/* ════════════════════════════════════════════════════════════
   GITHUB IMAGE UPLOAD
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
    body: JSON.stringify({
      message: `Upload ${path}`,
      content,
      branch
    })
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

/* ════════════════════════════════════════════════════════════
   CUSTOM DATE PICKER
════════════════════════════════════════════════════════════ */
function openDatePicker(inputEl) {
  if (!inputEl) return;
  datePickerTarget = inputEl;

  // Set initial view to the input's current value or today
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
  if (datePickerTarget) {
    datePickerTarget.value = new Date().toISOString().split("T")[0];
  }
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
    month: "long",
    year: "numeric"
  });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Today's Y/M/D for highlight
  const today = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth();
  const todayD = today.getDate();

  // Selected (from target input)
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
  // Blank cells for days before the 1st
  for (let i = 0; i < firstDay; i++) {
    html += `<div class="date-picker-day empty"></div>`;
  }
  // Day cells
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
  const yyyy = y;
  const mm   = String(m + 1).padStart(2, "0");
  const dd   = String(d).padStart(2, "0");
  const iso  = `${yyyy}-${mm}-${dd}`;

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
   ctx = { collection, docId, field, start, unit, name, step }
   unit: 'ml' | 'qty'
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
   RENDER — BOTTLES (with card +/−)
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
   RENDER — TESTERS (with card +/−)
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
   RENDER — FRAGRANCES (with card +/− on quantity)
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
   RENDER — ETHANOL (with card +/−)
════════════════════════════════════════════════════════════ */
async function renderEthonol() {
  const grid = document.getElementById("ethonolGrid");
  if (!grid) return;
  const q = (document.getElementById("ethonolSearch")?.value || "").toLowerCase();
  const list = ethonolItems.filter(e =>
    !q || (e.name||"").toLowerCase().includes(q)
  );

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
   DELETE — custom confirm
════════════════════════════════════════════════════════════ */
function confirmDelete(colName, id, label = "item") {
  const cap = label.charAt(0).toUpperCase() + label.slice(1);
  openConfirmModal(
    "Delete " + cap + "?",
    "This will permanently delete this " + label + ". This action cannot be undone.",
    async () => {
      const removed = findItemByCollection(colName, id);
      try {
        await deleteDoc(doc(db, colName, id));
        showToast("Deleted ✅", "success");
        notifyChange({ collection: colName, action: "deleted", item: itemLabel(removed) || cap, details: describeFields(removed || {}) });
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
  } else if (section === "bottle") {
    titleText = id ? "Edit Bottle" : "Add Bottle";
    fields = [
      { key: "name",         label: "Name *",        type: "text",   value: currentItem?.name || "" },
      { key: "brand",        label: "Brand",         type: "text",   value: currentItem?.brand || "" },
      { key: "size",         label: "Size (ml)",     type: "select", value: currentItem?.size || "50",
        options: ["20","30","50","100"],
        optionLabels: { "20": "20 ml", "30": "30 ml", "50": "50 ml", "100": "100 ml" } },
      { key: "quantity",     label: "Quantity",      type: "qty",    value: currentItem?.quantity || 1 },
      { key: "purchaseDate", label: "Purchase Date", type: "date",   value: currentItem?.purchaseDate || "" },
      { key: "notes",        label: "Notes",         type: "textarea", value: currentItem?.notes || "" },
    ];
  } else if (section === "tester") {
    titleText = id ? "Edit Tester" : "Add Tester";
    fields = [
      { key: "name",     label: "Name *",    type: "text",     value: currentItem?.name || "" },
      { key: "brand",    label: "Brand",     type: "text",     value: currentItem?.brand || "" },
      { key: "quantity", label: "Quantity",  type: "qty",      value: currentItem?.quantity || 1 },
      { key: "location", label: "Location",  type: "text",     value: currentItem?.location || "" },
      { key: "notes",    label: "Notes",     type: "textarea", value: currentItem?.notes || "" },
    ];
  } else if (section === "change") {
    titleText = id ? "Edit Change" : "Add Change";
    fields = [
      { key: "title",       label: "Title *",     type: "text",     value: currentItem?.title || "" },
      { key: "category",    label: "Category",    type: "select",   value: currentItem?.category || "NEW", options: ["NEW","UPDATE","FIX","REMOVED"] },
      { key: "date",        label: "Date",        type: "date",     value: currentItem?.date || new Date().toISOString().split("T")[0] },
      { key: "description", label: "Description", type: "textarea", value: currentItem?.description || "" },
    ];
  } else if (section === "frag") {
    titleText = id ? "Edit Fragrance" : "Add Fragrance";
    fields = [
      { key: "name",     label: "Name *",        type: "text",     value: currentItem?.name || "" },
      { key: "brand",    label: "Brand",         type: "text",     value: currentItem?.brand || "" },
      { key: "sizes",    label: "Available ML",  type: "text",     value: currentItem?.sizes || "", placeholder: "e.g. 50ml, 100ml, 200ml" },
      { key: "quantity", label: "Quantity",      type: "qty",      value: currentItem?.quantity || 1 },
      { key: "notes",    label: "Notes",         type: "textarea", value: currentItem?.notes || "" },
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
      { key: "name",  label: "Name *",         type: "text",     value: currentItem?.name || "", placeholder: "e.g. Ethanol Batch A" },
      { key: "ml",    label: "Available (ml)", type: "qty",      value: currentItem?.ml || 500 },
      { key: "notes", label: "Notes",          type: "textarea", value: currentItem?.notes || "" },
    ];
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

  html += `
    <div class="edit-row" style="margin-top:6px;border-top:1px solid rgba(210,195,175,0.35);padding-top:14px">
      <label>Image</label>
      <div id="modalImgPreview" style="margin-bottom:8px"></div>
      <input type="file" id="modalImgInput" accept="image/*" class="field-input" onchange="handleModalImageSelect(event)" />
      <div id="modalImgStatus" style="font-size:0.74rem;color:var(--text3);margin-top:6px"></div>
    </div>
  `;

  bodyEl.innerHTML = html;
  enhanceAllSelects(bodyEl);

  if (currentItem?.image) {
    modalImageUrl = currentItem.image;
    renderModalImagePreview();
  }

  document.getElementById("genericModal").style.display = "flex";
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
    todo:    "todo_items",
    bottle:  "perfume_bottles",
    tester:  "testers",
    change:  "new_changes",
    frag:    fragCollection(currentFragTab),
    ethonol: "ethonol_items"
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
    todo:    "todo",
    bottle:  "bottles",
    tester:  "testers",
    change:  "changes",
    frag:    "fragrances",
    ethonol: "ethonol"
  };
  const folder = folderMap[modalSection] || "misc";

  try {
    const { path } = await uploadImageToGitHub(file, folder);
    modalImageUrl = "ghapi:" + path;
    statusEl.textContent = "✅ Uploaded";
    renderModalImagePreview();
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
    todo:    "title",
    bottle:  "name",
    tester:  "name",
    change:  "title",
    frag:    "name",
    ethonol: "name"
  };
  const reqKey = requiredMap[modalSection];
  if (reqKey && (!data[reqKey] || !data[reqKey].toString().trim())) {
    showToast("Please fill in required fields", "error");
    return;
  }

  data.image = modalImageUrl || "";

  let targetCollection = collectionForSection(modalSection);

  if (modalSection === "frag" && data.fragTab) {
    targetCollection = fragCollection(data.fragTab);
    delete data.fragTab;
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
   EXPORT EXCEL
════════════════════════════════════════════════════════════ */
function exportAllExcel() {
  if (typeof XLSX === "undefined") { showToast("Excel lib not loaded", "error"); return; }
  const wb = XLSX.utils.book_new();

  const todoRows = [["Title","Priority","Due","Status","Notes","Created By"]];
  todoItems.forEach(t => todoRows.push([t.title||"", t.priority||"", t.dueDate||"", t.status||"", t.notes||"", t.createdBy||""]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(todoRows), "To-Do");

  const bRows = [["Name","Brand","Size(ml)","Qty","Purchase Date","Notes"]];
  bottles.forEach(b => bRows.push([b.name||"", b.brand||"", b.size||"", b.quantity||0, b.purchaseDate||"", b.notes||""]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bRows), "Bottles");

  const tRows = [["Name","Brand","Qty","Location","Notes"]];
  testers.forEach(t => tRows.push([t.name||"", t.brand||"", t.quantity||0, t.location||"", t.notes||""]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tRows), "Testers");

  const cRows = [["Title","Category","Date","Description","By"]];
  changes.forEach(c => cRows.push([c.title||"", c.category||"", c.date||"", c.description||"", c.createdBy||""]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cRows), "Changes");

  const fRows = [["Status","Name","Brand","Available ML","Quantity","Notes"]];
  fragHave.forEach(f   => fRows.push(["HAVE",     f.name||"", f.brand||"", f.sizes||"", f.quantity||0, f.notes||""]));
  fragAdd.forEach(f    => fRows.push(["TO ADD",   f.name||"", f.brand||"", f.sizes||"", f.quantity||0, f.notes||""]));
  fragRemove.forEach(f => fRows.push(["TO REMOVE",f.name||"", f.brand||"", f.sizes||"", f.quantity||0, f.notes||""]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fRows), "Fragrances");

  const eRows = [["Name","Available (formatted)","Available (ml)","Notes"]];
  ethonolItems.forEach(e => eRows.push([e.name||"", formatMl(e.ml||0), Number(e.ml)||0, e.notes||""]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(eRows), "Ethanol");

  XLSX.writeFile(wb, "LUXORA_UPDATES.xlsx");
  showToast("Excel exported ✅", "success");
}

/* ════════════════════════════════════════════════════════════
   CUSTOM DROPDOWNS
   Replaces the browser-default <select> menu with an app-styled one.
   The real <select> stays in the DOM (hidden) so data-key / .value /
   inline onchange handlers keep working exactly as before.
════════════════════════════════════════════════════════════ */
let openCSelect = null;   // { wrap, btn, menu, sel, active }

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

  // keep inside the viewport horizontally
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
  if (openCSelect && openCSelect.menu.contains(e.target)) return;   // scrolling the menu itself
  closeCSelect();
}

/* ════════════════════════════════════════════════════════════
   EMAIL NOTIFICATIONS
   Every add / edit / delete / stock +− sends one plain-text email
   to the three partners through the Apps Script relay.
   Fire-and-forget: it never blocks or breaks the app.
════════════════════════════════════════════════════════════ */
const COLLECTION_LABELS = {
  todo_items:      "To-Do List",
  perfume_bottles: "Perfume Bottles",
  testers:         "Testers",
  new_changes:     "New Changes",
  frag_have:       "Fragrances - We Have",
  frag_add:        "Fragrances - To Add",
  frag_remove:     "Fragrances - To Remove",
  ethonol_items:   "Ethanol"
};

const FIELD_LABELS = {
  title: "Title", name: "Name", priority: "Priority", dueDate: "Due Date",
  status: "Status", notes: "Notes", brand: "Brand", size: "Size (ml)",
  quantity: "Quantity", purchaseDate: "Purchase Date", location: "Location",
  category: "Category", date: "Date", description: "Description",
  sizes: "Available ML", ml: "Available (ml)", image: "Image"
};

const NOTIFY_SKIP_KEYS = new Set([
  "id", "_init", "_createdAt", "createdAt", "createdBy", "updatedAt", "updatedBy", "fragTab"
]);

function itemLabel(x) {
  return (x && (x.title || x.name)) || "Untitled";
}

function findItemByCollection(col, id) {
  const map = {
    todo_items: todoItems, perfume_bottles: bottles, testers: testers,
    new_changes: changes, frag_have: fragHave, frag_add: fragAdd,
    frag_remove: fragRemove, ethonol_items: ethonolItems
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
    // text/plain + no-cors = a "simple request", so the browser sends it without a CORS preflight
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

/* For inline onclick attribute strings — safe single-quoted value */
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

window.renderTodo             = renderTodo;
window.renderBottles          = renderBottles;
window.renderTesters          = renderTesters;
window.renderChanges          = renderChanges;
window.renderFrags            = renderFrags;
window.renderEthonol          = renderEthonol;