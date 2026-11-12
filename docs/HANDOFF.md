# Swallow α→β — Agent 引き継ぎ（最初に読む）

最終更新: 2026-11-10  
対象: 次の Cursor Project coordinator / Cloud Agent（まっさらな状態で可）

## 30 秒でやること

1. このファイルを読む
2. GitHub で次の作業を確認する（下記コマンド）
3. リポの `AGENTS.md` と `.agents/skills/issue-to-pr/SKILL.md` に従い、既存 Issue 1 件を PR まで進める（標準は依頼 → 計画 or 既存 Issue → PR。`create-issue` は「Issue にして」明示時、または実装途中で Issue が無いときに限る）

**正本は GitHub。このファイルの進捗表はスナップショット**（Issue + Milestone + Label が常に優先）。Cursor Project の notes は作業メモにすぎない。

---

## 1. プロジェクトの計画

| フェーズ | 内容                                                                                                       | 状態                  |
| -------- | ---------------------------------------------------------------------------------------------------------- | --------------------- |
| **α**    | Eagle 代替のデスクトップ最低限（ライブラリ・フォルダ・タグ・ゴミ箱・取り込み・シェル分割・右クリック抑止） | **完了**（main 到達） |
| **β**    | Eagle 基本機能とのギャップ埋め（P1→P2）                                                                    | **次の本番**          |
| **後続** | P3・拡張別リポ・対象外                                                                                     | backlog               |

### α で入れる／外す（確定済み）

- 入れた: フォルダ UI、右クリック抑止、App シェル main 取り込み、タグ UI
- α 外にした: Chrome 拡張（別リポ・#12）。階層取り込み #34 と設定 #35 は β へ送り、**いずれもクローズ済み**

詳細: [alpha-scope.md](./alpha-scope.md) / [eagle-vs-swallow.md](./eagle-vs-swallow.md) / [roadmap.md](./roadmap.md)

### β の優先度（2026-10-29 スナップショット）

- **P1（機能）**: 当初キュー #34 階層取り込み、#35 設定、#49 スマートフォルダ、#50 クイックルックは **すべてクローズ済み**。`milestone:beta` + `P1` のオープンは **0 件**
- **P1（セキュリティ・バグ・優先）**: #91 HTTP API Origin、#93 `thumb://` symlink（いずれも `bug` + `P1`。Milestone は現状 `alpha` のまま）
- **P2（beta・次の機能キュー）**: 例 #53 カラーラベル、#77 サイドバー、#78 HIG 探索、#87 トークン、#88 ボタン明示クラス、#89 HIG 試作撤去、#100 Biome Dependabot、#102 Rust 導入ドキュメント、#104 軽い CI パス など（一覧は GitHub）
- **P3 / backlog**: #57 Eagle 移行、#58 高度プレビュー、#12 拡張、#95 署名、ほか

マイルストーン: `alpha` | `beta` | `backlog`  
ラベル: `P1`/`P2`/`P3`、`area:desktop`/`area:extension`/`area:ci`

---

## 2. 今の進捗状況（2026-10-29 時点）

正本は GitHub。このファイルの進捗表はスナップショット。

### マージ済み（α デスクトップ）

