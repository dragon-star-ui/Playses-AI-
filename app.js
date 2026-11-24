const BACKEND_API_URL = "https://regular-datebook-outburst.ngrok-free.dev/chat";
const API_KEY = "playses-ai-key-tetap";
const DISCORD_INVITE_URL = "https://discord.gg/QxRSNFfU5B";
const SHARE_BASE_URL = "https://dragon-star-ui.github.io/Playses-AI-/index.html";
const SERVER_UNAVAILABLE_TEXT =
  "Sorry, there is a problem with the server or the server is down/not yet activated. Please check the server status in our discord community";

const THINKING_STEPS = [
  "Thinking...",
  "Reading your message...",
  "Running LSTM inference...",
  "Crafting the reply..."
];

const DUMMY_GREETINGS = [
  "Hey there! What would you like to talk about today?",
  "Hello! Drop a message whenever you're ready.",
  "Hi! Good to see you here—ask me anything.",
  "Welcome back! Start typing below to begin a chat.",
  "Hey! Ready to chat—what's on your mind?"
];

const STORAGE_SESSIONS_KEY = "playses_ai_sessions_v1";
const STORAGE_SHARE_MODE_KEY = "playses_ai_share_mode_v1";
const CONTEXT_MESSAGE_LIMIT = 6;
const LONG_PRESS_DURATION_MS = 500;
const TYPEWRITER_DELAY_MS = 40;

function showToast(msg) {
  const toastEl = document.getElementById("toast");
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toastEl.classList.remove("show");
  }, 2400);
}

window.addEventListener("error", (event) => {
  showToast("JS Error: " + (event.message || "unknown error"));
});

const stEl = document.getElementById("st");
const statusDotEl = document.getElementById("statusDot");

function setStatusLabel(label, dotMode) {
  if (stEl) stEl.textContent = label;
  if (statusDotEl) {
    statusDotEl.classList.remove("online", "offline");
    if (dotMode === "online") statusDotEl.classList.add("online");
    else if (dotMode === "offline") statusDotEl.classList.add("offline");
  }
}

setStatusLabel("Ready", "online");

function getShareMode() {
  const mode = localStorage.getItem(STORAGE_SHARE_MODE_KEY);
  return mode === "private" ? "private" : "public";
}

function setShareMode(mode) {
  localStorage.setItem(STORAGE_SHARE_MODE_KEY, mode === "private" ? "private" : "public");
}

function initSettingPage() {
  const radios = document.querySelectorAll('input[name="shareMode"]');
  const savedMsgEl = document.getElementById("settingSavedMsg");
  if (!radios.length) return;

  const currentMode = getShareMode();
  radios.forEach((radio) => {
    radio.checked = radio.value === currentMode;
    radio.addEventListener("change", () => {
      if (radio.checked) {
        setShareMode(radio.value);
        if (savedMsgEl) {
          savedMsgEl.textContent = `Saved: shared link mode is now ${radio.value}.`;
        }
        showToast(`Share mode: ${radio.value}`);
      }
    });
  });
}

function setDrawerOpen(isOpen) {
  const drawerEl = document.getElementById("drawer");
  const backdropEl = document.getElementById("backdrop");
  if (drawerEl) drawerEl.classList.toggle("open", isOpen);
  if (backdropEl) backdropEl.classList.toggle("show", isOpen);
  if (!isOpen) {
    closeHistoryActionMenu();
    closeMsgActionMenu();
  }
}

document.addEventListener("click", (e) => {
  const openBtn = e.target.closest("#openDrawer, .burger-btn");
  if (openBtn) {
    e.preventDefault();
    const drawerEl = document.getElementById("drawer");
    const isCurrentlyOpen = drawerEl ? drawerEl.classList.contains("open") : false;
    setDrawerOpen(!isCurrentlyOpen);
    return;
  }

  const closeBtn = e.target.closest("#closeDrawer, .close-btn");
  if (closeBtn) {
    e.preventDefault();
    setDrawerOpen(false);
    return;
  }

  if (e.target && e.target.id === "backdrop") {
    setDrawerOpen(false);
  }
});

