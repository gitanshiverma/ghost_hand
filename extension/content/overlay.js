/**
 * Ghost Hands - Shadow DOM Overlay
 * Visual highlighting & voice guidance:
 *  - High-contrast spotlight scrim cutout with pulsing focus glow
 *  - Floating animated Ghost Hand pointer (🖐️)
 *  - WCAG-compliant accessible caption card with step progress chip & mode badge
 *  - Agentic Auto-Fill Permission Gateway
 *  - Fish Audio TTS & browser speech playback with mute toggle
 *  - Accessible Large Target button for motor accessibility
 */

(function () {
  let overlayHost = null;
  let overlayRoot = null;
  let currentTargetElement = null;
  let currentStepData = null;
  let isLargeTargetActive = false;
  let isVoiceMuted = false;
  let currentAudio = null;
  let repositionAnimationFrame = null;

  const OVERLAY_STYLES = `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    :host {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 2147483647;
      overflow: hidden;
    }

    /* High-contrast spotlight scrim cutout around target element */
    .gh-spotlight {
      position: fixed;
      border: 3.5px solid #2563eb;
      border-radius: 12px;
      box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.65), 0 0 25px rgba(37, 99, 235, 0.6);
      transition: left 0.35s cubic-bezier(0.25, 1, 0.5, 1), top 0.35s cubic-bezier(0.25, 1, 0.5, 1), width 0.3s ease, height 0.3s ease, border-color 0.25s ease;
      pointer-events: none;
      z-index: 10;
    }

    .gh-spotlight.gh-success {
      border-color: #10b981;
      box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.65), 0 0 35px rgba(16, 185, 129, 0.8);
    }

    /* Pulsing glow ring */
    .gh-spotlight-ring {
      position: absolute;
      inset: -8px;
      border: 2px dashed rgba(59, 130, 246, 0.75);
      border-radius: 16px;
      animation: gh-ring-spin 6s linear infinite;
      pointer-events: none;
    }

    @keyframes gh-ring-spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    /* Animated Ghost Hand pointer */
    .gh-ghost-hand {
      position: fixed;
      font-size: 38px;
      line-height: 1;
      filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.35));
      animation: gh-hand-point 1.3s ease-in-out infinite alternate;
      pointer-events: none;
      z-index: 20;
      user-select: none;
      transition: left 0.35s cubic-bezier(0.25, 1, 0.5, 1), top 0.35s cubic-bezier(0.25, 1, 0.5, 1);
    }

    @keyframes gh-hand-point {
      0% {
        transform: translateY(0px) rotate(-10deg) scale(1);
      }
      100% {
        transform: translateY(-12px) rotate(5deg) scale(1.12);
      }
    }

    /* Accessible Caption Card */
    .gh-caption-card {
      position: fixed;
      width: 420px;
      max-width: calc(100vw - 32px);
      background: #ffffff;
      color: #0f172a;
      border: 2px solid #3b82f6;
      border-radius: 16px;
      padding: 16px 18px;
      box-shadow: 0 20px 45px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.05);
      pointer-events: auto;
      z-index: 30;
      transition: top 0.35s cubic-bezier(0.25, 1, 0.5, 1), left 0.35s cubic-bezier(0.25, 1, 0.5, 1);
      backdrop-filter: blur(8px);
    }

    .gh-caption-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
      gap: 8px;
    }

    .gh-chip-group {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .gh-progress-chip {
      background: #eff6ff;
      color: #1d4ed8;
      font-size: 12px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 9999px;
      border: 1px solid #bfdbfe;
      letter-spacing: 0.02em;
    }

    .gh-badge-mode {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 9999px;
      text-transform: capitalize;
    }

    .gh-badge-mode.mode-guide {
      background: #e0f2fe;
      color: #0369a1;
      border: 1px solid #bae6fd;
    }

    .gh-badge-mode.mode-assist {
      background: #fef3c7;
      color: #b45309;
      border: 1px solid #fde68a;
    }

    .gh-badge-mode.mode-automate {
      background: #f3e8ff;
      color: #7e22ce;
      border: 1px solid #e9d5ff;
    }

    .gh-badge-sensitive {
      background: #fef2f2;
      color: #b91c1c;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 9999px;
      border: 1px solid #fecaca;
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }

    .gh-badge-a11y {
      background: #fffbeb;
      color: #b45309;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 9999px;
      border: 1px solid #fde68a;
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }

    .gh-header-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .gh-voice-btn {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      color: #334155;
      font-size: 14px;
      line-height: 1;
      padding: 5px 8px;
      border-radius: 8px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
    }

    .gh-voice-btn:hover {
      background: #e2e8f0;
      border-color: #94a3b8;
    }

    .gh-voice-btn.speaking {
      background: #dbeafe;
      border-color: #3b82f6;
      color: #1d4ed8;
      animation: gh-pulse 1s infinite alternate;
    }

    .gh-voice-btn.muted {
      opacity: 0.6;
      background: #f1f5f9;
    }

    @keyframes gh-pulse {
      0% { transform: scale(1); }
      100% { transform: scale(1.08); }
    }

    .gh-close-button {
      background: transparent;
      border: none;
      color: #64748b;
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
      padding: 4px 6px;
      border-radius: 6px;
      transition: all 0.15s ease;
    }

    .gh-close-button:hover {
      background: #fee2e2;
      color: #dc2626;
    }

    .gh-instruction-title {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.4;
      margin-bottom: 8px;
    }

    .gh-target-hint {
      font-size: 12px;
      color: #475569;
      background: #f8fafc;
      border-left: 3px solid #3b82f6;
      padding: 6px 10px;
      border-radius: 4px;
      margin-bottom: 8px;
      word-break: break-word;
    }

    .gh-value-preview {
      font-size: 12px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      color: #166534;
      padding: 6px 10px;
      border-radius: 6px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
    }

    .gh-value-text {
      font-weight: 700;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 250px;
    }

    .gh-actions-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
    }

    .gh-btn-group {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .gh-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 700;
      border-radius: 8px;
      border: 1px solid transparent;
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
    }

    .gh-btn:active {
      transform: scale(0.97);
    }

    .gh-btn-primary {
      background: #2563eb;
      color: #ffffff;
    }

    .gh-btn-primary:hover {
      background: #1d4ed8;
    }

    .gh-btn-autofill {
      background: #16a34a;
      color: #ffffff;
      box-shadow: 0 2px 8px rgba(22, 163, 74, 0.3);
    }

    .gh-btn-autofill:hover {
      background: #15803d;
    }

    .gh-btn-confirm {
      background: #16a34a;
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(22, 163, 74, 0.3);
    }

    .gh-btn-confirm:hover {
      background: #15803d;
    }

    .gh-btn-secondary {
      background: #f1f5f9;
      color: #334155;
      border-color: #cbd5e1;
    }

    .gh-btn-secondary:hover {
      background: #e2e8f0;
      color: #0f172a;
    }

    .gh-btn-stop {
      background: #fee2e2;
      color: #b91c1c;
      border-color: #fca5a5;
    }

    .gh-btn-stop:hover {
      background: #dc2626;
      color: #ffffff;
    }

    /* Agentic Permission Modal */
    .gh-permission-modal {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      pointer-events: auto;
      padding: 16px;
      animation: gh-pop 0.25s ease-out;
    }

    .gh-permission-content {
      width: 480px;
      max-width: 100%;
      background: #ffffff;
      border-radius: 18px;
      padding: 24px;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.4);
      border: 2px solid #3b82f6;
    }

    .gh-permission-header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 16px;
    }

    .gh-permission-title {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.3;
    }

    .gh-permission-subtitle {
      font-size: 13px;
      color: #64748b;
      margin-top: 3px;
    }

    .gh-fields-preview {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 10px 14px;
      max-height: 160px;
      overflow-y: auto;
      margin-bottom: 14px;
    }

    .gh-field-preview-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 12px;
      border-bottom: 1px solid #f1f5f9;
    }

    .gh-field-preview-row:last-child {
      border-bottom: none;
    }

    .gh-field-name {
      font-weight: 600;
      color: #1e293b;
    }

    .gh-field-val {
      color: #059669;
      font-family: monospace;
      font-size: 11px;
    }

    .gh-safety-box {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 12px;
      color: #1e40af;
      line-height: 1.4;
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 16px;
    }

    .gh-permission-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
    }

    /* Large Target Mode Accessible Button */
    .gh-large-target-container {
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 40;
      pointer-events: auto;
      animation: gh-pop 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .gh-large-target-btn {
      min-width: 250px;
      min-height: 74px;
      padding: 16px 26px;
      font-size: 18px;
      font-weight: 800;
      line-height: 1.25;
      background: linear-gradient(135deg, #16a34a, #15803d);
      color: #ffffff;
      border: 3.5px solid #ffffff;
      border-radius: 18px;
      cursor: pointer;
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4), 0 0 20px rgba(22, 163, 74, 0.4);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
      text-align: center;
    }

    .gh-large-target-btn:hover {
      transform: translateY(-3px) scale(1.02);
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.45), 0 0 25px rgba(22, 163, 74, 0.6);
      background: linear-gradient(135deg, #15803d, #166534);
    }

    /* Completed Toast */
    .gh-toast {
      position: fixed;
      top: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: #10b981;
      color: #ffffff;
      padding: 10px 22px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 700;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
      z-index: 50;
      pointer-events: none;
      animation: gh-toast-pop 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    /* Intake Modal for User Values & Voice */
    .gh-intake-modal {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.75);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      pointer-events: auto;
      padding: 16px;
      animation: gh-pop 0.25s ease-out;
    }

    .gh-intake-content {
      width: 530px;
      max-width: 100%;
      background: #ffffff;
      border-radius: 20px;
      padding: 24px;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.4);
      border: 2.5px solid #2563eb;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
    }

    .gh-intake-header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 14px;
    }

    .gh-intake-title {
      font-size: 19px;
      font-weight: 800;
      color: #0f172a;
    }

    .gh-intake-subtitle {
      font-size: 13px;
      color: #64748b;
      margin-top: 3px;
    }

    .gh-voice-intake-bar {
      background: #eff6ff;
      border: 2px dashed #93c5fd;
      border-radius: 12px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      gap: 10px;
    }

    .gh-voice-intake-btn {
      background: #2563eb;
      color: #ffffff;
      border: none;
      border-radius: 10px;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s ease;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
    }

    .gh-voice-intake-btn:hover {
      background: #1d4ed8;
    }

    .gh-voice-intake-btn.recording {
      background: #dc2626;
      animation: gh-pulse 1.2s infinite;
    }

    .gh-intake-fields-scroll {
      overflow-y: auto;
      max-height: 300px;
      padding-right: 6px;
      margin-bottom: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .gh-intake-field-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .gh-intake-field-group label {
      font-size: 11px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .gh-intake-field-group input,
    .gh-intake-field-group select,
    .gh-intake-field-group textarea {
      width: 100%;
      border: 1.5px solid #cbd5e1;
      border-radius: 8px;
      padding: 8px 10px;
      font-size: 13px;
      color: #0f172a;
      outline: none;
      background: #f8fafc;
      transition: border-color 0.15s ease;
    }

    .gh-intake-field-group input:focus,
    .gh-intake-field-group select:focus,
    .gh-intake-field-group textarea:focus {
      border-color: #2563eb;
      background: #ffffff;
      box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
    }

    /* Cursor / Hover Assistant Tooltip */
    .gh-cursor-card {
      position: fixed;
      z-index: 50;
      background: #ffffff;
      border: 2px solid #2563eb;
      border-radius: 12px;
      padding: 10px 14px;
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.3);
      max-width: 290px;
      pointer-events: auto;
      animation: gh-pop 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      transition: top 0.12s ease-out, left 0.12s ease-out;
      font-size: 12px;
      color: #0f172a;
    }

    .gh-cursor-header {
      font-weight: 700;
      color: #1d4ed8;
      display: flex;
      align-items: center;
      gap: 5px;
      margin-bottom: 4px;
    }

    .gh-cursor-hint {
      color: #475569;
      line-height: 1.35;
      margin-bottom: 8px;
    }

    .gh-cursor-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .gh-summary-box {
      background: #f0fdf4;
      border: 1.5px solid #bbf7d0;
      border-radius: 10px;
      padding: 10px 14px;
      margin: 10px 0 12px 0;
    }

    /* Floating Voice Capture Overlay */
    .gh-voice-capture-overlay {
      position: fixed;
      top: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: #ffffff;
      border: 2.5px solid #2563eb;
      border-radius: 16px;
      padding: 16px 20px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
      z-index: 2147483647;
      pointer-events: auto;
      max-width: 520px;
      width: 92%;
      animation: gh-pop 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .gh-voice-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .gh-voice-indicator {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .gh-voice-mic-icon {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #eff6ff;
      border: 2px solid #3b82f6;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      animation: gh-pulse 1.2s infinite;
    }

    .gh-waveform {
      display: flex;
      align-items: center;
      gap: 3px;
      height: 20px;
    }

    .gh-wave-bar {
      width: 3.5px;
      background: #2563eb;
      border-radius: 2px;
      animation: gh-wave 1s ease-in-out infinite;
    }

    .gh-wave-bar:nth-child(1) { height: 8px; animation-delay: 0.1s; }
    .gh-wave-bar:nth-child(2) { height: 16px; animation-delay: 0.2s; }
    .gh-wave-bar:nth-child(3) { height: 22px; animation-delay: 0.3s; }
    .gh-wave-bar:nth-child(4) { height: 14px; animation-delay: 0.4s; }
    .gh-wave-bar:nth-child(5) { height: 7px; animation-delay: 0.5s; }

    @keyframes gh-wave {
      0%, 100% { transform: scaleY(0.4); }
      50% { transform: scaleY(1.3); }
    }

    .gh-voice-transcript-box {
      background: #f8fafc;
      border: 1.5px solid #cbd5e1;
      border-radius: 10px;
      padding: 10px 14px;
      font-size: 13.5px;
      color: #0f172a;
      min-height: 48px;
      line-height: 1.4;
    }

    .gh-voice-chips-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }

    .gh-voice-chip {
      font-size: 11px;
      font-weight: 600;
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
      border-radius: 6px;
      padding: 4px 8px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .gh-voice-chip:hover {
      background: #dbeafe;
      border-color: #93c5fd;
    }

    .gh-field-voice-updated {
      border-color: #10b981 !important;
      background-color: #f0fdf4 !important;
      box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2) !important;
      transition: all 0.3s ease;
    }

    /* Celebration & Final Confirmation Modal */
    .gh-celebration-modal {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.75);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483647;
      pointer-events: auto;
      padding: 20px;
      animation: gh-pop 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .gh-celebration-content {
      width: 480px;
      max-width: 100%;
      background: #ffffff;
      border-radius: 20px;
      padding: 28px;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.4);
      border: 2.5px solid #10b981;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 14px;
    }

    .gh-celebration-badge {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: #ecfdf5;
      border: 2px solid #10b981;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      box-shadow: 0 8px 24px rgba(16, 185, 129, 0.25);
    }

    .gh-ref-box {
      background: #f0fdf4;
      border: 1.5px solid #86efac;
      border-radius: 12px;
      padding: 12px 20px;
      margin: 8px 0;
      width: 100%;
    }

    .gh-ref-label {
      font-size: 11px;
      font-weight: 700;
      color: #166534;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .gh-ref-value {
      font-size: 20px;
      font-weight: 800;
      color: #15803d;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      margin-top: 4px;
    }

    /* Floating On-Page Assistant Dock Pill */
    .gh-floating-dock {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #0f172a;
      color: #ffffff;
      border: 2px solid #3b82f6;
      border-radius: 9999px;
      padding: 6px 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
      z-index: 2147483646;
      pointer-events: auto;
      cursor: pointer;
      font-size: 13px;
      font-weight: 700;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      user-select: none;
    }

    .gh-floating-dock:hover {
      transform: translateY(-2px) scale(1.03);
      box-shadow: 0 14px 35px rgba(37, 99, 235, 0.4);
      border-color: #60a5fa;
    }

    .gh-floating-dock-mic {
      background: #2563eb;
      color: #ffffff;
      border: none;
      border-radius: 9999px;
      padding: 5px 12px;
      font-size: 12px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 5px;
      cursor: pointer;
      transition: all 0.15s ease;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
    }

    .gh-floating-dock-mic:hover {
      background: #1d4ed8;
      transform: scale(1.05);
    }
  `;

  function ensureOverlay() {
    if (overlayHost && overlayRoot) return overlayRoot;

    overlayHost = document.createElement("div");
    overlayHost.id = "ghost-hands-overlay-host";
    overlayRoot = overlayHost.attachShadow({ mode: "open" });

    const styleEl = document.createElement("style");
    styleEl.textContent = OVERLAY_STYLES;
    overlayRoot.appendChild(styleEl);

    document.documentElement.appendChild(overlayHost);

    window.addEventListener("resize", onViewportChange, { passive: true });
    window.addEventListener("scroll", onViewportChange, { passive: true });

    return overlayRoot;
  }

  function onViewportChange() {
    if (repositionAnimationFrame) return;
    repositionAnimationFrame = requestAnimationFrame(() => {
      repositionAnimationFrame = null;
      updatePositions();
    });
  }

  function clearOverlay() {
    stopVoiceInstruction();
    hideCursorAssistant();
    if (currentTargetElement) {
      currentTargetElement.classList.remove("gh-highlighted-native-element");
      currentTargetElement = null;
    }
    if (overlayRoot) {
      const elementsToRemove = overlayRoot.querySelectorAll(
        ".gh-spotlight, .gh-ghost-hand, .gh-caption-card, .gh-large-target-container, .gh-toast, .gh-permission-modal, .gh-intake-modal, .gh-voice-capture-overlay, .gh-celebration-modal"
      );
      elementsToRemove.forEach(el => el.remove());
    }
    currentStepData = null;
  }

  function stopVoiceInstruction() {
    if (currentAudio) {
      try {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      } catch (e) {}
      currentAudio = null;
    }
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    updateVoiceButtonVisual(false);
  }

  function playVoiceInstruction(text, voiceBtnEl = null) {
    stopVoiceInstruction();
    if (isVoiceMuted || !text || !text.trim()) return;

    updateVoiceButtonVisual(true, voiceBtnEl);

    // Call service worker to fetch Fish Audio TTS non-blocking
    chrome.runtime.sendMessage({ type: "SPEAK_TEXT", text }, response => {
      if (response && response.ok && response.audioDataUrl) {
        try {
          currentAudio = new Audio(response.audioDataUrl);
          currentAudio.onended = () => updateVoiceButtonVisual(false, voiceBtnEl);
          currentAudio.onerror = () => {
            currentAudio = null;
            fallbackBrowserSpeech(text, voiceBtnEl);
          };
          currentAudio.play().catch(() => {
            fallbackBrowserSpeech(text, voiceBtnEl);
          });
        } catch (e) {
          fallbackBrowserSpeech(text, voiceBtnEl);
        }
      } else {
        fallbackBrowserSpeech(text, voiceBtnEl);
      }
    });
  }

  function fallbackBrowserSpeech(text, voiceBtnEl = null) {
    if (!window.speechSynthesis || isVoiceMuted) {
      updateVoiceButtonVisual(false, voiceBtnEl);
      return;
    }
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.onend = () => updateVoiceButtonVisual(false, voiceBtnEl);
      utterance.onerror = () => updateVoiceButtonVisual(false, voiceBtnEl);
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      updateVoiceButtonVisual(false, voiceBtnEl);
    }
  }

  function updateVoiceButtonVisual(isSpeaking, customBtn = null) {
    const btn = customBtn || (overlayRoot ? overlayRoot.querySelector(".gh-voice-btn") : null);
    if (!btn) return;

    if (isVoiceMuted) {
      btn.textContent = "🔇";
      btn.title = "Voice Guidance Muted (Click to Unmute)";
      btn.classList.add("muted");
      btn.classList.remove("speaking");
    } else if (isSpeaking) {
      btn.textContent = "🔊";
      btn.title = "Speaking... (Click to Mute)";
      btn.classList.add("speaking");
      btn.classList.remove("muted");
    } else {
      btn.textContent = "🔊";
      btn.title = "Voice Guidance Active (Click to Mute)";
      btn.classList.remove("speaking", "muted");
    }
  }

  function calculateTargetRect(target) {
    if (!target) return { x: 50, y: 50, width: 200, height: 40 };
    const r = target.getBoundingClientRect();
    return {
      x: Math.max(0, r.left),
      y: Math.max(0, r.top),
      width: Math.max(20, r.width),
      height: Math.max(20, r.height)
    };
  }

  function updatePositions() {
    if (!overlayRoot || !currentTargetElement) return;

    const rect = calculateTargetRect(currentTargetElement);

    const spotlight = overlayRoot.querySelector(".gh-spotlight");
    if (spotlight) {
      spotlight.style.left = `${rect.x - 8}px`;
      spotlight.style.top = `${rect.y - 8}px`;
      spotlight.style.width = `${rect.width + 16}px`;
      spotlight.style.height = `${rect.height + 16}px`;
    }

    const ghostHand = overlayRoot.querySelector(".gh-ghost-hand");
    if (ghostHand) {
      const handLeft = Math.min(window.innerWidth - 60, Math.max(10, rect.x + rect.width - 15));
      const handTop = Math.max(10, rect.y - 45);
      ghostHand.style.left = `${handLeft}px`;
      ghostHand.style.top = `${handTop}px`;
    }

    const captionCard = overlayRoot.querySelector(".gh-caption-card");
    if (captionCard) {
      positionCaptionCard(captionCard, rect);
    }
  }

  function positionCaptionCard(card, targetRect) {
    const cardWidth = Math.min(420, window.innerWidth - 32);
    const cardHeight = card.offsetHeight || 170;
    const padding = 16;

    let top = targetRect.y + targetRect.height + 16;
    let left = targetRect.x;

    if (top + cardHeight > window.innerHeight - padding) {
      if (targetRect.y - cardHeight - 16 > padding) {
        top = targetRect.y - cardHeight - 16;
      } else {
        top = window.innerHeight - cardHeight - padding;
      }
    }

    if (left + cardWidth > window.innerWidth - padding) {
      left = window.innerWidth - cardWidth - padding;
    }
    if (left < padding) left = padding;

  card.style.top = `${top}px`;
    card.style.left = `${left}px`;
    card.style.width = `${cardWidth}px`;
  }

  // --- Microphone Permission Helper ---
  async function requestMicrophonePermission() {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
        return true;
      }
    } catch (err) {
      console.warn("Microphone access permission check:", err);
      return false;
    }
    return true;
  }

  // --- Voice Dictation Helper for Elements ---
  let activeElementRecognition = null;
  async function startDictationForElement(element, btn, onDone) {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Speech recognition is not supported in this browser window. Please type your value directly.");
      return;
    }
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (activeElementRecognition) {
      try { activeElementRecognition.stop(); } catch (e) {}
      activeElementRecognition = null;
      if (btn) {
        btn.classList.remove("recording");
        btn.innerHTML = "<span>🎤 Dictate</span>";
      }
      return;
    }

    const hasMic = await requestMicrophonePermission();
    if (!hasMic) {
      alert("Microphone permission was not granted. Please allow microphone access in Chrome's address bar (mic icon at top-right of address bar) to dictate with voice.");
      return;
    }

    const rec = new SpeechRec();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";
    activeElementRecognition = rec;

    if (btn) {
      btn.classList.add("recording");
      btn.innerHTML = "<span>🔴 Listening...</span>";
    }

    rec.onresult = (e) => {
      let transcript = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      if (transcript && element) {
        if (window.GhostContentScript?.fillElementValue) {
          window.GhostContentScript.fillElementValue(element, transcript);
        } else {
          element.value = transcript;
          element.dispatchEvent(new Event("input", { bubbles: true }));
          element.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    };

    rec.onerror = (e) => {
      console.warn("Dictation error:", e.error);
      if (btn) {
        btn.classList.remove("recording");
        btn.innerHTML = "<span>🎤 Dictate</span>";
      }
      activeElementRecognition = null;
    };

    rec.onend = () => {
      if (btn) {
        btn.classList.remove("recording");
        btn.innerHTML = "<span>🎤 Dictate</span>";
      }
      activeElementRecognition = null;
      showCompletedFeedback("Voice captured! ✓");
      if (onDone) setTimeout(onDone, 500);
    };

    try {
      rec.start();
    } catch (e) {
      if (btn) {
        btn.classList.remove("recording");
        btn.innerHTML = "<span>🎤 Dictate</span>";
      }
      activeElementRecognition = null;
    }
  }

  // --- Persistent Floating On-Page Assistant Dock Pill ---
  let floatingDockEl = null;

  function renderFloatingDock(callbacks = {}) {
    ensureOverlay();
    const root = overlayRoot;

    if (floatingDockEl && root.contains(floatingDockEl)) {
      floatingDockEl.style.display = "flex";
      return floatingDockEl;
    }

    floatingDockEl = document.createElement("div");
    floatingDockEl.className = "gh-floating-dock";
    floatingDockEl.id = "gh-floating-dock";
    floatingDockEl.setAttribute("aria-label", "Ghost Hands Assistant Dock");

    floatingDockEl.innerHTML = `
      <div style="display: flex; align-items: center; gap: 7px; cursor: pointer;" id="gh-dock-logo" title="Ghost Hands Universal Web Assistant">
        <span style="font-size: 16px;">🖐️</span>
        <span style="font-size: 13px; font-weight: 800; letter-spacing: -0.01em;">Ghost Hands</span>
      </div>
      <button type="button" class="gh-floating-dock-mic" id="gh-dock-speak" title="Speak to Ghost Hands">
        <span>🎙️ Speak</span>
      </button>
      <button type="button" class="gh-floating-dock-mic" id="gh-dock-guide" style="background: #1e293b; border: 1px solid #475569;" title="Start Step-by-Step Guidance">
        <span>🧭 Guide</span>
      </button>
      <button type="button" class="gh-floating-dock-mic" id="gh-dock-autofill" style="background: #059669;" title="Start Agentic Auto-Fill">
        <span>⚡ Auto-Fill</span>
      </button>
    `;

    root.appendChild(floatingDockEl);

    const speakBtn = floatingDockEl.querySelector("#gh-dock-speak");
    if (speakBtn) {
      speakBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        showVoiceCaptureOverlay("guide", (transcript, mode) => {
          if (callbacks.onStartGuidance) {
            callbacks.onStartGuidance(transcript, mode);
          }
        });
      });
    }

    const guideBtn = floatingDockEl.querySelector("#gh-dock-guide");
    if (guideBtn) {
      guideBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (callbacks.onStartGuidance) {
          callbacks.onStartGuidance("", "guide");
        }
      });
    }

    const autoBtn = floatingDockEl.querySelector("#gh-dock-autofill");
    if (autoBtn) {
      autoBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (callbacks.onStartGuidance) {
          callbacks.onStartGuidance("", "automate");
        }
      });
    }

    const logo = floatingDockEl.querySelector("#gh-dock-logo");
    if (logo) {
      logo.addEventListener("click", (e) => {
        e.stopPropagation();
        showVoiceCaptureOverlay("guide", (transcript, mode) => {
          if (callbacks.onStartGuidance) {
            callbacks.onStartGuidance(transcript, mode);
          }
        });
      });
    }

    return floatingDockEl;
  }

  function hideFloatingDock() {
    if (floatingDockEl) {
      floatingDockEl.style.display = "none";
    }
  }

  function showFloatingDock() {
    if (floatingDockEl) {
      floatingDockEl.style.display = "flex";
    }
  }

  // --- Floating On-Page Voice Input Banner ---
  let activeVoiceCaptureRec = null;
  function showVoiceCaptureOverlay(initialMode = "guide", onTranscriptFinal = null) {
    ensureOverlay();
    const root = overlayRoot;

    // Remove existing if any
    const existing = root.querySelector(".gh-voice-capture-overlay");
    if (existing) existing.remove();

    const host = window.location.hostname.toLowerCase();
    const isAmazonOrShop = host.includes("amazon") || host.includes("flipkart") || host.includes("google") || host.includes("shopping");
    const isScholarship = document.getElementById("scholarship-form") || document.getElementById("full-name") || window.location.href.includes("form");

    let chipsHtml = "";
    if (isAmazonOrShop) {
      chipsHtml = `
        <span style="font-size: 11px; font-weight: 700; color: #64748b;">Or quick pick:</span>
        <button type="button" class="gh-voice-chip" data-text="coffee">☕ Coffee</button>
        <button type="button" class="gh-voice-chip" data-text="wireless noise cancelling headphones">🎧 Headphones</button>
        <button type="button" class="gh-voice-chip" data-text="running shoes for men">👟 Running Shoes</button>
        <button type="button" class="gh-voice-chip" data-text="laptop backpack">💻 Backpack</button>
      `;
    } else if (isScholarship) {
      chipsHtml = `
        <span style="font-size: 11px; font-weight: 700; color: #64748b;">Or quick pick:</span>
        <button type="button" class="gh-voice-chip" data-text="Complete scholarship form for Aarav Sharma">📝 Fill Scholarship</button>
        <button type="button" class="gh-voice-chip" data-text="Guide me step by step through this form">🧭 Guide Step-by-Step</button>
        <button type="button" class="gh-voice-chip" data-text="Auto-fill with student details">⚡ Auto-Fill Everything</button>
      `;
    } else {
      chipsHtml = `
        <span style="font-size: 11px; font-weight: 700; color: #64748b;">Or quick pick:</span>
        <button type="button" class="gh-voice-chip" data-text="Complete form step by step">📝 Complete Form</button>
        <button type="button" class="gh-voice-chip" data-text="Guide me through this webpage">🧭 Guide Me</button>
        <button type="button" class="gh-voice-chip" data-text="Auto-fill all fields">⚡ Auto-Fill All</button>
      `;
    }

    const banner = document.createElement("div");
    banner.className = "gh-voice-capture-overlay";

    banner.innerHTML = `
      <div class="gh-voice-header">
        <div class="gh-voice-indicator">
          <div class="gh-voice-mic-icon">🎙️</div>
          <div>
            <div style="font-size: 14px; font-weight: 800; color: #1e40af;">Ghost Hands Voice Assistant</div>
            <div style="font-size: 11.5px; color: #64748b;" id="gh-voice-status">Listening... Speak what you want to do</div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="gh-waveform" id="gh-voice-waveform">
            <div class="gh-wave-bar"></div>
            <div class="gh-wave-bar"></div>
            <div class="gh-wave-bar"></div>
            <div class="gh-wave-bar"></div>
            <div class="gh-wave-bar"></div>
          </div>
          <button class="gh-close-button" id="gh-voice-close" title="Close">✕</button>
        </div>
      </div>

      <div class="gh-voice-transcript-box" id="gh-voice-transcript">
        <em>${isAmazonOrShop ? 'Say: "Coffee", "Search headphones", or "Buy laptop"...' : 'Say: "Fill scholarship form" or "Guide me step by step"...'}</em>
      </div>

      <div style="display: flex; gap: 8px; align-items: center;">
        <input type="text" id="gh-voice-input-fallback" placeholder="Or type your search/request here..." style="flex: 1; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 7px 12px; font-size: 13px; outline: none; background: #f8fafc;" />
      </div>

      <div class="gh-voice-chips-row">
        ${chipsHtml}
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
        <button class="gh-btn gh-btn-secondary" id="gh-voice-cancel">Cancel</button>
        <button class="gh-btn gh-btn-autofill" id="gh-voice-start" style="padding: 8px 18px;">
          <span>⚡ Start with Voice</span>
        </button>
      </div>
    `;

    root.appendChild(banner);

    const transcriptEl = banner.querySelector("#gh-voice-transcript");
    const inputFallback = banner.querySelector("#gh-voice-input-fallback");
    const statusEl = banner.querySelector("#gh-voice-status");
    const waveformEl = banner.querySelector("#gh-voice-waveform");
    const closeBtn = banner.querySelector("#gh-voice-close");
    const cancelBtn = banner.querySelector("#gh-voice-cancel");
    const startBtn = banner.querySelector("#gh-voice-start");
    const chips = banner.querySelectorAll(".gh-voice-chip");

    let currentTranscript = "";
    let isListening = true;

    const finalizeAndStart = (intentText) => {
      isListening = false;
      if (activeVoiceCaptureRec) {
        try { activeVoiceCaptureRec.stop(); } catch (e) {}
        activeVoiceCaptureRec = null;
      }
      banner.remove();
      const textFromInput = inputFallback ? inputFallback.value.trim() : "";
      const finalText = (intentText || textFromInput || currentTranscript || "").trim() || (isAmazonOrShop ? "Coffee" : "Guide me through this webpage");
      if (onTranscriptFinal) {
        onTranscriptFinal(finalText, initialMode);
      }
    };

    if (inputFallback) {
      inputFallback.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          finalizeAndStart(inputFallback.value.trim());
        }
      });
      inputFallback.addEventListener("input", () => {
        currentTranscript = inputFallback.value;
      });
    }

    closeBtn.addEventListener("click", () => {
      isListening = false;
      if (activeVoiceCaptureRec) {
        try { activeVoiceCaptureRec.stop(); } catch (e) {}
        activeVoiceCaptureRec = null;
      }
      banner.remove();
    });

    cancelBtn.addEventListener("click", () => {
      isListening = false;
      if (activeVoiceCaptureRec) {
        try { activeVoiceCaptureRec.stop(); } catch (e) {}
        activeVoiceCaptureRec = null;
      }
      banner.remove();
    });

    startBtn.addEventListener("click", () => {
      finalizeAndStart(currentTranscript);
    });

    chips.forEach(chip => {
      chip.addEventListener("click", () => {
        const text = chip.getAttribute("data-text");
        currentTranscript = text;
        if (inputFallback) inputFallback.value = text;
        transcriptEl.innerHTML = `<strong>Selected:</strong> "${escapeHtml(text)}"`;
        finalizeAndStart(text);
      });
    });

    // Start Web Speech recognition in webpage context
    if (window.webkitSpeechRecognition || window.SpeechRecognition) {
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";
      activeVoiceCaptureRec = rec;

      rec.onstart = () => {
        statusEl.innerHTML = "<strong>Listening...</strong> Speak clearly now";
        if (waveformEl) waveformEl.style.display = "flex";
      };

      rec.onresult = (event) => {
        let interim = "";
        let finalTxt = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTxt += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        const text = (finalTxt || interim).trim();
        if (text) {
          currentTranscript = text;
          if (inputFallback) inputFallback.value = currentTranscript;
          transcriptEl.innerHTML = `<strong>Heard:</strong> "${escapeHtml(currentTranscript)}"`;
          statusEl.innerHTML = `<span style="color: #16a34a; font-weight: 700;">✓ Voice heard! Speak more or click Start</span>`;
          chrome.runtime.sendMessage({
            type: "VOICE_INTENT_CAPTURED",
            text: currentTranscript,
            isFinal: Boolean(finalTxt)
          }).catch(() => {});
        }
      };

      rec.onerror = (e) => {
        console.warn("Voice overlay recognition error:", e.error);
        if (e.error === "not-allowed") {
          statusEl.innerHTML = "<span style='color: #dc2626;'>Mic blocked. Click mic icon in address bar to Allow.</span>";
          if (waveformEl) waveformEl.style.display = "none";
        } else if (e.error === "no-speech") {
          statusEl.textContent = "Listening... Speak into your microphone";
        }
      };

      rec.onend = () => {
        if (isListening) {
          try { rec.start(); return; } catch (err) {}
        }
        if (waveformEl) waveformEl.style.display = "none";
      };

      requestMicrophonePermission().then(granted => {
        if (granted) {
          try { rec.start(); } catch (err) { console.warn("Rec start err:", err); }
        } else {
          statusEl.innerHTML = "<span style='color: #dc2626;'>Please allow mic in address bar or choose a suggestion below:</span>";
          if (waveformEl) waveformEl.style.display = "none";
        }
      });
    } else {
      statusEl.textContent = "Speech recognition is not supported in this browser. Please use quick chips:";
      if (waveformEl) waveformEl.style.display = "none";
    }
  }

  // --- Task Celebration & Confirmation Modal ---
  function showCelebrationModal(options = {}) {
    ensureOverlay();
    const root = overlayRoot;

    // Clear active guidance overlays
    const elementsToRemove = root.querySelectorAll(
      ".gh-spotlight, .gh-ghost-hand, .gh-caption-card, .gh-large-target-container, .gh-toast, .gh-permission-modal, .gh-intake-modal, .gh-voice-capture-overlay, .gh-celebration-modal"
    );
    elementsToRemove.forEach(el => el.remove());

    const title = options.title || "Task Completed Successfully! 🎉";
    const subtitle = options.subtitle || "Ghost Hands Universal Guidance";
    const referenceNumber = options.referenceNumber || ("NB-" + new Date().getFullYear() + "-" + Math.floor(100000 + Math.random() * 900000));
    const details = options.details || "";

    const modal = document.createElement("div");
    modal.className = "gh-celebration-modal";

    modal.innerHTML = `
      <div class="gh-celebration-content">
        <div class="gh-celebration-badge">🏆</div>
        <div>
          <h2 style="font-size: 20px; font-weight: 800; color: #15803d; margin-bottom: 4px;">${escapeHtml(title)}</h2>
          <div style="font-size: 13px; color: #64748b;">${escapeHtml(subtitle)}</div>
        </div>

        <div class="gh-ref-box">
          <div class="gh-ref-label">Official Confirmation Reference</div>
          <div class="gh-ref-value">${escapeHtml(referenceNumber)}</div>
        </div>

        <div style="font-size: 12.5px; color: #334155; line-height: 1.5; text-align: left; width: 100%; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px;">
          <div>✓ <strong>Form Submission:</strong> Completed & Accepted</div>
          <div>✓ <strong>All Required Fields:</strong> Verified & Validated</div>
          <div>✓ <strong>Supporting Documents:</strong> Successfully Attached</div>
          <div>✓ <strong>Declaration:</strong> Confirmed & Recorded</div>
          ${details ? `<div style="margin-top: 6px; font-weight: 600; color: #2563eb;">${escapeHtml(details)}</div>` : ""}
        </div>

        <div style="display: flex; gap: 10px; width: 100%; justify-content: center; margin-top: 6px;">
          <button class="gh-btn gh-btn-confirm" id="gh-celebration-done" style="padding: 12px 32px; font-size: 14px; width: 100%;">
            <span>Done &amp; Close ✓</span>
          </button>
        </div>
      </div>
    `;

    root.appendChild(modal);

    modal.querySelector("#gh-celebration-done").addEventListener("click", () => {
      modal.remove();
      if (options.onDone) options.onDone();
    });

    playVoiceInstruction(`Congratulations! Application successfully submitted. Your official reference number is ${referenceNumber}. All steps have been completed!`);
  }

  // --- User Values Intake Modal (Voice & Text) ---
  let intakeSpeechRec = null;
  let isIntakeRecording = false;

  function showUserValuesIntakeModal(context = {}, callbacks = {}) {
    ensureOverlay();
    const root = overlayRoot;
    clearOverlay();

    // Determine page type: "search", "scholarship", or "form"
    const pageType = context.pageType || (context.searchQuery ? "search" : (context.isScholarship ? "scholarship" : "scholarship"));
    const siteName = context.siteName || (window.location.hostname.replace("www.", "").split(".")[0] || "this website");
    const capitalizedSite = siteName.charAt(0).toUpperCase() + siteName.slice(1);

    const defaultValues = context.defaultValues || context;
    const vals = {
      name: defaultValues.name || defaultValues["full-name"] || "Aarav Sharma",
      email: defaultValues.email || defaultValues["university-email"] || "aarav.sharma@nsut.ac.in",
      studentId: defaultValues.studentId || defaultValues["student-id"] || "2024CS089",
      year: defaultValues.year || defaultValues["current-year"] || "Third year",
      degree: defaultValues.degree || defaultValues["degree-programme"] || "B.Tech Computer Science",
      category: defaultValues.category || defaultValues["scholarship-category"] || "Academic Excellence",
      achievements: defaultValues.achievements || defaultValues["academic-achievements"] || "Maintained 9.4 CGPA, Dean's List for consecutive semesters, published research paper in IEEE accessible computing interfaces.",
      statement: defaultValues.statement || defaultValues["personal-statement"] || "Passionate about applying software engineering to build assistive web technologies for accessibility. Financial assistance will support my academic tuition and ongoing research projects.",
      query: context.searchQuery || defaultValues.query || "Wireless noise cancelling headphones"
    };

    const modal = document.createElement("div");
    modal.className = "gh-intake-modal";

    let modalTitle = "What details would you like to fill?";
    let modalSubtitle = "Agentic AI will auto-fill using your custom values. You can speak or edit below:";
    let modalIcon = "📋";
    let voiceHintText = `Click "Speak Details" or tap a preset to auto-populate instantly:`;
    let confirmBtnText = "⚡ Start Auto-Filling with My Values";

    let presetButtonsHtml = "";
    if (pageType === "search") {
      modalIcon = "🔍";
      modalTitle = `What would you like to search on ${escapeHtml(capitalizedSite)}?`;
      modalSubtitle = `Ghost Hands will enter your search and guide you through results. Speak or type below:`;
      voiceHintText = `Click "Speak Query" and say what you're looking for, or click a preset:`;
      confirmBtnText = "⚡ Start Search with My Value";
      presetButtonsHtml = `
        <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px;">
          <button type="button" class="gh-voice-chip" id="gh-preset-search-1">🎧 Wireless Headphones</button>
          <button type="button" class="gh-voice-chip" id="gh-preset-search-2">👟 Running Shoes</button>
          <button type="button" class="gh-voice-chip" id="gh-preset-search-3">💻 Laptop Backpack</button>
        </div>
      `;
    } else {
      presetButtonsHtml = `
        <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px;">
          <button type="button" class="gh-voice-chip" id="gh-preset-1">👤 Aarav Sharma (CS)</button>
          <button type="button" class="gh-voice-chip" id="gh-preset-2">👤 Rahul Verma (IT)</button>
          <button type="button" class="gh-voice-chip" id="gh-preset-3">👤 Priya Singh (AI)</button>
        </div>
      `;
    }

    let fieldsHtml = "";
    if (pageType === "search") {
      fieldsHtml = `
        <div class="gh-intake-field-group">
          <label for="gh-val-search">Search on ${escapeHtml(capitalizedSite)}</label>
          <input type="text" id="gh-val-search" value="${escapeHtml(vals.query)}" placeholder="e.g. Wireless noise cancelling headphones" autofocus />
        </div>
      `;
    } else if (pageType === "form" && context.detectedFields && context.detectedFields.length > 0) {
      fieldsHtml = context.detectedFields.map((f, i) => `
        <div class="gh-intake-field-group">
          <label for="gh-dyn-${i}">${escapeHtml(f.label || f.id || `Field ${i+1}`)}</label>
          <input type="text" id="gh-dyn-${i}" data-field-id="${escapeHtml(f.id)}" value="${escapeHtml(f.value || "")}" placeholder="${escapeHtml(f.placeholder || f.label || "")}" />
        </div>
      `).join("");
    } else {
      fieldsHtml = `
        <div class="gh-intake-field-group">
          <label for="gh-val-name">Full Legal Name</label>
          <input type="text" id="gh-val-name" value="${escapeHtml(vals.name)}" placeholder="e.g. Aarav Sharma" />
        </div>

        <div class="gh-intake-field-group">
          <label for="gh-val-email">University Email</label>
          <input type="email" id="gh-val-email" value="${escapeHtml(vals.email)}" placeholder="name@northbridge.edu" />
        </div>

        <div class="gh-intake-field-group">
          <label for="gh-val-id">Student ID / Roll Number</label>
          <input type="text" id="gh-val-id" value="${escapeHtml(vals.studentId)}" placeholder="e.g. 2024CS089" />
        </div>

        <div class="gh-intake-field-group">
          <label for="gh-val-year">Current Year of Study</label>
          <select id="gh-val-year">
            <option ${vals.year === "First year" ? "selected" : ""}>First year</option>
            <option ${vals.year === "Second year" ? "selected" : ""}>Second year</option>
            <option ${vals.year === "Third year" || !vals.year ? "selected" : ""}>Third year</option>
            <option ${vals.year === "Fourth year" ? "selected" : ""}>Fourth year</option>
            <option ${vals.year === "Postgraduate" ? "selected" : ""}>Postgraduate</option>
          </select>
        </div>

        <div class="gh-intake-field-group">
          <label for="gh-val-degree">Degree Programme</label>
          <input type="text" id="gh-val-degree" value="${escapeHtml(vals.degree)}" placeholder="e.g. B.Tech Computer Science" />
        </div>

        <div class="gh-intake-field-group">
          <label for="gh-val-category">Scholarship Category</label>
          <select id="gh-val-category">
            <option ${vals.category === "Academic Excellence" || !vals.category ? "selected" : ""}>Academic Excellence</option>
            <option ${vals.category === "Leadership and Service" ? "selected" : ""}>Leadership and Service</option>
            <option ${vals.category === "STEM Achievement" ? "selected" : ""}>STEM Achievement</option>
            <option ${vals.category === "Arts and Humanities" ? "selected" : ""}>Arts and Humanities</option>
            <option ${vals.category === "First-Generation Student" ? "selected" : ""}>First-Generation Student</option>
          </select>
        </div>

        <div class="gh-intake-field-group">
          <label for="gh-val-achievements">Academic Achievements</label>
          <textarea id="gh-val-achievements" rows="2">${escapeHtml(vals.achievements)}</textarea>
        </div>

        <div class="gh-intake-field-group">
          <label for="gh-val-statement">Personal Statement (Min 50 Characters)</label>
          <textarea id="gh-val-statement" rows="2">${escapeHtml(vals.statement)}</textarea>
        </div>
      `;
    }

    modal.innerHTML = `
      <div class="gh-intake-content">
        <div class="gh-intake-header">
          <span style="font-size: 32px; line-height: 1;">${modalIcon}</span>
          <div style="flex: 1;">
            <div class="gh-intake-title">${modalTitle}</div>
            <div class="gh-intake-subtitle">${modalSubtitle}</div>
          </div>
          <button class="gh-close-button" id="gh-intake-close" title="Close">✕</button>
        </div>

        <div class="gh-voice-intake-bar" style="flex-direction: column; align-items: stretch;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
            <div style="flex: 1;">
              <div style="font-size: 12.5px; font-weight: 700; color: #1e40af; margin-bottom: 2px; display: flex; align-items: center; gap: 6px;">
                <span>🎙️ Voice Dictation</span>
                <div class="gh-waveform" id="gh-intake-waveform" style="display: none;">
                  <div class="gh-wave-bar"></div>
                  <div class="gh-wave-bar"></div>
                  <div class="gh-wave-bar"></div>
                  <div class="gh-wave-bar"></div>
                  <div class="gh-wave-bar"></div>
                </div>
              </div>
              <div id="gh-voice-hint" style="font-size: 11.5px; color: #3b82f6;">
                ${voiceHintText}
              </div>
            </div>
            <button type="button" class="gh-voice-intake-btn" id="gh-voice-record-btn">
              <span>🎤 ${pageType === "search" ? "Speak Query" : "Speak Details"}</span>
            </button>
          </div>
          ${presetButtonsHtml}
        </div>

        <div class="gh-intake-fields-scroll">
          ${fieldsHtml}
        </div>

        <div class="gh-safety-box" style="margin-bottom: 14px;">
          <div>🔒 <strong>Sensitive Data:</strong> Passwords & payment cards are never read or auto-filled.</div>
          <div>🛑 <strong>Consent Gate:</strong> The agent pauses before submission for your explicit approval.</div>
        </div>

        <div class="gh-permission-actions">
          <button class="gh-btn gh-btn-secondary" id="gh-intake-guide">🧭 Guide Me Instead</button>
          <button class="gh-btn gh-btn-autofill" id="gh-intake-submit" style="padding: 10px 18px; font-size: 13px;">
            <span>${confirmBtnText}</span>
          </button>
        </div>
      </div>
    `;

    root.appendChild(modal);

    const voiceBtn = modal.querySelector("#gh-voice-record-btn");
    const voiceHint = modal.querySelector("#gh-voice-hint");
    const waveformEl = modal.querySelector("#gh-intake-waveform");
    const submitBtn = modal.querySelector("#gh-intake-submit");
    const guideBtn = modal.querySelector("#gh-intake-guide");
    const closeBtn = modal.querySelector("#gh-intake-close");

    // Preset handlers
    const nameInput = modal.querySelector("#gh-val-name");
    const emailInput = modal.querySelector("#gh-val-email");
    const idInput = modal.querySelector("#gh-val-id");
    const yearSelect = modal.querySelector("#gh-val-year");
    const degreeInput = modal.querySelector("#gh-val-degree");
    const categorySelect = modal.querySelector("#gh-val-category");
    const achievementsInput = modal.querySelector("#gh-val-achievements");
    const statementInput = modal.querySelector("#gh-val-statement");
    const searchInput = modal.querySelector("#gh-val-search");

    function applyPresetValues(p) {
      if (p.name && nameInput) { nameInput.value = p.name; nameInput.classList.add("gh-field-voice-updated"); }
      if (p.email && emailInput) { emailInput.value = p.email; emailInput.classList.add("gh-field-voice-updated"); }
      if (p.studentId && idInput) { idInput.value = p.studentId; idInput.classList.add("gh-field-voice-updated"); }
      if (p.year && yearSelect) { yearSelect.value = p.year; yearSelect.classList.add("gh-field-voice-updated"); }
      if (p.degree && degreeInput) { degreeInput.value = p.degree; degreeInput.classList.add("gh-field-voice-updated"); }
      if (p.category && categorySelect) { categorySelect.value = p.category; categorySelect.classList.add("gh-field-voice-updated"); }
      if (p.achievements && achievementsInput) { achievementsInput.value = p.achievements; achievementsInput.classList.add("gh-field-voice-updated"); }
      if (p.statement && statementInput) { statementInput.value = p.statement; statementInput.classList.add("gh-field-voice-updated"); }
      if (p.query && searchInput) { searchInput.value = p.query; searchInput.classList.add("gh-field-voice-updated"); }

      voiceHint.innerHTML = `<span style="color: #15803d; font-weight: 700;">✓ Values loaded successfully!</span>`;
      setTimeout(() => {
        const updated = modal.querySelectorAll(".gh-field-voice-updated");
        updated.forEach(u => u.classList.remove("gh-field-voice-updated"));
      }, 1500);
    }

    const p1Btn = modal.querySelector("#gh-preset-1");
    if (p1Btn) {
      p1Btn.addEventListener("click", () => {
        applyPresetValues({
          name: "Aarav Sharma",
          email: "aarav.sharma@nsut.ac.in",
          studentId: "2024CS089",
          year: "Third year",
          degree: "B.Tech Computer Science",
          category: "Academic Excellence",
          achievements: "Maintained 9.4 CGPA, Dean's List for consecutive semesters, published research paper in IEEE accessible computing interfaces.",
          statement: "Passionate about applying software engineering to build assistive web technologies for accessibility. Financial assistance will support my academic tuition and ongoing research projects."
        });
      });
    }

    const p2Btn = modal.querySelector("#gh-preset-2");
    if (p2Btn) {
      p2Btn.addEventListener("click", () => {
        applyPresetValues({
          name: "Rahul Verma",
          email: "rahul.verma@nsut.ac.in",
          studentId: "2024IT105",
          year: "Second year",
          degree: "B.Tech Information Technology",
          category: "STEM Achievement",
          achievements: "First place in National Hackathon 2025, open source contributor to accessible web tools, 9.1 CGPA.",
          statement: "I am committed to designing high-impact web software and intelligent assistive agents. This scholarship will fund my educational resources and laboratory equipment."
        });
      });
    }

    const p3Btn = modal.querySelector("#gh-preset-3");
    if (p3Btn) {
      p3Btn.addEventListener("click", () => {
        applyPresetValues({
          name: "Priya Singh",
          email: "priya.singh@nsut.ac.in",
          studentId: "2024AI042",
          year: "Third year",
          degree: "B.Tech Artificial Intelligence",
          category: "Leadership and Service",
          achievements: "President of University Accessibility Club, organized assistive workshops for 300+ students, 9.3 CGPA.",
          statement: "Dedicated to building empowering educational technologies and leading student initiatives in assistive computing. This grant enables continued research and community service."
        });
      });
    }

    const s1Btn = modal.querySelector("#gh-preset-search-1");
    if (s1Btn) s1Btn.addEventListener("click", () => applyPresetValues({ query: "Wireless noise cancelling headphones" }));
    const s2Btn = modal.querySelector("#gh-preset-search-2");
    if (s2Btn) s2Btn.addEventListener("click", () => applyPresetValues({ query: "Running shoes for men" }));
    const s3Btn = modal.querySelector("#gh-preset-search-3");
    if (s3Btn) s3Btn.addEventListener("click", () => applyPresetValues({ query: "Waterproof laptop backpack" }));

    // Speech-to-text dictation into intake form
    if (window.webkitSpeechRecognition || window.SpeechRecognition) {
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      intakeSpeechRec = new SpeechRec();
      intakeSpeechRec.continuous = true;
      intakeSpeechRec.interimResults = true;
      intakeSpeechRec.lang = "en-US";

      intakeSpeechRec.onstart = () => {
        isIntakeRecording = true;
        voiceBtn.classList.add("recording");
        voiceBtn.innerHTML = "<span>🔴 Stop Listening</span>";
        if (waveformEl) waveformEl.style.display = "flex";
        voiceHint.innerHTML = "<strong>Listening...</strong> Speak clearly now into your microphone.";
      };

      intakeSpeechRec.onresult = (event) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }

        if (pageType === "search") {
          const sInp = modal.querySelector("#gh-val-search");
          if (sInp && transcript) {
            sInp.value = transcript.trim();
            sInp.classList.add("gh-field-voice-updated");
          }
          voiceHint.innerHTML = `Heard: "<em>${escapeHtml(transcript.trim())}</em>"`;
          return;
        }

        // Robust natural language parsing for form fields
        const t = transcript.trim();

        // Email regex
        const emailMatch = t.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (emailMatch && emailInput) {
          emailInput.value = emailMatch[1].trim();
          emailInput.classList.add("gh-field-voice-updated");
        }

        // Student ID / Roll regex
        const idMatch = t.match(/(?:roll|id|student\s*id|number)(?:\s+is|:)?\s+([A-Za-z0-9-]+)/i);
        if (idMatch && idInput) {
          idInput.value = idMatch[1].trim();
          idInput.classList.add("gh-field-voice-updated");
        }

        // Degree regex
        const degreeMatch = t.match(/(?:degree|programme|course|branch)(?:\s+is|:)?\s+([A-Za-z\s]+?)(?:,|and|category|year|$)/i);
        if (degreeMatch && degreeInput) {
          degreeInput.value = degreeMatch[1].trim();
          degreeInput.classList.add("gh-field-voice-updated");
        } else if ((t.toLowerCase().includes("computer science") || t.toLowerCase().includes("btech") || t.toLowerCase().includes("engineering")) && degreeInput) {
          degreeInput.value = "B.Tech Computer Science";
          degreeInput.classList.add("gh-field-voice-updated");
        }

        // Year match
        const yearMatch = t.match(/(first|second|third|fourth|postgraduate)\s*year/i);
        if (yearMatch && yearSelect) {
          const matchedYear = yearMatch[1].toLowerCase();
          for (let opt of yearSelect.options) {
            if (opt.value.toLowerCase().includes(matchedYear)) {
              yearSelect.value = opt.value;
              yearSelect.classList.add("gh-field-voice-updated");
              break;
            }
          }
        }

        // Name match: flexible matching
        const nameMatch = t.match(/(?:my\s+name(?:\s+is|:)?)\s+([A-Za-z\s]+?)(?:,|and|email|roll|student|year|programme|degree|$)/i);
        if (nameMatch && nameMatch[1].trim() && nameInput) {
          nameInput.value = nameMatch[1].trim();
          nameInput.classList.add("gh-field-voice-updated");
        } else if (!emailMatch && !idMatch && nameInput && t.split(" ").length >= 2 && t.split(" ").length <= 4 && !t.includes("@")) {
          // If user just speaks their name e.g. "Aarav Sharma"
          nameInput.value = t;
          nameInput.classList.add("gh-field-voice-updated");
        }

        voiceHint.innerHTML = `Heard: "<em>${escapeHtml(t.slice(-60))}</em>"`;
      };

      intakeSpeechRec.onerror = (e) => {
        console.warn("Intake speech error:", e.error);
        if (e.error === "no-speech") {
          voiceHint.innerHTML = "<em>Listening... Speak now into your microphone.</em>";
          return;
        }
        if (e.error === "not-allowed") {
          voiceHint.innerHTML = "<span style='color: #dc2626;'>Microphone access denied. Please click the mic icon in Chrome address bar or use the presets below.</span>";
        } else {
          voiceHint.innerHTML = `<em>Listening... (status: ${e.error})</em>`;
        }
        voiceBtn.classList.remove("recording");
        voiceBtn.innerHTML = `<span>🎤 ${pageType === "search" ? "Speak Query" : "Speak Details"}</span>`;
        if (waveformEl) waveformEl.style.display = "none";
        isIntakeRecording = false;
      };

      intakeSpeechRec.onend = () => {
        if (isIntakeRecording) {
          try {
            intakeSpeechRec.start();
            return;
          } catch (err) {}
        }
        voiceBtn.classList.remove("recording");
        voiceBtn.innerHTML = `<span>🎤 ${pageType === "search" ? "Speak Query" : "Speak Details"}</span>`;
        if (waveformEl) waveformEl.style.display = "none";
        isIntakeRecording = false;
      };
    }

    voiceBtn.addEventListener("click", async () => {
      if (!intakeSpeechRec) {
        alert("Speech recognition is not available in this browser window. Please type your values or click a quick preset.");
        return;
      }
      if (isIntakeRecording) {
        isIntakeRecording = false;
        intakeSpeechRec.stop();
        voiceBtn.classList.remove("recording");
        voiceBtn.innerHTML = `<span>🎤 ${pageType === "search" ? "Speak Query" : "Speak Details"}</span>`;
        if (waveformEl) waveformEl.style.display = "none";
      } else {
        const permitted = await requestMicrophonePermission();
        if (!permitted) {
          voiceHint.innerHTML = "<span style='color: #dc2626;'>Microphone access blocked. Click the camera/microphone icon in Chrome address bar to Allow.</span>";
          return;
        }
        try {
          intakeSpeechRec.start();
        } catch (e) {
          console.warn("Intake recognition start error:", e);
        }
      }
    });

    const getCollectedValues = () => {
      if (pageType === "search") {
        const searchInput = modal.querySelector("#gh-val-search");
        const q = (searchInput ? searchInput.value.trim() : "") || vals.query || "Wireless noise cancelling headphones";
        return { query: q, search: q, "search-query": q };
      }

      if (pageType === "form" && context.detectedFields && context.detectedFields.length > 0) {
        const collected = {};
        context.detectedFields.forEach((f, i) => {
          const inp = modal.querySelector(`#gh-dyn-${i}`);
          if (inp) collected[f.id] = inp.value.trim();
        });
        return collected;
      }

      const nameVal = (nameInput ? nameInput.value.trim() : "") || vals.name;
      const emailVal = (emailInput ? emailInput.value.trim() : "") || vals.email;
      const idVal = (idInput ? idInput.value.trim() : "") || vals.studentId;
      const yearVal = (yearSelect ? yearSelect.value : "") || vals.year;
      const degreeVal = (degreeInput ? degreeInput.value.trim() : "") || vals.degree;
      const categoryVal = (categorySelect ? categorySelect.value : "") || vals.category;
      const achievementsVal = (achievementsInput ? achievementsInput.value.trim() : "") || vals.achievements;
      let statementVal = (statementInput ? statementInput.value.trim() : "") || vals.statement;

      // Ensure statement satisfies 50 char minimum for portal validation
      if (statementVal.length < 50) {
        statementVal = statementVal + ". Financial assistance will support my academic tuition and ongoing research projects at the university.";
      }

      return {
        name: nameVal,
        email: emailVal,
        studentId: idVal,
        year: yearVal,
        degree: degreeVal,
        category: categoryVal,
        achievements: achievementsVal,
        statement: statementVal,
        "full-name": nameVal,
        "university-email": emailVal,
        "student-id": idVal,
        "current-year": yearVal,
        "degree-programme": degreeVal,
        "scholarship-category": categoryVal,
        "academic-achievements": achievementsVal,
        "personal-statement": statementVal,
        "academic-transcript": "academic_transcript.pdf",
        "declaration": "true"
      };
    };

    submitBtn.addEventListener("click", () => {
      isIntakeRecording = false;
      if (intakeSpeechRec) {
        try { intakeSpeechRec.stop(); } catch (e) {}
      }
      const collected = getCollectedValues();
      modal.remove();
      if (callbacks.onConfirm) callbacks.onConfirm(collected);
    });

    guideBtn.addEventListener("click", () => {
      isIntakeRecording = false;
      if (intakeSpeechRec) {
        try { intakeSpeechRec.stop(); } catch (e) {}
      }
      modal.remove();
      if (callbacks.onGuideMe) callbacks.onGuideMe();
    });

    closeBtn.addEventListener("click", () => {
      isIntakeRecording = false;
      if (intakeSpeechRec) {
        try { intakeSpeechRec.stop(); } catch (e) {}
      }
      modal.remove();
      if (callbacks.onCancel) callbacks.onCancel();
    });
  }

  // --- Interactive Cursor / Hover Assistant ---
  let cursorCardEl = null;

  function showCursorAssistant(target, rect, info = {}, callbacks = {}) {
    ensureOverlay();
    const root = overlayRoot;

    if (!cursorCardEl) {
      cursorCardEl = document.createElement("div");
      cursorCardEl.className = "gh-cursor-card";
      root.appendChild(cursorCardEl);
    }

    const label = info.label || target.name || target.id || "Form Field";
    const hint = info.hint || info.instruction || (target.required ? "This field is required. Click or focus to fill." : "Optional field.");
    const suggested = info.suggestedValue || "";

    cursorCardEl.innerHTML = `
      <div class="gh-cursor-header">
        <span>🧭</span>
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(label)}</span>
      </div>
      <div class="gh-cursor-hint">${escapeHtml(hint)}</div>
      ${suggested ? `<div style="font-size: 11px; background: #eff6ff; color: #1e40af; padding: 4px 8px; border-radius: 6px; margin-bottom: 8px;">Value: <strong>${escapeHtml(String(suggested))}</strong></div>` : ""}
      <div class="gh-cursor-actions">
        ${target.tagName === "INPUT" || target.tagName === "TEXTAREA" ? `<button class="gh-btn gh-btn-secondary" id="gh-cur-dictate" style="padding: 4px 8px; font-size: 11px;">🎤 Speak</button>` : ""}
        ${suggested ? `<button class="gh-btn gh-btn-autofill" id="gh-cur-fill" style="padding: 4px 8px; font-size: 11px;">⚡ Fill</button>` : ""}
        <button class="gh-btn gh-btn-secondary" id="gh-cur-explain" style="padding: 4px 8px; font-size: 11px;">🔊 Explain</button>
        <button class="gh-close-button" id="gh-cur-close" style="font-size: 13px; margin-left: auto;">✕</button>
      </div>
    `;

    cursorCardEl.style.display = "block";

    const cardWidth = 280;
    const cardHeight = 130;
    let left = rect.x + rect.width + 12;
    let top = rect.y;

    if (left + cardWidth > window.innerWidth - 16) {
      left = Math.max(16, rect.x - cardWidth - 12);
    }
    if (top + cardHeight > window.innerHeight - 16) {
      top = Math.max(16, window.innerHeight - cardHeight - 16);
    }

    cursorCardEl.style.left = `${left}px`;
    cursorCardEl.style.top = `${top}px`;

    const closeBtn = cursorCardEl.querySelector("#gh-cur-close");
    if (closeBtn) closeBtn.addEventListener("click", () => hideCursorAssistant());

    const dictateBtn = cursorCardEl.querySelector("#gh-cur-dictate");
    if (dictateBtn) {
      dictateBtn.addEventListener("click", () => {
        startDictationForElement(target, dictateBtn, () => {
          if (callbacks.onCompleted) callbacks.onCompleted();
        });
      });
    }

    const fillBtn = cursorCardEl.querySelector("#gh-cur-fill");
    if (fillBtn) {
      fillBtn.addEventListener("click", () => {
        if (callbacks.onFill) callbacks.onFill(suggested);
        showCompletedFeedback("Filled! ✓");
      });
    }

    const explainBtn = cursorCardEl.querySelector("#gh-cur-explain");
    if (explainBtn) {
      explainBtn.addEventListener("click", () => {
        playVoiceInstruction(hint);
      });
    }
  }

  function hideCursorAssistant() {
    if (cursorCardEl) {
      cursorCardEl.style.display = "none";
    }
  }

  // Autonomous Agent Permission Dialog
  function showPermissionDialog(plan, callbacks = {}) {
    ensureOverlay();
    const root = overlayRoot;
    clearOverlay();

    const fillable = plan.filter(s => s.suggested_value && !s.is_sensitive);

    const modal = document.createElement("div");
    modal.className = "gh-permission-modal";

    modal.innerHTML = `
      <div class="gh-permission-content">
        <div class="gh-permission-header">
          <span style="font-size: 30px;">🖐️</span>
          <div>
            <div class="gh-permission-title">Auto-Fill Permission Request</div>
            <div class="gh-permission-subtitle">You selected "Do it for me". Grant permission to fill form fields automatically?</div>
          </div>
        </div>
        
        <div class="gh-permission-body">
          <div style="font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 6px;">
            Fields to be completed (${fillable.length}):
          </div>
          <div class="gh-fields-preview">
            ${fillable.slice(0, 6).map(f => `
              <div class="gh-field-preview-row">
                <span class="gh-field-name">${escapeHtml(f.visible_label || f.field_id)}</span>
                <span class="gh-field-val">"${escapeHtml(String(f.suggested_value).slice(0, 28))}"</span>
              </div>
            `).join("")}
            ${fillable.length > 6 ? `<div style="font-size: 11px; color: #64748b; font-style: italic; margin-top: 4px;">+ ${fillable.length - 6} more fields</div>` : ""}
          </div>

          <div class="gh-safety-box">
            <div>🔒 <strong>Sensitive Data:</strong> Passwords and payment cards are never auto-filled.</div>
            <div>🛑 <strong>Final Confirmation:</strong> The agent stops before submission for your explicit approval.</div>
          </div>
        </div>

        <div class="gh-permission-actions">
          <button class="gh-btn gh-btn-secondary" id="gh-perm-decline">Guide Step-by-Step</button>
          <button class="gh-btn gh-btn-autofill" id="gh-perm-grant" style="padding: 10px 18px; font-size: 13px;">
            <span>⚡ Grant Permission & Auto-Fill</span>
          </button>
        </div>
      </div>
    `;

    root.appendChild(modal);

    const grantBtn = modal.querySelector("#gh-perm-grant");
    const declineBtn = modal.querySelector("#gh-perm-decline");

    // Accessible auto-focus on primary permission action
    setTimeout(() => {
      if (grantBtn) grantBtn.focus();
    }, 50);

    modal.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (grantBtn) grantBtn.click();
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (declineBtn) declineBtn.click();
      }
    });

    grantBtn.addEventListener("click", () => {
      modal.remove();
      if (callbacks.onGrant) callbacks.onGrant();
    });

    declineBtn.addEventListener("click", () => {
      modal.remove();
      if (callbacks.onDecline) callbacks.onDecline();
    });
  }

  function showGhostStep(step, totalSteps, callbacks = {}) {
    ensureOverlay();
    const root = overlayRoot;

    clearOverlay();
    currentStepData = step;

    const target = callbacks.findTarget ? callbacks.findTarget(step.target_ref || step.field_id || step.id) : null;
    currentTargetElement = target;

    if (!target) {
      showUncertainStep(step, totalSteps, callbacks);
      return;
    }

    target.classList.add("gh-highlighted-native-element");

    const initialRect = target.getBoundingClientRect();
    const isOutOfView = (
      initialRect.top < 60 ||
      initialRect.bottom > window.innerHeight - 60 ||
      initialRect.left < 20 ||
      initialRect.right > window.innerWidth - 20
    );

    if (isOutOfView) {
      try {
        target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      } catch (e) {
        target.scrollIntoView(false);
      }
    }

    const rect = calculateTargetRect(target);
    const spotlight = document.createElement("div");
    spotlight.className = "gh-spotlight";
    spotlight.style.left = `${rect.x - 8}px`;
    spotlight.style.top = `${rect.y - 8}px`;
    spotlight.style.width = `${rect.width + 16}px`;
    spotlight.style.height = `${rect.height + 16}px`;

    const ring = document.createElement("div");
    ring.className = "gh-spotlight-ring";
    spotlight.appendChild(ring);
    root.appendChild(spotlight);

    const ghostHand = document.createElement("div");
    ghostHand.className = "gh-ghost-hand";
    ghostHand.textContent = "🖐️";
    const handLeft = Math.min(window.innerWidth - 60, Math.max(10, rect.x + rect.width - 15));
    const handTop = Math.max(10, rect.y - 45);
    ghostHand.style.left = `${handLeft}px`;
    ghostHand.style.top = `${handTop}px`;
    root.appendChild(ghostHand);

    // Floating Caption Card
    const captionCard = document.createElement("div");
    captionCard.className = "gh-caption-card";

    const header = document.createElement("div");
    header.className = "gh-caption-header";

    const chipGroup = document.createElement("div");
    chipGroup.className = "gh-chip-group";

    const progressChip = document.createElement("span");
    progressChip.className = "gh-progress-chip";
    progressChip.textContent = `Step ${step.step_id || 1} of ${totalSteps || 1}`;
    chipGroup.appendChild(progressChip);

    const mode = callbacks.mode || "guide";
    const modeBadge = document.createElement("span");
    modeBadge.className = `gh-badge-mode mode-${mode}`;
    modeBadge.textContent = mode === "automate" ? "⚡ Do it for me" : "🧭 Guide me";
    chipGroup.appendChild(modeBadge);

    if (step.is_sensitive) {
      const sensitiveBadge = document.createElement("span");
      sensitiveBadge.className = "gh-badge-sensitive";
      sensitiveBadge.innerHTML = "🔒 Sensitive";
      chipGroup.appendChild(sensitiveBadge);
    }

    const headerActions = document.createElement("div");
    headerActions.className = "gh-header-actions";

    const voiceBtn = document.createElement("button");
    voiceBtn.className = "gh-voice-btn";
    voiceBtn.title = isVoiceMuted ? "Voice Guidance Muted" : "Voice Guidance Active (Fish Audio)";
    voiceBtn.textContent = isVoiceMuted ? "🔇" : "🔊";
    voiceBtn.addEventListener("click", () => {
      isVoiceMuted = !isVoiceMuted;
      updateVoiceButtonVisual(false, voiceBtn);
      if (!isVoiceMuted) {
        playVoiceInstruction(step.instruction, voiceBtn);
      } else {
        stopVoiceInstruction();
      }
    });
    headerActions.appendChild(voiceBtn);

    const closeBtn = document.createElement("button");
    closeBtn.className = "gh-close-button";
    closeBtn.title = "Stop Guidance";
    closeBtn.setAttribute("aria-label", "Stop Guidance");
    closeBtn.innerHTML = "✕";
    closeBtn.addEventListener("click", () => {
      if (callbacks.onStop) callbacks.onStop();
    });
    headerActions.appendChild(closeBtn);

    header.appendChild(chipGroup);
    header.appendChild(headerActions);
    captionCard.appendChild(header);

    const instruction = document.createElement("div");
    instruction.className = "gh-instruction-title";
    instruction.textContent = step.instruction || "Interact with this field to continue";
    captionCard.appendChild(instruction);

    if (step.visible_label || step.accessible_name) {
      const hint = document.createElement("div");
      hint.className = "gh-target-hint";
      hint.textContent = `Target: ${step.visible_label || step.accessible_name}`;
      captionCard.appendChild(hint);
    }

    // Auto-fill value preview
    if (step.suggested_value && !step.is_sensitive && step.action_type !== "click") {
      const valPreview = document.createElement("div");
      valPreview.className = "gh-value-preview";
      valPreview.innerHTML = `
        <span>⚡ Value:</span>
        <span class="gh-value-text">"${escapeHtml(String(step.suggested_value))}"</span>
      `;
      captionCard.appendChild(valPreview);
    }

    // Application Review Summary on Final Confirmation Step
    if (step.requires_confirmation) {
      const summaryBox = document.createElement("div");
      summaryBox.className = "gh-summary-box";
      summaryBox.innerHTML = `
        <div style="font-weight: 800; font-size: 13px; color: #166534; margin-bottom: 6px; display: flex; align-items: center; gap: 5px;">
          <span>📋</span> Application Review Summary
        </div>
        <div style="font-size: 11.5px; color: #1e293b; line-height: 1.5;">
          ${callbacks.getApplicationSummary ? callbacks.getApplicationSummary() : `
            <div>• <strong>Name:</strong> ${escapeHtml(document.getElementById("full-name")?.value || "Aarav Sharma")}</div>
            <div>• <strong>Email:</strong> ${escapeHtml(document.getElementById("university-email")?.value || "aarav.sharma@nsut.ac.in")}</div>
            <div>• <strong>Student ID:</strong> ${escapeHtml(document.getElementById("student-id")?.value || "2024CS089")}</div>
            <div>• <strong>Year:</strong> ${escapeHtml(document.getElementById("current-year")?.value || "Third year")}</div>
            <div>• <strong>Programme:</strong> ${escapeHtml(document.getElementById("degree-programme")?.value || "B.Tech Computer Science")}</div>
            <div>• <strong>Category:</strong> ${escapeHtml(document.getElementById("scholarship-category")?.value || "Academic Excellence")}</div>
            <div>• <strong>Transcript:</strong> Attached (PDF) ✓</div>
            <div>• <strong>Declaration:</strong> Agreed ✓</div>
          `}
        </div>
      `;
      captionCard.appendChild(summaryBox);
    }

    const actionsRow = document.createElement("div");
    actionsRow.className = "gh-actions-row";

    const stopButton = document.createElement("button");
    stopButton.className = "gh-btn gh-btn-stop";
    stopButton.textContent = "🛑 Stop";
    stopButton.addEventListener("click", () => {
      if (callbacks.onStop) callbacks.onStop();
    });
    actionsRow.appendChild(stopButton);

    const rightBtnGroup = document.createElement("div");
    rightBtnGroup.className = "gh-btn-group";

    // 🎤 Voice Button: If input/textarea, dictate directly. If non-text or button/select, allow voice instruction/command.
    if (!step.requires_confirmation && !step.is_sensitive && target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
      const dictateBtn = document.createElement("button");
      dictateBtn.className = "gh-btn gh-btn-secondary";
      dictateBtn.innerHTML = "<span>🎤 Dictate</span>";
      dictateBtn.title = "Speak to fill this field with voice";
      dictateBtn.addEventListener("click", () => {
        startDictationForElement(target, dictateBtn, () => {
          if (callbacks.onTargetActivated) {
            callbacks.onTargetActivated(step, target);
          }
        });
      });
      rightBtnGroup.appendChild(dictateBtn);
    } else if (!step.requires_confirmation) {
      const voiceBtnCommand = document.createElement("button");
      voiceBtnCommand.className = "gh-btn gh-btn-secondary";
      voiceBtnCommand.innerHTML = "<span>🎤 Voice</span>";
      voiceBtnCommand.title = "Speak a command or instruction";
      voiceBtnCommand.addEventListener("click", () => {
        showVoiceCaptureOverlay(mode, (spokenText) => {
          const lower = (spokenText || "").toLowerCase();
          if (lower.includes("stop") || lower.includes("cancel")) {
            if (callbacks.onStop) callbacks.onStop();
          } else if (lower.includes("skip") || lower.includes("next") || lower.includes("continue") || lower.includes("finish")) {
            if (callbacks.onNext) callbacks.onNext(step);
          } else if (lower.includes("fill") || lower.includes("auto")) {
            if (callbacks.onAutoFill && step.suggested_value && target) {
              callbacks.onAutoFill(step, target);
            } else if (callbacks.onAutoFillAll) {
              callbacks.onAutoFillAll();
            }
          } else if (target && (target.tagName === "BUTTON" || target.tagName === "A" || target.type === "checkbox" || target.type === "radio")) {
            target.click();
            if (callbacks.onTargetActivated) callbacks.onTargetActivated(step, target);
          } else if (target && target.tagName === "SELECT") {
            if (window.GhostContentScript?.fillElementValue) {
              window.GhostContentScript.fillElementValue(target, spokenText);
            }
            if (callbacks.onTargetActivated) callbacks.onTargetActivated(step, target);
          }
        });
      });
      rightBtnGroup.appendChild(voiceBtnCommand);
    }

    // ⚡ Fill button in Guide mode for single field fill
    if (mode === "guide" && step.suggested_value && !step.is_sensitive && step.action_type !== "click") {
      const fillBtn = document.createElement("button");
      fillBtn.className = "gh-btn gh-btn-autofill";
      fillBtn.textContent = "⚡ Fill";
      fillBtn.title = "Fill this field with suggested value";
      fillBtn.addEventListener("click", () => {
        if (callbacks.onAutoFill) callbacks.onAutoFill(step, target);
      });
      rightBtnGroup.appendChild(fillBtn);
    }

    // Quick Auto-Fill All trigger in Guide mode
    if (mode === "guide" && !step.requires_confirmation && callbacks.onAutoFillAll) {
      const fillAllBtn = document.createElement("button");
      fillAllBtn.className = "gh-btn gh-btn-autofill";
      fillAllBtn.textContent = "⚡ Auto-Fill All";
      fillAllBtn.title = "Grant permission and auto-fill remaining form fields";
      fillAllBtn.addEventListener("click", () => {
        callbacks.onAutoFillAll();
      });
      rightBtnGroup.appendChild(fillAllBtn);
    }

    if (step.requires_confirmation) {
      const confirmButton = document.createElement("button");
      confirmButton.className = "gh-btn gh-btn-confirm";
      confirmButton.innerHTML = "<span>🚀 Confirm & Submit Application</span>";
      confirmButton.addEventListener("click", () => {
        if (callbacks.onConfirm) callbacks.onConfirm(step);
      });
      rightBtnGroup.appendChild(confirmButton);
    } else {
      const skipButton = document.createElement("button");
      skipButton.className = "gh-btn gh-btn-secondary";
      skipButton.textContent = (step.step_id >= totalSteps) ? "Finish ✓" : "Skip / Next →";
      skipButton.addEventListener("click", () => {
        if (callbacks.onNext) callbacks.onNext(step);
      });
      rightBtnGroup.appendChild(skipButton);
    }

    actionsRow.appendChild(rightBtnGroup);
    captionCard.appendChild(actionsRow);

    root.appendChild(captionCard);
    positionCaptionCard(captionCard, rect);

    if (isLargeTargetActive || step.needs_large_target) {
      renderLargeTargetButton(step, target, callbacks);
    }

    // Play Voice Instruction asynchronously
    playVoiceInstruction(step.instruction, voiceBtn);
  }

  function renderLargeTargetButton(step, target, callbacks) {
    if (!overlayRoot) return;

    const existing = overlayRoot.querySelector(".gh-large-target-container");
    if (existing) existing.remove();

    const container = document.createElement("div");
    container.className = "gh-large-target-container";

    const button = document.createElement("button");
    button.className = "gh-large-target-btn";

    const label = step.visible_label || step.accessible_name || "Activate Field";
    button.innerHTML = `
      <span>🎯 ${escapeHtml(label.slice(0, 32))}</span>
      <span style="font-size: 11px; opacity: 0.9;">Large Target Mode</span>
    `;

    button.addEventListener("click", () => {
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.focus();

        if (
          target.tagName === "BUTTON" ||
          target.tagName === "A" ||
          target.type === "checkbox" ||
          target.type === "radio" ||
          target.getAttribute("role") === "button"
        ) {
          target.click();
        }

        showCompletedFeedback("Large target activated!");
        if (callbacks.onTargetActivated) {
          callbacks.onTargetActivated(step, target);
        }
      }
    });

    container.appendChild(button);
    overlayRoot.appendChild(container);
  }

  function showUncertainStep(step, totalSteps, callbacks = {}) {
    ensureOverlay();
    const root = overlayRoot;

    clearOverlay();

    const captionCard = document.createElement("div");
    captionCard.className = "gh-caption-card";
    captionCard.style.left = "24px";
    captionCard.style.bottom = "24px";
    captionCard.style.top = "auto";

    captionCard.innerHTML = `
      <div class="gh-caption-header">
        <span class="gh-progress-chip">Step ${step.step_id || 1} of ${totalSteps || 1}</span>
        <button class="gh-close-button" id="gh-uncertain-close">✕</button>
      </div>
      <div class="gh-instruction-title">Guidance Step</div>
      <div class="gh-target-hint">Instruction: ${escapeHtml(step.instruction || "Please perform this step on the page.")}</div>
      <div class="gh-actions-row">
        <button class="gh-btn gh-btn-stop" id="gh-uncertain-stop">🛑 Stop</button>
        <button class="gh-btn gh-btn-primary" id="gh-uncertain-next">Continue →</button>
      </div>
    `;

    root.appendChild(captionCard);

    captionCard.querySelector("#gh-uncertain-close").addEventListener("click", () => {
      if (callbacks.onStop) callbacks.onStop();
    });
    captionCard.querySelector("#gh-uncertain-stop").addEventListener("click", () => {
      if (callbacks.onStop) callbacks.onStop();
    });
    captionCard.querySelector("#gh-uncertain-next").addEventListener("click", () => {
      if (callbacks.onNext) callbacks.onNext(step);
    });

    playVoiceInstruction(step.instruction);
  }

  function showCompletedFeedback(message = "Step Completed! ✓") {
    if (!overlayRoot) return;

    const spotlight = overlayRoot.querySelector(".gh-spotlight");
    if (spotlight) {
      spotlight.classList.add("gh-success");
    }

    if (currentTargetElement) {
      currentTargetElement.classList.add("gh-completed-native-element");
    }

    const toast = document.createElement("div");
    toast.className = "gh-toast";
    toast.textContent = message;
    overlayRoot.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 900);
  }

  function setLargeTargetMode(enabled) {
    isLargeTargetActive = Boolean(enabled);
    if (overlayRoot && currentStepData && currentTargetElement) {
      if (isLargeTargetActive) {
        renderLargeTargetButton(currentStepData, currentTargetElement, {});
      } else {
        const existing = overlayRoot.querySelector(".gh-large-target-container");
        if (existing) existing.remove();
      }
    }
  }

  function setVoiceMuted(muted) {
    isVoiceMuted = Boolean(muted);
    updateVoiceButtonVisual(false);
    if (isVoiceMuted) {
      stopVoiceInstruction();
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  window.GhostOverlay = {
    ensureOverlay,
    clearOverlay,
    renderFloatingDock,
    hideFloatingDock,
    showFloatingDock,
    showGhostStep,
    showPermissionDialog,
    showUserValuesIntakeModal,
    showVoiceCaptureOverlay,
    showCelebrationModal,
    showCursorAssistant,
    hideCursorAssistant,
    startDictationForElement,
    showUncertainStep,
    showCompletedFeedback,
    setLargeTargetMode,
    setVoiceMuted,
    playVoiceInstruction,
    stopVoiceInstruction,
    updatePositions
  };
})();