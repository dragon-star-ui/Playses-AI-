const BACKEND_API_URL = "https://regular-datebook-outburst.ngrok-free.dev/chat";
const API_KEY = "playses-ai-key-tetap";
const SERVER_UNAVAILABLE_MESSAGE =
  "Sorry, there is a problem with the server or the server is down/not yet activated";

const STORAGE_SESSIONS_KEY = "playses_ai_sessions_v1";
const CONTEXT_MESSAGE_LIMIT = 6; // Jumlah pesan terakhir yang dikirim sebagai konteks
const LONG_PRESS_DURATION_MS = 500; // Durasi tekan lama (ms)

// --- 1. Menu Samping (Burger Drawer) ---
const openDrawerBtn = document.getElementById("openDrawer");
const closeDrawerBtn = document.getElementById("closeDrawer");
const drawer = document.getElementById("drawer");
const backdrop = document.getElementById("backdrop");

function setDrawerOpen(isOpen) {
  if (!drawer || !backdrop) return;
  drawer.classList.toggle("open", isOpen);
  backdrop.classList.toggle("show", isOpen);
  if (!isOpen) {
    closeLongPressMenu();
  }
}

if (openDrawerBtn) {
  openDrawerBtn.addEventListener("click", () => setDrawerOpen(true));
}
if (closeDrawerBtn) {
  closeDrawerBtn.addEventListener("click", () => setDrawerOpen(false));
}
if (backdrop) {
  backdrop.addEventListener("click", () => setDrawerOpen(false));
}

// --- 2. State Riwayat Percakapan Privat per Pengguna ---
const chatEl = document.getElementById("chat");
const formEl = document.getElementById("f");
const inpEl = document.getElementById("inp");
const btnEl = document.getElementById("btn");
const stEl = document.getElementById("st");

const newChatBtn = document.getElementById("newChatBtn");
const historyListEl = document.getElementById("historyList");
const actionMenuEl = document.getElementById("historyActionMenu");
const deleteHistoryBtn = document.getElementById("deleteHistoryBtn");
const cancelHistoryActionBtn = document.getElementById("cancelHistoryActionBtn");

let sessions = [];
let activeSessionId = null; // null berarti belum mulai percakapan / sesi baru kosong
let selectedSessionIdForMenu = null;

function loadSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_SESSIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    sessions = Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    sessions = [];
  }
}

function saveSessions() {
  localStorage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify(sessions));
}

function generateSessionId() {
  return "sess_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
}

function buildTitleFromMessage(text) {
  const clean = text.trim().replace(/\s+/g, " ");
  if (!clean) return "New Chat";
  return clean.length > 32 ? clean.slice(0, 32).trim() + "..." : clean;
}

function getActiveSession() {
  if (!activeSessionId) return null;
  return sessions.find((s) => s.id === activeSessionId) || null;
}

function createNewSessionWithFirstMessage(userText) {
  const newSession = {
    id: generateSessionId(),
    title: buildTitleFromMessage(userText),
    createdAt: Date.now(),
    messages: []
  };
  sessions.unshift(newSession);
  activeSessionId = newSession.id;
  saveSessions();
  return newSession;
}

function appendMessageDOM(text, cls) {
  if (!chatEl) return null;
  const d = document.createElement("div");
  d.className = "msg " + cls;
  d.textContent = text;
  chatEl.appendChild(d);
  chatEl.scrollTop = chatEl.scrollHeight;
  return d;
}

function renderChatArea() {
  if (!chatEl) return;
  chatEl.innerHTML = "";
  const current = getActiveSession();
  if (!current || !Array.isArray(current.messages) || current.messages.length === 0) {
    return;
  }
  current.messages.forEach((m) => {
    appendMessageDOM(m.text, m.cls);
  });
}

// --- 3. Menu Tekan Lama (Long Press) untuk Hapus Riwayat ---
function closeLongPressMenu() {
  selectedSessionIdForMenu = null;
  if (actionMenuEl) {
    actionMenuEl.classList.remove("show");
    actionMenuEl.setAttribute("aria-hidden", "true");
  }
}

function openLongPressMenu(sessionId, anchorEl) {
  if (!actionMenuEl) return;
  selectedSessionIdForMenu = sessionId;

  if (anchorEl && historyListEl) {
    const itemRect = anchorEl.getBoundingClientRect();
    const listRect = historyListEl.getBoundingClientRect();
    const topOffset = Math.max(0, itemRect.bottom - listRect.top + 4);
    actionMenuEl.style.top = topOffset + "px";
  }

  actionMenuEl.classList.add("show");
  actionMenuEl.setAttribute("aria-hidden", "false");
}

function deleteSessionById(sessionId) {
  if (!sessionId) return;
  sessions = sessions.filter((s) => s.id !== sessionId);
  saveSessions();

  if (activeSessionId === sessionId) {
    activeSessionId = null;
    renderChatArea();
  }

  closeLongPressMenu();
  renderHistoryList();
}

if (deleteHistoryBtn) {
  deleteHistoryBtn.addEventListener("click", () => {
    if (selectedSessionIdForMenu) {
      deleteSessionById(selectedSessionIdForMenu);
    }
  });
}

if (cancelHistoryActionBtn) {
  cancelHistoryActionBtn.addEventListener("click", () => {
    closeLongPressMenu();
  });
}

document.addEventListener("pointerdown", (e) => {
  if (!actionMenuEl || !actionMenuEl.classList.contains("show")) return;
  if (!actionMenuEl.contains(e.target) && !e.target.closest(".history-item")) {
    closeLongPressMenu();
  }
});

