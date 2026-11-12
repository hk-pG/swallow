---

name: code-review
description: >-
Swallow の PR / ブランチを、実装チャットと切り離した **独立レビュー** で見る。
固定点からの差分を Standards（リポ規約）と Spec（Issue 受け入れ条件）の二軸で並列にレビューし、結果を並記する。
先生が実装文脈を持たない別エージェントに依頼するとき、または「独立レビュー」「規約と受け入れ条件を確認」と言われたときに使う。
---

# 独立 code-review（Standards / Spec 二軸）

[mattpocock/skills の code-review](https://github.com/mattpocock/skills/tree/main/skills/engineering/code-review)（MIT）を Swallow 向けに改変。帰属は [`ATTRIBUTION.md`](./ATTRIBUTION.md)、許諾全文は [`LICENSE`](./LICENSE)。

**このスキルが担うこと**

- `git diff <固定点>...HEAD` を対象に、**規約準拠**と**Issue／PR 由来の仕様充足**を分けて報告する
- 実装担当の会話文脈に頼らない（差分・Issue・`AGENTS.md` のみ）

**担わないこと**

- セルフレビュー（staged）→ `scripts/agent/review-staged.sh` と `issue-to-pr` §6
- セキュリティ差分の攻撃モデリング → [`.agents/skills/differential-review/SKILL.md`](../differential-review/SKILL.md)（Trail of Bits、外部参照のみ）

## 触れてはいけない領域（レビュー指摘の対象外）

依頼で明示されない限り、次への変更要求は出さない（Swallow Project 方針）:

- `apps/extension/`
- `apps/desktop/src-tauri/src/infra/http_api.rs`
- テーマ関連（`apps/desktop/src/styles/themes/`、`tokens.css`、設定・ツールバーのテーマ UI）

指摘は **差分に含まれる行** に限定する。

## プロセス

### 1. 固定点を決める

ユーザーまたは PR 説明から固定点を得る（`origin/main`、マージベース SHA、タグなど）。未指定なら `origin/main` を使う。

```sh
git fetch origin
git rev-parse <固定点>
git diff <固定点>...HEAD
git log <固定点>..HEAD --oneline
```

`rev-parse` が失敗する、または diff が空なら **ここで止まる**（並列レビューに進まない）。

### 2. Spec の正本を特定する

次の順で探す:

1. コミットメッセージ・PR 本文の `Closes #N` / `Fixes #N` → `gh issue view N --json title,body`
2. ユーザーが渡した Issue 番号または本文ファイル
3. `docs/` 内の設計メモ（ブランチ名・機能名と一致するもの）
4. 見つからなければ Spec 軸は **「spec なし」** とし、ユーザーに Issue 番号を確認する

### 3. Standards の正本を読む

差分に関係する範囲で、必ず次を Standards 軸の入力に含める:

| 優先 | ファイル                                                                          | 内容                                      |
| ---- | --------------------------------------------------------------------------------- | ----------------------------------------- |
| 必須 | [`AGENTS.md`](../../../AGENTS.md)                                                 | モジュール境界、Tauri IPC、規約、禁止事項 |
| 必須 | [`apps/desktop/src/styles/README.md`](../../../apps/desktop/src/styles/README.md) | スタイルが diff に含まれるとき            |
| 任意 | [`CONTRIBUTING.md`](../../../CONTRIBUTING.md)                                     | 存在すれば追加                            |
| 任意 | 該当 feature の `README` / `docs/*.md`                                            | diff が触る領域のみ                       |

CI が既に検証しているもの（feature 境界、Tauri 契約、トークン直書き、Rust 境界など）は **重ねて指摘しない**（`pnpm test` 系スクリプトが正本）。

**Smell ベースライン**（リポが許容していても、diff 上で際立つ場合のみ _possible …_ とラベル付け。確定違反にしない）:

- Duplicated Code / Shotgun Surgery / Speculative Generality / Divergent Change  
  （一覧の完全版は上流 MIT スキル参照。リポ規約と矛盾するなら規約を優先）

### 4. 二軸を並列に走らせる

Standards と Spec は **別サブエージェント（別コンテキスト）** で同時に実行し、親が結果を集約する。各サブエージェントには実装 PR のチャット履歴を渡さない。

**Standards サブエージェントへのブリーフ（要約）**

- diff コマンド・コミット一覧
- 上記 Standards ファイルの要点（該当節を引用）
- 出力: ファイル／hunk ごとに (a) 規約違反（規約ファイル＋規則を引用）、(b) possible smell。**400 語以内**

**Spec サブエージェントへのブリーフ（要約）**

- diff コマンド・コミット一覧
- Issue 本文（受け入れ条件・スコープ外の記述を含む）
- 出力: (a) 未実装・部分実装、(b) スコープクリープ、(c) 実装が仕様と齟齬していそうな点。Issue 行を引用。**400 語以内**

Spec が無い場合は Spec サブエージェントをスキップする。

### 5. 集約レポート

見出し `## Standards` と `## Spec` で並記する。軸を混ぜて再ランク付けしない。

末尾に一行サマリー: 各軸の指摘件数と、その軸での最重要 1 件（あれば）。

判定語彙（例）: `VERDICT: APPROVE` / `REQUEST_CHANGES` — **各軸とは別**に、全体のマージ可否は先生が決める。

### 6. 記録（Project 利用時）

レビュー結果は `/cursor/stores/self/internal/reviews/` に Markdown で残す（既存 `pr-*-*.md` と同形式）。head SHA と `git diff` の取り方を明記する。

## 二軸を分ける理由

規約どおりでも仕様を外す変更、仕様どおりでも境界違反する変更があり得る。一つのスコアに潰すと見落とす。
