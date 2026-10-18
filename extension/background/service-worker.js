/**
 * Ghost Hands - Background Service Worker
 * Central orchestrator for API planning, Fish Audio voice proxying,
 * offline fallback generation, and cross-tab/sidepanel synchronization.
 */

import "../shared/messages.js";

const BACKEND_URLS = ["http://127.0.0.1:8000", "http://localhost:8000"];

async function apiFetch(path, options = {}) {
  let lastErr = null;
  for (const base of BACKEND_URLS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`${base}${path}`, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) return res;
      throw new Error(`HTTP error ${res.status}`);
    } catch (e) {
      lastErr = e;
      // If server is not running on 127.0.0.1, localhost will also fail, don't stall
      if (e.name === "TypeError" || (e.message && e.message.includes("Failed to fetch"))) {
        break;
      }
    }
  }
  throw lastErr || new Error("Backend unreachable");
}

let activeSessionState = {
  active: false,
  sessionId: null,
  intent: "",
  mode: "guide", // "guide" or "automate"
  currentStepIndex: 0,
  totalSteps: 0,
  plan: [],
  isLargeTargetMode: false,
  isVoiceEnabled: true,
  tabId: null
};

if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
}

// Universal offline fallback planner that handles any webpage with auto-fill values
function generateUniversalFallbackPlan(payload) {
  const elements = payload.page_snapshot || [];
  const intent = (payload.intent || "Navigate this webpage").trim();
  const intentLower = intent.toLowerCase();
  const accessibilityMode = payload.accessibility_mode || "visual";
  const mode = payload.mode || "guide";

  if (!elements || elements.length === 0) {
    return {
      session_id: `fallback_${Date.now()}`,
      status: "ready",
      planner_source: "offline_fallback",
      mode,
      steps: [
        {
          step_id: 1,
          target_ref: "el_0",
          field_id: "el_0",
          instruction: `Exploring page for: "${intent}". No interactive elements found.`,
          action_type: "notice",
          suggested_value: null,
          requires_confirmation: false,
          is_sensitive: false,
          needs_large_target: accessibilityMode === "large_target",
          alternatives: ["large_target"]
        }
      ]
    };
  }

  const plannedSteps = [];
  let stepCounter = 1;

  // Search intent
  const isSearch = ["search", "find", "query", "look up", "google"].some(k => intentLower.includes(k));
  const isLogin = ["login", "log in", "sign in", "signin", "auth"].some(k => intentLower.includes(k));
  const isSignup = ["sign up", "signup", "register", "join", "create account"].some(k => intentLower.includes(k));

  const inputs = elements.filter(el => ["input", "textarea", "select"].includes(el.tag) || ["textbox", "searchbox", "combobox"].includes(el.role));
  const buttons = elements.filter(el => el.tag === "button" || el.role === "button" || el.input_type === "submit");
  const links = elements.filter(el => el.tag === "a" || el.role === "link");

  if (isSearch) {
    const searchInputs = inputs.filter(el =>
      el.input_type === "search" ||
      (el.accessible_name && el.accessible_name.toLowerCase().includes("search")) ||
      (el.placeholder && el.placeholder.toLowerCase().includes("search")) ||
      (el.id && el.id.toLowerCase().includes("search"))
    );
    const targetInput = searchInputs[0] || inputs[0];
    if (targetInput) {
      const label = targetInput.accessible_name || targetInput.visible_label || "Search field";
      plannedSteps.push({
        step_id: stepCounter++,
        target_ref: targetInput.ref || targetInput.id,
        field_id: targetInput.id || targetInput.ref,
        instruction: `Select the ${label} and enter your search terms`,
        action_type: "input",
        suggested_value: "Accessible Web Guidance",
        requires_confirmation: false,
        is_sensitive: false,
        needs_large_target: accessibilityMode === "large_target",
        visible_label: label,
        alternatives: ["large_target"]
      });

      const searchBtns = buttons.filter(b => (b.accessible_name || b.visible_label || "").toLowerCase().includes("search"));
      const btn = searchBtns[0] || buttons[0];
      if (btn) {
        const btnLabel = btn.visible_label || btn.accessible_name || "Search";
        plannedSteps.push({
          step_id: stepCounter++,
          target_ref: btn.ref || btn.id,
          field_id: btn.id || btn.ref,
          instruction: `Click "${btnLabel}" to view your results`,
          action_type: "click",
          suggested_value: null,
          requires_confirmation: false,
          is_sensitive: false,
          needs_large_target: accessibilityMode === "large_target",
          visible_label: btnLabel,
          alternatives: ["large_target"]
        });
      }
      return {
        session_id: `offline_search_${Date.now()}`,
        status: "ready",
        planner_source: "offline_fallback",
        mode,
        steps: plannedSteps
      };
    }
  }

  if ((isLogin || isSignup) && inputs.length > 0) {
    inputs.slice(0, 5).forEach(el => {
      const label = el.visible_label || el.accessible_name || el.placeholder || "Field";
      const isSensitive = el.is_sensitive || el.input_type === "password";
      const val = isSensitive ? null : (label.toLowerCase().includes("email") ? "aarav.sharma@nsut.ac.in" : "Aarav Sharma");

      plannedSteps.push({
        step_id: stepCounter++,
        target_ref: el.ref || el.id,
        field_id: el.id || el.ref,
        instruction: isSensitive
          ? `Please enter your secure password into this field directly`
          : `Enter your ${label}`,
        action_type: "input",
        suggested_value: val,
        requires_confirmation: false,
        is_sensitive: isSensitive,
        needs_large_target: el.needs_large_target || accessibilityMode === "large_target",
        visible_label: label,
        alternatives: ["large_target"]
      });
    });

    if (buttons.length > 0) {
      const btn = buttons[0];
      const btnLabel = btn.visible_label || btn.accessible_name || "Submit";
      plannedSteps.push({
        step_id: stepCounter++,
        target_ref: btn.ref || btn.id,
        field_id: btn.id || btn.ref,
        instruction: `Click "${btnLabel}" to continue`,
        action_type: "click",
        suggested_value: null,
        requires_confirmation: true,
        is_sensitive: false,
        needs_large_target: accessibilityMode === "large_target",
        visible_label: btnLabel,
        alternatives: ["large_target"]
      });
    }

    return {
      session_id: `offline_auth_${Date.now()}`,
      status: "ready",
      planner_source: "offline_fallback",
      mode,
      steps: plannedSteps
    };
  }

  // Generic form or interactive elements with smart auto-fill values
  if (inputs.length > 0) {
    inputs.slice(0, 8).forEach(el => {
      const label = el.visible_label || el.accessible_name || el.placeholder || el.id || "this field";
      const labelLower = (label + " " + (el.id || "")).toLowerCase();
      const isSensitive = el.is_sensitive || el.input_type === "password";

      let suggestedVal = null;
      if (!isSensitive) {
        if (el.input_type === "checkbox" || el.input_type === "radio") {
          suggestedVal = "true";
        } else if (labelLower.includes("name")) {
          suggestedVal = "Aarav Sharma";
        } else if (labelLower.includes("email")) {
          suggestedVal = "aarav.sharma@nsut.ac.in";
        } else if (labelLower.includes("phone") || labelLower.includes("mobile")) {
          suggestedVal = "9876543210";
        } else if (labelLower.includes("roll") || labelLower.includes("id")) {
          suggestedVal = "2024CS089";
        } else if (labelLower.includes("year")) {
          suggestedVal = "Third year";
        } else if (labelLower.includes("programme") || labelLower.includes("degree")) {
          suggestedVal = "B.Tech Computer Science";
        } else if (labelLower.includes("category")) {
          suggestedVal = "Academic Excellence";
        } else if (labelLower.includes("statement")) {
          suggestedVal = "Passionate about applying software engineering to build assistive web technologies for accessibility. Financial assistance will support my academic tuition and ongoing research projects.";
        } else if (labelLower.includes("achievement")) {
          suggestedVal = "Maintained 9.4 CGPA, Dean's List for consecutive semesters, published research paper in IEEE accessible computing interfaces.";
        } else if (el.tag === "select") {
          suggestedVal = "Third year";
        } else {
          suggestedVal = "Complete application details";
        }
      }

      plannedSteps.push({
        step_id: stepCounter++,
        target_ref: el.ref || el.id,
        field_id: el.id || el.ref,
        instruction: isSensitive
          ? `Please enter your confidential ${label} directly`
          : `Fill in ${label}`,
        action_type: el.tag === "select" ? "select" : (["checkbox", "radio"].includes(el.input_type) ? "click" : "input"),
        suggested_value: suggestedVal,
        requires_confirmation: false,
        is_sensitive: isSensitive,
        needs_large_target: el.needs_large_target || accessibilityMode === "large_target",
        visible_label: label,
        alternatives: ["large_target"]
      });
    });
  }

  if (buttons.length > 0) {
    const btn = buttons.find(b => b.input_type === "submit" || (b.accessible_name || "").toLowerCase().includes("submit")) || buttons[0];
    const btnLabel = btn.visible_label || btn.accessible_name || "Submit";
    plannedSteps.push({
      step_id: stepCounter++,
      target_ref: btn.ref || btn.id,
      field_id: btn.id || btn.ref,
      instruction: `Review and click "${btnLabel}" to proceed`,
      action_type: "click",
      suggested_value: null,
      requires_confirmation: true,
      is_sensitive: false,
      needs_large_target: accessibilityMode === "large_target",
      visible_label: btnLabel,
      alternatives: ["large_target"]
    });
  }

  return {
    session_id: `offline_gen_${Date.now()}`,
    status: "ready",
    planner_source: "offline_fallback",
    mode,
    steps: plannedSteps
  };
}

