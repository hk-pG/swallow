import type { ItemView, LibraryTags, TagGroup } from "@swallow/shared";
import { ask } from "@tauri-apps/plugin-dialog";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { tagSections } from "../lib/tags";
import { SidebarSection } from "./SidebarSection";

export interface TagNavMutations {
  addTag: (tag: string) => Promise<void>;
  removeTag: (tag: string) => Promise<void>;
  createGroup: (name: string) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
  setTagGroup: (tag: string, groupId: string | null) => Promise<void>;
}

interface Props {
  libraryTags: LibraryTags | null;
  view: ItemView;
  onChange: (view: ItemView) => void;
  mutations: TagNavMutations;
  disabled?: boolean;
}

export function TagNav({ libraryTags, view, onChange, mutations, disabled }: Props) {
  const [tagDraft, setTagDraft] = useState("");
  const [groupDraft, setGroupDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sections = useMemo(() => (libraryTags ? tagSections(libraryTags) : []), [libraryTags]);
  const groups = libraryTags?.groups ?? [];

  useEffect(() => {
    if (disabled) setAdding(false);
  }, [disabled]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const submitTag = (e: FormEvent) => {
    e.preventDefault();
    const tag = tagDraft.trim();
    if (!tag || disabled || busy) return;
    void run(async () => {
      await mutations.addTag(tag);
      setTagDraft("");
      setAdding(false);
    });
  };

  const submitGroup = (e: FormEvent) => {
    e.preventDefault();
    const name = groupDraft.trim();
    if (!name || disabled || busy) return;
    void run(async () => {
      await mutations.createGroup(name);
      setGroupDraft("");
      setAdding(false);
    });
  };

  const handleRemoveTag = (tag: string) => {
    void run(async () => {
      const confirmed = await ask(
        `タグ「${tag}」を削除しますか？すべてのアイテムからも外れます。`,
        {
          title: "タグを削除",
          kind: "warning",
          okLabel: "削除",
          cancelLabel: "キャンセル",
        },
      );
      if (!confirmed) return;
      await mutations.removeTag(tag);
    });
  };

  const handleDeleteGroup = (group: TagGroup) => {
    void run(async () => {
      const confirmed = await ask(
        `グループ「${group.name}」を削除しますか？中のタグは未分類に残ります。`,
        {
          title: "タググループを削除",
          kind: "warning",
          okLabel: "削除",
          cancelLabel: "キャンセル",
        },
      );
      if (!confirmed) return;
      await mutations.deleteGroup(group.id);
    });
  };

  return (
    <SidebarSection
      title="タグ"
      headerAction={
        <button
          type="button"
          className="text-button"
          disabled={disabled}
          aria-expanded={adding}
          onClick={() => setAdding((open) => !open)}
        >
          追加
        </button>
      }
    >
      {adding && (
        <>
          <form className="sidebar-form" onSubmit={submitTag}>
            <input
              className="sidebar-input"
              type="text"
              placeholder="タグを追加"
              value={tagDraft}
              disabled={disabled || busy}
              onChange={(e) => setTagDraft(e.target.value)}
            />
            <button type="submit" disabled={disabled || busy || tagDraft.trim() === ""}>
              追加
            </button>
          </form>
          <form className="sidebar-form" onSubmit={submitGroup}>
            <input
              className="sidebar-input"
              type="text"
              placeholder="グループを作成"
              value={groupDraft}
              disabled={disabled || busy}
              onChange={(e) => setGroupDraft(e.target.value)}
            />
            <button type="submit" disabled={disabled || busy || groupDraft.trim() === ""}>
              作成
            </button>
          </form>
        </>
      )}

      {error && (
        <p className="sidebar-error" role="alert">
          {error}
        </p>
      )}

      {sections.map(({ group, tags }) => (
        <div key={group?.id ?? "ungrouped"} className="tag-group">
          <div className="tag-group-header">
            <span className="tag-group-name">{group?.name ?? "未分類"}</span>
            {group && (
              <button
                type="button"
                className="sidebar-icon-button"
                title="グループを削除"
                disabled={disabled || busy}
                onClick={() => handleDeleteGroup(group)}
              >
                ×
              </button>
            )}
          </div>
          {tags.length === 0 ? (
            <p className="tag-group-empty">タグなし</p>
          ) : (
            <ul className="tag-list">
              {tags.map((tag) => {
                const selected = view.kind === "tag" && view.tag === tag;
                return (
                  <li key={tag} className="sidebar-row">
                    <button
                      type="button"
                      className="nav-item tag-nav-item"
                      aria-current={selected ? "page" : undefined}
                      disabled={disabled || busy}
                      onClick={() => onChange({ kind: "tag", tag })}
                    >
                      {tag}
                    </button>
                    {selected && !disabled && (
                      <div className="sidebar-detail">
                        <select
                          className="tag-group-select"
                          aria-label={`${tag} のグループ`}
                          value={group?.id ?? ""}
                          disabled={busy}
                          onChange={(e) => {
                            const value = e.target.value;
                            void run(() => mutations.setTagGroup(tag, value === "" ? null : value));
                          }}
                        >
                          <option value="">未分類</option>
                          {groups.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="text-button danger"
                          disabled={busy}
                          onClick={() => handleRemoveTag(tag)}
                        >
                          削除
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </SidebarSection>
  );
}
