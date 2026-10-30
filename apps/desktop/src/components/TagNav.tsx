import type { ItemView, LibraryTags, TagGroup } from "@swallow/shared";
import { ask } from "@tauri-apps/plugin-dialog";
import { type FormEvent, type MouseEvent, useMemo, useState } from "react";
import { tagSections } from "../lib/tags";
import { useSidebarContextMenu } from "../lib/useSidebarContextMenu";
import { SidebarContextMenu } from "./SidebarContextMenu";

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

type TagMenuTarget = { tag: string; groupId: string | null };
type TagGroupMenuTarget = { group: TagGroup };

export function TagNav({ libraryTags, view, onChange, mutations, disabled }: Props) {
  const [tagDraft, setTagDraft] = useState("");
  const [groupDraft, setGroupDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    state: tagMenuState,
    close: closeTagMenu,
    open: openTagMenu,
  } = useSidebarContextMenu<TagMenuTarget>();
  const {
    state: groupMenuState,
    close: closeGroupMenu,
    open: openGroupMenu,
  } = useSidebarContextMenu<TagGroupMenuTarget>();

  const sections = useMemo(() => (libraryTags ? tagSections(libraryTags) : []), [libraryTags]);
  const groups = libraryTags?.groups ?? [];

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
    });
  };

  const submitGroup = (e: FormEvent) => {
    e.preventDefault();
    const name = groupDraft.trim();
    if (!name || disabled || busy) return;
    void run(async () => {
      await mutations.createGroup(name);
      setGroupDraft("");
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

  const tagMenuItems = tagMenuState
    ? [
        ...groups.map((group) => ({
          label: `グループ: ${group.name}`,
          onClick: () => void run(() => mutations.setTagGroup(tagMenuState.tag, group.id)),
        })),
        {
          label: "グループ: 未分類",
          onClick: () => void run(() => mutations.setTagGroup(tagMenuState.tag, null)),
        },
        {
          label: "タグを削除",
          danger: true,
          onClick: () => handleRemoveTag(tagMenuState.tag),
        },
      ]
    : [];

  const groupMenuItems = groupMenuState
    ? [
        {
          label: "グループを削除",
          danger: true,
          onClick: () => handleDeleteGroup(groupMenuState.group),
        },
      ]
    : [];

  return (
    <section className="sidebar-section" aria-label="タグ">
      <div className="sidebar-section-header">
        <h2 className="sidebar-section-title">タグ</h2>
      </div>

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

      {error && (
        <p className="sidebar-error" role="alert">
          {error}
        </p>
      )}

      {sections.map(({ group, tags }) => (
        <div key={group?.id ?? "ungrouped"} className="tag-group">
          {group ? (
            <button
              type="button"
              className="tag-group-header tag-group-header-button"
              onContextMenu={(event: MouseEvent) => openGroupMenu(event, { group })}
            >
              <span className="tag-group-name">{group.name}</span>
            </button>
          ) : (
            <div className="tag-group-header">
              <span className="tag-group-name">未分類</span>
            </div>
          )}
          {tags.length === 0 ? (
            <p className="tag-group-empty">タグなし</p>
          ) : (
            <ul className="tag-list">
              {tags.map((tag) => (
                <li key={tag} className="tag-row">
                  <button
                    type="button"
                    className="nav-item tag-nav-item"
                    aria-current={view.kind === "tag" && view.tag === tag ? "page" : undefined}
                    disabled={disabled || busy}
                    onClick={() => onChange({ kind: "tag", tag })}
                    onContextMenu={(event: MouseEvent) =>
                      openTagMenu(event, { tag, groupId: group?.id ?? null })
                    }
                  >
                    {tag}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      <SidebarContextMenu
        state={tagMenuState}
        ariaLabel={tagMenuState ? `タグ ${tagMenuState.tag} の操作` : "タグの操作"}
        items={tagMenuItems}
        onClose={closeTagMenu}
      />
      <SidebarContextMenu
        state={groupMenuState}
        ariaLabel={
          groupMenuState ? `グループ ${groupMenuState.group.name} の操作` : "タググループの操作"
        }
        items={groupMenuItems}
        onClose={closeGroupMenu}
      />
    </section>
  );
}
