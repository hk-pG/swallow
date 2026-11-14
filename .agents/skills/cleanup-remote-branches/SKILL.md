---

name: cleanup-remote-branches
description: remote ブランチの利用状況と対応 PR を確認し、不要なマージ済みブランチを削除する。「不要な remote ブランチを整理」と頼まれたときに使う。
---

# remote ブランチの整理

削除を依頼された範囲だけ実行する。調査だけの依頼では削除しない。今回の実行に対する許可を将来の実行に引き継がない。

## 調査と判定

1. `git remote -v` で対象リポジトリを特定する。`git status --short`、`git branch --show-current`、`git worktree list --porcelain` で現在の作業と使用中ブランチを確認する。ローカルブランチ・worktree は削除しない。
2. `git fetch <remote> --prune` し、GitHub API の branches を全ページ取得する。既定ブランチは repository API の `default_branch` で確認し、保護状態も取得する。API・権限エラーを「利用なし」と扱わない。
3. 対象リポジトリの PR を全ページ取得し、`number`、`state`、`head.ref`、`head.sha`、`head.repo.full_name`、`base.ref`、`base.repo.full_name`、`merged_at`、URL を確認する。REST の pulls は `state=all` に `--paginate` を付ける。REST ではマージ済みも `state=closed` なので、`merged_at` で区別する。fork の同名 head と取り違えない。
4. 各ブランチを次の条件で判定する。

- **必ず残す:** 既定・保護ブランチ、`main` / `master` / `develop` / `feature/core`、現在の checkout またはいずれかのローカル worktree で使用中のブランチ。Open PR の head または base として対象リポジトリで参照されているブランチ。
- **削除可能:** 対象リポジトリのブランチを head とするマージ済み PR があり、remote の現在の SHA がその PR の最終 head SHA と一致し、上記の残す条件に該当しないもの。対象リポジトリの既定ブランチにマージされたことも確認する。別ブランチにだけマージされたものは保留する。
- **保留:** PR なし、未マージでクローズ、マージ後の追加コミット、取得不完全、用途不明。古さ・命名・`git branch --merged` だけで削除しない。squash merge では祖先判定だけでは不足する。

他の作業で利用中だと分かる情報があれば、削除可能条件を満たしても残す。ローカル以外の利用状況を完全に証明できるとは説明しない。

## 削除と検証

削除前に候補のブランチ名・SHA・対応 PR・判定理由を一時ファイルに保存する。削除対象数と保留理由を利用者に伝える。既に削除の許可があれば再確認は不要。

直前に Open PR、保護状態、worktree と remote SHA を再確認する。変化があった候補は除外して再判定する。対象を手作業でシェル文字列へ連結せず、引数配列または適切な引用で渡す。

SHA の変化による誤削除を防ぐため、各候補に明示的な lease を付けて削除する。これは他人のブランチへの force push で履歴を書き換える用途には使わない。

```sh
git push --atomic <remote> \
  --force-with-lease=refs/heads/<branch>:<確認済みSHA> \
  :refs/heads/<branch>
```

複数候補は同じ push に各 lease と削除 refspec を追加する。lease 不一致・保護・権限エラーなら無条件削除へ切り替えない。再取得して原因を確認し、不要と確認できる範囲だけ再実行する。

`git fetch <remote> --prune` 後に `git ls-remote --heads <remote>` で各候補が消え、残すブランチが残っていることを確認する。失敗・一部成功を全件成功として報告しない。

削除数、対応 PR と削除前 SHA、残したブランチと理由、確認できなかった事項を報告する。必要なら一時記録を Issue コメントや PR 本文に残す。スキル化・PR 作成は別途依頼された場合だけ、リポジトリの `create-issue` / `issue-to-pr` に従う。
