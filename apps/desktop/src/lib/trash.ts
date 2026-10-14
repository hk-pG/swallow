import type { ItemMetadata } from "@swallow/shared";

export function purgeConfirmMessage(items: readonly Pick<ItemMetadata, "name" | "ext">[]): string {
  const [only] = items;
  const target =
    items.length === 1 && only ? `「${only.name}.${only.ext}」` : `${items.length} 件のアイテム`;
  return `${target}を完全に削除します。ファイルも削除され、元に戻せません。`;
}
