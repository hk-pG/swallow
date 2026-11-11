import type {
  ColorLabel,
  Folder,
  FolderId,
  ItemId,
  ItemMetadata,
  ItemMetadataPatch,
} from "@swallow/shared";
import { type FormEvent, useId, useMemo, useState } from "react";
import { ColorLabelPicker } from "../../color-labels";
import { FolderAssignControl } from "../../folders";
import { suggestTags } from "../../tags";
import { commonColorLabel, unionItemTags } from "../lib/multiSelect";

interface MultiItemInspectorProps {
  selectedCount: number;
  selectedItems: readonly ItemMetadata[];
  folders: Folder[];
  libraryTagNames: string[];
  onSaveItems: (ids: ItemId[], patch: ItemMetadataPatch) => Promise<void>;
  onAssignFolder: (ids: ItemId[], folderId: FolderId) => Promise<void>;
  onUnassignFolder: (ids: ItemId[], folderId: FolderId) => Promise<void>;
  onAddTags: (ids: ItemId[], tags: string[]) => Promise<void>;
  onRemoveTags: (ids: ItemId[], tags: string[]) => Promise<void>;
}

export function MultiItemInspector({
  selectedCount,
  selectedItems,
  folders,
  libraryTagNames,
  onSaveItems,
  onAssignFolder,
  onUnassignFolder,
  onAddTags,
  onRemoveTags,
}: MultiItemInspectorProps) {
  const [error, setError] = useState<string | null>(null);
  const itemIds = useMemo(() => selectedItems.map((entry) => entry.id), [selectedItems]);
  const tags = useMemo(() => unionItemTags(selectedItems), [selectedItems]);
  const colorLabel = useMemo(() => commonColorLabel(selectedItems), [selectedItems]);
  const mixedColorLabels =
    selectedItems.length > 1 &&
    colorLabel === null &&
    selectedItems.some((entry) => entry.colorLabel !== null);

  const setColorLabel = async (next: ColorLabel | null) => {
    setError(null);
    try {
      await onSaveItems(itemIds, { colorLabel: next });
    } catch (e) {
      setError(String(e));
      throw e;
    }
  };

  return (
    <div className="inspector-body" data-multi-inspector="true">
      <p className="inspector-muted">{selectedCount} 件を選択中</p>
      {mixedColorLabels && <p className="inspector-muted">カラーラベルが混在しています</p>}
      <ColorLabelPicker value={colorLabel} onChange={(label) => void setColorLabel(label)} />

      <section className="inspector-section">
        <h3>タグ</h3>
        <BulkTagEditor
          tags={tags}
          suggestions={libraryTagNames}
          onAdd={async (nextTags) => {
            setError(null);
            try {
              await onAddTags(itemIds, nextTags);
            } catch (e) {
              setError(String(e));
              throw e;
            }
          }}
          onRemove={async (nextTags) => {
            setError(null);
            try {
              await onRemoveTags(itemIds, nextTags);
            } catch (e) {
              setError(String(e));
              throw e;
            }
          }}
        />
      </section>

      <section className="inspector-section">
        <h3>フォルダ</h3>
        <FolderAssignControl
          key={itemIds.slice().sort().join("\n")}
          folders={folders}
          onAssign={(folderId) => onAssignFolder(itemIds, folderId)}
          onUnassign={(folderId) => onUnassignFolder(itemIds, folderId)}
        />
      </section>

      {error && (
        <p className="inspector-error" role="alert">
          保存に失敗しました: {error}
        </p>
      )}
    </div>
  );
}

function BulkTagEditor({
  tags,
  suggestions,
  onAdd,
  onRemove,
}: {
  tags: string[];
  suggestions: string[];
  onAdd: (tags: string[]) => Promise<void>;
  onRemove: (tags: string[]) => Promise<void>;
}) {
  const listId = useId();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const matches = useMemo(() => suggestTags(suggestions, draft, tags), [suggestions, draft, tags]);

  const add = async (raw: string) => {
    const tag = raw.trim();
    if (!tag || busy) {
      setDraft("");
      return;
    }
    setBusy(true);
    try {
      await onAdd([tag]);
      setDraft("");
    } catch {
      // Parent surfaces the error.
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void add(draft);
  };

  return (
    <div className="editable-tags">
      {tags.length === 0 ? (
        <p className="inspector-muted">タグなし</p>
      ) : (
        <ul className="chip-list">
          {tags.map((tag) => (
            <li key={tag} className="chip editable-chip">
              <span>{tag}</span>
              <button
                type="button"
                className="chip-remove"
                title={`選択中のすべてから ${tag} を外す`}
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void onRemove([tag]).finally(() => setBusy(false));
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="tag-add-form" onSubmit={submit}>
        <input
          className="inspector-input"
          type="text"
          list={listId}
          data-inspector-tag-input="true"
          placeholder="選択中すべてにタグを追加"
          value={draft}
          disabled={busy}
          onChange={(e) => setDraft(e.target.value)}
        />
        <datalist id={listId}>
          {matches.map((tag) => (
            <option key={tag} value={tag} />
          ))}
        </datalist>
        <button
          type="submit"
          className="push-button compact"
          disabled={busy || draft.trim() === ""}
        >
          追加
        </button>
      </form>
    </div>
  );
}