const chatEl = document.getElementById("chat");
const formEl = document.getElementById("f");
const inpEl = document.getElementById("inp");
const btnEl = document.getElementById("btn");

const newChatBtn = document.getElementById("newChatBtn");
const historyListEl = document.getElementById("historyList");
const actionMenuEl = document.getElementById("historyActionMenu");
const renameHistoryBtn = document.getElementById("renameHistoryBtn");
const shareHistoryBtn = document.getElementById("shareHistoryBtn");
const deleteHistoryBtn = document.getElementById("deleteHistoryBtn");

const msgActionMenuEl = document.getElementById("msgActionMenu");
const copyMsgBtn = document.getElementById("copyMsgBtn");

let sessions = [];
let activeSessionId = null;
let selectedSessionIdForMenu = null;
let selectedBotMessageText = "";
let privateLinkBlocked = false;
let cancelPendingLongPress = null;

function generateRandomChatCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

function loadSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_SESSIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    sessions = Array.isArray(parsed) ? parsed : [];
    sessions.forEach((s) => {
      if (!s.shareCode) {
        s.shareCode = generateRandomChatCode();
      }
    });
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

function buildShareUrl(session) {
  return `${SHARE_BASE_URL}?chat=${encodeURIComponent(session.shareCode)}`;
}

function updateUrlForSession(session) {
  if (!chatEl) return;
  try {
    const url = new URL(window.location.href);
    if (session && session.shareCode) {
      url.searchParams.set("chat", session.shareCode);
    } else {
      url.searchParams.delete("chat");
    }
    window.history.replaceState({}, "", url.toString());
  } catch (_) {}
}

function createNewSessionWithFirstMessage(userText) {
  privateLinkBlocked = false;
  const newSession = {
    id: generateSessionId(),
    shareCode: generateRandomChatCode(),
    title: buildTitleFromMessage(userText),
    createdAt: Date.now(),
    messages: []
  };
  sessions.unshift(newSession);
  activeSessionId = newSession.id;
  saveSessions();
  updateUrlForSession(newSession);
  return newSession;
}

function setMessageBubbleContent(el, text) {
  if (!el) return;
  el.innerHTML = "";

  const marker = "discord community";
  const markerIdx = text.indexOf(marker);

  if (text.startsWith("Sorry, there is a problem with the server") && markerIdx !== -1) {
    const beforeAndMarker = text.slice(0, markerIdx + marker.length);
    const afterMarker = text.slice(markerIdx + marker.length);

    el.appendChild(document.createTextNode(beforeAndMarker + " "));

    const linkEl = document.createElement("a");
    linkEl.href = DISCORD_INVITE_URL;
    linkEl.textContent = DISCORD_INVITE_URL;
    linkEl.target = "_blank";
    linkEl.rel = "noopener noreferrer";
    linkEl.style.color = "#6ea8fe";
    linkEl.style.textDecoration = "underline";
    linkEl.style.wordBreak = "break-all";
    el.appendChild(linkEl);

    if (afterMarker) {
      el.appendChild(document.createTextNode(afterMarker));
    }
    return;
  }

  el.textContent = text;
}

async function copyToClipboard(text) {
  if (!text) return false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) {}
  try {
    const helper = document.createElement("textarea");
    helper.value = text;
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    document.body.appendChild(helper);
    helper.select();
    document.execCommand("copy");
    document.body.removeChild(helper);
    return true;
  } catch (_) {
    return false;
  }
}

function closeMsgActionMenu() {
  selectedBotMessageText = "";
  if (msgActionMenuEl) {
    msgActionMenuEl.classList.remove("show");
    msgActionMenuEl.setAttribute("aria-hidden", "true");
  }
}

