# Swallow 機能ロードマップ（要約）

更新日: 2026-10-18  
入口・着手手順: [HANDOFF.md](./HANDOFF.md)  
根拠の詳細: [eagle-vs-swallow.md](./eagle-vs-swallow.md) / [alpha-scope.md](./alpha-scope.md) / [github-tracking.md](./github-tracking.md)

優先度: **P1** = beta 前半 / **P2** = beta 後半 / **P3** = 後続。

## 次の作業の確認

```bash
gh issue list --milestone beta --label P1 --state open
```

β 全体・後続は [HANDOFF.md](./HANDOFF.md) のコマンド一覧を参照。

## 優先度順一覧

| 優先度 | Issue | 一言 |
|---|---|---|
| P1 | [#34](https://github.com/hk-pG/swallow/issues/34) | フォルダ階層ごとの取り込み |
| P1 | [#35](https://github.com/hk-pG/swallow/issues/35) | 設定ファイル拡張 |
| P1 | [#49](https://github.com/hk-pG/swallow/issues/49) | スマートフォルダ（保存済み検索） |
| P1 | [#50](https://github.com/hk-pG/swallow/issues/50) | クイックルック / 原寸プレビュー |
| P2 | [#51](https://github.com/hk-pG/swallow/issues/51)–[#56](https://github.com/hk-pG/swallow/issues/56) | 高度検索・お気に入りビュー・カラーラベル・独自コンテキストメニュー・リスト/ズーム・タグ磨き |
| P3 | [#57](https://github.com/hk-pG/swallow/issues/57) / [#58](https://github.com/hk-pG/swallow/issues/58) | Eagle 移行インポート / 高度プレビュー |

## α 済み（再 Issue なし）

ライブラリ・フォルダ UI・タグ最低限 UI・インスペクター・取り込み・固定スマートビュー・星・注釈・複数選択・ゴミ箱・基本ショートカット・右クリック抑止・グリッドサムネ・ローカル HTTP API・App シェル分割。

トラッカー: [#45](https://github.com/hk-pG/swallow/issues/45)（α）、[#14](https://github.com/hk-pG/swallow/issues/14)（MVP）。

## 対象外・別枠

| 項目 | 扱い |
|---|---|
| クラウド同期 | Issue 不要（対象外） |
| Chrome 拡張 | [#12](https://github.com/hk-pG/swallow/issues/12)（別リポ予定・`backlog`） |
| CI 調査 | [#46](https://github.com/hk-pG/swallow/issues/46)（`backlog` + `area:ci`） |

## マイルストーンとラベル

| マイルストーン | 意味 |
|---|---|
| [`alpha`](https://github.com/hk-pG/swallow/milestone/1) | α（ほぼ完了。トラッカー紐づけ） |
| [`beta`](https://github.com/hk-pG/swallow/milestone/2) | P1/P2 |
| [`backlog`](https://github.com/hk-pG/swallow/milestone/3) | P3・後続・拡張など |

ラベル: `P1` / `P2` / `P3`、`area:desktop` / `area:extension` / `area:ci`。付与スクリプトは [`scripts/agent/github-taxonomy-setup.sh`](../scripts/agent/github-taxonomy-setup.sh)。
