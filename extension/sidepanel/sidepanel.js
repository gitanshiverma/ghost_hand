/**
 * Ghost Hands - Universal Side Panel Controller
 */

const statusBadge = document.getElementById("sp-status");
const intentCard = document.getElementById("sp-intent-card");
const intentInput = document.getElementById("sp-intent-input");
const startBtn = document.getElementById("sp-start-btn");
const guidanceCard = document.getElementById("sp-guidance-card");
const stepCount = document.getElementById("sp-step-count");
const progressFill = document.getElementById("sp-progress-fill");
const stepList = document.getElementById("sp-step-list");
const prevBtn = document.getElementById("sp-prev-btn");
const nextBtn = document.getElementById("sp-next-btn");
const stopBtn = document.getElementById("sp-stop-btn");
const largeTargetToggle = document.getElementById("sp-large-target-toggle");
const voiceToggle = document.getElementById("sp-voice-toggle");
const inspectBtn = document.getElementById("sp-inspect-btn");
const inspector = document.getElementById("sp-inspector");
const a11yScoreEl = document.getElementById("sp-a11y-score");
const modeBtns = document.querySelectorAll(".mode-btn");
const quickChips = document.querySelectorAll(".chip");

const spMicBtn = document.getElementById("sp-mic-btn");
const spMicLabel = document.getElementById("sp-mic-label");
const spMicStatus = document.getElementById("sp-mic-status");
const spMicStatusText = document.getElementById("sp-mic-status-text");
const spModeDesc = document.getElementById("sp-mode-desc");

let activeTabId = null;
let currentSessionState = null;
let selectedMode = "guide";
let spRecognition = null;
let spIsRecording = false;

function updateStartBtnText() {
  if (selectedMode === "automate") {
    startBtn.innerHTML = "<span>⚡ Start Auto-Filling</span>";
    if (spModeDesc) {
      spModeDesc.textContent = "Agentic AI Auto-Fill: asks what details you want to fill (via Voice or Text) and completes form steps comfortably.";
    }
  } else {
    startBtn.innerHTML = "<span>🧭 Start Guided Steps</span>";
    if (spModeDesc) {
      spModeDesc.textContent = "Guided steps + intelligent Cursor Assistant that explains whatever you point at.";
    }
  }
}

function isRestrictedUrl(url) {
  if (!url) return true;
  return url.startsWith("chrome://") ||
         url.startsWith("chrome-extension://") ||
         url.startsWith("edge://") ||
         url.startsWith("about:") ||
         url.startsWith("chrome-devtools://") ||
         url.startsWith("view-source:");
}

// Voice Recognition (Delegated to Webpage Context for full MV3 browser speech support)
if (spMicBtn) {
  spMicBtn.addEventListener("click", async () => {
    const tab = await getActiveTab();
    if (!tab?.id || isRestrictedUrl(tab.url)) {
      alert("Chrome blocks extensions on system pages (like chrome://extensions). Please switch to a web tab (such as https://www.amazon.in or http://localhost:8000/form) to use Ghost Hands.");
      return;
    }
    await ensureContentScript(tab.id, tab.url);
    chrome.tabs.sendMessage(tab.id, {
      type: "START_PAGE_VOICE_CAPTURE",
      mode: selectedMode
    }).catch(() => {});
  });
}

// Listen for voice updates from webpage overlay
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "VOICE_INTENT_CAPTURED" && message.text) {
    if (intentInput) {
      intentInput.value = message.text;
    }
  }
});

// Mode selection
modeBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    modeBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedMode = btn.getAttribute("data-mode");
    updateStartBtnText();
    chrome.storage.local?.set({ selectedMode });
    chrome.runtime.sendMessage({ type: "SET_AUTONOMY_MODE", mode: selectedMode });
  });
});

// Quick chips
quickChips.forEach(chip => {
  chip.addEventListener("click", () => {
    intentInput.value = chip.getAttribute("data-intent");
    intentInput.focus();
  });
});

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function ensureContentScript(tabId, url = "") {
  if (isRestrictedUrl(url)) return false;
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: "PING" });
    if (res?.ok) return true;
  } catch (e) {
    try {
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ["content/overlay.css"]
      });
    } catch (cssErr) {}

    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [
          "shared/messages.js",
          "content/overlay.js",
          "content/content-script.js"
        ]
      });
      await new Promise(r => setTimeout(r, 80));
      return true;
    } catch (err) {
      console.warn("Script injection fallback error:", err);
      return false;
    }
  }
  return true;
}

