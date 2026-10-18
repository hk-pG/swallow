/** Focuses the tag input in the inspector after selecting an item. */
export function focusInspectorTagInput(): void {
  const input = document.querySelector<HTMLInputElement>('[data-inspector-tag-input="true"]');
  input?.focus();
  input?.scrollIntoView({ block: "nearest" });
}
