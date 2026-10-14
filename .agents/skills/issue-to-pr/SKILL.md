---
name: issue-to-pr
description: >-
  Swallow リポジトリの GitHub Issue 1 件を、ブランチ作成から実装・検証・PR 作成まで人に確認せず進める。
  「Issue #N をやって」「#N に着手」「issue を PR にして」と頼まれたときに使う。
---

# Issue から PR まで

人の確認を待たずに PR 作成まで進める。迷ったら妥当な方を選び、PR の「判断したこと」に書く。
止まってよいのは下の「中断する条件」に当たるときだけ。

```
進捗:
- [ ] 1. 着手
- [ ] 2. 調査
- [ ] 3. 計画
- [ ] 4. 実装
- [ ] 5. 検証
- [ ] 6. セルフレビュー
- [ ] 7. PR 作成
- [ ] 8. 報告
```

## 1. 着手

```sh
scripts/agent/start-issue.sh <N>              # main なら issue-<N> を作る。他のブランチ上ならそのまま使う
scripts/agent/start-issue.sh <N> --worktree   # main のチェックアウトから並行作業用の worktree を作る
```

- Orca が Issue から作った worktree ではブランチができているので、オプションなしで実行する（依存も `orca.yaml` の setup で入っている）
- 既存のブランチや PR があると止まる。自分が続きを担当すると明示されていなければ `--force` せず中断する
- `--worktree` のときは表示されたパスに移動し、`pnpm install --frozen-lockfile` を実行する

## 2. 調査

- Issue 本文・コメント・関連 Issue を読み、受け入れ条件を一覧にする
- 依存先の Issue が未完了（`[OPEN]`）で、それなしでは受け入れ条件を満たせないなら中断する
- 触るコードと既存テストを読む。似た既存実装があれば同じ書き方に揃える

## 3. 計画

受け入れ条件ごとに、変えるファイルと追加するテストを決める。Issue の範囲外の改善はしない（見つけたら PR の「この PR に含まないもの」に書く）。

## 4. 実装

`AGENTS.md` の規約に従う。特に注意すること:

- Rust の型を変えたら `packages/shared` の型と `apps/desktop/src/lib/commands.ts` も揃える
- 新しい Tauri コマンドは `commands.rs` に定義し、`lib.rs` の `generate_handler!` に登録する
- 振る舞いの変更には必ずテストを付ける

作業中は速いチェックを回す: `pnpm test` / `pnpm typecheck` / `pnpm rust:test` / `pnpm rust:clippy`。

コミットは意味のある単位で、メッセージは Conventional Commits（日本語の要約）にする。PR は squash マージされるので細かさにはこだわらない。

## 5. 検証

```sh
scripts/agent/check.sh
```

- 失敗したら原因を直して再実行する。抑制コメントやテストの skip で回避しない
- 整形の失敗は `pnpm format` と `cargo fmt --all` で直す
- 通った後にファイルを変えたら再実行が必要（`open-pr.sh` が検出する）
- 未コミットのまま実行してよい。通った状態をそのままコミットすれば PR を作れる
- 画面の変更は可能なら `pnpm dev` で確認する。確認できなければ PR のチェックを外したままにし、理由を書く

## 6. セルフレビュー

`git diff origin/main...HEAD` を読み、次を確認する:

- 受け入れ条件をすべて満たしているか。満たせないものは理由を説明できるか
- デバッグ用のコード、不要なファイル、関係ない変更が混ざっていないか
- エラー時の挙動（存在しない ID、壊れた JSON、ライブラリ未オープン）を考えたか

直したら 5 に戻る。

## 7. PR 作成

`.github/pull_request_template.md` を元に本文を一時ファイル（例: `/tmp/pr-<N>.md`）に書く。

- 1 行目は受け入れ条件をすべて満たすなら `Closes #<N>`、一部だけなら `Refs #<N>`
- 「受け入れ条件」に Issue のチェックリストを転記し、状態を反映する
- 「判断したこと」に Issue に書かれていなかった決定を書く
- 「確認したこと」は実際にやったものだけチェックする

```sh
scripts/agent/open-pr.sh --title "feat(desktop): フォルダのサイドバー UI を追加" --body-file /tmp/pr-<N>.md
```

受け入れ条件を一部しか満たせないときは `--draft` を付ける。スクリプトがエラーを出したら、メッセージに従って直し再実行する。

## 8. 報告

PR の URL、満たせなかった受け入れ条件、レビューで見てほしい点を短く報告する。PR はマージしない。

## 中断する条件

次のときは実装を止め、Issue に状況をコメントし（`gh issue comment <N> --body-file <path>`）、利用者に報告する。

- 依存先の Issue が未完了で、受け入れ条件を満たせない
- 受け入れ条件同士が矛盾している、または既存の設計と両立しない
- 秘密情報や外部アカウントなど、エージェントが用意できないものが必要
- 他のエージェントが同じ Issue を進めている