function renderHistoryList() {
  if (!historyListEl) return;
  closeLongPressMenu();

  // Kosongkan item lama kecuali menu aksi jika berada di dalam historyListEl
  const existingItems = historyListEl.querySelectorAll(".history-item");
  existingItems.forEach((el) => el.remove());

  const existingEmpty = historyListEl.querySelector(".history-empty");
  if (existingEmpty) existingEmpty.remove();

  if (sessions.length === 0) {
    const emptyEl = document.createElement("div");
    emptyEl.className = "history-empty";
    emptyEl.textContent = "No chat history yet";
    historyListEl.prepend(emptyEl);
    return;
  }

  sessions.forEach((sess) => {
    const itemBtn = document.createElement("button");
    itemBtn.type = "button";
    itemBtn.className = "history-item" + (sess.id === activeSessionId ? " active" : "");
    itemBtn.textContent = sess.title || "New Chat";

    let pressTimer = null;
    let longPressTriggered = false;
    let startX = 0;
    let startY = 0;

    const clearPressTimer = () => {
      if (pressTimer !== null) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };

    itemBtn.addEventListener("pointerdown", (e) => {
      longPressTriggered = false;
      startX = e.clientX;
      startY = e.clientY;
      clearPressTimer();

      pressTimer = setTimeout(() => {
        longPressTriggered = true;
        openLongPressMenu(sess.id, itemBtn);
      }, LONG_PRESS_DURATION_MS);
    });

    itemBtn.addEventListener("pointermove", (e) => {
      if (pressTimer === null) return;
      const movedX = Math.abs(e.clientX - startX);
      const movedY = Math.abs(e.clientY - startY);
      if (movedX > 10 || movedY > 10) {
        clearPressTimer();
      }
    });

    itemBtn.addEventListener("pointerup", () => {
      clearPressTimer();
    });

    itemBtn.addEventListener("pointercancel", () => {
      clearPressTimer();
    });

    itemBtn.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      openLongPressMenu(sess.id, itemBtn);
    });

    itemBtn.addEventListener("click", () => {
      if (longPressTriggered) {
        longPressTriggered = false;
        return;
      }
      if (actionMenuEl && actionMenuEl.classList.contains("show")) {
        closeLongPressMenu();
        return;
      }
      activeSessionId = sess.id;
      renderHistoryList();
      renderChatArea();
      setDrawerOpen(false);
    });

    if (actionMenuEl && actionMenuEl.parentElement === historyListEl) {
      historyListEl.insertBefore(itemBtn, actionMenuEl);
    } else {
      historyListEl.appendChild(itemBtn);
    }
  });
}

if (newChatBtn) {
  newChatBtn.addEventListener("click", () => {
    activeSessionId = null;
    renderHistoryList();
    renderChatArea();
    setDrawerOpen(false);
    if (inpEl) inpEl.focus();
  });
}

// Inisialisasi saat halaman dibuka: mulai dari chat kosong tanpa percakapan aktif
loadSessions();
activeSessionId = null;
renderHistoryList();
renderChatArea();

// --- 4. Kirim Pesan ke Backend ---
if (formEl && inpEl && btnEl && stEl && chatEl) {
  formEl.onsubmit = async function (e) {
    e.preventDefault();
    const val = inpEl.value.trim();
    if (!val) return;

    closeLongPressMenu();

    let session = getActiveSession();
    if (!session) {
      session = createNewSessionWithFirstMessage(val);
      renderHistoryList();
    }

    const recentHistory = session.messages
      .slice(-CONTEXT_MESSAGE_LIMIT)
      .map((m) => ({
        role: m.cls === "user" ? "user" : "assistant",
        content: m.text
      }));

    session.messages.push({ text: val, cls: "user" });
    saveSessions();
    appendMessageDOM(val, "user");

    inpEl.value = "";
    inpEl.disabled = true;
    btnEl.disabled = true;
    stEl.textContent = "thinking...";
    const loadingBubble = appendMessageDOM("...", "bot");

    if (!BACKEND_API_URL) {
      if (loadingBubble) loadingBubble.textContent = SERVER_UNAVAILABLE_MESSAGE;
      session.messages.push({ text: SERVER_UNAVAILABLE_MESSAGE, cls: "bot" });
      saveSessions();
      stEl.textContent = "Error";
      inpEl.disabled = false;
      btnEl.disabled = false;
      inpEl.focus();
      return;
    }

    try {
      const r = await fetch(BACKEND_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
          "ngrok-skip-browser-warning": "true"
        },
        body: JSON.stringify({
          message: val,
          history: recentHistory
        })
      });

      if (!r.ok) {
        if (loadingBubble) {
          loadingBubble.textContent = SERVER_UNAVAILABLE_MESSAGE;
          chatEl.scrollTop = chatEl.scrollHeight;
        }
        session.messages.push({ text: SERVER_UNAVAILABLE_MESSAGE, cls: "bot" });
        saveSessions();
        stEl.textContent = "Error";
        return;
      }

      const rawText = await r.text();
      let data = {};
      try {
        data = JSON.parse(rawText);
      } catch (_) {
        data = {};
      }

      const replyText = data.reply || SERVER_UNAVAILABLE_MESSAGE;

      if (loadingBubble) {
        loadingBubble.textContent = replyText;
        chatEl.scrollTop = chatEl.scrollHeight;
      }

      session.messages.push({ text: replyText, cls: "bot" });
      saveSessions();
      stEl.textContent = "Siap";
    } catch (_) {
      if (loadingBubble) {
        loadingBubble.textContent = SERVER_UNAVAILABLE_MESSAGE;
        chatEl.scrollTop = chatEl.scrollHeight;
      }
      session.messages.push({ text: SERVER_UNAVAILABLE_MESSAGE, cls: "bot" });
      saveSessions();
      stEl.textContent = "Error";
    } finally {
      inpEl.disabled = false;
      btnEl.disabled = false;
      inpEl.focus();
    }
  };
}
