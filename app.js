const BACKEND_API_URL = "https://regular-datebook-outburst.ngrok-free.dev/chat";
const API_KEY = "playses-ai-key-tetap";
const SERVER_UNAVAILABLE_MESSAGE =
  "Sorry, there is a problem with the server or the server is down/not yet activated";

const IDLE_LIMIT_MS = 5 * 60 * 1000; // 5 menit
const STORAGE_MESSAGES_KEY = "playses_ai_messages_v1";
const STORAGE_LAST_ACTIVE_KEY = "playses_ai_last_active_v1";
const WELCOME_MESSAGE = { text: "Hello users, how can I help you?", cls: "bot" };

// --- 1. Menu Samping (Burger Drawer) ---
const openDrawerBtn = document.getElementById("openDrawer");
const closeDrawerBtn = document.getElementById("closeDrawer");
const drawer = document.getElementById("drawer");
const backdrop = document.getElementById("backdrop");

function setDrawerOpen(isOpen) {
  if (!drawer || !backdrop) return;
  drawer.classList.toggle("open", isOpen);
  backdrop.classList.toggle("show", isOpen);
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

// --- 2. Riwayat Chat & Reset Jika Idle >= 5 Menit ---
const chatEl = document.getElementById("chat");
const formEl = document.getElementById("f");
const inpEl = document.getElementById("inp");
const btnEl = document.getElementById("btn");
const stEl = document.getElementById("st");

let messages = [];

function getLastActive() {
  const raw = localStorage.getItem(STORAGE_LAST_ACTIVE_KEY);
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function touchActivity() {
  localStorage.setItem(STORAGE_LAST_ACTIVE_KEY, String(Date.now()));
}

function isExpiredByIdle() {
  const lastActive = getLastActive();
  if (!lastActive) return false;
  return (Date.now() - lastActive) >= IDLE_LIMIT_MS;
}

function saveMessages() {
  localStorage.setItem(STORAGE_MESSAGES_KEY, JSON.stringify(messages));
  touchActivity();
}

function resetMessagesToWelcome() {
  messages = [{ ...WELCOME_MESSAGE }];
  localStorage.setItem(STORAGE_MESSAGES_KEY, JSON.stringify(messages));
  touchActivity();
  renderMessages();
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

function renderMessages() {
  if (!chatEl) return;
  chatEl.innerHTML = "";
  messages.forEach((m) => appendMessageDOM(m.text, m.cls));
}

function loadOrInitMessages() {
  if (!chatEl) return;

  if (isExpiredByIdle()) {
    resetMessagesToWelcome();
    return;
  }

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_MESSAGES_KEY) || "null");
    if (Array.isArray(saved) && saved.length > 0) {
      messages = saved;
    } else {
      messages = [{ ...WELCOME_MESSAGE }];
      localStorage.setItem(STORAGE_MESSAGES_KEY, JSON.stringify(messages));
    }
  } catch (_) {
    messages = [{ ...WELCOME_MESSAGE }];
  }

  touchActivity();
  renderMessages();
}

["pointerdown", "keydown", "scroll", "touchstart"].forEach((evtName) => {
  window.addEventListener(evtName, () => {
    if (isExpiredByIdle()) {
      resetMessagesToWelcome();
    } else {
      touchActivity();
    }
  }, { passive: true });
});

setInterval(() => {
  if (isExpiredByIdle() && chatEl) {
    resetMessagesToWelcome();
  }
}, 10000);

loadOrInitMessages();

// --- 3. Kirim Pesan ke Backend ---
if (formEl && inpEl && btnEl && stEl && chatEl) {
  formEl.onsubmit = async function (e) {
    e.preventDefault();
    const val = inpEl.value.trim();
    if (!val) return;

    if (isExpiredByIdle()) {
      resetMessagesToWelcome();
    }

    messages.push({ text: val, cls: "user" });
    saveMessages();
    appendMessageDOM(val, "user");

    inpEl.value = "";
    inpEl.disabled = true;
    btnEl.disabled = true;
    stEl.textContent = "think...";
    const loadingBubble = appendMessageDOM("...", "bot");

    if (!BACKEND_API_URL) {
      if (loadingBubble) loadingBubble.textContent = SERVER_UNAVAILABLE_MESSAGE;
      messages.push({ text: SERVER_UNAVAILABLE_MESSAGE, cls: "bot" });
      saveMessages();
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
        body: JSON.stringify({ message: val })
      });

      if (!r.ok) {
        if (loadingBubble) {
          loadingBubble.textContent = SERVER_UNAVAILABLE_MESSAGE;
          chatEl.scrollTop = chatEl.scrollHeight;
        }
        messages.push({ text: SERVER_UNAVAILABLE_MESSAGE, cls: "bot" });
        saveMessages();
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

      messages.push({ text: replyText, cls: "bot" });
      saveMessages();
      stEl.textContent = "Siap";
    } catch (_) {
      if (loadingBubble) {
        loadingBubble.textContent = SERVER_UNAVAILABLE_MESSAGE;
        chatEl.scrollTop = chatEl.scrollHeight;
      }
      messages.push({ text: SERVER_UNAVAILABLE_MESSAGE, cls: "bot" });
      saveMessages();
      stEl.textContent = "Error";
    } finally {
      inpEl.disabled = false;
      btnEl.disabled = false;
      inpEl.focus();
    }
  };
}
