# Swallow 予定・進捗の正本（GitHub）

確定日: 2026-10-18

Cursor 非依存。人が GitHub 上で読む。入口は [HANDOFF.md](./HANDOFF.md)。

## 役割分担

| 層 | GitHub 機能 | 役割 |
|---|---|---|
| 実行単位 | **Issues** | 1 機能 = 1 Issue。受け入れ条件は本文 |
| 期 | **Milestones** | `alpha` / `beta` / `backlog` |
| 優先・領域 | **Labels** | `P1`/`P2`/`P3`、`area:desktop` 等 |
| 進行状況 | **Projects（ボード）** | Todo / In progress / Done（任意。Milestone+Label でも可） |
| 入口 | リポ [`docs/roadmap.md`](./roadmap.md) / [`docs/HANDOFF.md`](./HANDOFF.md) | 人が最初に開く。詳細は Milestone/Issue へ |

Cursor Project の notes / Context は当日の作業メモのみ。引き継ぎや週次確認の正本にはしない。

## マイルストーン定義

| 名前 | 意味 |
|---|---|
| `alpha` | α（デスクトップ主要機能は main 到達済み。トラッカー紐づけ） |
| `beta` | P1/P2（Eagle ギャップ埋め） |
| `backlog` | P3・後続・α 外（拡張別リポなど） |

## いま付ける Issue（要約）

詳細は [roadmap.md](./roadmap.md) と [`scripts/agent/github-taxonomy-setup.sh`](../scripts/agent/github-taxonomy-setup.sh)。

- **beta + P1**: #34 #35 #49 #50
- **beta + P2**: #51–#56
- **backlog + P3**: #57 #58
- **backlog**: #12（extension）、#46（ci）
- **alpha**: #45 #14（トラッカー）

## セットアップ（オーナーの `gh`）

### 適用済み（2026-10-18 08:12 UTC）

`scripts/agent/github-taxonomy-setup.sh` をリポ書き込み権限のある `GH_TOKEN` で実行し完了。

- マイルストーン `alpha` / `beta` / `backlog` 確認済み
- ラベル `P1`/`P2`/`P3`/`area:desktop`/`area:extension`/`area:ci` 確認済み
- 対象オープン Issue 16 件に付与済み（代表確認: #49 #50 #34 → beta+P1、#45 → alpha、#46 → backlog+area:ci）

再実行（冪等）:

```bash
bash scripts/agent/github-taxonomy-setup.sh
```

### 残作業

1. GitHub Projects ボード（未作成なら任意）: 列を `Todo` / `In progress` / `Done`、Milestone `beta` でフィルタすると週次確認が楽。
2. 週次の作業確認は次で足りる:

```bash
gh issue list --milestone beta --label P1 --state open
```