| PR                                              | 内容                     |
| ----------------------------------------------- | ------------------------ |
| [#41](https://github.com/hk-pG/swallow/pull/41) | フォルダ UI              |
| [#42](https://github.com/hk-pG/swallow/pull/42) | 本番右クリック抑止       |
| [#47](https://github.com/hk-pG/swallow/pull/47) | App シェル分割を main へ |
| [#48](https://github.com/hk-pG/swallow/pull/48) | タグ管理 UI              |

### β P1 機能（クローズ済み・「次」から外す）

| Issue                                             | 内容                            |
| ------------------------------------------------- | ------------------------------- |
| [#34](https://github.com/hk-pG/swallow/issues/34) | フォルダ階層ごと素材を取り込む  |
| [#35](https://github.com/hk-pG/swallow/issues/35) | ユーザー設定のファイル保存      |
| [#49](https://github.com/hk-pG/swallow/issues/49) | スマートフォルダ                |
| [#50](https://github.com/hk-pG/swallow/issues/50) | クイックルック / 原寸プレビュー |

### 分類の整備

- ラベル・マイルストーンは **適用済み**（オープン Issue は随時変動。確認は `gh issue list`）
- `GH_TOKEN`（Runtime Secret）があれば Cloud Agent の `gh` で Issue 書き込み可

### 未着手（人が決める／任意）

- GitHub Projects ボード（進行のカンバン）は未作成でも運用可（Milestone+Label で足りる）

---

## 3. 次に着手する作業の確認方法

正本は GitHub。推測で始めず、必ず一覧を取る。

```bash
# 全オープン P1（セキュリティバグ含む。beta に限定しない）
gh issue list --repo hk-pG/swallow --label P1 --state open

# β の最優先ラベル（現状は空になりうる）
gh issue list --repo hk-pG/swallow --milestone beta --label P1 --state open

# β 全体（P2 中心）
gh issue list --repo hk-pG/swallow --milestone beta --state open

# 後続
gh issue list --repo hk-pG/swallow --milestone backlog --state open
```

### 2026-10-29 スナップショット（着手キュー）

1. **先にオープン P1 バグ**: [#91](https://github.com/hk-pG/swallow/issues/91)、[#93](https://github.com/hk-pG/swallow/issues/93)（`bug` + `P1`。機能 P2 より先）
2. **beta + P1 オープンは 0 件** → 上記 P1 が空いたら **beta + P2** へ（例: #53 / #77 / #87 など。最新は GitHub）
3. クローズ済みの #34 / #35 / #49 / #50 を「次」として選ばない

### 着手ルール

1. **オープンな `P1`（とくに `bug`）が残っているうちは機能 P2 に手を出さない**（依存・方針変更がない限り）。`milestone:beta` + `P1` が空でも、他マイルストーンの P1 バグは先
2. Issue を 1 件選び、`scripts/agent/start-issue.sh <N>` → 実装 → `scripts/agent/check.sh` → PR（Ready まで。**マージは人**）
3. 並行可なら独立した Issue を複数 Agent に分割してよい（着手前に `gh` で OPEN を再確認）
4. #12（拡張）は別リポ予定 → このリポでは実装しない
5. AGENTS.md 禁止事項: main 直 push、PR マージ、Issue クローズ／ラベル無断変更（付与は運用上可だが既存方針を壊さない）
6. **バグはチャットだけで直さない**。既存 Issue があれば `issue-to-pr`。無いまま修正を頼まれたときだけ `create-issue` で記録してから着手。「Issue にして」だけなら作成して止まる。詳細は `AGENTS.md` と `.agents/skills/create-issue/SKILL.md`

### 受け入れの見方

- 各 Issue 本文のチェックリスト
- ロードマップ: [roadmap.md](./roadmap.md)（ドキュメントもスナップショット。最新は GitHub）
- Eagle ギャップ: [eagle-vs-swallow.md](./eagle-vs-swallow.md)

---

## 4. 「どこを見ればよいか」一覧

| 知りたいこと             | 場所                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| **この引き継ぎ（入口）** | **このファイル** [`docs/HANDOFF.md`](./HANDOFF.md)                                                                                    |
| 予定・進捗の正本の考え方 | [github-tracking.md](./github-tracking.md)                                                                                            |
| β Issue 一覧・優先度     | [roadmap.md](./roadmap.md) ＋ GitHub Milestone [`beta`](https://github.com/hk-pG/swallow/milestone/2)                                 |
| α で何を入れたか         | [alpha-scope.md](./alpha-scope.md)                                                                                                    |
| Eagle との過不足         | [eagle-vs-swallow.md](./eagle-vs-swallow.md)                                                                                          |
| 実装の標準ルート         | [`AGENTS.md`](../AGENTS.md)、[`.agents/skills/issue-to-pr/SKILL.md`](../.agents/skills/issue-to-pr/SKILL.md)                          |
| Issue 作成（例外）       | [`.agents/skills/create-issue/SKILL.md`](../.agents/skills/create-issue/SKILL.md)（「Issue にして」明示時／実装途中で Issue 無し）    |
| 独立 PR レビュー         | [`.agents/skills/code-review/SKILL.md`](../.agents/skills/code-review/SKILL.md)（実装文脈なし・Standards/Spec 二軸）                  |
| 差分セキュリティレビュー | [`.agents/skills/differential-review/SKILL.md`](../.agents/skills/differential-review/SKILL.md)（HTTP/Origin/パス差分・ToB 外部参照） |
| コードベース構成・境界   | [AGENTS.md の構成とモジュール境界](../AGENTS.md#モジュール境界フロント)（機能ベース `app/`・`features/*`・Tauri `commands/mod.rs`）   |
| 分類スクリプト           | [`scripts/agent/github-taxonomy-setup.sh`](../scripts/agent/github-taxonomy-setup.sh)（冪等）                                         |
| α トラッカー Issue       | [#45](https://github.com/hk-pG/swallow/issues/45)                                                                                     |
| ライブの Issue（P1）     | https://github.com/hk-pG/swallow/issues?q=is%3Aopen+label%3AP1                                                                        |
| ライブの Issue（beta）   | https://github.com/hk-pG/swallow/issues?q=is%3Aopen+milestone%3Abeta                                                                  |

---

## 5. 自律起動チェックリスト（次の Agent 用）

- [ ] `gh issue list --label P1 --state open` と `gh issue list --milestone beta --label P1 --state open` を実行した
- [ ] 1 件選んで Issue 本文の受け入れ条件を読んだ（クローズ済みを選んでいない）
- [ ] `AGENTS.md` / issue-to-pr に従いブランチ・実装・`pnpm ci:all`・PR Ready
- [ ] マージはユーザー待ちと報告した
- [ ] 進捗の正本更新が必要なら GitHub（Milestone クローズは人がやることが多い）／この HANDOFF の日付を更新

## 6. 環境メモ

ローカル用の雛形はリポ直下の [`.env.example`](../.env.example)（コピーして `.env` を作り、**コミットしない**）。概要表は [README の Environment variables](../README.md#environment-variables) と同じ内容。

### トークン名の正本（外向き vs 実行時）

| 用途                                     | 外向きの名前（人が設定する場所）        | 実行時に読む名前            | 必須              | 備考                                                                            |
| ---------------------------------------- | --------------------------------------- | --------------------------- | ----------------- | ------------------------------------------------------------------------------- |
| Cloud Agents API（`cloud-run.sh`）       | `CURSOR_API_KEY`                        | 同じ                        | Orca 起動時は必須 | Cursor Dashboard → API Keys。ホストのシェルまたは `.env`                        |
| Cloud Agent 内の `gh`（Issue／ラベル等） | **`GH_TOKEN`**（Runtime Secret 推奨名） | `GH_TOKEN`                  | 任意              | fine-grained PAT（このリポ向け）。Dashboard に直接置くときは **この名前を使う** |
| 上と同じトークンを Orca ホストから渡す   | `SWALLOW_CLOUD_GH_TOKEN`                | → エージェント内 `GH_TOKEN` | 任意              | `scripts/agent/cloud-run.sh` が起動時にマップ。**Dashboard 名ではない**         |
| 並行 worktree の置き場                   | `SWALLOW_WORKTREE_DIR`                  | 同じ                        | 任意              | 未設定時 `../<リポ名>-worktrees`（`start-issue.sh --worktree`）                 |
| 分類スクリプトの対象リポ                 | `REPO`                                  | 同じ                        | 任意              | 既定 `hk-pG/swallow`（`github-taxonomy-setup.sh`）                              |
| Rust／Compose イメージ                   | `CARGO_HOME`, `RUSTUP_HOME`             | 同じ                        | 通常不要          | `docker/build.Dockerfile` で設定。`lib.sh` が PATH 補正                         |
| Tauri 開発ビルド                         | `TAURI_DEV_HOST`, `TAURI_ENV_*`         | 同じ                        | 通常不要          | `pnpm dev` / Tauri CLI が設定                                                   |
| GitHub Actions                           | `GITHUB_TOKEN`（Actions 組み込み）      | ジョブにより `GH_TOKEN` 等  | CI のみ           | ローカル `.env` には入れない                                                    |

- **推奨**: Cloud Agent の Runtime Secret は **`GH_TOKEN` ひとつ**に統一する。Orca から起動するときだけ、ホスト側で `SWALLOW_CLOUD_GH_TOKEN` を使い、スクリプトが `GH_TOKEN` に渡す
- 無ければ `gh` の Issue/Label 操作は 403 になりうる（PR 作成は Cursor 組み込みで可能なことが多い）
- リポ: https://github.com/hk-pG/swallow

---

次の一手の既定値: **オープンな `P1`（現状 #91 / #93）を先に片付ける。それが空なら Milestone `beta` のオープン Issue（主に P2）を `gh` で確認して着手。**