function openMsgActionMenu(text, x, y, anchorEl) {
  if (!msgActionMenuEl || !text) return;
  selectedBotMessageText = text;

  let posX = typeof x === "number" && x > 0 ? x : 24;
  let posY = typeof y === "number" && y > 0 ? y : 120;

  if ((!x || !y) && anchorEl) {
    const rect = anchorEl.getBoundingClientRect();
    posX = rect.left + 10;
    posY = rect.bottom + 6;
  }

  const maxX = Math.max(12, window.innerWidth - 150);
  const maxY = Math.max(12, window.innerHeight - 70);
  msgActionMenuEl.style.left = Math.min(posX, maxX) + "px";
  msgActionMenuEl.style.top = Math.min(posY, maxY) + "px";

  msgActionMenuEl.classList.add("show");
  msgActionMenuEl.setAttribute("aria-hidden", "false");
}

if (copyMsgBtn) {
  copyMsgBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const textToCopy = selectedBotMessageText;
    closeMsgActionMenu();
    const ok = await copyToClipboard(textToCopy);
    showToast(ok ? "Copied" : "Copy failed");
  });
}

function bindBotBubbleLongPress(el, getTextFn) {
  let timer = null;
  let startX = 0;
  let startY = 0;

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  cancelPendingLongPress = clearTimer;

  el.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse") return;
    startX = e.clientX;
    startY = e.clientY;
    const xAtDown = e.clientX;
    const yAtDown = e.clientY;
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      const currentText = getTextFn();
      if (currentText) {
        openMsgActionMenu(currentText, xAtDown, yAtDown, el);
      }
    }, LONG_PRESS_DURATION_MS);
  });

  el.addEventListener("pointermove", (e) => {
    if (timer === null) return;
    if (Math.abs(e.clientX - startX) > 6 || Math.abs(e.clientY - startY) > 6) {
      clearTimer();
    }
  });

  el.addEventListener("pointerup", clearTimer);
  el.addEventListener("pointercancel", clearTimer);

  el.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    clearTimer();
    const currentText = getTextFn();
    if (currentText) {
      openMsgActionMenu(currentText, e.clientX, e.clientY, el);
    }
  });
}

function appendMessageDOM(text, cls) {
  if (!chatEl) return null;
  const d = document.createElement("div");
  d.className = "msg " + cls;
  setMessageBubbleContent(d, text);
  if (cls === "bot") {
    d.dataset.fullText = text;
    bindBotBubbleLongPress(d, () => d.dataset.fullText || d.textContent || "");
  }
  chatEl.appendChild(d);
  chatEl.scrollTop = chatEl.scrollHeight;
  return d;
}

function renderRandomDummyGreeting() {
  if (!chatEl) return;
  const greeting = DUMMY_GREETINGS[Math.floor(Math.random() * DUMMY_GREETINGS.length)];
  const box = document.createElement("div");
  box.className = "dummy-greeting";
  box.textContent = greeting;
  chatEl.appendChild(box);
}

function renderChatArea() {
  if (!chatEl) return;
  chatEl.innerHTML = "";

  if (privateLinkBlocked) {
    const notice = document.createElement("div");
    notice.className = "system-msg";
    notice.textContent = "This chat link is set to Private and cannot be opened.";
    chatEl.appendChild(notice);
    return;
  }

  const current = getActiveSession();
  if (!current || !Array.isArray(current.messages) || current.messages.length === 0) {
    renderRandomDummyGreeting();
    return;
  }

  current.messages.forEach((m) => {
    appendMessageDOM(m.text, m.cls);
  });
}

function closeHistoryActionMenu() {
  selectedSessionIdForMenu = null;
  if (actionMenuEl) {
    actionMenuEl.classList.remove("show");
    actionMenuEl.setAttribute("aria-hidden", "true");
  }
}

