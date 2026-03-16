/**
 * Okta Login Helper — content script
 *
 * Runs on Okta sign-in pages and:
 *   1. Pre-fills the username field with the saved default.
 *   2. Ticks the "Remember Me" checkbox when enabled.
 *   3. Optionally clicks the "Next" button to advance the login flow.
 *
 * Supports both Okta Classic Engine and Okta Identity Engine (OIE) page
 * layouts.
 */

(() => {
  "use strict";

  // ---------------------------------------------------------------------------
  // Selector lists (tried in order; first match wins)
  // ---------------------------------------------------------------------------

  /** Username / identifier input selectors */
  const USERNAME_SELECTORS = [
    "#okta-signin-username",           // Classic Engine
    'input[name="identifier"]',        // OIE
    'input[name="username"]',
    'input[type="email"]',
    'input[autocomplete="username"]',
  ];

  /** "Remember Me" checkbox selectors */
  const REMEMBER_ME_SELECTORS = [
    'input[name="rememberMe"]',
    'input[name="remember"]',
    "#rememberMe",
  ];

  /** Next / Submit button selectors */
  const NEXT_BUTTON_SELECTORS = [
    "#okta-signin-submit",                   // Classic Engine
    'input[type="submit"]',
    'button[type="submit"]',
    '[data-type="save"]',
    'button[data-se="email-button"]',        // OIE "Email" factor button
  ];

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Returns the first element that matches any selector in the list, or null.
   * @param {string[]} selectors
   * @param {Document|Element} root
   * @returns {Element|null}
   */
  function queryFirst(selectors, root = document) {
    for (const sel of selectors) {
      const el = root.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  /**
   * Sets the value on an input element and fires the synthetic events that
   * React / Preact / Angular controlled inputs need to update their state.
   * @param {HTMLInputElement} input
   * @param {string} value
   */
  function setInputValue(input, value) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, value);
    } else {
      input.value = value;
    }

    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /**
   * Checks (or unchecks) a checkbox and dispatches the events frameworks need.
   * @param {HTMLInputElement} checkbox
   * @param {boolean} checked
   */
  function setCheckboxValue(checkbox, checked) {
    if (checkbox.checked === checked) return;

    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "checked"
    )?.set;

    if (nativeSetter) {
      nativeSetter.call(checkbox, checked);
    } else {
      checkbox.checked = checked;
    }

    checkbox.dispatchEvent(new Event("input", { bubbles: true }));
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    checkbox.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }

  // ---------------------------------------------------------------------------
  // Core logic — executed once the settings are loaded
  // ---------------------------------------------------------------------------

  /**
   * Attempts to fill username, tick Remember Me, and click Next.
   * Called immediately and again after the DOM settles (via MutationObserver).
   * @param {{ username: string, rememberMe: boolean, autoNext: boolean }} settings
   */
  function applySettings(settings) {
    const { username, rememberMe, autoNext } = settings;

    // 1. Fill username
    const usernameEl = username ? queryFirst(USERNAME_SELECTORS) : null;
    if (usernameEl && !usernameEl.value) {
      setInputValue(usernameEl, username);
    }

    // 2. Remember Me checkbox
    if (rememberMe) {
      const rememberEl = queryFirst(REMEMBER_ME_SELECTORS);
      // Only interact with a genuine remember-me checkbox (not the username field)
      if (rememberEl && rememberEl !== usernameEl) {
        setCheckboxValue(rememberEl, true);
      }
    }

    // 3. Auto-click Next
    if (autoNext && username) {
      const nextBtn = queryFirst(NEXT_BUTTON_SELECTORS);
      if (nextBtn) {
        nextBtn.click();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // MutationObserver — handles SPAs that render the form after page load
  // ---------------------------------------------------------------------------

  /**
   * Watches for DOM changes and re-runs applySettings until all three targets
   * have been acted on (or a time limit is reached).
   * @param {{ username: string, rememberMe: boolean, autoNext: boolean }} settings
   */
  function watchAndApply(settings) {
    let attempts = 0;
    const MAX_ATTEMPTS = 20;
    const INTERVAL_MS = 300;

    const interval = setInterval(() => {
      attempts += 1;
      applySettings(settings);

      const usernameEl = queryFirst(USERNAME_SELECTORS);
      const usernameReady = !settings.username || (usernameEl && usernameEl.value.length > 0);
      const rememberReady = !settings.rememberMe || queryFirst(REMEMBER_ME_SELECTORS)?.checked;

      if ((usernameReady && rememberReady) || attempts >= MAX_ATTEMPTS) {
        clearInterval(interval);
      }
    }, INTERVAL_MS);
  }

  // ---------------------------------------------------------------------------
  // Entry point
  // ---------------------------------------------------------------------------

  chrome.storage.sync.get(
    { username: "", rememberMe: true, autoNext: false },
    (settings) => {
      if (chrome.runtime.lastError) {
        return; // Storage unavailable; fail silently
      }

      // Run immediately for fully server-rendered pages
      applySettings(settings);

      // Then watch for SPA re-renders
      watchAndApply(settings);
    }
  );
})();
