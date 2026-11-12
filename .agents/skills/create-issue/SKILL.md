---

name: create-issue
description: >-
Swallow で GitHub Issue を新規作成する。先生が「Issue にして」「バックログに積んで」と明示したとき、
および実装依頼の途中で Issue が無いときにだけ使う。通常の実装は既存 Issue または計画から
issue-to-pr へ進む。本文の正本は .github/ISSUE_TEMPLATE の YAML フォーム。
---

# Issue を作成する

実装の標準ルートは **依頼 → 計画 or 既存 Issue → PR（`issue-to-pr`）** である。
人が GitHub の Issue フォームで起票し、エージェントはトリアージと計画→PR を担う想定に寄せる。

**このスキルを使うのは次だけ:**

1. 先生が「Issue にして」「バックログに積んで」など、**Issue 化を明示**したとき
2. **実装依頼の途中で Issue が無い**とき（記録を残してから着手する）

推測でバックログ Issue を増やさない。

```
進捗:
- [ ] 1. 停止条件を確認する
- [ ] 2. 重複確認
- [ ] 3. 種別・YAML テンプレート決定
- [ ] 4. 本文を YAML から組み立て（mktemp）
- [ ] 5. ラベル・Milestone を付けて gh issue create
- [ ] 6. 報告（停止条件に従う）
```

## 1. 停止条件（一文）

**「Issue にして」だけなら URL を返して止まる。実装依頼の途中で Issue が無いときだけ、作成後に着手。**

| 依頼の形                                   | 作成後                                                                     |
| ------------------------------------------ | -------------------------------------------------------------------------- |
| 「Issue にして」「バックログに積んで」だけ | URL・番号・ラベルを返して **止まる**（ブランチも PR も作らない）           |
| 「直して」「実装して」等で Issue が無い    | 作成した `#N` で `.agents/skills/issue-to-pr/SKILL.md` の「1. 着手」へ進む |

`issue-to-pr` の §0 も同じ停止条件に揃える。矛盾させない。

## 2. 重複確認

リポジトリルートで:

```sh
gh issue list --search "<キーワード>" --state open --limit 20
gh issue list --search "<キーワード>" --state all --limit 20
```

- 同じ受け入れ条件の **オープン Issue** があれば新規作成しない。URL を返す
- 既存本文に **無い** 再現手順・受け入れ条件があるときだけ、短く `gh issue comment` する（`mktemp` で本文ファイルを作る）
- **ラベル・本文・Milestone は編集しない**（`gh issue edit` しない）
- クローズ済みの再発・続きは、関連 `#N` を新規本文に書いて作ってよい

## 3. 種別とテンプレートファイル

`.github/ISSUE_TEMPLATE/` の YAML が本文の正本。スキル内に本文ひな型をハードコードしない。

| 種別                                     | タイトル接頭辞 | 読むファイル        | `--label` に含める種別 |
| ---------------------------------------- | -------------- | ------------------- | ---------------------- |
| 不具合                                   | `[bug] `       | `bug.yml`           | `bug`                  |
| プロダクト機能                           | `[機能] `      | `feature.yml`       | `enhancement`          |
| リファクタ・調査・ドキュメント・ハーネス | `[依頼] `      | `agent_request.yml` | `enhancement`          |

YAML 先頭の `labels:` は Web フォーム用。`gh issue create --body-file` では **自動付与されない**ので、種別ラベルは必ず `--label` に含める。

作成前に実在を確認する:

```sh
gh label list --limit 50
```

使う名前: `bug`, `enhancement`, `area:desktop`, `area:extension`, `area:ci`, `P1`, `P2`, `P3`。

## 4. 本文の組み立て（YAML → Markdown）

対象の `*.yml` を実行時に読む。`body:` 配列を順に処理する。

1. `type: markdown` … スキップ（案内文は本文に入れない）
2. `attributes.label` がある項目 … `### {label}` を見出しにし、その下に値を書く
3. `type: textarea` … 依頼内容を書く。`validations.required: true` は空にしない。任意で書くことが無ければ本文は `_No response_`
4. `type: dropdown` … 選んだ **options の文字列をそのまま** 1 行で書く（例: `desktop（Tauri / React）`）
5. YAML の `value` / `placeholder` はヒント。プレースホルダをそのままコピペしない