function openHistoryActionMenu(sessionId, anchorEl) {
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

function renameSessionById(sessionId) {
  const sess = sessions.find((s) => s.id === sessionId);
  if (!sess) return;
  const nextTitle = window.prompt("Rename chat:", sess.title || "New Chat");
  if (nextTitle !== null) {
    const trimmed = nextTitle.trim();
    if (trimmed) {
      sess.title = trimmed;
      saveSessions();
      renderHistoryList();
      showToast("Title updated");
    }
  }
  closeHistoryActionMenu();
}

async function shareSessionById(sessionId) {
  const sess = sessions.find((s) => s.id === sessionId);
  if (!sess) return;
  if (!sess.shareCode) {
    sess.shareCode = generateRandomChatCode();
    saveSessions();
  }
  const shareUrl = buildShareUrl(sess);
  const copied = await copyToClipboard(shareUrl);
  closeHistoryActionMenu();
  showToast(copied ? `Share link copied: ${shareUrl}` : shareUrl);
}

function deleteSessionById(sessionId) {
  if (!sessionId) return;
  sessions = sessions.filter((s) => s.id !== sessionId);
  saveSessions();

  if (activeSessionId === sessionId) {
    activeSessionId = null;
    privateLinkBlocked = false;
    updateUrlForSession(null);
    renderChatArea();
  }

  closeHistoryActionMenu();
  renderHistoryList();
  showToast("Chat deleted");
}

if (renameHistoryBtn) {
  renameHistoryBtn.addEventListener("click", () => {
    if (selectedSessionIdForMenu) renameSessionById(selectedSessionIdForMenu);
  });
}

if (shareHistoryBtn) {
  shareHistoryBtn.addEventListener("click", () => {
    if (selectedSessionIdForMenu) shareSessionById(selectedSessionIdForMenu);
  });
}

if (deleteHistoryBtn) {
  deleteHistoryBtn.addEventListener("click", () => {
    if (selectedSessionIdForMenu) deleteSessionById(selectedSessionIdForMenu);
  });
}

document.addEventListener("pointerdown", (e) => {
  if (actionMenuEl && actionMenuEl.classList.contains("show")) {
    if (!actionMenuEl.contains(e.target) && !e.target.closest(".history-item")) {
      closeHistoryActionMenu();
    }
  }
  if (msgActionMenuEl && msgActionMenuEl.classList.contains("show")) {
    if (!msgActionMenuEl.contains(e.target) && !e.target.closest(".bot")) {
      closeMsgActionMenu();
    }
  }
});

if (chatEl) {
  chatEl.addEventListener("scroll", () => {
    if (typeof cancelPendingLongPress === "function") cancelPendingLongPress();
    closeMsgActionMenu();
  });
}

function renderHistoryList() {
  if (!historyListEl) return;
  closeHistoryActionMenu();

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
        openHistoryActionMenu(sess.id, itemBtn);
      }, LONG_PRESS_DURATION_MS);
    });

    itemBtn.addEventListener("pointermove", (e) => {
      if (pressTimer === null) return;
      if (Math.abs(e.clientX - startX) > 6 || Math.abs(e.clientY - startY) > 6) {
        clearPressTimer();
      }
    });

    itemBtn.addEventListener("pointerup", clearPressTimer);
    itemBtn.addEventListener("pointercancel", clearPressTimer);

    itemBtn.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      clearPressTimer();
      openHistoryActionMenu(sess.id, itemBtn);
    });

    itemBtn.addEventListener("click", () => {
      if (longPressTriggered) {
        longPressTriggered = false;
        return;
      }
      if (actionMenuEl && actionMenuEl.classList.contains("show")) {
        closeHistoryActionMenu();
        return;
      }
      privateLinkBlocked = false;
      activeSessionId = sess.id;
      updateUrlForSession(sess);
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
    privateLinkBlocked = false;
    updateUrlForSession(null);
    renderHistoryList();
    renderChatArea();
    setDrawerOpen(false);
    if (inpEl) inpEl.focus();
  });
}

