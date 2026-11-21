const BACKEND_API_URL = "https://regular-datebook-outburst.ngrok-free.dev/chat";
const API_KEY = "playses-ai-key-tetap";
const SERVER_UNAVAILABLE_MESSAGE =
  "Sorry, there is a problem with the server or the server is down/not yet activated";

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

// --- 2. Tampilan Chat Tanpa Riwayat Tersimpan ---
const chatEl = document.getElementById("chat");
const formEl = document.getElementById("f");
const inpEl = document.getElementById("inp");
const btnEl = document.getElementById("btn");
const stEl = document.getElementById("st");

function appendMessageDOM(text, cls) {
  if (!chatEl) return null;
  const d = document.createElement("div");
  d.className = "msg " + cls;
  d.textContent = text;
  chatEl.appendChild(d);
  chatEl.scrollTop = chatEl.scrollHeight;
  return d;
}

if (chatEl) {
  chatEl.innerHTML = "";
  appendMessageDOM(WELCOME_MESSAGE.text, WELCOME_MESSAGE.cls);
}

// --- 3. Kirim Pesan ke Backend ---
if (formEl && inpEl && btnEl && stEl && chatEl) {
  formEl.onsubmit = async function (e) {
    e.preventDefault();
    const val = inpEl.value.trim();
    if (!val) return;

    appendMessageDOM(val, "user");

    inpEl.value = "";
    inpEl.disabled = true;
    btnEl.disabled = true;
    stEl.textContent = "thinking...";
    const loadingBubble = appendMessageDOM("...", "bot");

    if (!BACKEND_API_URL) {
      if (loadingBubble) loadingBubble.textContent = SERVER_UNAVAILABLE_MESSAGE;
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

      stEl.textContent = "Siap";
    } catch (_) {
      if (loadingBubble) {
        loadingBubble.textContent = SERVER_UNAVAILABLE_MESSAGE;
        chatEl.scrollTop = chatEl.scrollHeight;
      }
      stEl.textContent = "Error";
    } finally {
      inpEl.disabled = false;
      btnEl.disabled = false;
      inpEl.focus();
    }
  };
}
