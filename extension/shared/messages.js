/**
 * Ghost Hands - Shared Message Protocol
 * Defines all message types and schema helpers between Content Scripts, Service Worker,
 * Popup, and Side Panel.
 */

(function (root) {
  if (root.MessageTypes && root.GhostMessages) {
    return;
  }

  const MessageTypes = Object.freeze({
    // Guidance Lifecycle
    START_GUIDANCE: "START_GUIDANCE",
    STOP_GUIDANCE: "STOP_GUIDANCE",
    STOP_SESSION: "STOP_SESSION",
    GUIDANCE_STARTED: "GUIDANCE_STARTED",
    GUIDANCE_STOPPED: "GUIDANCE_STOPPED",

    // Step Navigation & Execution
    SHOW_STEP: "SHOW_STEP",
    STEP_COMPLETED: "STEP_COMPLETED",
    NEXT_STEP: "NEXT_STEP",
    PREV_STEP: "PREV_STEP",
    CONFIRM_ACTION: "CONFIRM_ACTION",

    // DOM Mapping & Snapshots
    GET_PAGE_SNAPSHOT: "GET_PAGE_SNAPSHOT",
    SNAPSHOT_RESPONSE: "SNAPSHOT_RESPONSE",

    // Backend Integration
    PLAN_REQUEST: "PLAN_REQUEST",
    PLAN_RESPONSE: "PLAN_RESPONSE",
    SPEAK_TEXT: "SPEAK_TEXT",

    // State Synchronization & UI
    GET_SESSION_STATE: "GET_SESSION_STATE",
    SESSION_STATE_CHANGED: "SESSION_STATE_CHANGED",
    TOGGLE_LARGE_TARGET: "TOGGLE_LARGE_TARGET",
    TOGGLE_VOICE: "TOGGLE_VOICE",
    SET_AUTONOMY_MODE: "SET_AUTONOMY_MODE",
    OPEN_SIDEPANEL: "OPEN_SIDEPANEL",
    PING: "PING",

    // Voice Interaction
    START_PAGE_VOICE_CAPTURE: "START_PAGE_VOICE_CAPTURE",
    VOICE_INTENT_CAPTURED: "VOICE_INTENT_CAPTURED"
  });

  // Helper creators
  function createPlanRequest(intent, pageSnapshot, accessibilityMode = "visual", mode = "guide", pageTitle = "", url = "") {
    return {
      type: MessageTypes.PLAN_REQUEST,
      payload: {
        intent,
        page_snapshot: pageSnapshot,
        accessibility_mode: accessibilityMode,
        mode,
        page_title: pageTitle,
        url
      }
    };
  }

  function createConfirmAction(sessionId, stepId) {
    return {
      type: MessageTypes.CONFIRM_ACTION,
      sessionId,
      stepId
    };
  }

  function createStopSession(sessionId) {
    return {
      type: MessageTypes.STOP_SESSION,
      sessionId
    };
  }

  function createStepCompleted(sessionId, stepId, targetRef = null) {
    return {
      type: MessageTypes.STEP_COMPLETED,
      sessionId,
      stepId,
      targetRef
    };
  }

  function createSpeakRequest(text) {
    return {
      type: MessageTypes.SPEAK_TEXT,
      text
    };
  }

  // Universal module export pattern
  const GhostMessages = {
    MessageTypes,
    createPlanRequest,
    createConfirmAction,
    createStopSession,
    createStepCompleted,
    createSpeakRequest
  };

  root.MessageTypes = MessageTypes;
  root.GhostMessages = GhostMessages;
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this);
