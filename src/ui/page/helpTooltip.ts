import { t } from "../../i18n.js";

const TOOLTIP_ID = "app-help-tooltip";
const TOOLTIP_OFFSET = 12;

interface TooltipAnchor {
  element: HTMLElement;
  message: string;
}

function isControlElement(
  element: Element | null,
): element is
  | HTMLButtonElement
  | HTMLInputElement
  | HTMLSelectElement
  | HTMLTextAreaElement {
  return (
    element instanceof HTMLButtonElement ||
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement
  );
}

function isReadOnlyControl(element: Element | null) {
  return (
    (element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement) &&
    element.readOnly
  );
}

function getLabelText(element: HTMLElement) {
  const ariaLabel = element.getAttribute("aria-label")?.trim();
  if (ariaLabel) {
    return ariaLabel;
  }
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  ) {
    const label = element.closest("label")?.querySelector("span")?.textContent;
    if (label?.trim()) {
      return label.trim();
    }
    if (element.placeholder.trim()) {
      return element.placeholder.trim();
    }
  }
  if (element instanceof HTMLSelectElement) {
    const label = element.closest("label")?.querySelector("span")?.textContent;
    if (label?.trim()) {
      return label.trim();
    }
  }
  const text = element.textContent?.replace(/\s+/g, " ").trim();
  return text || t("help.genericControlFallbackLabel");
}

function isDisabledForHelp(element: HTMLElement) {
  if (isControlElement(element)) {
    return element.disabled || isReadOnlyControl(element);
  }
  if (element.getAttribute("aria-disabled") === "true") {
    return true;
  }
  const control = element.querySelector("button,input,select,textarea");
  if (isControlElement(control)) {
    return control.disabled || isReadOnlyControl(control);
  }
  return false;
}

function getHelpValues(element: HTMLElement) {
  return {
    label: element.dataset.helpLabel ?? getLabelText(element),
  };
}

function resolveHelpMessage(element: HTMLElement) {
  const disabled = isDisabledForHelp(element);
  const key = disabled
    ? (element.dataset.disabledHelpKey ?? element.dataset.helpKey)
    : element.dataset.helpKey;
  if (key) {
    return t(key, getHelpValues(element));
  }
  const label = getLabelText(element);
  return disabled
    ? t("help.disabled.generic", { label })
    : t("help.genericControl", { label });
}

function findTooltipAnchor(target: EventTarget | null): TooltipAnchor | null {
  if (!(target instanceof Element)) {
    return null;
  }
  const element = target.closest(
    "[data-help-key], [data-disabled-help-key], button, input, select, textarea, label, [role='button'], [role='menuitem']",
  );
  if (!(element instanceof HTMLElement)) {
    return null;
  }
  const message = resolveHelpMessage(element);
  return message ? { element, message } : null;
}

function clampTooltipPosition(
  tooltip: HTMLElement,
  x: number,
  y: number,
  documentRef: Document,
) {
  const viewportWidth = documentRef.defaultView?.innerWidth ?? 0;
  const viewportHeight = documentRef.defaultView?.innerHeight ?? 0;
  const rect = tooltip.getBoundingClientRect();
  const nextLeft = Math.min(
    Math.max(8, x + TOOLTIP_OFFSET),
    Math.max(8, viewportWidth - rect.width - 8),
  );
  const nextTop = Math.min(
    Math.max(8, y + TOOLTIP_OFFSET),
    Math.max(8, viewportHeight - rect.height - 8),
  );
  tooltip.style.left = `${nextLeft}px`;
  tooltip.style.top = `${nextTop}px`;
}

function createTooltipElement(documentRef: Document) {
  const existing = documentRef.getElementById(TOOLTIP_ID);
  if (existing instanceof HTMLElement) {
    return existing;
  }
  const tooltip = documentRef.createElement("div");
  tooltip.id = TOOLTIP_ID;
  tooltip.className = "help-tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;
  documentRef.body.append(tooltip);
  return tooltip;
}

export function setupHelpTooltip(documentRef: Document = document) {
  const tooltip = createTooltipElement(documentRef);
  let activeElement: HTMLElement | null = null;
  let lastPointer: { x: number; y: number } | null = null;

  function hide() {
    if (activeElement?.getAttribute("aria-describedby") === TOOLTIP_ID) {
      activeElement.removeAttribute("aria-describedby");
    }
    activeElement = null;
    tooltip.hidden = true;
  }

  function show(anchor: TooltipAnchor, x: number, y: number) {
    activeElement = anchor.element;
    tooltip.textContent = anchor.message;
    tooltip.hidden = false;
    anchor.element.setAttribute("aria-describedby", TOOLTIP_ID);
    clampTooltipPosition(tooltip, x, y, documentRef);
  }

  documentRef.addEventListener("pointerover", (event) => {
    const anchor = findTooltipAnchor(event.target);
    if (!anchor) {
      hide();
      return;
    }
    lastPointer = { x: event.clientX, y: event.clientY };
    show(anchor, event.clientX, event.clientY);
  });

  documentRef.addEventListener("pointermove", (event) => {
    if (tooltip.hidden) {
      return;
    }
    lastPointer = { x: event.clientX, y: event.clientY };
    clampTooltipPosition(tooltip, event.clientX, event.clientY, documentRef);
  });

  documentRef.addEventListener("pointerout", (event) => {
    if (
      activeElement &&
      event.relatedTarget instanceof Node &&
      activeElement.contains(event.relatedTarget)
    ) {
      return;
    }
    hide();
  });

  documentRef.addEventListener("focusin", (event) => {
    const anchor = findTooltipAnchor(event.target);
    if (!anchor) {
      return;
    }
    const rect = anchor.element.getBoundingClientRect();
    show(anchor, rect.left, rect.bottom);
  });

  documentRef.addEventListener("focusout", hide);
  documentRef.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hide();
    }
  });

  return {
    hide,
    refreshActiveTooltip() {
      if (!activeElement || tooltip.hidden) {
        return;
      }
      const message = resolveHelpMessage(activeElement);
      tooltip.textContent = message;
      const rect = activeElement.getBoundingClientRect();
      const x = lastPointer?.x ?? rect.left;
      const y = lastPointer?.y ?? rect.bottom;
      clampTooltipPosition(tooltip, x, y, documentRef);
    },
  };
}