GitHub のフォーム起票と同じ見出し語になる。`feature.yml` なら「追加したい機能」「なぜ欲しいか（任意）」など YAML の `label` どおり（スキル独自の「背景／現状」は使わない）。

一時ファイル:

```sh
body=$(mktemp)
# body に Markdown を書く
gh issue create ... --body-file "$body"
rm -f "$body"
```

コメント用も同様に `mktemp` する。

### 領域・優先度（本文の選択肢とラベルの両方）

dropdown の表示文字列を本文に書いたうえで、`--label` にも対応ラベルを付ける。

**領域**（`label: 領域`）:

| 本文に書く options 文字列     | `--label`                                                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `desktop（Tauri / React）`    | `area:desktop`                                                                                                 |
| `extension（Chrome 拡張）`    | `area:extension`                                                                                               |
| `ci（CI / エージェント基盤）` | `area:ci`                                                                                                      |
| `docs / その他`               | `area:ci`                                                                                                      |
| `未定`                        | 主領域を選ぶ。製品なら `area:desktop`、ハーネス／ドキュメントなら `area:ci`。本文は選んだ options 文字列にする |

**優先度**（`label: 優先度の目安` があるテンプレート）:

| 本文に書く options 文字列 | `--label`                            |
| ------------------------- | ------------------------------------ |
| `P1（高）`                | `P1`                                 |
| `P2（中）`                | `P2`                                 |
| `P3（低 / backlog）`      | `P3`                                 |
| `未定`                    | `P2`（本文は `P2（中）` にしてよい） |

`bug.yml` には優先度 dropdown が無い。それでも **`P1` / `P2` / `P3` のいずれかを `--label` に必ず付ける**（迷ったら `P2`）。セキュリティ・データ損失に近ければ `P1`。

### Milestone

| Milestone | 目安                                           |
| --------- | ---------------------------------------------- |
| `beta`    | P1/P2 の製品機能・バグ                         |
| `backlog` | P3、後続、拡張の長期、エージェント基盤の非急務 |
| `alpha`   | 原則付けない（新規作業には使わない）           |

### 品質

- 受け入れ条件（YAML にその label があるとき）は検証可能なチェックリスト
- 1 Issue = 1 まとまり。秘密情報を書かない
- チャットでの調査結果は該当フィールドに要約する

## 5. 作成コマンド

**`gh issue create --template` は使わない。** `--body` / `--body-file` と併用できず、YAML から組み立てた本文を渡せない。

```sh
body=$(mktemp)
# ... YAML に従って Markdown を書き込む ...
gh issue create \
  --title "[機能] 短い要約" \
  --label "enhancement,area:desktop,P2" \
  --milestone "beta" \
  --body-file "$body"
rm -f "$body"
```

- 種別・領域・優先度を `--label` にすべて含める（カンマ区切り）
- 作成後に本文・ラベル・Milestone を `edit` しない。足りない追記はコメントのみ

## 6. 報告

- 作成した Issue の URL・番号・ラベル・Milestone
- 重複で作らなかった場合は既存 URL（と、コメントしたかどうか）
- 停止条件どおり: 「Issue にして」だけならここで終了。実装依頼なら `issue-to-pr` へ続けた旨

## 中断・作らない条件

- 「Issue にして」も実装依頼もなく、単なる相談・メモのとき（標準ルートどおり計画 or 既存 Issue を案内する）
- オープンな重複があり、新規の受け入れ条件も無いとき
- `gh issue create` が権限エラーのとき（エラーを報告）

## 関連

- 実装: `.agents/skills/issue-to-pr/SKILL.md`
- 方針: `AGENTS.md`
- 追跡: `docs/github-tracking.md` / `docs/HANDOFF.md`
- 正本フォーム: `.github/ISSUE_TEMPLATE/{bug,feature,agent_request}.yml`
