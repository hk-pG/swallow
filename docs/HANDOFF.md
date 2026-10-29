# Swallow α→β — Agent 引き継ぎ（最初に読む）

最終更新: 2026-10-18  
対象: 次の Cursor Project coordinator / Cloud Agent（まっさらな状態で可）

## 30 秒でやること

1. このファイルを読む
2. GitHub で次の作業を確認する（下記コマンド）
3. リポの `AGENTS.md` と `.agents/skills/issue-to-pr/SKILL.md` に従い、Issue 1 件を PR まで進める

予定・進捗の**正本は GitHub**（Issue + Milestone + Label）。Cursor Project の notes は作業メモにすぎない。

---

## 1. プロジェクトの計画

| フェーズ | 内容                                                                                                       | 状態                  |
| -------- | ---------------------------------------------------------------------------------------------------------- | --------------------- |
| **α**    | Eagle 代替のデスクトップ最低限（ライブラリ・フォルダ・タグ・ゴミ箱・取り込み・シェル分割・右クリック抑止） | **完了**（main 到達） |
| **β**    | Eagle 基本機能とのギャップ埋め（P1→P2）                                                                    | **次の本番**          |
| **後続** | P3・拡張別リポ・対象外                                                                                     | backlog               |

### α で入れる／外す（確定済み）

- 入れた: フォルダ UI、右クリック抑止、App シェル main 取り込み、タグ UI
- 外した: Chrome 拡張（別リポ・#12）、階層取り込み #34 と設定 #35 は **β 予定**（α 外）

詳細: [alpha-scope.md](./alpha-scope.md) / [eagle-vs-swallow.md](./eagle-vs-swallow.md) / [roadmap.md](./roadmap.md)

### β の優先度

- **P1（先）**: #34 階層取り込み、#35 設定、#49 スマートフォルダ、#50 クイックルック
- **P2**: #51–#56（高度検索・お気に入り・カラーラベル・コンテキストメニュー・リスト/ズーム・タグ磨き）
- **P3 / backlog**: #57 Eagle 移行、#58 高度プレビュー、#12 拡張、#46 CI

マイルストーン: `alpha` | `beta` | `backlog`  
ラベル: `P1`/`P2`/`P3`、`area:desktop`/`area:extension`/`area:ci`

---

## 2. 今の進捗状況（2026-10-18 時点）

### マージ済み（α デスクトップ）

| PR                                              | 内容                     |
| ----------------------------------------------- | ------------------------ |
| [#41](https://github.com/hk-pG/swallow/pull/41) | フォルダ UI              |
| [#42](https://github.com/hk-pG/swallow/pull/42) | 本番右クリック抑止       |
| [#47](https://github.com/hk-pG/swallow/pull/47) | App シェル分割を main へ |
| [#48](https://github.com/hk-pG/swallow/pull/48) | タグ管理 UI              |

### 分類の整備

- ラベル・マイルストーンは **適用済み**（オープン Issue 16 件）
- `GH_TOKEN`（Runtime Secret）があれば Cloud Agent の `gh` で Issue 書き込み可

### 未着手（人が決める／任意）

- GitHub Projects ボード（進行のカンバン）は未作成でも運用可（Milestone+Label で足りる）

---

## 3. 次に着手する作業の確認方法

正本は GitHub。推測で始めず、必ず一覧を取る。

```bash
# β の最優先（ここから着手）
gh issue list --repo hk-pG/swallow --milestone beta --label P1 --state open

# β 全体
gh issue list --repo hk-pG/swallow --milestone beta --state open

# 後続
gh issue list --repo hk-pG/swallow --milestone backlog --state open
```

### 着手ルール

1. **P1 かつ `beta` が空くまで P2 に手を出さない**（依存・方針変更がない限り）。**バグ（`bug`）の P1 は機能 P2 より先**
2. Issue を 1 件選び、`scripts/agent/start-issue.sh <N>` → 実装 → `scripts/agent/check.sh` → PR（Ready まで。**マージは人**）
3. 並行可なら P1 を複数 Agent に分割してよい（#34/#35/#49/#50 は原則独立）
4. #12（拡張）は別リポ予定 → このリポでは実装しない
5. AGENTS.md 禁止事項: main 直 push、PR マージ、Issue クローズ／ラベル無断変更（付与は運用上可だが既存方針を壊さない）
6. **バグは先に Issue 化**（再現・受け入れ条件・原因仮説を本文に残す）。チャットだけで直さない。詳細は `AGENTS.md` の「バグの扱い」

### 受け入れの見方

- 各 Issue 本文のチェックリスト
- ロードマップ: [roadmap.md](./roadmap.md)
- Eagle ギャップ: [eagle-vs-swallow.md](./eagle-vs-swallow.md)

---

## 4. 「どこを見ればよいか」一覧

| 知りたいこと             | 場所                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| **この引き継ぎ（入口）** | **このファイル** [`docs/HANDOFF.md`](./HANDOFF.md)                                                           |
| 予定・進捗の正本の考え方 | [github-tracking.md](./github-tracking.md)                                                                   |
| β Issue 一覧・優先度     | [roadmap.md](./roadmap.md) ＋ GitHub Milestone [`beta`](https://github.com/hk-pG/swallow/milestone/2)        |
| α で何を入れたか         | [alpha-scope.md](./alpha-scope.md)                                                                           |
| Eagle との過不足         | [eagle-vs-swallow.md](./eagle-vs-swallow.md)                                                                 |
| 実装の進め方             | [`AGENTS.md`](../AGENTS.md)、[`.agents/skills/issue-to-pr/SKILL.md`](../.agents/skills/issue-to-pr/SKILL.md) |
| 分類スクリプト           | [`scripts/agent/github-taxonomy-setup.sh`](../scripts/agent/github-taxonomy-setup.sh)（冪等）                |
| α トラッカー Issue       | [#45](https://github.com/hk-pG/swallow/issues/45)                                                            |
| ライブの Issue           | https://github.com/hk-pG/swallow/issues?q=is%3Aopen+milestone%3Abeta+label%3AP1                              |

---

## 5. 自律起動チェックリスト（次の Agent 用）

- [ ] `gh issue list --milestone beta --label P1 --state open` を実行した
- [ ] 1 件選んで Issue 本文の受け入れ条件を読んだ
- [ ] `AGENTS.md` / issue-to-pr に従いブランチ・実装・`pnpm ci:all`・PR Ready
- [ ] マージはユーザー待ちと報告した
- [ ] 進捗の正本更新が必要なら GitHub（Milestone クローズは人がやることが多い）／この HANDOFF の日付を更新

## 6. 環境メモ

- Cloud Agent で Issue 書き込み: Secrets に **`GH_TOKEN`**（Runtime Secret）
- 無ければ `gh` の Issue/Label 操作は 403 になりうる（PR 作成は Cursor 組み込みで可能なことが多い）
- リポ: https://github.com/hk-pG/swallow

---

次の一手の既定値: **Milestone `beta` + label `P1` のオープン Issue を上から（または依存の少ない順に）実装開始。**