async function init() {
  updateStartBtnText();
  const tab = await getActiveTab();
  if (tab?.id) {
    activeTabId = tab.id;
    refreshState();
    loadAccessibilityScore(tab.id);
  }

  chrome.storage.local?.get(["isLargeTargetMode", "isVoiceEnabled", "selectedMode"], res => {
    if (res && res.isLargeTargetMode !== undefined) {
      largeTargetToggle.checked = res.isLargeTargetMode;
    }
    if (res && res.isVoiceEnabled !== undefined) {
      voiceToggle.checked = res.isVoiceEnabled;
    }
    if (res && res.selectedMode) {
      selectedMode = res.selectedMode;
      modeBtns.forEach(b => {
        b.classList.toggle("active", b.getAttribute("data-mode") === selectedMode);
      });
      updateStartBtnText();
    }
  });
}

async function loadAccessibilityScore(tabId) {
  try {
    await ensureContentScript(tabId);
    const res = await chrome.tabs.sendMessage(tabId, { type: "GET_PAGE_SNAPSHOT" });
    if (res?.snapshot) {
      const score = res.snapshot.accessibility_score || 90;
      a11yScoreEl.textContent = `${score}/100`;
      a11yScoreEl.style.background = score >= 80 ? "#dcfce7" : (score >= 60 ? "#fef3c7" : "#fee2e2");
      a11yScoreEl.style.color = score >= 80 ? "#15803d" : (score >= 60 ? "#b45309" : "#b91c1c");
    }
  } catch (e) {
    a11yScoreEl.textContent = "Ready";
  }
}

async function refreshState() {
  if (!activeTabId) {
    const tab = await getActiveTab();
    if (tab?.id) activeTabId = tab.id;
    else return;
  }

  try {
    const response = await chrome.tabs.sendMessage(activeTabId, { type: "GET_SESSION_STATE" });
    if (response) {
      renderState(response);
    }
  } catch (err) {
    chrome.runtime.sendMessage({ type: "GET_SESSION_STATE" }, res => {
      if (res?.state) renderState(res.state);
    });
  }
}

function renderState(state) {
  if (!state) return;
  currentSessionState = state;

  if (state.mode) {
    selectedMode = state.mode;
    modeBtns.forEach(b => {
      b.classList.toggle("active", b.getAttribute("data-mode") === selectedMode);
    });
  }

  if (state.active && state.plan && state.plan.length > 0) {
    statusBadge.textContent = "Guiding";
    statusBadge.classList.add("active");
    intentCard.style.display = "none";
    guidanceCard.style.display = "block";

    const currIdx = state.currentStepIndex || 0;
    const total = state.totalSteps || state.plan.length;
    stepCount.textContent = `Step ${currIdx + 1} of ${total}`;

    const percentage = Math.round(((currIdx) / total) * 100);
    progressFill.style.width = `${percentage}%`;

    // Render Steps List
    stepList.innerHTML = "";
    state.plan.forEach((step, idx) => {
      const item = document.createElement("div");
      item.className = "step-item";
      if (idx < currIdx) item.classList.add("completed");
      else if (idx === currIdx) item.classList.add("active");

      const icon = document.createElement("div");
      icon.className = "step-icon";
      if (idx < currIdx) icon.textContent = "✓";
      else if (idx === currIdx) icon.textContent = "🖐️";
      else icon.textContent = `${idx + 1}`;

      const content = document.createElement("div");
      content.className = "step-content";

      const title = document.createElement("div");
      title.className = "step-title";
      title.textContent = step.instruction || `Step ${step.step_id}`;

      if (step.is_sensitive) {
        const sensitiveBadge = document.createElement("span");
        sensitiveBadge.className = "step-badge sensitive";
        sensitiveBadge.textContent = "🔒 Sensitive";
        title.appendChild(sensitiveBadge);
      }

      if (step.needs_large_target) {
        const a11yBadge = document.createElement("span");
        a11yBadge.className = "step-badge a11y";
        a11yBadge.textContent = "🎯 Small";
        title.appendChild(a11yBadge);
      }

      content.appendChild(title);

      if (step.visible_label || step.accessible_name) {
        const targetHint = document.createElement("div");
        targetHint.className = "step-target";
        targetHint.textContent = `Target: ${step.visible_label || step.accessible_name}`;
        content.appendChild(targetHint);
      }

      item.appendChild(icon);
      item.appendChild(content);

      item.addEventListener("click", async () => {
        if (activeTabId) {
          chrome.tabs.sendMessage(activeTabId, {
            type: "SHOW_STEP",
            stepIndex: idx
          });
        }
      });

      stepList.appendChild(item);
    });

    prevBtn.disabled = currIdx === 0;
    const currentStep = state.plan[currIdx];
    if (currentStep && currentStep.requires_confirmation) {
      nextBtn.textContent = "Confirm Action ✓";
      nextBtn.style.background = "#16a34a";
    } else {
      nextBtn.textContent = currIdx >= total - 1 ? "Finish ✓" : "Next / Skip →";
      nextBtn.style.background = "#2563eb";
    }
  } else {
    statusBadge.textContent = "Ready";
    statusBadge.classList.remove("active");
    intentCard.style.display = "block";
    guidanceCard.style.display = "none";
    startBtn.disabled = false;
    updateStartBtnText();
  }
}

