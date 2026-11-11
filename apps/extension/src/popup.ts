import { isExtensionResponse } from "./extensionProtocol";
import type { ListedImage } from "./pageImage";
import {
  FINDING_IMAGES_MESSAGE,
  NO_IMAGES_MESSAGE,
  PAGE_UNREADABLE_MESSAGE,
  SAVE_FAILED_MESSAGE,
  SAVE_MENU_TITLE,
  SAVING_MESSAGE,
} from "./userMessage";

void main();

async function main(): Promise<void> {
  const status = document.querySelector("#status");
  const list = document.querySelector("#images");
  if (!(status instanceof HTMLElement) || !(list instanceof HTMLElement)) return;
  setStatus(status, FINDING_IMAGES_MESSAGE, "info");
  const tabId = await activeTabId();
  if (tabId === undefined) {
    setStatus(status, PAGE_UNREADABLE_MESSAGE, "error");
    return;
  }
  let response: unknown;
  try {
    response = await chrome.runtime.sendMessage({ type: "list-images", tabId });
  } catch {
    setStatus(status, PAGE_UNREADABLE_MESSAGE, "error");
    return;
  }
  if (!isExtensionResponse(response) || !response.ok || !("images" in response)) {
    const message =
      isExtensionResponse(response) && !response.ok ? response.message : PAGE_UNREADABLE_MESSAGE;
    setStatus(status, message, "error");
    return;
  }
  if (response.images.length === 0) {
    setStatus(status, NO_IMAGES_MESSAGE, "info");
    return;
  }
  setStatus(status, "", "info");
  for (const image of response.images) {
    list.append(renderRow(image, tabId, status));
  }
}

function renderRow(image: ListedImage, tabId: number, status: HTMLElement): HTMLLIElement {
  const row = document.createElement("li");
  const text = document.createElement("div");
  text.className = "text";
  const label = document.createElement("div");
  label.className = "label";
  label.textContent = image.label;
  text.append(label);
  if (image.width > 0 && image.height > 0) {
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `${image.width} × ${image.height}`;
    text.append(meta);
  }
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = SAVE_MENU_TITLE;
  button.addEventListener("click", () => {
    void saveImage(button, image, tabId, status);
  });
  row.append(text, button);
  return row;
}

async function saveImage(
  button: HTMLButtonElement,
  image: ListedImage,
  tabId: number,
  status: HTMLElement,
): Promise<void> {
  button.disabled = true;
  setStatus(status, SAVING_MESSAGE, "info");
  let response: unknown;
  try {
    response = await chrome.runtime.sendMessage({
      type: "save-image",
      tabId,
      imageIndex: image.index,
      srcUrl: image.srcUrl,
    });
  } catch {
    response = undefined;
  }
  button.disabled = false;
  if (isExtensionResponse(response) && "message" in response) {
    setStatus(status, response.message, response.ok ? "success" : "error");
    return;
  }
  setStatus(status, SAVE_FAILED_MESSAGE, "error");
}

function setStatus(status: HTMLElement, message: string, kind: "info" | "error" | "success"): void {
  status.textContent = message;
  status.dataset.kind = message === "" ? "" : kind;
}

async function activeTabId(): Promise<number | undefined> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0]?.id;
}
