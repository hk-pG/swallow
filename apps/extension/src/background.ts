import {
  type ExtensionRequest,
  type ExtensionResponse,
  isExtensionRequest,
} from "./extensionProtocol";
import { bytesFromBase64, imageParts, imageScheme, MAX_PAGE_TRANSFER_BYTES } from "./imageBytes";
import {
  listImagesInPage,
  type PageBytesResult,
  type PageImageResult,
  readBlobUrlInPage,
  readImageAtInPage,
} from "./pageImage";
import { type LoadedImage, saveFromSrcUrl, saveLoadedImage } from "./saveImage";
import {
  IMAGE_FETCH_FAILED_MESSAGE,
  IMAGE_TOO_LARGE_MESSAGE,
  PAGE_UNREADABLE_MESSAGE,
  SAVE_FAILED_MESSAGE,
  SAVE_MENU_TITLE,
} from "./userMessage";

const SAVE_IMAGE_MENU_ID = "swallow-save-image";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: SAVE_IMAGE_MENU_ID,
      title: SAVE_MENU_TITLE,
      contexts: ["image"],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== SAVE_IMAGE_MENU_ID) return;
  const srcUrl = info.srcUrl;
  if (!srcUrl) {
    notify(IMAGE_FETCH_FAILED_MESSAGE);
    return;
  }
  void saveFromSrcUrl(
    { srcUrl, pageUrl: info.pageUrl ?? tab?.url },
    {
      fetch: extensionFetch(),
      readBlobInTab: (blobUrl) => readBlobInTab(tab?.id, info.frameId, blobUrl),
    },
  )
    .then((result) => {
      notify(result.message);
    })
    .catch(() => {
      notify(SAVE_FAILED_MESSAGE);
    });
});

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !isExtensionRequest(message)) return undefined;
  void handleExtensionRequest(message)
    .then(sendResponse)
    .catch(() => {
      sendResponse({ ok: false, message: SAVE_FAILED_MESSAGE } satisfies ExtensionResponse);
    });
  return true;
});

async function handleExtensionRequest(request: ExtensionRequest): Promise<ExtensionResponse> {
  if (request.type === "list-images") {
    return listTabImages(request.tabId);
  }
  const pageUrl = await pageUrlOf(request.tabId);
  if (
    request.srcUrl &&
    imageScheme(request.srcUrl) !== "data" &&
    imageScheme(request.srcUrl) !== "other"
  ) {
    return saveFromSrcUrl(
      { srcUrl: request.srcUrl, pageUrl },
      {
        fetch: extensionFetch(),
        readBlobInTab: (blobUrl) => readBlobInTab(request.tabId, undefined, blobUrl),
      },
    );
  }
  try {
    const injected = await chrome.scripting.executeScript({
      target: { tabId: request.tabId },
      func: readImageAtInPage,
      args: [request.imageIndex, MAX_PAGE_TRANSFER_BYTES],
    });
    const read = injected[0]?.result;
    if (!read) return { ok: false, message: IMAGE_FETCH_FAILED_MESSAGE };
    return savePageRead(read, pageUrl, request.tabId);
  } catch {
    return { ok: false, message: PAGE_UNREADABLE_MESSAGE };
  }
}

async function listTabImages(tabId: number): Promise<ExtensionResponse> {
  try {
    const injected = await chrome.scripting.executeScript({
      target: { tabId },
      func: listImagesInPage,
    });
    const images = injected[0]?.result;
    if (!images) return { ok: false, message: PAGE_UNREADABLE_MESSAGE };
    return { ok: true, images };
  } catch {
    return { ok: false, message: PAGE_UNREADABLE_MESSAGE };
  }
}

async function savePageRead(
  read: PageImageResult,
  pageUrl: string | undefined,
  tabId: number,
): Promise<ExtensionResponse> {
  if (!read.ok) {
    return {
      ok: false,
      message: read.reason === "tooLarge" ? IMAGE_TOO_LARGE_MESSAGE : IMAGE_FETCH_FAILED_MESSAGE,
    };
  }
  if (read.mode === "url") {
    return saveFromSrcUrl(
      { srcUrl: read.url, pageUrl },
      {
        fetch: extensionFetch(),
        readBlobInTab: (blobUrl) => readBlobInTab(tabId, undefined, blobUrl),
      },
    );
  }
  let bytes: Uint8Array;
  try {
    bytes = bytesFromBase64(read.base64);
  } catch {
    return { ok: false, message: IMAGE_FETCH_FAILED_MESSAGE };
  }
  const parts = imageParts({ contentType: read.mime, bytes });
  const image: LoadedImage = { bytes, mime: parts.mime, name: parts.name, ext: parts.ext };
  return saveLoadedImage(image, pageUrl, extensionFetch());
}

async function readBlobInTab(
  tabId: number | undefined,
  frameId: number | undefined,
  blobUrl: string,
): Promise<PageBytesResult> {
  if (tabId === undefined) return { ok: false, reason: "fetch" };
  const injected = await chrome.scripting.executeScript({
    target: frameId === undefined ? { tabId } : { tabId, frameIds: [frameId] },
    func: readBlobUrlInPage,
    args: [blobUrl, MAX_PAGE_TRANSFER_BYTES],
  });
  return injected[0]?.result ?? { ok: false, reason: "fetch" };
}

async function pageUrlOf(tabId: number): Promise<string | undefined> {
  try {
    const tab = await chrome.tabs.get(tabId);
    return tab.url;
  } catch {
    return undefined;
  }
}

function extensionFetch(): typeof fetch {
  return globalThis.fetch.bind(globalThis);
}

function notify(message: string): void {
  void chrome.notifications.create({
    type: "basic",
    iconUrl: "icon.png",
    title: "Swallow",
    message,
  });
}
