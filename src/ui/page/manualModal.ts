import {
  getUserManualBlocks,
  type UserManualBlock,
} from "../../content/userManual.js";

interface ManualModalElementsLike {
  manualModal: HTMLElement | null;
  manualBackdrop: HTMLElement | null;
  manualBody: HTMLElement | null;
  manualDismissButton: HTMLButtonElement | null;
  manualCloseButton: HTMLButtonElement | null;
}

interface ManualModalContext {
  elements: ManualModalElementsLike;
  documentRef?: Document;
}

function appendInlineMarkdown(
  documentRef: Document,
  parent: HTMLElement,
  text: string,
) {
  const inlinePattern = /(`([^`]+)`)|\[([^\]]+)]\(([^)]+)\)/g;
  let currentIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlinePattern.exec(text))) {
    if (match.index > currentIndex) {
      parent.append(
        documentRef.createTextNode(text.slice(currentIndex, match.index)),
      );
    }

    if (match[2]) {
      const code = documentRef.createElement("code");
      code.textContent = match[2];
      parent.append(code);
    } else if (match[3] && match[4]) {
      const link = documentRef.createElement("a");
      link.href = match[4];
      link.textContent = match[3];
      if (/^https?:\/\//.test(match[4])) {
        link.target = "_blank";
        link.rel = "noreferrer";
      }
      parent.append(link);
    }

    currentIndex = match.index + match[0].length;
  }

  if (currentIndex < text.length) {
    parent.append(documentRef.createTextNode(text.slice(currentIndex)));
  }
}

function createManualHeadingElement(
  documentRef: Document,
  block: Extract<UserManualBlock, { type: "heading" }>,
) {
  const headingLevel = block.level <= 2 ? "h3" : "h4";
  const heading = documentRef.createElement(headingLevel);
  heading.className = `manual-modal__heading manual-modal__heading--level-${block.level}`;
  heading.textContent = block.text;
  return heading;
}

function createManualParagraphElement(
  documentRef: Document,
  block: Extract<UserManualBlock, { type: "paragraph" }>,
) {
  const paragraph = documentRef.createElement("p");
  paragraph.className = "manual-modal__paragraph";
  appendInlineMarkdown(documentRef, paragraph, block.text);
  return paragraph;
}

function createManualImageElement(
  documentRef: Document,
  block: Extract<UserManualBlock, { type: "image" }>,
) {
  const figure = documentRef.createElement("figure");
  figure.className = "manual-modal__figure";

  const image = documentRef.createElement("img");
  image.src = block.src;
  image.alt = block.alt;
  image.loading = "lazy";

  const caption = documentRef.createElement("figcaption");
  caption.textContent = block.alt;

  figure.append(image, caption);
  return figure;
}

function createManualListElement(
  documentRef: Document,
  block: Extract<UserManualBlock, { type: "list" }>,
) {
  const list = documentRef.createElement(block.ordered ? "ol" : "ul");
  list.className = "manual-modal__list";
  block.items.forEach((item) => {
    const listItem = documentRef.createElement("li");
    listItem.style.setProperty("--manual-list-indent", String(item.indent));
    appendInlineMarkdown(documentRef, listItem, item.text);
    list.append(listItem);
  });
  return list;
}

function createManualBlockElement(
  documentRef: Document,
  block: UserManualBlock,
) {
  if (block.type === "heading") {
    return createManualHeadingElement(documentRef, block);
  }
  if (block.type === "paragraph") {
    return createManualParagraphElement(documentRef, block);
  }
  if (block.type === "image") {
    return createManualImageElement(documentRef, block);
  }
  return createManualListElement(documentRef, block);
}

export function createManualModalActions(context: ManualModalContext) {
  const documentRef = context.documentRef ?? document;
  let lastFocusedElement: Element | null = null;
  let initialized = false;

  function renderManualContent() {
    const { manualBody } = context.elements;
    if (!manualBody) {
      return;
    }
    const fragment = documentRef.createDocumentFragment();
    getUserManualBlocks().forEach((block, index) => {
      if (index === 0 && block.type === "heading" && block.level === 1) {
        return;
      }
      fragment.append(createManualBlockElement(documentRef, block));
    });
    manualBody.replaceChildren(fragment);
  }

  function openManual() {
    const { manualModal, manualDismissButton } = context.elements;
    if (!manualModal) {
      return;
    }
    renderManualContent();
    lastFocusedElement = documentRef.activeElement;
    manualModal.hidden = false;
    documentRef.body.classList.add("manual-modal-open");
    manualDismissButton?.focus();
  }

  function closeManual() {
    const { manualModal } = context.elements;
    if (!manualModal || manualModal.hidden) {
      return;
    }
    manualModal.hidden = true;
    documentRef.body.classList.remove("manual-modal-open");
    if (lastFocusedElement instanceof HTMLElement) {
      lastFocusedElement.focus();
    }
    lastFocusedElement = null;
  }

  function handleDocumentKeydown(event: KeyboardEvent) {
    if (event.key !== "Escape" || context.elements.manualModal?.hidden) {
      return;
    }
    event.preventDefault();
    closeManual();
  }

  function initManualModal() {
    if (initialized) {
      return;
    }
    initialized = true;
    renderManualContent();
    context.elements.manualBackdrop?.addEventListener("click", closeManual);
    context.elements.manualCloseButton?.addEventListener("click", closeManual);
    context.elements.manualDismissButton?.addEventListener(
      "click",
      closeManual,
    );
    documentRef.addEventListener("keydown", handleDocumentKeydown);
  }

  return {
    closeManual,
    initManualModal,
    openManual,
    renderManualContent,
  };
}
