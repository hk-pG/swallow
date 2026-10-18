import type { Folder, FolderId, ItemId, ItemMetadata, ItemMetadataPatch } from "@swallow/shared";
import { type FormEvent, type KeyboardEvent, useEffect, useId, useMemo, useState } from "react";
import { flattenFolderNames } from "../lib/folders";
import { formatBytes, formatDateTime, formatResolution } from "../lib/format";
import { suggestTags } from "../lib/tags";
import { ColorLabelPicker } from "./ColorLabelPicker";
import { FolderAssignControl } from "./FolderAssignControl";

const MAX_STAR = 5;

interface InspectorProps {
  item: ItemMetadata | null;
  /** Library folder tree, used to resolve `item.folders` to names. */
  folders?: Folder[];
  /** All tags registered in the library, used for suggestions. */
  libraryTagNames?: string[];
  onSave: (id: ItemId, patch: ItemMetadataPatch) => Promise<void>;
  onAssignFolder?: (id: ItemId, folderId: FolderId) => Promise<void>;
  onUnassignFolder?: (id: ItemId, folderId: FolderId) => Promise<void>;
  onAddTags?: (id: ItemId, tags: string[]) => Promise<void>;
  onRemoveTags?: (id: ItemId, tags: string[]) => Promise<void>;
}

export function Inspector({
  item,
  folders = [],
  libraryTagNames = [],
  onSave,
  onAssignFolder,
  onUnassignFolder,
  onAddTags,
  onRemoveTags,
}: InspectorProps) {
  const [error, setError] = useState<string | null>(null);
  const folderNames = useMemo(() => flattenFolderNames(folders), [folders]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: clear errors from the previous selection
  useEffect(() => setError(null), [item?.id]);

  if (!item) {
    return <p className="inspector-empty">アイテムを選択してください</p>;
  }

  const { id } = item;
  const save = async (patch: ItemMetadataPatch) => {
    setError(null);
    try {
      await onSave(id, patch);
    } catch (e) {
      setError(String(e));
      throw e;
    }
  };

  return (
    <div className="inspector-body" key={id}>
      <CommitField label="名前" value={item.name} required onCommit={(name) => save({ name })} />
      <StarRating value={item.star} onChange={(star) => save({ star }).catch(() => {})} />
      <ColorLabelPicker
        value={item.colorLabel}
        onChange={(colorLabel) => save({ colorLabel }).catch(() => {})}
      />
      <CommitField
        label="メモ"
        value={item.annotation}
        multiline
        onCommit={(annotation) => save({ annotation })}
      />
      <CommitField
        label="URL"
        value={item.url ?? ""}
        type="url"
        placeholder="https://"
        onCommit={(url) => save({ url })}
      />
      {error && (
        <p className="inspector-error" role="alert">
          保存に失敗しました: {error}
        </p>
      )}

      <section className="inspector-section">
        <h3>タグ</h3>
        {onAddTags && onRemoveTags ? (
          <EditableTagList
            tags={item.tags}
            suggestions={libraryTagNames}
            onAdd={async (tags) => {
              setError(null);
              try {
                await onAddTags(id, tags);
              } catch (e) {
                setError(String(e));
                throw e;
              }
            }}
            onRemove={async (tags) => {
              setError(null);
              try {
                await onRemoveTags(id, tags);
              } catch (e) {
                setError(String(e));
                throw e;
              }
            }}
          />
        ) : (
          <ChipList values={item.tags} empty="タグなし" />
        )}
      </section>
      <section className="inspector-section">
        <h3>フォルダ</h3>
        {onAssignFolder && onUnassignFolder ? (
          <FolderAssignControl
            folders={folders}
            memberIds={item.folders}
            onAssign={(folderId) => onAssignFolder(id, folderId)}
            onUnassign={(folderId) => onUnassignFolder(id, folderId)}
          />
        ) : (
          <ChipList
            values={item.folders.map((fid) => folderNames.get(fid) ?? fid)}
            empty="未分類"
          />
        )}
      </section>

      <section className="inspector-section">
        <h3>情報</h3>
        <dl className="inspector-props">
          <dt>形式</dt>
          <dd>{item.ext.toUpperCase()}</dd>
          <dt>サイズ</dt>
          <dd>{formatBytes(item.size)}</dd>
          <dt>解像度</dt>
          <dd>{formatResolution(item.width, item.height)}</dd>
          <dt>作成日時</dt>
          <dd>{formatDateTime(item.createdAt)}</dd>
          <dt>更新日時</dt>
          <dd>{formatDateTime(item.modifiedAt)}</dd>
        </dl>
      </section>
    </div>
  );
}

interface CommitFieldProps {
  label: string;
  value: string;
  multiline?: boolean;
  required?: boolean;
  type?: "text" | "url";
  placeholder?: string;
  onCommit: (value: string) => Promise<void>;
}

/** Saves on blur or Enter (Ctrl/Cmd+Enter when multiline); Escape reverts. */
function CommitField({
  label,
  value,
  multiline,
  required,
  type = "text",
  placeholder,
  onCommit,
}: CommitFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  const commit = () => {
    if (draft === value) return;
    if (required && draft.trim() === "") {
      setDraft(value);
      return;
    }
    onCommit(draft).catch(() => setDraft(value));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      // Blurring here would commit the stale draft before the reset renders.
      setDraft(value);
    } else if (e.key === "Enter" && (!multiline || e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  const common = {
    id,
    className: "inspector-input",
    value: draft,
    placeholder,
    onChange: (e: { target: { value: string } }) => setDraft(e.target.value),
    onBlur: commit,
    onKeyDown,
  };

  return (
    <div className="inspector-field">
      <label className="inspector-label" htmlFor={id}>
        {label}
      </label>
      {multiline ? <textarea rows={4} {...common} /> : <input type={type} {...common} />}
    </div>
  );
}

function StarRating({ value, onChange }: { value: number; onChange: (star: number) => void }) {
  return (
    <div className="inspector-field">
      <span className="inspector-label">評価</span>
      <div className="star-rating">
        {Array.from({ length: MAX_STAR }, (_, i) => i + 1).map((star) => (
          <button
            key={star}
            type="button"
            className={star <= value ? "star active" : "star"}
            aria-label={`${star} つ星`}
            aria-pressed={star <= value}
            onClick={() => onChange(star === value ? 0 : star)}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

function ChipList({ values, empty }: { values: string[]; empty: string }) {
  if (values.length === 0) {
    return <p className="inspector-muted">{empty}</p>;
  }
  return (
    <ul className="chip-list">
      {values.map((v) => (
        <li key={v} className="chip">
          {v}
        </li>
      ))}
    </ul>
  );
}

function EditableTagList({
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
    if (!tag || busy || tags.includes(tag)) {
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
                title={`${tag} を外す`}
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
          placeholder="タグを追加"
          value={draft}
          disabled={busy}
          onChange={(e) => setDraft(e.target.value)}
        />
        <datalist id={listId}>
          {matches.map((tag) => (
            <option key={tag} value={tag} />
          ))}
        </datalist>
        <button type="submit" disabled={busy || draft.trim() === ""}>
          追加
        </button>
      </form>
    </div>
  );
}