startBtn.addEventListener("click", async () => {
  const tab = await getActiveTab();
  if (!tab?.id || isRestrictedUrl(tab.url)) {
    alert("Cannot start guidance on browser system pages (like chrome://extensions). Please switch to a website like http://localhost:8000/form or https://www.amazon.in.");
    return;
  }
  activeTabId = tab.id;

  const intent = intentInput.value.trim() || "Guide me through this webpage";

  startBtn.disabled = true;
  startBtn.innerHTML = "<span>⏳ Analyzing Page...</span>";

  try {
    await ensureContentScript(tab.id, tab.url);
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: "START_GUIDANCE",
        intent,
        mode: selectedMode
      });
    } catch (msgErr) {
      await new Promise(r => setTimeout(r, 120));
      await chrome.tabs.sendMessage(tab.id, {
        type: "START_GUIDANCE",
        intent,
        mode: selectedMode
      });
    }
  } catch (err) {
    console.warn("Sidepanel start guidance error:", err);
    startBtn.disabled = false;
    updateStartBtnText();
  }
});

// Previous Step
prevBtn.addEventListener("click", async () => {
  if (activeTabId) {
    chrome.tabs.sendMessage(activeTabId, { type: "PREV_STEP" });
  }
});

// Next Step / Confirm
nextBtn.addEventListener("click", async () => {
  if (activeTabId) {
    chrome.tabs.sendMessage(activeTabId, { type: "NEXT_STEP" });
  }
});

// Emergency Stop
stopBtn.addEventListener("click", async () => {
  if (activeTabId) {
    chrome.tabs.sendMessage(activeTabId, { type: "STOP" });
  }
  chrome.runtime.sendMessage({ type: "STOP_SESSION" });
});

// Large Target Toggle
largeTargetToggle.addEventListener("change", async () => {
  const enabled = largeTargetToggle.checked;
  chrome.storage.local?.set({ isLargeTargetMode: enabled });

  if (activeTabId) {
    chrome.tabs.sendMessage(activeTabId, {
      type: "TOGGLE_LARGE_TARGET",
      enabled
    }).catch(() => {});
  }
});

// Voice Toggle
voiceToggle.addEventListener("change", async () => {
  const enabled = voiceToggle.checked;
  chrome.storage.local?.set({ isVoiceEnabled: enabled });
  chrome.runtime.sendMessage({ type: "TOGGLE_VOICE", enabled });

  if (activeTabId) {
    chrome.tabs.sendMessage(activeTabId, {
      type: "TOGGLE_VOICE",
      enabled
    }).catch(() => {});
  }
});

// Inspect DOM
inspectBtn.addEventListener("click", async () => {
  const tab = await getActiveTab();
  if (!tab?.id) return;

  inspector.textContent = "Analyzing DOM interactive elements...";
  inspector.classList.add("visible");

  try {
    await ensureContentScript(tab.id);
    const res = await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_SNAPSHOT" });
    if (res?.snapshot) {
      inspector.textContent = JSON.stringify(res.snapshot, null, 2);
    } else {
      inspector.textContent = "Failed to capture page elements.";
    }
  } catch (err) {
    inspector.textContent = `Error: ${err.message}`;
  }
});

// State listener
chrome.runtime.onMessage.addListener(message => {
  if (message.type === "SESSION_STATE_CHANGED" && message.state) {
    renderState(message.state);
  }
});

// Tab change tracking
chrome.tabs.onActivated.addListener(activeInfo => {
  activeTabId = activeInfo.tabId;
  refreshState();
  loadAccessibilityScore(activeInfo.tabId);
});

init();