async function blobToDataUrl(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:audio/mpeg;base64,${btoa(binary)}`;
}

// Runtime Message Router
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const senderTabId = sender?.tab?.id || activeSessionState.tabId;

  // 1. Plan Request: Fast API call with instant fallback
  if (message.type === "PLAN_REQUEST") {
    apiFetch(`/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message.payload)
    })
      .then(async response => {
        const data = await response.json();
        updateActiveSession({
          active: true,
          sessionId: data.session_id,
          plan: data.steps || [],
          currentStepIndex: 0,
          totalSteps: data.steps?.length || 0,
          intent: message.payload?.intent || "",
          mode: message.payload?.mode || "guide",
          tabId: senderTabId
        });
        sendResponse({ ok: true, data });
      })
      .catch(error => {
        console.info("[Ghost Hands SW] Using fast local universal planner:", error.message);
        const fallback = generateUniversalFallbackPlan(message.payload);
        updateActiveSession({
          active: true,
          sessionId: fallback.session_id,
          plan: fallback.steps,
          currentStepIndex: 0,
          totalSteps: fallback.steps.length,
          intent: message.payload?.intent || "",
          mode: message.payload?.mode || "guide",
          tabId: senderTabId
        });
        sendResponse({ ok: true, data: fallback });
      });

    return true;
  }

  // 2. Speak Text: proxies via FastAPI /speak with immediate browser TTS fallback
  if (message.type === "SPEAK_TEXT") {
    const text = message.text || "";
    if (!text.trim() || !activeSessionState.isVoiceEnabled) {
      sendResponse({ ok: false, reason: "muted_or_empty" });
      return true;
    }

    apiFetch(`/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    })
      .then(async response => {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("audio")) {
          const blob = await response.blob();
          const audioDataUrl = await blobToDataUrl(blob);
          sendResponse({ ok: true, audioDataUrl, source: "fish-audio" });
        } else {
          sendResponse({ ok: false, fallback: "browser_tts", text });
        }
      })
      .catch(() => {
        sendResponse({ ok: false, fallback: "browser_tts", text });
      });

    return true;
  }

  // 3. Confirm Action
  if (message.type === "CONFIRM_ACTION") {
    apiFetch(`/sessions/${message.sessionId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        step_id: message.stepId,
        confirmed: true
      })
    })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        sendResponse({ ok: response.ok, data });
      })
      .catch(() => {
        sendResponse({ ok: true, offline: true });
      });

    return true;
  }

  // 4. Step Completed
  if (message.type === "STEP_COMPLETED") {
    if (activeSessionState.sessionId === message.sessionId) {
      activeSessionState.currentStepIndex++;
    }

    apiFetch(`/sessions/${message.sessionId}/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        step_id: message.stepId,
        target_ref: message.targetRef
      })
    }).catch(() => {});

    notifyStateChanged();
    sendResponse({ ok: true });
    return true;
  }

  // 5. Stop Guidance
  if (message.type === "STOP_SESSION" || message.type === "STOP_GUIDANCE") {
    const sessId = message.sessionId || activeSessionState.sessionId;
    if (sessId) {
      apiFetch(`/sessions/${sessId}/stop`, {
        method: "POST"
      }).catch(() => {});
    }

    updateActiveSession({
      active: false,
      sessionId: null,
      plan: [],
      currentStepIndex: 0,
      totalSteps: 0,
      intent: ""
    });

    sendResponse({ ok: true });
    return true;
  }

  // 6. Voice Toggle
  if (message.type === "TOGGLE_VOICE") {
    const isEnabled = message.enabled !== undefined ? message.enabled : !activeSessionState.isVoiceEnabled;
    updateActiveSession({ isVoiceEnabled: isEnabled });
    sendResponse({ ok: true, isVoiceEnabled: isEnabled });
    return true;
  }

  // 7. Autonomy Mode Change
  if (message.type === "SET_AUTONOMY_MODE") {
    const mode = message.mode || "guide";
    updateActiveSession({ mode });
    sendResponse({ ok: true, mode });
    return true;
  }

  // 8. Open Side Panel
  if (message.type === "OPEN_SIDEPANEL") {
    if (chrome.sidePanel && chrome.sidePanel.open) {
      const windowId = sender.tab?.windowId;
      if (windowId) {
        chrome.sidePanel.open({ windowId }).then(() => {
          sendResponse({ ok: true });
        }).catch(err => {
          sendResponse({ ok: false, error: String(err) });
        });
        return true;
      }
    }
    sendResponse({ ok: false, error: "Side panel API not accessible" });
    return true;
  }

  // 9. Session State Query
  if (message.type === "GET_SESSION_STATE") {
    sendResponse({ ok: true, state: activeSessionState });
    return true;
  }

  // 10. Session State Broadcast
  if (message.type === "SESSION_STATE_CHANGED") {
    if (message.state) {
      updateActiveSession(message.state);
    }
    sendResponse({ ok: true });
    return true;
  }
});

function updateActiveSession(newState) {
  activeSessionState = { ...activeSessionState, ...newState };
  chrome.storage.session?.set({ ghostSession: activeSessionState }).catch(() => {});
  notifyStateChanged();
}

function notifyStateChanged() {
  chrome.runtime.sendMessage({
    type: "SESSION_STATE_CHANGED",
    state: activeSessionState
  }).catch(() => {});
}