function typeReply(bubbleEl, fullText) {
  return new Promise((resolve) => {
    if (!bubbleEl) {
      resolve();
      return;
    }
    bubbleEl.dataset.fullText = fullText;
    bubbleEl.textContent = "";
    const chars = Array.from(fullText);
    let i = 0;

    const interval = setInterval(() => {
      if (i < chars.length) {
        bubbleEl.textContent += chars[i];
        i += 1;
        if (chatEl) chatEl.scrollTop = chatEl.scrollHeight;
      } else {
        clearInterval(interval);
        setMessageBubbleContent(bubbleEl, fullText);
        if (msgActionMenuEl && msgActionMenuEl.classList.contains("show")) {
          selectedBotMessageText = fullText;
        }
        if (chatEl) chatEl.scrollTop = chatEl.scrollHeight;
        resolve();
      }
    }, TYPEWRITER_DELAY_MS);
  });
        }
                             if (formEl && inpEl && btnEl && chatEl) {
  formEl.onsubmit = async function (e) {
    e.preventDefault();
    const val = inpEl.value.trim();
    if (!val) return;

    closeHistoryActionMenu();
    closeMsgActionMenu();

    let session = getActiveSession();
    if (!session) {
      session = createNewSessionWithFirstMessage(val);
      renderHistoryList();
    } else {
      updateUrlForSession(session);
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
    setStatusLabel("Thinking...", "online");

    let stepIdx = 0;
    const loadingBubble = appendMessageDOM(THINKING_STEPS[0], "bot");
    if (loadingBubble) loadingBubble.dataset.fullText = "";
    const thinkingTimer = setInterval(() => {
      stepIdx = (stepIdx + 1) % THINKING_STEPS.length;
      const nextStep = THINKING_STEPS[stepIdx];
      if (loadingBubble) {
        loadingBubble.textContent = nextStep;
        if (chatEl) chatEl.scrollTop = chatEl.scrollHeight;
      }
      if (stEl) stEl.textContent = nextStep;
    }, 1100);

    const stopThinking = () => {
      clearInterval(thinkingTimer);
    };

    const showServerUnavailable = async () => {
      stopThinking();
      setStatusLabel("Offline", "offline");
      if (loadingBubble) {
        await typeReply(loadingBubble, SERVER_UNAVAILABLE_TEXT);
      }
      session.messages.push({ text: SERVER_UNAVAILABLE_TEXT, cls: "bot" });
      saveSessions();
    };

    if (!BACKEND_API_URL) {
      await showServerUnavailable();
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
        await showServerUnavailable();
        return;
      }

      const rawText = await r.text();
      let data = {};
      try {
        data = JSON.parse(rawText);
      } catch (_) {
        data = {};
      }

      stopThinking();

      if (!data.reply) {
        await showServerUnavailable();
        return;
      }

      setStatusLabel("Online", "online");
      const replyText = String(data.reply);
      if (loadingBubble) {
        await typeReply(loadingBubble, replyText);
      }

      session.messages.push({ text: replyText, cls: "bot" });
      saveSessions();
    } catch (_) {
      await showServerUnavailable();
    } finally {
      stopThinking();
      inpEl.disabled = false;
      btnEl.disabled = false;
      inpEl.focus();
    }
  };
}

initSettingPage();
loadSessions();
renderHistoryList();
setStatusLabel("Ready", "online");

if (chatEl) {
  const params = new URLSearchParams(window.location.search);
  const sharedCode = params.get("chat");

  if (sharedCode) {
    const matchedSession = sessions.find((s) => s.shareCode === sharedCode);
    if (getShareMode() === "private") {
      activeSessionId = null;
      privateLinkBlocked = true;
    } else if (matchedSession) {
      activeSessionId = matchedSession.id;
      privateLinkBlocked = false;
    } else {
      activeSessionId = null;
      privateLinkBlocked = false;
    }
  } else {
    activeSessionId = null;
    privateLinkBlocked = false;
  }

  renderChatArea();
}
