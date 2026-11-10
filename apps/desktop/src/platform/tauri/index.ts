/**
 * Backward-compatible re-exports of Tauri command wrappers after the feature split.
 * Prefer importing from `features/<name>/api` in new code.
 */

export {
  assignItems,
  createFolder,
  deleteFolder,
  listFolders,
  moveFolder,
  renameFolder,
  unassignItems,
} from "../../features/folders/api";
export { importAssets, pickImportFiles, pickImportFolders } from "../../features/import/api";
export {
  getItem,
  ITEMS_IMPORTED_EVENT,
  listItems,
  onItemImported,
  purgeItems,
  restoreItems,
  revealItemInExplorer,
  trashItems,
  updateItem,
} from "../../features/items/api";
export {
  createLibrary,
  getAppInfo,
  getRecentLibraries,
  openLibrary,
  restoreLibrary,
} from "../../features/library/api";
export { getSettings, updateSettings } from "../../features/settings/api";
export {
  createSmartFolder,
  deleteSmartFolder,
  listSmartFolders,
  renameSmartFolder,
  updateSmartFolder,
} from "../../features/smart-folders/api";
export {
  addItemTags,
  addTag,
  createTagGroup,
  deleteTagGroup,
  getLibraryTags,
  removeItemTags,
  removeTag,
  setTagGroup,
} from "../../features/tags/api";
