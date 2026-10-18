/**
 * Ghost Hands - Ultra-Fast Universal Content Script & Agentic Executor
 * Zero-latency local planning (< 5ms) + Fast Autonomous Auto-Filling
 */

(function () {
  if (window.__GHOST_HANDS_CONTENT_SCRIPT_INITIALIZED__) {
    try {
      if (window.GhostOverlay?.renderFloatingDock) {
        window.GhostOverlay.renderFloatingDock({
          onStartGuidance: (intent, mode) => {
            if (window.GhostContentScript?.startGuidance) {
              window.GhostContentScript.startGuidance(intent, mode);
            }
          }
        });
      }
    } catch (e) {}
    return;
  }
  window.__GHOST_HANDS_CONTENT_SCRIPT_INITIALIZED__ = true;

  let currentSession = null;
  let currentPlan = [];
  let currentStepIndex = 0;
  let currentMode = "guide"; // "guide" or "automate"
  let isLargeTargetMode = false;
  let elementRefCache = new Map();
  let currentCompletionCleanup = null;
  let autoActionTimer = null;
  let hasGrantedAutoFillPermission = false;
  let stepIsAdvancing = false;

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  const SENSITIVE_KEYWORDS = [
    "password", "passwd", "pwd", "otp", "pin", "cvv", "cvc",
    "card", "credit", "debit", "aadhaar", "passport", "ssn",
    "upi", "secret", "token", "auth", "security code", "pan"
  ];

  const KNOWN_SCHOLARSHIP_DEFAULTS = {
    "full-name": "Aarav Sharma",
    "university-email": "aarav.sharma@nsut.ac.in",
    "student-id": "2024CS089",
    "current-year": "Third year",
    "degree-programme": "B.Tech Computer Science",
    "scholarship-category": "Academic Excellence",
    "academic-achievements": "Maintained 9.4 CGPA, Dean's List for consecutive semesters, published research paper in IEEE accessible computing interfaces.",
    "personal-statement": "Passionate about applying software engineering to build assistive web technologies for accessibility. Financial assistance will support my academic tuition and ongoing research projects.",
    "academic-transcript": "academic_transcript.pdf",
    "declaration": "true"
  };

  function isSensitiveElement(element) {
    const type = (element.type || "").toLowerCase();
    if (type === "password") return true;

    const autocomplete = (element.getAttribute("autocomplete") || "").toLowerCase();
    if (
      autocomplete.includes("password") ||
      autocomplete.includes("cc-number") ||
      autocomplete.includes("cc-csc") ||
      autocomplete.includes("one-time-code")
    ) {
      return true;
    }

    const identifiers = [
      element.getAttribute("aria-label"),
      element.name,
      element.id,
      element.placeholder,
      element.getAttribute("data-testid")
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return SENSITIVE_KEYWORDS.some(kw => identifiers.includes(kw));
  }

  function getAssociatedLabelText(element) {
    if (element.labels && element.labels.length > 0) {
      return element.labels[0].innerText || element.labels[0].textContent || "";
    }
    const id = element.id;
    if (id) {
      try {
        const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (label) return label.innerText || label.textContent || "";
      } catch (e) {}
    }
    return "";
  }

  function getAccessibleName(element) {
    const ariaLabel = element.getAttribute("aria-label");
    if (ariaLabel) return ariaLabel.trim();

    const labelText = getAssociatedLabelText(element);
    if (labelText) return labelText.trim();

    const placeholder = element.placeholder;
    if (placeholder && !isSensitiveElement(element)) return placeholder.trim();

    const title = element.getAttribute("title");
    if (title) return title.trim();

    const text = (element.innerText || element.textContent || "").trim();
    if (text) return text.slice(0, 80);

    return "";
  }

  function generateFastSelector(element) {
    if (element.id) {
      try {
        return `#${CSS.escape(element.id)}`;
      } catch (e) {
        return `#${element.id}`;
      }
    }
    const tag = element.tagName.toLowerCase();
    if (element.name && tag !== "form") {
      try {
        return `${tag}[name="${CSS.escape(element.name)}"]`;
      } catch (e) {}
    }
    if (element.getAttribute("data-testid")) {
      return `[data-testid="${CSS.escape(element.getAttribute("data-testid"))}"]`;
    }
    const parent = element.parentElement;
    if (parent && parent.id) {
      try {
        return `#${CSS.escape(parent.id)} > ${tag}`;
      } catch (e) {}
    }
    return tag;
  }

  function extractUserValuesFromIntent(intent) {
    const vals = {};
    const text = (intent || "").trim();
    if (!text) return vals;

    const nameMatch = text.match(/(?:name(?:\s+is|:)?)\s+([A-Za-z\s]+?)(?:,|and|email|roll|student|year|programme|$)/i);
    if (nameMatch) vals.name = nameMatch[1].trim();

    const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) vals.email = emailMatch[1].trim();

    const rollMatch = text.match(/(?:roll|id|student\s*id)(?:\s+is|:)?\s+([A-Za-z0-9]+)/i);
    if (rollMatch) vals.roll = rollMatch[1].trim();

    const searchMatch = text.match(/(?:search\s+(?:for\s+)?|find\s+|buy\s+|look\s+for\s+)(.+)/i);
    if (searchMatch) {
      vals.query = searchMatch[1].trim().replace(/["']/g, "");
    } else if (!nameMatch && !emailMatch && !rollMatch && !text.toLowerCase().includes("guide me") && !text.toLowerCase().includes("auto-fill") && !text.toLowerCase().includes("scholarship")) {
      vals.query = text.replace(/["']/g, "");
    }

    return vals;
  }

  /**
   * Ultra-Fast DOM Snapshot (< 10ms)
   */
  function extractPageSnapshot() {
    elementRefCache.clear();

    const selector = [
      "input:not([type='hidden'])",
      "textarea",
      "select",
      "button",
      "[role='button']",
      "[role='checkbox']",
      "[role='radio']",
      "[role='searchbox']",
      "[role='textbox']",
      "[role='combobox']",
      "[role='switch']",
      "[role='tab']",
      "[contenteditable='true']",
      "form a[href]",
      "nav a[href]",
      "main a[href]"
    ].join(",");

    const candidates = document.querySelectorAll(selector);
    const mapped = [];

    for (let i = 0; i < candidates.length; i++) {
      const el = candidates[i];
      if (el.closest && el.closest("#ghost-hands-overlay-host")) continue;

      if (el.offsetWidth > 0 && el.offsetHeight > 0 && (el.offsetParent !== null || el.tagName === "BODY")) {
        const ref = `el_${mapped.length}`;
        const isSensitive = isSensitiveElement(el);
        const accessibleName = getAccessibleName(el);
        const visibleLabel = getAssociatedLabelText(el);
        const rect = el.getBoundingClientRect();

        elementRefCache.set(ref, el);
        if (el.id) {
          elementRefCache.set(el.id, el);
          elementRefCache.set(`#${el.id}`, el);
        }
        if (el.name) {
          elementRefCache.set(el.name, el);
        }

        mapped.push({
          ref,
          id: el.id || "",
          field_id: el.id || ref,
          highlight_index: mapped.length,
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute("role") || el.tagName.toLowerCase(),
          accessible_name: accessibleName,
          visible_label: visibleLabel,
          placeholder: isSensitive ? "[REDACTED]" : (el.placeholder || "").slice(0, 60),
          input_type: el.type || "",
          required: Boolean(el.required || el.getAttribute("aria-required") === "true"),
          is_sensitive: isSensitive,
          needs_large_target: (rect.width < 44 || rect.height < 44) || (el.type === "checkbox" || el.type === "radio"),
          selector: generateFastSelector(el),
          rect: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          }
        });

        if (mapped.length >= 40) break;
      }
    }

    return {
      page_title: document.title || "Webpage",
      url: window.location.href,
      accessibility_score: 95,
      total_interactive_elements: mapped.length,
      elements: mapped
    };
  }

  /**
   * Zero-Latency Local Planner (Runs in < 2ms)
   */
  function generateInstantPlan(intent, elements, mode, accessibilityMode) {
    const steps = [];
    let stepCounter = 1;
    const intentLower = (intent || "").toLowerCase();
    const userVals = extractUserValuesFromIntent(intent);

    // 1. Scholarship Form Check (Instant Match)
    const hasScholarship = elements.some(el => Object.keys(KNOWN_SCHOLARSHIP_DEFAULTS).includes(el.id));
    if (hasScholarship) {
      const knownIds = [
        "full-name", "university-email", "student-id", "current-year",
        "degree-programme", "scholarship-category", "academic-achievements",
        "personal-statement", "academic-transcript", "declaration", "submit-button"
      ];

      for (const id of knownIds) {
        const el = elements.find(e => e.id === id);
        if (!el) continue;

        let val = KNOWN_SCHOLARSHIP_DEFAULTS[id] || null;
        if (id === "full-name" && userVals.name) val = userVals.name;
        if (id === "university-email" && userVals.email) val = userVals.email;
        if (id === "student-id" && userVals.roll) val = userVals.roll;

        const isSubmit = id === "submit-button";
        const isFile = el.input_type === "file";
        const isSelect = el.tag === "select";
        const isCheckbox = el.input_type === "checkbox";

        let actionType = "input";
        if (isSubmit || isCheckbox) actionType = "click";
        else if (isSelect) actionType = "select";
        else if (isFile) actionType = "file";

        steps.push({
          step_id: stepCounter++,
          target_ref: id,
          field_id: id,
          instruction: isSubmit
            ? "Review your application details and click Submit"
            : (isFile ? "Attach academic transcript document" : `Fill in your ${el.visible_label || id.replace(/-/g, ' ')}`),
          action_type: actionType,
          suggested_value: isSubmit ? null : val,
          requires_confirmation: isSubmit,
          is_sensitive: false,
          needs_large_target: el.needs_large_target || (accessibilityMode === "large_target"),
          visible_label: el.visible_label || id,
          alternatives: ["large_target"]
        });
      }
      return { session_id: `instant_${Date.now()}`, steps };
    }

    // 2. Search / E-Commerce Detection (Amazon, Flipkart, Google, YouTube, or search pages)
    const isSearchIntent = ["search", "find", "query", "look up", "google", "buy", "product", "item"].some(k => intentLower.includes(k));
    const isShoppingOrSearchSite = window.location.hostname.includes("amazon") || window.location.hostname.includes("flipkart") || window.location.hostname.includes("google") || window.location.hostname.includes("youtube");
    // Strictly filter text inputs (exclude select dropdowns, checkboxes, radios, submits)
    const textInputs = elements.filter(el =>
      (el.tag === "input" && !["checkbox", "radio", "submit", "button", "reset", "hidden", "file", "image"].includes(el.input_type)) ||
      el.tag === "textarea" ||
      ["textbox", "searchbox"].includes(el.role)
    );
    const buttons = elements.filter(el => el.tag === "button" || el.role === "button" || el.input_type === "submit");

    let searchInput = textInputs.find(el =>
      el.id === "twotabsearchtextbox" ||
      el.name === "field-keywords" ||
      el.id === "nav-search-keywords" ||
      el.id === "search" ||
      el.name === "q" ||
      el.name === "query" ||
      el.name === "search_query"
    );

    if (!searchInput) {
      searchInput = textInputs.find(el => el.input_type === "search" || el.role === "searchbox");
    }

    if (!searchInput) {
      searchInput = textInputs.find(el =>
        (el.placeholder && el.placeholder.toLowerCase().includes("search")) ||
        (el.accessible_name && el.accessible_name.toLowerCase().includes("search") && el.tag === "input")
      );
    }

    if (!searchInput && isShoppingOrSearchSite && textInputs.length > 0) {
      searchInput = textInputs[0];
    }

    if (isSearchIntent || isShoppingOrSearchSite || searchInput) {
      if (searchInput) {
        const defaultQuery = (intent && !intentLower.includes("guide me") && !intentLower.includes("navigate")) ? intent : "Wireless noise cancelling headphones";
        const query = userVals.query || defaultQuery;
        steps.push({
          step_id: stepCounter++,
          target_ref: searchInput.id || searchInput.ref,
          field_id: searchInput.id || searchInput.ref,
          instruction: `Enter "${query}" in the search box`,
          action_type: "input",
          suggested_value: query,
          requires_confirmation: false,
          is_sensitive: false,
          needs_large_target: searchInput.needs_large_target,
          visible_label: searchInput.visible_label || searchInput.accessible_name || "Search Box",
          alternatives: ["large_target"]
        });

        const searchBtn = buttons.find(b =>
          b.id === "nav-search-submit-button" ||
          (b.accessible_name || b.visible_label || "").toLowerCase().includes("search") ||
          (b.tag === "input" && b.input_type === "submit") ||
          (b.id || "").toLowerCase().includes("search")
        ) || buttons[0];

        if (searchBtn) {
          steps.push({
            step_id: stepCounter++,
            target_ref: searchBtn.id || searchBtn.ref,
            field_id: searchBtn.id || searchBtn.ref,
            instruction: `Click Search to view results for "${query}"`,
            action_type: "click",
            suggested_value: null,
            requires_confirmation: false,
            is_sensitive: false,
            needs_large_target: searchBtn.needs_large_target,
            visible_label: searchBtn.visible_label || "Search Button",
            alternatives: ["large_target"]
          });
        }
        return { session_id: `instant_search_${Date.now()}`, steps };
      }
    }

    // 3. Generic Form Inputs Auto-Fill
    const inputs = elements.filter(el => ["input", "textarea", "select"].includes(el.tag) && !["hidden", "submit", "button", "reset"].includes(el.input_type));
    inputs.slice(0, 8).forEach(el => {
      const label = el.visible_label || el.accessible_name || el.placeholder || "Field";
      const lower = label.toLowerCase();
      const isSens = el.is_sensitive;

      let val = null;
      if (!isSens) {
        if (el.input_type === "checkbox") val = "true";
        else if (lower.includes("name")) val = userVals.name || "Aarav Sharma";
        else if (lower.includes("email")) val = userVals.email || "aarav.sharma@nsut.ac.in";
        else if (lower.includes("phone")) val = "9876543210";
        else if (lower.includes("roll") || lower.includes("id")) val = userVals.roll || "2024CS089";
        else if (lower.includes("city")) val = "New Delhi";
        else if (lower.includes("address")) val = "Sector 3, Dwarka, New Delhi";
        else if (el.tag === "select") val = "First option";
        else val = "Application details";
      }

      steps.push({
        step_id: stepCounter++,
        target_ref: el.ref,
        field_id: el.id || el.ref,
        instruction: isSens ? `Enter your confidential ${label} directly` : `Fill in ${label}`,
        action_type: el.tag === "select" ? "select" : (el.input_type === "checkbox" ? "click" : "input"),
        suggested_value: val,
        requires_confirmation: false,
        is_sensitive: isSens,
        needs_large_target: el.needs_large_target,
        visible_label: label,
        alternatives: ["large_target"]
      });
    });

    if (buttons.length > 0) {
      const submitBtn = buttons.find(b => b.input_type === "submit" || (b.accessible_name || b.visible_label || "").toLowerCase().includes("submit")) || buttons[0];
      steps.push({
        step_id: stepCounter++,
        target_ref: submitBtn.ref,
        field_id: submitBtn.id || submitBtn.ref,
        instruction: `Review and click "${submitBtn.visible_label || 'Submit'}"`,
        action_type: "click",
        suggested_value: null,
        requires_confirmation: true,
        is_sensitive: false,
        needs_large_target: submitBtn.needs_large_target,
        visible_label: submitBtn.visible_label || "Submit",
        alternatives: ["large_target"]
      });
    }

    if (steps.length === 0 && elements.length > 0) {
      steps.push({
        step_id: 1,
        target_ref: elements[0].ref,
        field_id: elements[0].id || elements[0].ref,
        instruction: `Interact with this element for "${intent}"`,
        action_type: "notice",
        suggested_value: null,
        requires_confirmation: false,
        is_sensitive: false,
        needs_large_target: false,
        visible_label: elements[0].visible_label || "Page element",
        alternatives: ["large_target"]
      });
    }

    return { session_id: `instant_form_${Date.now()}`, steps };
  }

  function findElementByRef(ref) {
    if (!ref) return null;

    if (elementRefCache.has(ref)) {
      const cached = elementRefCache.get(ref);
      if (document.body.contains(cached)) return cached;
    }

    const cleanId = ref.startsWith("#") ? ref.slice(1) : ref;
    try {
      const byId = document.getElementById(cleanId);
      if (byId && document.body.contains(byId)) return byId;
    } catch (e) {}

    try {
      const byQuery = document.querySelector(ref);
      if (byQuery && document.body.contains(byQuery)) return byQuery;
    } catch (e) {}

    try {
      const byName = document.querySelector(`[name="${CSS.escape(cleanId)}"]`);
      if (byName && document.body.contains(byName)) return byName;
    } catch (e) {}

    if (ref.startsWith("el_")) {
      const idx = Number(ref.replace("el_", ""));
      extractPageSnapshot();
      return elementRefCache.get(ref) || [...elementRefCache.values()][idx] || null;
    }

    extractPageSnapshot();
    return elementRefCache.get(ref) || document.getElementById(cleanId) || null;
  }

  /**
   * Framework-Compatible Value Injection (React, Vue, vanilla DOM)
   */
  function fillElementValue(element, value) {
    if (!element || value === undefined || value === null) return;

    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.focus();

    const tag = element.tagName.toUpperCase();
    const type = (element.type || "").toLowerCase();

    if (type === "file") {
      try {
        const file = new File(["Ghost Hands Accessibility Demo Document Content"], "academic_transcript.pdf", { type: "application/pdf" });
        const dt = new DataTransfer();
        dt.items.add(file);
        element.files = dt.files;
        element.dispatchEvent(new Event("change", { bubbles: true }));
        element.dispatchEvent(new Event("input", { bubbles: true }));
      } catch (e) {
        console.warn("File input auto-fill skipped:", e);
      }
    } else if (type === "checkbox") {
      const shouldCheck = value === true || value === "true" || value === "checked" || value === 1;
      if (element.checked !== shouldCheck) {
        element.checked = shouldCheck;
        element.dispatchEvent(new Event("change", { bubbles: true }));
        element.dispatchEvent(new Event("click", { bubbles: true }));
      }
    } else if (type === "radio") {
      element.checked = true;
      element.dispatchEvent(new Event("change", { bubbles: true }));
      element.dispatchEvent(new Event("click", { bubbles: true }));
    } else if (tag === "SELECT") {
      let matched = false;
      const targetStr = String(value).toLowerCase();
      for (let i = 0; i < element.options.length; i++) {
        const opt = element.options[i];
        if (
          opt.value.toLowerCase() === targetStr ||
          opt.text.toLowerCase().includes(targetStr)
        ) {
          element.selectedIndex = i;
          matched = true;
          break;
        }
      }
      if (!matched && element.options.length > 1) {
        element.selectedIndex = 1;
      }
      element.dispatchEvent(new Event("change", { bubbles: true }));
    } else if (tag === "INPUT" || tag === "TEXTAREA") {
      const proto = Object.getPrototypeOf(element);
      const set = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (set) {
        set.call(element, value);
      } else {
        element.value = value;
      }
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    } else if (element.isContentEditable) {
      element.innerText = value;
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  /**
   * Interactive Cursor Assistant (Follows user focus & hover in Guide Mode)
   */
  let cursorAssistantActive = false;
  let cursorHoverCleanup = [];

  function setupCursorAssistant() {
    teardownCursorAssistant();
    cursorAssistantActive = true;

    const interactiveSelector = "input, select, textarea, button, [role='button'], [role='checkbox'], [role='radio']";
    const elements = document.querySelectorAll(interactiveSelector);

    let hoverTimeout = null;

    elements.forEach(el => {
      if (el.closest && el.closest("#ghost-hands-overlay-host")) return;

      const onHoverOrFocus = () => {
        if (!cursorAssistantActive || currentMode !== "guide") return;
        if (hoverTimeout) clearTimeout(hoverTimeout);

        hoverTimeout = setTimeout(() => {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return;

          const label = getAssociatedLabelText(el) || getAccessibleName(el) || el.name || el.id || "Interactive Field";
          const isSens = isSensitiveElement(el);
          const req = el.required || el.getAttribute("aria-required") === "true";
          const placeholder = el.placeholder || "";

          let hint = req ? "Required field. " : "Optional field. ";
          if (isSens) {
            hint = "🔒 Confidential field. Enter directly without sharing.";
          } else if (el.type === "email") {
            hint += "Enter a valid email address (e.g. name@northbridge.edu).";
          } else if (el.type === "file") {
            hint += "Attach your supporting document (PDF or image).";
          } else if (el.tagName === "SELECT") {
            hint += "Select the appropriate option from the dropdown menu.";
          } else if (placeholder) {
            hint += `Expected format: ${placeholder}`;
          }

          let suggestedVal = null;
          if (!isSens && KNOWN_SCHOLARSHIP_DEFAULTS[el.id]) {
            suggestedVal = KNOWN_SCHOLARSHIP_DEFAULTS[el.id];
          }

          if (window.GhostOverlay && window.GhostOverlay.showCursorAssistant) {
            window.GhostOverlay.showCursorAssistant(el, rect, {
              label,
              hint,
              suggestedValue: suggestedVal
            }, {
              onFill: (val) => {
                fillElementValue(el, val);
                const step = currentPlan[currentStepIndex];
                if (step && (step.target_ref === el.id || step.field_id === el.id)) {
                  handleStepCompletion(step, el);
                }
              },
              onCompleted: () => {
                const step = currentPlan[currentStepIndex];
                if (step && (step.target_ref === el.id || step.field_id === el.id)) {
                  handleStepCompletion(step, el);
                }
              }
            });
          }
        }, 120);
      };

      const onLeave = () => {
        if (hoverTimeout) clearTimeout(hoverTimeout);
      };

      el.addEventListener("mouseenter", onHoverOrFocus);
      el.addEventListener("focusin", onHoverOrFocus);
      el.addEventListener("mouseleave", onLeave);

      cursorHoverCleanup.push(() => {
        el.removeEventListener("mouseenter", onHoverOrFocus);
        el.removeEventListener("focusin", onHoverOrFocus);
        el.removeEventListener("mouseleave", onLeave);
      });
    });
  }

  function teardownCursorAssistant() {
    cursorAssistantActive = false;
    cursorHoverCleanup.forEach(clean => clean());
    cursorHoverCleanup = [];
    if (window.GhostOverlay && window.GhostOverlay.hideCursorAssistant) {
      window.GhostOverlay.hideCursorAssistant();
    }
  }

  /**
   * Step Execution & Display (Calibrated Observable Pacing)
   */
  function displayCurrentStep() {
    if (window.GhostOverlay?.hideFloatingDock) {
      window.GhostOverlay.hideFloatingDock();
    }
    if (autoActionTimer) {
      clearTimeout(autoActionTimer);
      autoActionTimer = null;
    }

    if (!currentPlan || currentStepIndex >= currentPlan.length) {
      if (window.GhostOverlay) {
        window.GhostOverlay.showCompletedFeedback("All steps completed! 🎉");
        setTimeout(stopSession, 1200);
      }
      return;
    }

    const step = currentPlan[currentStepIndex];
    const totalSteps = currentPlan.length;

    if (currentCompletionCleanup) {
      currentCompletionCleanup();
      currentCompletionCleanup = null;
    }

    const target = findElementByRef(step.target_ref || step.field_id || step.id);
    const stepNeedsLargeTarget = isLargeTargetMode || step.needs_large_target;

    if (window.GhostOverlay) {
      window.GhostOverlay.setLargeTargetMode(stepNeedsLargeTarget);
      window.GhostOverlay.showGhostStep(step, totalSteps, {
        mode: currentMode,
        findTarget: findElementByRef,
        onNext: () => advanceStep(),
        onStop: () => stopSession(),
        onConfirm: () => confirmStep(step),
        getApplicationSummary: () => {
          const nameVal = document.getElementById("full-name")?.value || KNOWN_SCHOLARSHIP_DEFAULTS["full-name"];
          const emailVal = document.getElementById("university-email")?.value || KNOWN_SCHOLARSHIP_DEFAULTS["university-email"];
          const idVal = document.getElementById("student-id")?.value || KNOWN_SCHOLARSHIP_DEFAULTS["student-id"];
          const yearVal = document.getElementById("current-year")?.value || KNOWN_SCHOLARSHIP_DEFAULTS["current-year"];
          const degVal = document.getElementById("degree-programme")?.value || KNOWN_SCHOLARSHIP_DEFAULTS["degree-programme"];
          const catVal = document.getElementById("scholarship-category")?.value || KNOWN_SCHOLARSHIP_DEFAULTS["scholarship-category"];
          return `
            <div>• <strong>Name:</strong> ${escapeHtml(nameVal)}</div>
            <div>• <strong>Email:</strong> ${escapeHtml(emailVal)}</div>
            <div>• <strong>Student ID:</strong> ${escapeHtml(idVal)}</div>
            <div>• <strong>Year:</strong> ${escapeHtml(yearVal)}</div>
            <div>• <strong>Programme:</strong> ${escapeHtml(degVal)}</div>
            <div>• <strong>Category:</strong> ${escapeHtml(catVal)}</div>
            <div>• <strong>Transcript:</strong> Attached (PDF) ✓</div>
            <div>• <strong>Declaration:</strong> Agreed ✓</div>
          `;
        },
        onAutoFill: (activeStep, targetEl) => {
          if (activeStep.suggested_value && targetEl) {
            fillElementValue(targetEl, activeStep.suggested_value);
            handleStepCompletion(activeStep, targetEl);
          }
        },
        onAutoFillAll: () => autoFillAllRemaining(),
        onTargetActivated: (activeStep, targetEl) => {
          handleStepCompletion(activeStep, targetEl);
        }
      });
    }

    if (target) {
      currentCompletionCleanup = attachCompletionListener(step, target);

      // --- Smooth Agentic Auto-Fill Execution (Calm, Observable Pacing: ~2.6s per step) ---
      if (currentMode === "automate" && hasGrantedAutoFillPermission) {
        if (!step.requires_confirmation) {
          // 1500ms dwell time: user clearly sees the spotlight, Ghost Hand pointer, and focused field
          autoActionTimer = setTimeout(() => {
            if (stepIsAdvancing) return;
            stepIsAdvancing = true;

            // Disconnect completion listener before triggering synthetic events to avoid double-advance
            if (currentCompletionCleanup) {
              currentCompletionCleanup();
              currentCompletionCleanup = null;
            }

            if (step.action_type === "click") {
              const isSearchAction = (target.id && target.id.includes("search")) ||
                (target.name && target.name.includes("search")) ||
                window.location.hostname.includes("amazon") ||
                window.location.hostname.includes("flipkart") ||
                window.location.hostname.includes("google") ||
                window.location.hostname.includes("youtube");

              if (isSearchAction) {
                const searchQ = (currentPlan[0] && currentPlan[0].suggested_value) ? currentPlan[0].suggested_value : "Wireless noise cancelling headphones";
                try {
                  chrome.storage.local?.set({
                    ghostActiveTask: {
                      type: "SEARCH_RESULTS",
                      query: searchQ,
                      mode: currentMode,
                      timestamp: Date.now()
                    }
                  });
                } catch (e) {}
              }

              target.click();
              if (target.form && (target.type === "submit" || (target.id && target.id.includes("search")) || (target.name && target.name.includes("search")))) {
                try {
                  if (target.form.requestSubmit) target.form.requestSubmit(target);
                  else target.form.submit();
                } catch (e) {}
              }
            } else if (step.suggested_value && !step.is_sensitive) {
              fillElementValue(target, step.suggested_value);
            }

            if (window.GhostOverlay) {
              window.GhostOverlay.showCompletedFeedback("Auto-Filled! ✓");
            }

            chrome.runtime.sendMessage({
              type: "STEP_COMPLETED",
              sessionId: currentSession,
              stepId: step.step_id,
              targetRef: step.target_ref || step.field_id || step.id
            }).catch(() => {});

            // 1100ms hold time: user comfortably sees the filled value and the green success glow
            setTimeout(() => {
              stepIsAdvancing = false;
              advanceStep();
            }, 1100);
          }, 1500);
        }
        // Strict stop on Submit button / confirmation gate (requires_confirmation: true)
      }
    }

    broadcastSessionState();
  }

  function attachCompletionListener(step, target) {
    if (!target) return () => {};

    let completed = false;
    let debounceTimer = null;

    const triggerCompletion = () => {
      if (completed || stepIsAdvancing) return;
      completed = true;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      handleStepCompletion(step, target);
    };

    const listeners = [];
    const addTrackedListener = (el, event, handler) => {
      el.addEventListener(event, handler);
      listeners.push(() => el.removeEventListener(event, handler));
    };

    const tagName = target.tagName.toUpperCase();
    const type = (target.type || "").toLowerCase();

    if (tagName === "INPUT" || tagName === "TEXTAREA") {
      if (type === "checkbox" || type === "radio") {
        addTrackedListener(target, "change", triggerCompletion);
        addTrackedListener(target, "click", triggerCompletion);
      } else if (type === "submit" || type === "button" || type === "reset") {
        addTrackedListener(target, "click", triggerCompletion);
      } else {
        const handleInput = () => {
          if (target.value && target.value.trim().length > 0) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(triggerCompletion, 350);
          }
        };
        addTrackedListener(target, "input", handleInput);
        addTrackedListener(target, "change", triggerCompletion);
      }
    } else if (tagName === "SELECT") {
      addTrackedListener(target, "change", triggerCompletion);
    } else {
      addTrackedListener(target, "click", triggerCompletion);
    }

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      listeners.forEach(cleanup => cleanup());
    };
  }

  function handleStepCompletion(step, target) {
    if (stepIsAdvancing) return;
    stepIsAdvancing = true;

    if (window.GhostOverlay) {
      window.GhostOverlay.showCompletedFeedback("Step Completed! ✓");
    }

    chrome.runtime.sendMessage({
      type: "STEP_COMPLETED",
      sessionId: currentSession,
      stepId: step.step_id,
      targetRef: step.target_ref || step.field_id || step.id
    }).catch(() => {});

    setTimeout(() => {
      stepIsAdvancing = false;
      advanceStep();
    }, 400);
  }

  function advanceStep() {
    if (autoActionTimer) {
      clearTimeout(autoActionTimer);
      autoActionTimer = null;
    }
    if (currentCompletionCleanup) {
      currentCompletionCleanup();
      currentCompletionCleanup = null;
    }

    currentStepIndex++;
    if (currentStepIndex < currentPlan.length) {
      displayCurrentStep();
    } else {
      if (window.GhostOverlay) {
        window.GhostOverlay.showCompletedFeedback("All steps completed successfully! 🎉");
      }
      setTimeout(stopSession, 1200);
    }
  }

  function prevStep() {
    if (currentStepIndex > 0) {
      currentStepIndex--;
      displayCurrentStep();
    }
  }

  function confirmStep(step) {
    const target = findElementByRef(step.target_ref || step.field_id || step.id);

    // 1. Ensure all scholarship/form requirements pass validation before submitting
    const transcriptInput = document.getElementById("academic-transcript");
    if (transcriptInput && (!transcriptInput.files || transcriptInput.files.length === 0)) {
      try {
        const file = new File(["Ghost Hands Accessibility Demo Document Content"], "academic_transcript.pdf", { type: "application/pdf" });
        const dt = new DataTransfer();
        dt.items.add(file);
        transcriptInput.files = dt.files;
        transcriptInput.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (e) {}
    }

    const declInput = document.getElementById("declaration");
    if (declInput && !declInput.checked) {
      declInput.checked = true;
      declInput.dispatchEvent(new Event("change", { bubbles: true }));
      declInput.dispatchEvent(new Event("click", { bubbles: true }));
    }

    const stmtInput = document.getElementById("personal-statement");
    if (stmtInput && stmtInput.value.trim().length < 50) {
      stmtInput.value = (stmtInput.value.trim() ? stmtInput.value.trim() + " " : "") +
        "Passionate about applying software engineering to build assistive web technologies for accessibility. Financial assistance will support my academic tuition and ongoing research projects.";
      stmtInput.dispatchEvent(new Event("input", { bubbles: true }));
      stmtInput.dispatchEvent(new Event("change", { bubbles: true }));
    }

    if (target) {
      if (target.form) {
        try {
          if (target.form.requestSubmit) target.form.requestSubmit(target);
          else target.form.submit();
        } catch (e) {
          target.click();
        }
      } else {
        target.click();
      }
    }

    chrome.runtime.sendMessage({
      type: "CONFIRM_ACTION",
      sessionId: currentSession,
      stepId: step.step_id
    }).catch(() => {});

    // Check for confirmation banner / message
    setTimeout(() => {
      const confirmation = document.getElementById("confirmation") || document.querySelector(".confirmation, #confirmation, [role='alert']");
      if (confirmation && (!confirmation.hidden || window.getComputedStyle(confirmation).display !== "none")) {
        confirmation.scrollIntoView({ behavior: "smooth", block: "center" });
        const refNo = document.getElementById("reference-number")?.textContent.trim() ||
          ("NB-" + new Date().getFullYear() + "-" + Math.floor(100000 + Math.random() * 900000));

        if (window.GhostOverlay && window.GhostOverlay.showCelebrationModal) {
          window.GhostOverlay.showCelebrationModal({
            title: "Application Successfully Submitted! 🎉",
            subtitle: "Northbridge Merit Scholarship Portal",
            referenceNumber: refNo,
            onDone: () => stopSession()
          });
          return;
        }
      }
      advanceStep();
    }, 450);
  }

  function stopSession() {
    if (autoActionTimer) {
      clearTimeout(autoActionTimer);
      autoActionTimer = null;
    }
    if (currentCompletionCleanup) {
      currentCompletionCleanup();
      currentCompletionCleanup = null;
    }

    teardownCursorAssistant();

    if (window.GhostOverlay) {
      window.GhostOverlay.clearOverlay();
      if (window.GhostOverlay.showFloatingDock) {
        window.GhostOverlay.showFloatingDock();
      }
    }

    if (currentSession) {
      chrome.runtime.sendMessage({
        type: "STOP_SESSION",
        sessionId: currentSession
      }).catch(() => {});
    }

    currentSession = null;
    currentPlan = [];
    currentStepIndex = 0;
    hasGrantedAutoFillPermission = false;
    stepIsAdvancing = false;

    broadcastSessionState();
  }

  function createIntakeContext(snapshotData, instantPlan, intent) {
    const isScholarship = snapshotData.elements.some(el => Object.keys(KNOWN_SCHOLARSHIP_DEFAULTS).includes(el.id));
    const isSearchPlan = Boolean(instantPlan && instantPlan.session_id && instantPlan.session_id.includes("search"));
    const hostName = window.location.hostname.replace("www.", "");
    const rawSite = hostName.split(".")[0] || "website";
    const siteName = rawSite.charAt(0).toUpperCase() + rawSite.slice(1);

    let pageType = "form";
    if (isScholarship) {
      pageType = "scholarship";
    } else if (isSearchPlan || hostName.includes("amazon") || hostName.includes("flipkart") || hostName.includes("google") || hostName.includes("youtube")) {
      pageType = "search";
    }

    let defaultSearchQuery = "Wireless noise cancelling headphones";
    if (intent && !intent.toLowerCase().includes("guide me") && !intent.toLowerCase().includes("navigate")) {
      defaultSearchQuery = intent;
    } else if (instantPlan?.steps?.[0]?.suggested_value) {
      defaultSearchQuery = instantPlan.steps[0].suggested_value;
    }

    return {
      pageType,
      siteName,
      searchQuery: defaultSearchQuery,
      defaultValues: KNOWN_SCHOLARSHIP_DEFAULTS,
      detectedFields: snapshotData.elements.filter(el => ["input", "textarea", "select"].includes(el.tag) && !el.is_sensitive).slice(0, 6).map(el => ({
        id: el.id || el.ref,
        label: el.visible_label || el.accessible_name || el.placeholder || el.id,
        placeholder: el.placeholder || "",
        value: el.suggested_value || ""
      }))
    };
  }

  function applyUserValuesToPlan(userValues, pageType) {
    if (pageType === "search") {
      const q = userValues.query || userValues.search || "Wireless noise cancelling headphones";
      currentPlan.forEach(step => {
        if (step.action_type === "input") {
          step.suggested_value = q;
          step.instruction = `Enter "${q}" in the search box`;
        } else if (step.action_type === "click") {
          step.instruction = `Click Search to view results for "${q}"`;
        }
      });
    } else if (pageType === "scholarship") {
      Object.assign(KNOWN_SCHOLARSHIP_DEFAULTS, userValues);
      currentPlan.forEach(step => {
        const fieldKey = step.field_id || step.target_ref;
        if (userValues[fieldKey] !== undefined) {
          step.suggested_value = userValues[fieldKey];
        } else if (fieldKey === "full-name" && userValues.name) {
          step.suggested_value = userValues.name;
        } else if (fieldKey === "university-email" && userValues.email) {
          step.suggested_value = userValues.email;
        } else if (fieldKey === "student-id" && userValues.studentId) {
          step.suggested_value = userValues.studentId;
        } else if (fieldKey === "degree-programme" && userValues.degree) {
          step.suggested_value = userValues.degree;
        } else if (fieldKey === "current-year" && userValues.year) {
          step.suggested_value = userValues.year;
        } else if (fieldKey === "scholarship-category" && userValues.category) {
          step.suggested_value = userValues.category;
        } else if (fieldKey === "academic-achievements" && userValues.achievements) {
          step.suggested_value = userValues.achievements;
        } else if (fieldKey === "personal-statement" && userValues.statement) {
          step.suggested_value = userValues.statement;
        }
      });
    } else {
      currentPlan.forEach(step => {
        const k = step.field_id || step.target_ref;
        if (userValues[k]) step.suggested_value = userValues[k];
      });
    }
  }

  function autoFillAllRemaining() {
    hasGrantedAutoFillPermission = true;
    currentMode = "automate";
    if (window.GhostOverlay) {
      window.GhostOverlay.showCompletedFeedback("Switching to Auto-Fill... ⚡");
    }
    setTimeout(() => {
      displayCurrentStep();
    }, 300);
  }

  function syncPlanWithBackend(intent, snapshotData) {
    chrome.runtime.sendMessage({
      type: "PLAN_REQUEST",
      payload: {
        intent: intent || "Guide me through this webpage",
        page_snapshot: snapshotData.elements,
        page_title: snapshotData.page_title,
        url: snapshotData.url,
        accessibility_score: snapshotData.accessibility_score,
        mode: currentMode,
        accessibility_mode: isLargeTargetMode ? "large_target" : "visual"
      }
    }).catch(() => {});
  }

  /**
   * Guidance Lifecycle with User Value Intake & Consent Gateway
   */
  function startGuidance(intent, mode = "guide") {
    currentMode = (mode === "automate") ? "automate" : "guide";
    stepIsAdvancing = false;
    hasGrantedAutoFillPermission = false;

    // 1. Instant Snapshot (< 5ms)
    const snapshotData = extractPageSnapshot();

    // 2. Instant Plan Generation (< 2ms)
    const instantPlan = generateInstantPlan(intent, snapshotData.elements, currentMode, isLargeTargetMode ? "large_target" : "visual");
    currentSession = instantPlan.session_id;
    currentPlan = instantPlan.steps;
    currentStepIndex = 0;

    // 3. User Value Intake (Voice & Text) for Agentic Auto-Fill ("Do it for me")
    if (currentMode === "automate" && !hasGrantedAutoFillPermission) {
      if (window.GhostOverlay && window.GhostOverlay.showUserValuesIntakeModal) {
        const intakeContext = createIntakeContext(snapshotData, instantPlan, intent);
        window.GhostOverlay.showUserValuesIntakeModal(intakeContext, {
          onConfirm: (userValues) => {
            hasGrantedAutoFillPermission = true;
            applyUserValuesToPlan(userValues, intakeContext.pageType);
            displayCurrentStep();
          },
          onGuideMe: () => {
            currentMode = "guide";
            hasGrantedAutoFillPermission = false;
            displayCurrentStep();
            setupCursorAssistant();
          },
          onCancel: () => {
            stopSession();
          }
        });
        syncPlanWithBackend(intent, snapshotData);
        return;
      }
    }

    // 4. Immediately display Step 1 (< 5ms total!)
    displayCurrentStep();

    // 5. If Guide Mode: attach Interactive Cursor Assistant listeners!
    if (currentMode === "guide") {
      setupCursorAssistant();
    }

    // 6. Background non-blocking sync with backend/service worker
    syncPlanWithBackend(intent, snapshotData);
  }

  function broadcastSessionState() {
    chrome.runtime.sendMessage({
      type: "SESSION_STATE_CHANGED",
      state: {
        active: Boolean(currentSession),
        sessionId: currentSession,
        mode: currentMode,
        currentStepIndex,
        totalSteps: currentPlan.length,
        currentStep: currentPlan[currentStepIndex] || null,
        plan: currentPlan,
        isLargeTargetMode
      }
    }).catch(() => {});
  }

  function handleSearchResultsLanding(task) {
    const query = task.query || "Wireless noise cancelling headphones";

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;

      const amazonItems = document.querySelectorAll(
        '[data-component-type="s-search-result"], .s-result-item[data-asin]:not([data-asin=""])'
      );
      let targetProduct = null;
      let titleText = "";
      let priceText = "";

      for (const item of amazonItems) {
        const titleEl = item.querySelector("h2 a, h2 span, .a-text-normal");
        if (titleEl && titleEl.textContent.trim().length > 5) {
          targetProduct = item;
          titleText = titleEl.textContent.trim();
          const priceEl = item.querySelector(".a-price .a-offscreen, .a-price-whole");
          if (priceEl) priceText = priceEl.textContent.trim();
          break;
        }
      }

      if (!targetProduct) {
        const genericCards = document.querySelectorAll(
          ".g, [data-hveid], .b_algo, .product-card, .search-result, article, main a[href]"
        );
        for (const card of genericCards) {
          const link = card.querySelector("a[href]") || (card.tagName === "A" ? card : null);
          if (link && link.textContent.trim().length > 5) {
            targetProduct = card;
            titleText = link.textContent.trim();
            break;
          }
        }
      }

      if (targetProduct || attempts > 15) {
        clearInterval(interval);
        if (!targetProduct) return;

        targetProduct.scrollIntoView({ behavior: "smooth", block: "center" });

        currentSession = `search_results_${Date.now()}`;
        currentMode = task.mode || "automate";
        currentStepIndex = 0;
        currentPlan = [
          {
            step_id: 1,
            target_ref: "top_result",
            field_id: "top_result",
            instruction: `Top Recommended Result for "${query}": ${titleText.slice(0, 70)}... ${priceText ? `(${priceText})` : ""}`,
            action_type: "notice",
            suggested_value: null,
            requires_confirmation: false,
            is_sensitive: false,
            needs_large_target: false,
            visible_label: `Top result: ${titleText.slice(0, 35)}...`,
            alternatives: []
          }
        ];

        elementRefCache.set("top_result", targetProduct);

        if (window.GhostOverlay) {
          window.GhostOverlay.showGhostStep(currentPlan[0], 1, {
            mode: currentMode,
            findTarget: () => targetProduct,
            onNext: () => {
              if (window.GhostOverlay.showCelebrationModal) {
                window.GhostOverlay.showCelebrationModal({
                  title: `Search Task Completed! 🎯`,
                  subtitle: `Found top matches for "${query}"`,
                  referenceNumber: `RESULTS-${Date.now().toString().slice(-6)}`,
                  details: `Inspected product: ${titleText.slice(0, 90)}`,
                  onDone: () => stopSession()
                });
              } else {
                stopSession();
              }
            },
            onStop: () => stopSession(),
            onConfirm: () => {
              const link = targetProduct.querySelector("a[href]");
              if (link) link.click();
              stopSession();
            }
          });
        }
      }
    }, 250);
  }

  // Keyboard navigation (Escape to stop guidance)
  window.addEventListener("keydown", e => {
    if (!currentSession) return;
    if (e.key === "Escape") {
      stopSession();
    }
  });

  // Runtime Message Router
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case "START_PAGE_VOICE_CAPTURE":
        if (window.GhostOverlay && window.GhostOverlay.showVoiceCaptureOverlay) {
          window.GhostOverlay.showVoiceCaptureOverlay(message.mode || currentMode, (transcript, mode) => {
            startGuidance(transcript, mode);
          });
          sendResponse({ ok: true });
        } else {
          sendResponse({ ok: false, reason: "overlay_not_ready" });
        }
        break;

      case "START_GUIDANCE":
        startGuidance(message.intent, message.mode);
        sendResponse({ ok: true });
        break;

      case "SHOW_STEP":
        if (typeof message.stepIndex === "number") {
          currentStepIndex = message.stepIndex;
        }
        displayCurrentStep();
        sendResponse({ ok: true });
        break;

      case "NEXT_STEP":
        advanceStep();
        sendResponse({ ok: true });
        break;

      case "PREV_STEP":
        prevStep();
        sendResponse({ ok: true });
        break;

      case "STOP":
      case "STOP_GUIDANCE":
      case "STOP_SESSION":
        stopSession();
        sendResponse({ ok: true });
        break;

      case "GET_PAGE_SNAPSHOT":
        sendResponse({ ok: true, snapshot: extractPageSnapshot() });
        break;

      case "TOGGLE_LARGE_TARGET":
        isLargeTargetMode = message.enabled !== undefined ? message.enabled : !isLargeTargetMode;
        if (window.GhostOverlay) {
          window.GhostOverlay.setLargeTargetMode(isLargeTargetMode);
        }
        sendResponse({ ok: true, isLargeTargetMode });
        break;

      case "TOGGLE_VOICE":
        if (window.GhostOverlay) {
          window.GhostOverlay.setVoiceMuted(!message.enabled);
        }
        sendResponse({ ok: true });
        break;

      case "SET_AUTONOMY_MODE":
        currentMode = message.mode || "guide";
        hasGrantedAutoFillPermission = false;
        sendResponse({ ok: true, mode: currentMode });
        break;

      case "GET_SESSION_STATE":
        sendResponse({
          active: Boolean(currentSession),
          sessionId: currentSession,
          mode: currentMode,
          currentStepIndex,
          totalSteps: currentPlan.length,
          currentStep: currentPlan[currentStepIndex] || null,
          plan: currentPlan,
          isLargeTargetMode
        });
        break;

      case "PING":
        sendResponse({ ok: true, active: Boolean(currentSession) });
        break;

      default:
        break;
    }
    return true;
  });

  // Check for cross-page continuation tasks on page load
  try {
    chrome.storage.local?.get("ghostActiveTask", res => {
      if (res?.ghostActiveTask && (Date.now() - res.ghostActiveTask.timestamp < 120000)) {
        const task = res.ghostActiveTask;
        chrome.storage.local?.remove("ghostActiveTask");
        if (task.type === "SEARCH_RESULTS") {
          setTimeout(() => handleSearchResultsLanding(task), 600);
        }
      }
    });
  } catch (e) {}

  // Initialize Persistent Floating Assistant Dock on webpage
  try {
    if (window.GhostOverlay?.renderFloatingDock) {
      window.GhostOverlay.renderFloatingDock({
        onStartGuidance: (intent, mode) => {
          startGuidance(intent, mode);
        }
      });
    }
  } catch (e) {
    console.warn("Ghost Hands floating dock init error:", e);
  }

  window.GhostContentScript = {
    extractPageSnapshot,
    findElementByRef,
    fillElementValue,
    startGuidance,
    stopSession
  };
})();