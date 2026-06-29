(() => {
  if (globalThis.__autodialerSheetsLoaded) return;
  globalThis.__autodialerSheetsLoaded = true;
  const DEBUG = true;
  const PHONE_REGEX = /^\+?\d{10,15}$/;
  const CLICK_RETRY_DELAYS = [50, 150, 300, 600];
  const MIN_RESEND_MS = 800;
  const FORMULA_POLL_MS = 200;
  let lastFormulaBarText = "";
  let lastSentNumber = "";
  let lastSentAt = 0;
  let lastClickAt = 0;
  let selectionObserver = null;

  if (document.documentElement) {
    document.documentElement.dataset.autodialerSheets = "loaded";
  }
  if (DEBUG) console.debug("[Autodialer] Sheets content script loaded.");

  function normalizeNumber(raw) {
    if (!raw) return null;
    const trimmed = String(raw).trim();
    const hasPlus = trimmed.startsWith("+");
    const digitsOnly = trimmed.replace(/\D/g, "");
    const normalized = `${hasPlus ? "+" : ""}${digitsOnly}`;
    return PHONE_REGEX.test(normalized) ? normalized : null;
  }

  function extractPhoneNumber(text) {
    if (!text) return null;
    const raw = String(text).trim();
    const candidates = raw.match(/[+()\d][\d\s().-]{8,}\d/g);
    if (!candidates) return null;

    for (const candidate of candidates) {
      const normalized = normalizeNumber(candidate);
      if (normalized) return normalized;
    }

    return null;
  }

  function getFormulaBarElement() {
    return document.querySelector(
      '#t-formula-bar-input, input[aria-label*="Formula bar"], [role="textbox"][aria-label*="Formula bar"], input[aria-label*="Formula"], [role="textbox"][aria-label*="Formula"], input[aria-label*="fx"], [role="textbox"][aria-label*="fx"], [data-sheets-formula-bar-text-style]'
    );
  }

  function getFormulaBarText() {
    const formulaBar = getFormulaBarElement();
    if (!formulaBar) return "";
    if (formulaBar.value) return formulaBar.value;
    if (formulaBar.textContent) return formulaBar.textContent;
    return "";
  }

  function getCellText(target) {
    // Sheets cells are usually role=gridcell with aria-label containing the value.
    if (!target) return "";

    const cell = target.closest && target.closest('[role="gridcell"]');
    if (cell) {
      const ariaLabel = cell.getAttribute("aria-label");
      if (ariaLabel) return ariaLabel;
      if (cell.innerText) return cell.innerText;
      if (cell.textContent) return cell.textContent;
    }

    const ariaLabel = target.getAttribute && target.getAttribute("aria-label");
    if (ariaLabel) return ariaLabel;
    if (target.innerText) return target.innerText;
    if (target.textContent) return target.textContent;

    const selectedCell = document.querySelector(
      '[role="gridcell"][aria-selected="true"], [aria-selected="true"][data-row][data-col]'
    );
    if (selectedCell) {
      const selectedLabel = selectedCell.getAttribute("aria-label");
      if (selectedLabel) return selectedLabel;
      if (selectedCell.innerText) return selectedCell.innerText;
      if (selectedCell.textContent) return selectedCell.textContent;
    }

    return getFormulaBarText();
  }

  function trySendNumber(target, attempt = 0) {
    const formulaBarText = getFormulaBarText() || lastFormulaBarText;
    const text = formulaBarText || getCellText(target);
    const number = extractPhoneNumber(text);
    if (number) {
      const now = Date.now();
      if (number === lastSentNumber && now - lastSentAt < MIN_RESEND_MS) return;
      lastSentNumber = number;
      lastSentAt = now;
      if (DEBUG) console.debug("[Autodialer] Sending number:", number);
      try {
        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ type: "DIAL_NUMBER", number });
        } else if (DEBUG) {
          console.debug("[Autodialer] chrome.runtime not available in this frame.");
        }
      } catch (error) {
        if (DEBUG) console.debug("[Autodialer] sendMessage failed:", error);
      }
      return;
    }

    if (attempt < CLICK_RETRY_DELAYS.length) {
      setTimeout(() => trySendNumber(target, attempt + 1), CLICK_RETRY_DELAYS[attempt]);
      return;
    }

    if (DEBUG) console.debug("[Autodialer] No phone number found.", text);
  }

  function handleClick(event) {
    const target = event.target;
    if (!target) return;
    lastClickAt = Date.now();
    trySendNumber(target, 0);
    // Give Sheets a moment to update selection/formula bar on single click.
    setTimeout(() => trySendNumber(target, 0), 180);
    setTimeout(() => trySendNumber(target, 0), 420);
  }

  function handleSelectionChange() {
    const selectedCell = document.querySelector('[role="gridcell"][aria-selected="true"]');
    if (!selectedCell) return;
    trySendNumber(selectedCell, 0);
  }

  function startSelectionObserver() {
    const grid = document.querySelector('[role="grid"]');
    if (!grid || selectionObserver) return;
    selectionObserver = new MutationObserver(handleSelectionChange);
    selectionObserver.observe(grid, {
      attributes: true,
      subtree: true,
      attributeFilter: ["aria-selected"]
    });
  }

  function handleFormulaBarChange() {
    const current = getFormulaBarText();
    if (!current || current === lastFormulaBarText) return;
    lastFormulaBarText = current;
    trySendNumber(getFormulaBarElement(), 0);
  }

  function startFormulaBarTracking() {
    const formulaBar = getFormulaBarElement();
    if (!formulaBar) return;
    formulaBar.addEventListener("input", () => {
      handleFormulaBarChange();
    });
  }

  function startFormulaBarPolling() {
    setInterval(() => {
      handleFormulaBarChange();
    }, FORMULA_POLL_MS);
  }

  document.addEventListener("click", handleClick, true);
  document.addEventListener("selectionchange", handleSelectionChange, true);
  startFormulaBarTracking();
  startFormulaBarPolling();
  startSelectionObserver();
})();
