import type { AppInfo, ItemId, LibraryTags } from "@swallow/shared";
import { invoke } from "@tauri-apps/api/core";

export function getAppInfo(): Promise<AppInfo> {
  return invoke<AppInfo>("app_info");
}

export function getLibraryTags(libraryPath: string): Promise<LibraryTags> {
  return invoke<LibraryTags>("get_library_tags", { libraryPath });
}

export function addTag(libraryPath: string, tag: string): Promise<LibraryTags> {
  return invoke<LibraryTags>("add_tag", { libraryPath, tag });
}

/** Also removes the tag from every item. */
export function removeTag(libraryPath: string, tag: string): Promise<LibraryTags> {
  return invoke<LibraryTags>("remove_tag", { libraryPath, tag });
}

export function createTagGroup(libraryPath: string, name: string): Promise<LibraryTags> {
  return invoke<LibraryTags>("create_tag_group", { libraryPath, name });
}

/** Tags in the group stay in the library as ungrouped tags. */
export function deleteTagGroup(libraryPath: string, groupId: string): Promise<LibraryTags> {
  return invoke<LibraryTags>("delete_tag_group", { libraryPath, groupId });
}

/** `groupId: null` makes the tag ungrouped. */
export function setTagGroup(
  libraryPath: string,
  tag: string,
  groupId: string | null,
): Promise<LibraryTags> {
  return invoke<LibraryTags>("set_tag_group", { libraryPath, tag, groupId });
}

export function addItemTags(
  libraryPath: string,
  itemIds: ItemId[],
  tags: string[],
): Promise<LibraryTags> {
  return invoke<LibraryTags>("add_item_tags", { libraryPath, itemIds, tags });
}

export function removeItemTags(
  libraryPath: string,
  itemIds: ItemId[],
  tags: string[],
): Promise<void> {
  return invoke<void>("remove_item_tags", { libraryPath, itemIds, tags });
}
