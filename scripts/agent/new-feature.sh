#!/usr/bin/env bash
# Scaffolds apps/desktop/src/features/<name>/ with boundary-safe stubs.
set -euo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib.sh
source "$script_dir/lib.sh"

usage() {
  cat <<'EOF'
usage: scripts/agent/new-feature.sh <feature-name> [options]

  <feature-name>   kebab-case domain id (e.g. bookmarks, smart-views)

options:
  --root <path>    repository root (default: git top-level)
  --with-api       add features/<name>/api.ts (Tauri IPC skeleton, no invoke until Rust is registered)
  --with-sidebar   add features/<name>/sidebar/<Pascal>Section.tsx and export from index.ts
  --dry-run        print planned files and checklist without writing
  -h, --help       show this help

Creates the public facade (index.ts) and optional api/sidebar stubs that pass
feature-boundaries and tauri-command-contract CI without registering new commands.
EOF
}

kebab_to_pascal() {
  local name=$1
  local part
  local out=""
  local IFS=-
  read -ra parts <<<"$name"
  for part in "${parts[@]}"; do
    if [[ -z "$part" ]]; then
      die "invalid feature name: empty segment in \"$name\""
    fi
    out+="${part^}"
  done
  printf '%s' "$out"
}

is_valid_feature_name() {
  local name=$1
  [[ "$name" =~ ^[a-z][a-z0-9]*(-[a-z0-9]+)*$ ]]
}

print_checklist() {
  local name=$1
  local with_api=$2
  local with_sidebar=$3
  cat <<EOF

== 新機能 "${name}" の拡張チェックリスト ==

[ ] packages/shared — 型・純関数: packages/shared/src/<domain>/ と packages/shared/src/index.ts
[ ] Rust domain — apps/desktop/src-tauri/src/domain/（必要なら infra/）
[ ] Rust commands — apps/desktop/src-tauri/src/commands/<領域>.rs + commands/mod.rs の swallow_invoke_handler!
[ ] フロント公開面 — apps/desktop/src/features/${name}/index.ts$( [[ "$with_api" == "1" ]] && echo " と api.ts（invoke は Rust 登録後）")
$( [[ "$with_sidebar" == "1" ]] && echo "[ ] サイドバー — sidebarRegistry.tsx に { id: \"${name}\", Component, requiredProviders } を追加" )
[ ] App Providers — session 状態が必要なら app/appFeatureProviders.tsx の APP_FEATURE_PROVIDERS
[ ] HTTP API（該当時）— packages/shared/src/api/httpContract.ts の HTTP_API_ROUTES
[ ] HTTP API（該当時）— apps/desktop/src-tauri/src/infra/http_api.rs の HTTP_API_ROUTE_SPECS
[ ] テスト — 振る舞い変更に Vitest / Rust #[cfg(test)]
[ ] 検証 — pnpm lint && pnpm typecheck && pnpm test（境界・契約 CI 含む）

詳細手順: .agents/skills/new-feature/SKILL.md
EOF
}

REPO_ROOT=""
FEATURE_NAME=""
WITH_API=0
WITH_SIDEBAR=0
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h | --help)
      usage
      exit 0
      ;;
    --root)
      [[ $# -ge 2 ]] || die "--root requires a path"
      REPO_ROOT=$(cd "$2" && pwd)
      shift 2
      ;;
    --with-api)
      WITH_API=1
      shift
      ;;
    --with-sidebar)
      WITH_SIDEBAR=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --)
      shift
      break
      ;;
    -*)
      die "unknown option: $1 (use --help)"
      ;;
    *)
      if [[ -n "$FEATURE_NAME" ]]; then
        die "unexpected argument: $1 (only one feature name allowed)"
      fi
      FEATURE_NAME=$1
      shift
      ;;
  esac
done

if [[ -z "$FEATURE_NAME" ]]; then
  usage >&2
  die "missing <feature-name>"
fi

if [[ -n "$REPO_ROOT" ]]; then
  :
else
  REPO_ROOT=$(repo_root 2>/dev/null || true)
  if [[ -z "$REPO_ROOT" ]]; then
    REPO_ROOT=$(cd "$script_dir/../.." && pwd)
  fi
fi

if ! is_valid_feature_name "$FEATURE_NAME"; then
  die "invalid feature name \"$FEATURE_NAME\" (use kebab-case: ^[a-z][a-z0-9]*(-[a-z0-9]+)*$)"
fi

case "$FEATURE_NAME" in
  app | shared | platform)
    die "reserved feature name: $FEATURE_NAME"
    ;;
esac

FEATURE_DIR="$REPO_ROOT/apps/desktop/src/features/$FEATURE_NAME"
if [[ -e "$FEATURE_DIR" ]]; then
  die "feature already exists: $FEATURE_DIR"
fi

PASCAL=$(kebab_to_pascal "$FEATURE_NAME")
SECTION_COMPONENT="${PASCAL}Section"

write_file() {
  local rel=$1
  local body=$2
  local full="$FEATURE_DIR/$rel"
  if [[ "$DRY_RUN" == 1 ]]; then
    info "[dry-run] would write $full"
    return
  fi
  mkdir -p "$(dirname "$full")"
  printf '%s' "$body" >"$full"
  [[ "$body" == *$'\n' ]] || printf '\n' >>"$full"
  info "wrote $full"
}

feature_index_body() {
  local exports=$1
  cat <<EOF
/**
 * Public facade for this feature — re-export hooks, components, and sidebar entries here.
 * Do not import other features' internal paths; use their index.ts or api.ts only.
 */

${exports}
EOF
}

if [[ "$WITH_SIDEBAR" == 1 ]]; then
  INDEX_BODY=$(feature_index_body "export { ${SECTION_COMPONENT} } from \"./sidebar/${SECTION_COMPONENT}\";")
else
  INDEX_BODY=$(feature_index_body "export {};")
fi

API_BODY='/**
 * Tauri IPC for this feature.
 *
 * Before adding invoke() calls:
 *  1. Implement #[tauri::command] in apps/desktop/src-tauri/src/commands/
 *  2. Register in commands/mod.rs (swallow_invoke_handler!)
 *  3. Add typed wrappers here (invoke is allowed only in this file)
 *
 * Until then, keep this module free of invoke/listen so tauri-command-contract CI passes.
 */

export {};
'

SIDEBAR_BODY="import type { SidebarSectionProps } from \"../../sidebar\";

/** Sidebar section stub — replace with real UI and register in app/sidebarRegistry.tsx. */
export function ${SECTION_COMPONENT}(_props: SidebarSectionProps) {
  return null;
}
"

if [[ "$DRY_RUN" == 1 ]]; then
  info "dry-run: feature $FEATURE_NAME at $FEATURE_DIR"
fi

if [[ "$DRY_RUN" != 1 ]]; then
  mkdir -p "$FEATURE_DIR"
fi

write_file "index.ts" "$INDEX_BODY"

if [[ "$WITH_API" == 1 ]]; then
  write_file "api.ts" "$API_BODY"
fi

if [[ "$WITH_SIDEBAR" == 1 ]]; then
  write_file "sidebar/${SECTION_COMPONENT}.tsx" "$SIDEBAR_BODY"
fi

print_checklist "$FEATURE_NAME" "$WITH_API" "$WITH_SIDEBAR"

if [[ "$DRY_RUN" == 1 ]]; then
  info "dry-run complete (no files written)"
else
  info "feature scaffold created: features/$FEATURE_NAME"
fi
