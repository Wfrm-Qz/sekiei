import {
  getUserManualBlocks,
  type UserManualBlock,
} from "../../content/userManual.js";
import { getCurrentLocale, onLocaleChange, t } from "../../i18n.js";

interface ManualModalElementsLike {
  manualModal: HTMLElement | null;
  manualBackdrop: HTMLElement | null;
  manualBody: HTMLElement | null;
  manualDismissButton: HTMLButtonElement | null;
  manualCloseButton: HTMLButtonElement | null;
}

interface ManualModalContext {
  elements: ManualModalElementsLike;
  getLocale?: typeof getCurrentLocale;
  onLocaleChange?: typeof onLocaleChange;
  documentRef?: Document;
}

interface ManualTocItem {
  id: string;
  level: number;
  text: string;
}

function slugifyManualHeading(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[`"'()[\]{}]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getManualHeadingId(text: string, index: number) {
  const slug = slugifyManualHeading(text);
  return slug ? `manual-section-${index}-${slug}` : `manual-section-${index}`;
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
  id?: string,
) {
  const headingLevel = block.level <= 2 ? "h3" : "h4";
  const heading = documentRef.createElement(headingLevel);
  heading.className = `manual-modal__heading manual-modal__heading--level-${block.level}`;
  heading.textContent = block.text;
  if (id) {
    heading.id = id;
    heading.tabIndex = -1;
  }
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
  id?: string,
) {
  if (block.type === "heading") {
    return createManualHeadingElement(documentRef, block, id);
  }
  if (block.type === "paragraph") {
    return createManualParagraphElement(documentRef, block);
  }
  if (block.type === "image") {
    return createManualImageElement(documentRef, block);
  }
  return createManualListElement(documentRef, block);
}

function createManualTableOfContents(
  documentRef: Document,
  locale: ReturnType<typeof getCurrentLocale>,
  items: ManualTocItem[],
  onNavigate: (item: ManualTocItem, button: HTMLButtonElement) => void,
  onClose: () => void,
) {
  const nav = documentRef.createElement("nav");
  nav.className = "manual-modal__toc";
  nav.setAttribute("aria-label", t("manual.tocTitle", {}, locale));

  const header = documentRef.createElement("div");
  header.className = "manual-modal__toc-header";

  const title = documentRef.createElement("p");
  title.className = "manual-modal__toc-title";
  title.textContent = t("manual.tocTitle", {}, locale);

  const closeButton = documentRef.createElement("button");
  closeButton.className = "manual-modal__toc-close dads-icon-button";
  closeButton.type = "button";
  closeButton.textContent = "×";
  closeButton.setAttribute("aria-label", t("manual.tocClose", {}, locale));
  closeButton.addEventListener("click", onClose);

  header.append(title, closeButton);

  const list = documentRef.createElement("ol");
  list.className = "manual-modal__toc-list";

  items.forEach((item, index) => {
    const listItem = documentRef.createElement("li");
    listItem.className = `manual-modal__toc-item manual-modal__toc-item--level-${item.level}`;

    const button = documentRef.createElement("button");
    button.className = "manual-modal__toc-link";
    button.type = "button";
    button.textContent = item.text;
    button.addEventListener("click", () => onNavigate(item, button));
    if (index === 0) {
      button.setAttribute("aria-current", "true");
    }

    listItem.append(button);
    list.append(listItem);
  });

  nav.append(header, list);
  return nav;
}

export function createManualModalActions(context: ManualModalContext) {
  const documentRef = context.documentRef ?? document;
  const getLocale = context.getLocale ?? getCurrentLocale;
  const subscribeLocaleChange = context.onLocaleChange ?? onLocaleChange;
  let lastFocusedElement: Element | null = null;
  let initialized = false;

  function renderManualContent() {
    const { manualBody } = context.elements;
    if (!manualBody) {
      return;
    }
    const locale = getLocale();
    const blocks = getUserManualBlocks(locale);
    const tocItems: ManualTocItem[] = [];
    const article = documentRef.createElement("article");
    article.className = "manual-modal__article";
    article.tabIndex = -1;

    blocks.forEach((block, index) => {
      if (index === 0 && block.type === "heading" && block.level === 1) {
        return;
      }
      const headingId =
        block.type === "heading" && block.level > 1
          ? getManualHeadingId(block.text, index)
          : undefined;
      if (block.type === "heading" && headingId) {
        tocItems.push({
          id: headingId,
          level: block.level,
          text: block.text,
        });
      }
      article.append(createManualBlockElement(documentRef, block, headingId));
    });

    const layout = documentRef.createElement("div");
    layout.className = "manual-modal__layout";

    const tocToggle = documentRef.createElement("button");
    tocToggle.className = "manual-modal__toc-toggle dads-button";
    tocToggle.type = "button";
    tocToggle.textContent = t("manual.tocToggle", {}, locale);
    tocToggle.addEventListener("click", () => {
      layout.classList.add("manual-modal__layout--toc-open");
    });

    const setActiveTocButton = (button: HTMLButtonElement) => {
      layout
        .querySelectorAll<HTMLButtonElement>(".manual-modal__toc-link")
        .forEach((link) => {
          link.removeAttribute("aria-current");
        });
      button.setAttribute("aria-current", "true");
    };

    const closeToc = () => {
      layout.classList.remove("manual-modal__layout--toc-open");
    };

    const toc = createManualTableOfContents(
      documentRef,
      locale,
      tocItems,
      (item, button) => {
        const heading = article.querySelector<HTMLElement>(`#${item.id}`);
        heading?.scrollIntoView?.({ block: "start", behavior: "smooth" });
        heading?.focus({ preventScroll: true });
        setActiveTocButton(button);
        closeToc();
      },
      closeToc,
    );

    layout.append(tocToggle, toc, article);
    manualBody.replaceChildren(layout);
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
    subscribeLocaleChange(() => {
      renderManualContent();
    });
  }

  return {
    closeManual,
    initManualModal,
    openManual,
    renderManualContent,
  };
}
