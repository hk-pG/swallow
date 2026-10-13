/** ULID */
export type ItemId = string;
export type FolderId = string;

/** `images/<id>.info/metadata.json` */
export interface ItemMetadata {
  id: ItemId;
  name: string;
  ext: string;
  /** bytes */
  size: number;
  width: number | null;
  height: number | null;
  tags: string[];
  folders: FolderId[];
  annotation: string;
  /** 0-5 */
  star: number;
  url: string | null;
  /** Unix epoch milliseconds */
  createdAt: number;
  /** Unix epoch milliseconds */
  modifiedAt: number;
  isDeleted: boolean;
}

export interface Folder {
  id: FolderId;
  name: string;
  children: Folder[];
}

/** `metadata.json` at the library root */
export interface LibraryMetadata {
  name: string;
  version: number;
  folders: Folder[];
}

export interface TagGroup {
  id: string;
  name: string;
  tags: string[];
}

/** `tags.json` at the library root */
export interface LibraryTags {
  tags: string[];
  groups: TagGroup[];
}
