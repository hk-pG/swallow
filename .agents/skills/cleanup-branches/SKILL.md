---
name: cleanup-branches
description: >-
  マージ済み・リモート消失・クローズ済み PR の不要ブランチを判定し、確認後にローカル・worktree・リモートを削除する。
  「ブランチを掃除」「不要ブランチを削除」「gone ブランチを消す」と頼まれたときに使う。
---

# 不要ブランチの掃除

判定結果を提示し、利用者の確認後にだけ削除する。`main`・現在のブランチ・未マージの独自コミットがあるブランチは勝手に消さない。

```
進捗:
- [ ] 1. 同期
- [ ] 2. 一覧
- [ ] 3. 判定
- [ ] 4. 確認
- [ ] 5. 削除
- [ ] 6. 報告
```

## 1. 同期

```sh
git fetch --prune origin
git switch main
git pull --ff-only origin main
```

`main` 以外にいる・未コミット変更があるときは報告して止める（stash や破棄はしない）。

## 2. 一覧

次をまとめて取る。

```sh
git branch -vv
git branch -r
git worktree list
git branch --merged main
gh pr list --state all --limit 50 --json number,title,state,headRefName,mergedAt
```

## 3. 判定

各ブランチを次のどれかに分類する。

| 分類 | 条件 |
|------|------|
| **削除可** | (a) `main` にマージ済み、または (b) upstream が `[gone]` かつ対応 PR が MERGED/CLOSED、または (c) リモートのみ残っていて対応 PR が MERGED/CLOSED |
| **要確認** | `main` に無いコミットがある／PR が OPEN／upstream が gone だが PR 情報なし／リモートだけ残って意図が不明 |
| **残す** | `main`、現在のブランチ、利用者が明示したブランチ、worktree がアクティブ作業中と分かるもの |

補足:

- worktree 付き（`git branch -vv` の `+`）は、ブランチ削除の前に worktree 削除が必要
- squash マージだと `git branch --merged` に出ないことがある。そのときは PR の `MERGED` + head ブランチ名、または upstream `[gone]` を優先する
- リモート追跡が消えたあともローカルだけ残るのが典型的な掃除対象

## 4. 確認

利用者に表で示す。削除はここで承認を得てから。

```
### 削除する
| 場所 | ブランチ | 理由 |
|------|----------|------|
| local / worktree / remote | name | merged #N / gone / closed #N |

### 残す・要確認
| ブランチ | 理由 |
|----------|------|
| hk-pG/croaker | main に無いコミットあり |
```

「この方針で消して」「削除して」など明示の承認がなければ 5 に進まない。要確認をまとめて消す指示があれば、それも削除可に含めてよい。

## 5. 削除

承認されたものだけ、この順で消す。

**worktree 先**

```sh
git worktree remove <path>
# ディレクトリが既に無いときだけ
git worktree remove --force <path>
# または
git worktree prune
```

**ローカル**

```sh
git branch -d <branch>          # マージ済み
git branch -D <branch>          # gone / squash マージで -d が拒否されたときのみ（承認済み）
```

**リモート**

```sh
git push origin --delete <branch>
```

やってはいけないこと:

- `main` / 現在のブランチの削除
- 承認されていないブランチの削除
- force push、`git push --delete` 以外の破壊操作
- 他人のオープン PR の head ブランチの削除

## 6. 報告

削除した一覧・残した一覧・失敗（worktree 使用中など）を短く報告する。

```sh
git branch -vv
git worktree list
git branch -r
```

## 中断する条件

- 作業ツリーに未コミット変更があり、`main` に移れない
- 消したいブランチが別 worktree でチェックアウト中で、`--force` なしでは外せない（利用者に確認）
- リモート削除の権限エラー
