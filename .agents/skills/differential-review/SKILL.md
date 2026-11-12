---

name: differential-review
description: >-
Swallow で、ループバック HTTP・拡張 Origin・パス処理に触れる差分を攻撃シナリオ観点で見る。
Trail of Bits の differential-review は GitHub 上の外部手順を参照するだけで、本文はリポに置かない。
一般的な PR 独立レビュー（規約・受け入れ条件）は code-review スキル。
---

# 差分セキュリティレビュー（differential-review 参照）

## 使い分け

| 状況                                                 | 使うスキル                                                       |
| ---------------------------------------------------- | ---------------------------------------------------------------- |
| 規約準拠・Issue 受け入れ条件の二軸（実装文脈なし）   | [`.agents/skills/code-review/SKILL.md`](../code-review/SKILL.md) |
| **攻撃シナリオ・差分のリスク**（下記トリガーに該当） | **本スキル**                                                     |

両方必要な PR では **code-review と本スキルを別コンテキストで順に** 実行する（同一チャットで混ぜない）。

## 適用トリガー（Swallow）

差分に次のいずれかが含まれるときだけ本スキルを使う。該当しなければ **使わない**。

1. **ループバック HTTP API** — 例: `packages/shared/src/api/httpContract.ts`、`apps/desktop/src-tauri/src/infra/` のうち **本スキル PR では編集禁止の `http_api.rs` を除く** 周辺（`protocol`、認可ヘルパ、ルート登録の呼び出し側）
2. **拡張の Origin / chrome-extension** — 例: Origin 検証、拡張 ID 固定、CORS・プリフライトに関わる共有型やデスクトップ側の境界
3. **パス処理** — 例: ライブラリパス正規化、シンボリックリンク、`thumb://`、取り込み・reveal のパス結合、ディレクトリトラバーサル耐性

`apps/extension/` 配下の変更は **別 Project が担当**。本リポの差分がトリガーに含まれても、拡張実装そのもののレビューはスコープ外とし、デスクトップ／`shared` 側の境界だけを見る。

## 禁止

- Trail of Bits の `SKILL.md` / `methodology.md` / `patterns.md` 等を **Swallow リポに複製・長文引用しない**（CC-BY-SA-4.0。根拠は [`ATTRIBUTION.md`](./ATTRIBUTION.md)）
- 本手順で `apps/desktop/src-tauri/src/infra/http_api.rs` を **編集しない**（読み取り参照は可）

## 手順

### 1. 固定点と差分

```sh
git fetch origin
git diff <固定点>...HEAD
```

固定点は `origin/main` またはレビュー依頼で指定された SHA。

### 2. 上流手順を読む（外部のみ）

pin されたコミットのツリーを開き、そこにある指示に従う:

- ツリー: [`ATTRIBUTION.md`](./ATTRIBUTION.md) の「上流 pin」リンク（現行: `4b1b74b…`）
- 必要なら同一ツリー内の `methodology.md`・`patterns.md` 等を **GitHub 上で** 読む（ファイルをリポに追加しない）

ローカルに全文を保存しない。要約も **自分の言葉で短く** 書き、上流段落のコピペはしない。

### 3. Swallow の契約・境界を当てる

読み取りのみ。差分と突き合わせる:

| 領域           | 正本の例                                  |
| -------------- | ----------------------------------------- |
| HTTP ルート表  | `packages/shared/src/api/httpContract.ts` |
| HTTP API 実装  | `infra/http_api.rs`（**変更しない**）     |
| モジュール境界 | `AGENTS.md`                               |
| 契約 CI        | `scripts/ci/http-api-contract.mjs`        |

攻撃シナリオは「誰が・どの経路で・何を悪用できるか」を diff の行に紐づけて書く。

### 4. レポート

- 見出し例: `VERDICT:`、攻撃シナリオ、影響、信頼度、テストギャップ
- Project 利用時: `/cursor/stores/self/internal/reviews/pr-<N>-differential.md` に保存
- **code-review の Standards/Spec レポートと混ぜない**

### 5. pin の更新

上流が大きく変わったら [`ATTRIBUTION.md`](./ATTRIBUTION.md) の SHA だけを別 PR で更新する。
