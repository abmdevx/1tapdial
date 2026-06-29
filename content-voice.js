(() => {
  const DEBUG = true;
  const AUTO_CALL = true;
  const RETRY_LIMIT = 8;
  const RETRY_DELAY_MS = 400;
  const CALL_RETRY_LIMIT = 6;
  const CALL_RETRY_DELAY_MS = 200;

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.visibility !== "hidden" && style.display !== "none";
  }

  function isSearchInput(el) {
    const label = (el.getAttribute && el.getAttribute("aria-label")) || "";
    return label.toLowerCase().includes("search");
  }

  function matchesDialHint(el) {
    const label = (el.getAttribute && el.getAttribute("aria-label")) || "";
    const placeholder = (el.getAttribute && el.getAttribute("placeholder")) || "";
    const combined = `${label} ${placeholder}`.toLowerCase();
    return combined.includes("name or number") || combined.includes("enter a name or number");
  }

  function findDialInput() {
    // Prefer stable, semantic selectors over fragile class names.
    const candidates = [
      'input[type="tel"]',
      'input[type="text"][placeholder*="name or number"]',
      'input[role="combobox"]',
      'input[placeholder*="name or number"]',
      'input[aria-label*="Enter a name or number"]',
      'input[aria-label*="name or number"]',
      'input[aria-label*="Number"]',
      'input[aria-label*="phone"]',
      '[role="textbox"][contenteditable="true"]'
    ];

    for (const selector of candidates) {
      const list = document.querySelectorAll(selector);
      for (const el of list) {
        if (el && isVisible(el) && !isSearchInput(el) && matchesDialHint(el)) return el;
      }
    }

    for (const selector of candidates) {
      const list = document.querySelectorAll(selector);
      for (const el of list) {
        if (el && isVisible(el) && !isSearchInput(el)) return el;
      }
    }

    return null;
  }

  function findCallButton() {
    // Google Voice uses aria-labels or role-based buttons.
    const candidates = [
      'button[aria-label*="Call"]',
      'button[aria-label*="call"]',
      '[role="button"][aria-label*="Call"]',
      '[role="button"][aria-label*="call"]',
      'button[mattooltip*="Call"]',
      'button[mattooltip*="call"]'
    ];

    for (const selector of candidates) {
      const list = document.querySelectorAll(selector);
      for (const el of list) {
        if (el && isVisible(el)) return el;
      }
    }

    return null;
  }

  function setInputValue(input, number) {
    if (input.tagName && input.tagName.toLowerCase() === "input") {
      input.focus();
      input.value = number;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    // Fallback for contenteditable dial pads.
    input.focus();
    input.textContent = number;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function tryInsertNumber(number, attempt = 0) {
    const input = findDialInput();
    if (!input) {
      if (attempt < RETRY_LIMIT) {
        setTimeout(() => tryInsertNumber(number, attempt + 1), RETRY_DELAY_MS);
      } else {
        console.warn("[Autodialer] Dial input not found.");
      }
      return;
    }

    if (DEBUG) console.debug("[Autodialer] Dial input found.");
    setInputValue(input, number);

    if (AUTO_CALL) {
      tryAutoCall(0);
    }
  }

  function tryAutoCall(attempt) {
    const callButton = findCallButton();
    const disabled = callButton && callButton.hasAttribute("disabled");
    if (callButton && !disabled) {
      callButton.click();
      return;
    }
    if (attempt < CALL_RETRY_LIMIT) {
      setTimeout(() => tryAutoCall(attempt + 1), CALL_RETRY_DELAY_MS);
      return;
    }
    if (DEBUG) console.warn("[Autodialer] Call button not found or disabled.");
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== "INJECT_NUMBER") return;
    const number = message.number;
    if (!number) return;

    if (DEBUG) console.debug("[Autodialer] Received number:", number);

    tryInsertNumber(number);
  });
})();
