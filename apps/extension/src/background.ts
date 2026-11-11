import { desktopAppInfoUrl } from "./loopback";

/** Shared-contract URL kept live until the save flow calls the desktop API. */
export const DESKTOP_APP_INFO_URL = desktopAppInfoUrl();

chrome.runtime.onInstalled.addListener(() => {
  if (DESKTOP_APP_INFO_URL.length === 0) {
    throw new Error("desktop app info URL is empty");
  }
});
