# 外部参照（differential-review）

Swallow は [Trail of Bits `skills`](https://github.com/trailofbits/skills) の **differential-review** 手順を **リポジトリ内に複製しません**。

## ライセンス（一次情報）

| 項目                   | 値                                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| リポジトリ             | `trailofbits/skills`                                                                           |
| SPDX                   | **CC-BY-SA-4.0**（`gh api repos/trailofbits/skills --jq .license.spdx_id`、確認日 2026-11-12） |
| ライセンス全文（外部） | <https://github.com/trailofbits/skills/blob/main/LICENSE>                                      |

CC-BY-SA-4.0 のため、`methodology.md` / `patterns.md` 等の **本文を Swallow にコピーしない**。レビュー時は下記 pin の GitHub 上を読む。

## 上流 pin

| 項目                      | 値                                                                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ディレクトリ              | `plugins/differential-review/skills/differential-review/`                                                                                                                             |
| `SKILL.md` の直近コミット | `4b1b74b181e81cbcaa8d3b68a0e4ed867165b972`（`gh api "repos/trailofbits/skills/commits?path=plugins/differential-review/skills/differential-review/SKILL.md&per_page=1"`、2026-11-12） |
| 当該コミットでのツリー    | <https://github.com/trailofbits/skills/tree/4b1b74b181e81cbcaa8d3b68a0e4ed867165b972/plugins/differential-review/skills/differential-review>                                          |
| 関連プラグイン README     | <https://github.com/trailofbits/skills/tree/main/plugins/differential-review>                                                                                                         |

更新が必要なときは **新しい path 直近コミット SHA を `gh api` で取り直し**、本ファイルの pin だけを PR で更新する（上流文書のコピーは増やさない）。
