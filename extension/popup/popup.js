/**
 * Ghost Hands - Universal Popup Controller
 */

const intentInput = document.getElementById("intent");
const startButton = document.getElementById("start");
const stopButton = document.getElementById("stop");
const openSidepanelBtn = document.getElementById("open-sidepanel");
const largeTargetToggle = document.getElementById("large-target-toggle");
const voiceToggle = document.getElementById("voice-toggle");
const statusPill = document.getElementById("status-pill");
const activeBanner = document.getElementById("active-banner");
const bannerStepCount = document.getElementById("banner-step-count");
const bannerInstruction = document.getElementById("banner-instruction");
const quickChips = document.querySelectorAll(".chip");
const modeBtns = document.querySelectorAll(".mode-btn");
const modeDescription = document.getElementById("mode-description");

const micBtn = document.getElementById("mic-btn");
const micLabel = document.getElementById("mic-label");
const micStatus = document.getElementById("mic-status");
const micStatusText = document.getElementById("mic-status-text");

let selectedMode = "guide";
let recognition = null;
let isRecording = false;

const MODE_DESCRIPTIONS = {
  guide: "Step-by-step guidance + interactive Cursor Assistant that explains whatever you hover or point at.",
  automate: "Agentic AI Auto-Fill: asks what details you want to fill (via Voice or Text) and completes form steps comfortably."
};

function updateStartButtonText() {
  if (selectedMode === "automate") {
    startButton.innerHTML = "<span>⚡ Start Auto-Filling</span>";
  } else {
    startButton.innerHTML = "<span>🧭 Start Guided Steps</span>";
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
if (micBtn) {
  micBtn.addEventListener("click", async () => {
    const tab = await getActiveTab();
    if (!tab?.id || isRestrictedUrl(tab.url)) {
      alert("Chrome blocks extensions from running on system pages (like chrome://extensions). Please switch to a web tab (such as https://www.amazon.in or http://localhost:8000/form) to use Ghost Hands.");
      return;
    }
    await ensureContentScript(tab.id, tab.url);
    chrome.tabs.sendMessage(tab.id, {
      type: "START_PAGE_VOICE_CAPTURE",
      mode: selectedMode
    }).catch(() => {});
    window.close();
  });
}

// Listen for voice updates from webpage overlay if popup is active
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
    modeDescription.textContent = MODE_DESCRIPTIONS[selectedMode] || "";
    updateStartButtonText();
    chrome.storage.local?.set({ selectedMode });
    chrome.runtime.sendMessage({ type: "SET_AUTONOMY_MODE", mode: selectedMode });
  });
});

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Ensures content scripts are active on the target tab
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

// Quick chip clicks
quickChips.forEach(chip => {
  chip.addEventListener("click", () => {
    intentInput.value = chip.getAttribute("data-intent");
    intentInput.focus();
  });
});

async function init() {
  updateStartButtonText();
  const tab = await getActiveTab();
  if (!tab?.id) return;

  chrome.storage.local?.get(["isLargeTargetMode", "isVoiceEnabled", "selectedMode"], result => {
    if (result && result.isLargeTargetMode !== undefined) {
      largeTargetToggle.checked = result.isLargeTargetMode;
    }
    if (result && result.isVoiceEnabled !== undefined) {
      voiceToggle.checked = result.isVoiceEnabled;
    }
    if (result && result.selectedMode) {
      selectedMode = result.selectedMode;
      modeBtns.forEach(b => {
        b.classList.toggle("active", b.getAttribute("data-mode") === selectedMode);
      });
      modeDescription.textContent = MODE_DESCRIPTIONS[selectedMode] || "";
      updateStartButtonText();
    }
  });

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_SESSION_STATE" });
    if (response && response.active) {
      updateActiveUI(response);
    }
  } catch (err) {
    chrome.runtime.sendMessage({ type: "GET_SESSION_STATE" }, res => {
      if (res?.state && res.state.active) {
        updateActiveUI(res.state);
      }
    });
  }
}

function updateActiveUI(state) {
  if (state && state.active) {
    statusPill.textContent = "Guiding";
    statusPill.classList.add("active");
    activeBanner.classList.add("visible");
    bannerStepCount.textContent = `Step ${(state.currentStepIndex || 0) + 1} of ${state.totalSteps || 1}`;
    if (state.currentStep) {
      bannerInstruction.textContent = state.currentStep.instruction || "Guided step active on page";
    }
    startButton.textContent = "🔄 Restart Guidance";
  } else {
    statusPill.textContent = "Ready";
    statusPill.classList.remove("active");
    activeBanner.classList.remove("visible");
    updateStartButtonText();
  }

  if (state && state.isLargeTargetMode !== undefined) {
    largeTargetToggle.checked = state.isLargeTargetMode;
  }
  if (state && state.mode) {
    selectedMode = state.mode;
    modeBtns.forEach(b => {
      b.classList.toggle("active", b.getAttribute("data-mode") === selectedMode);
    });
    modeDescription.textContent = MODE_DESCRIPTIONS[selectedMode] || "";
    updateStartButtonText();
  }
}

startButton.addEventListener("click", async () => {
  const tab = await getActiveTab();
  if (!tab?.id || isRestrictedUrl(tab.url)) {
    startButton.disabled = false;
    updateStartButtonText();
    alert("Chrome blocks extensions on system pages (like chrome://extensions). Please switch to a web tab (such as http://localhost:8000/form or https://www.amazon.com) to test Ghost Hands.");
    return;
  }

  const intent = intentInput.value.trim() || "Guide me through this webpage";

  startButton.textContent = "⏳ Analyzing Page...";
  startButton.disabled = true;

  try {
    await ensureContentScript(tab.id, tab.url);

    // Send START_GUIDANCE with retry
    let started = false;
    try {
      const resp = await chrome.tabs.sendMessage(tab.id, {
        type: "START_GUIDANCE",
        intent,
        mode: selectedMode
      });
      if (resp?.ok) started = true;
    } catch (msgErr) {
      await new Promise(r => setTimeout(r, 120));
      const resp = await chrome.tabs.sendMessage(tab.id, {
        type: "START_GUIDANCE",
        intent,
        mode: selectedMode
      });
      if (resp?.ok) started = true;
    }

    statusPill.textContent = "Guiding";
    statusPill.classList.add("active");
    setTimeout(() => window.close(), 60);
  } catch (err) {
    console.error("Failed to start guidance:", err);
    startButton.disabled = false;
    updateStartButtonText();
    alert("Could not start guidance on this page. Please refresh the page (press F5 or reload button) and try again.");
  }
});

// Emergency Stop
stopButton.addEventListener("click", async () => {
  const tab = await getActiveTab();
  if (tab?.id) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "STOP" });
    } catch (e) {}
  }

  chrome.runtime.sendMessage({ type: "STOP_SESSION" });

  statusPill.textContent = "Stopped";
  statusPill.classList.remove("active");
  activeBanner.classList.remove("visible");
  startButton.disabled = false;
  startButton.textContent = "🖐️ Start Guidance";
});

// Large Target Toggle
largeTargetToggle.addEventListener("change", async () => {
  const enabled = largeTargetToggle.checked;
  chrome.storage.local?.set({ isLargeTargetMode: enabled });

  const tab = await getActiveTab();
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
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

  const tab = await getActiveTab();
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: "TOGGLE_VOICE",
      enabled
    }).catch(() => {});
  }
});

// Open Side Panel
openSidepanelBtn.addEventListener("click", async () => {
  const tab = await getActiveTab();
  chrome.runtime.sendMessage({ type: "OPEN_SIDEPANEL" }, () => {
    window.close();
  });
});

init();