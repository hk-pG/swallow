# Desktop styles

`apps/desktop/src/styles/` はデスクトップ UI の見た目用 CSS をまとめるディレクトリである。`main.tsx` から各ファイルを import する。

## デザイントークン（正本）

色・余白・角丸・フォント・影・blur は **`tokens.css` のセマンティック変数だけ**を参照する。feature のコンポーネントに見た目の値を直書きしない。

- **正本**: 非色（`--space-*`・`--radius-*`・`--font-*`）と、属性が付く前の色のフォールバックは `tokens.css`。色の上書きは `themes/*.css`
- **テーマ**: `themes/ink.css`・`themes/paper.css`・`themes/slate.css` が `[data-theme][data-appearance="light|dark"]` で同じセマンティック名へ具体色を入れる。起動時は属性が付くまでインク + OS。保存した `themeId` と `colorScheme` はツールバーとインスペクタの表示設定から切り替え、反映は `data-theme` と `data-appearance` だけ。選択肢はインク / 紙 / スレート。外観はシステム / ライト / ダークのまま
- **名前**: 既存のトークン名は維持する。`--muted` は `--color-secondary-label` の別名のまま。浮いた面は `--color-elevated` / `--color-elevated-text`。`--color-overlay`・`--shadow-float`・`--shadow-overlay`・`--radius-xl` は Quick Look とメニューが使う
- **消費**: 同ディレクトリの `layout.css`・`controls.css`・`items.css` などでは `var(--...)` または既存のセマンティッククラス経由で参照する
- **React**: `features/` と `app/` のコンポーネントはセマンティック CSS クラスを使う。色や余白のリテラル、`style={{ fontSize: 12 }}` のような見た目プロパティの直書きは避ける（メニュー座標やサムネイル用 CSS 変数など、動的レイアウトだけは例外）

## ファイル構成

| ファイル           | 役割                                             |
| ------------------ | ------------------------------------------------ |
| `tokens.css`       | 非色と、属性が付く前のインク色                   |
| `themes/ink.css`   | インクの light / dark。`themes/index.css` が読む |
| `themes/paper.css` | 紙の light / dark                                |
| `themes/slate.css` | スレートの light / dark                          |
| `layout.css`       | シェル（サイドバー・インスペクタ・ツールバー枠） |
| `controls.css`     | ボタン・ナビ行など共通コントロール               |
| `sidebar.css`      | サイドバー・フォルダツリー・タグ UI              |
| `items.css`        | グリッド／リスト・検索ツールバー                 |
| `inspector.css`    | 右ペインのインスペクタ                           |
| `quick-look.css`   | Quick Look オーバーレイ                          |

## ボタンとインタラクティブ要素

`<button>` には役割クラスを付ける。クラス無しの `<button>` は意図的に無スタイル（UA デフォルト）のままにする。

| クラス                        | 用途                                                                 |
| ----------------------------- | -------------------------------------------------------------------- |
| `push-button`                 | 枠付きの通常アクション（ツールバー・フォーム・インスペクタ）         |
| `text-button`                 | 枠無しテキストアクション。`link` で下線リンク風、`danger` で危険操作 |
| `sidebar-icon-button`         | サイドバー内の × などアイコンのみ                                    |
| `nav-item`                    | サイドバー／ナビの行ボタン                                           |
| `grid-item` / `item-list-row` | ライブラリグリッド／リストの選択セル                                 |

## CI

`scripts/ci/style-token-boundaries.mjs`（`pnpm test` に含む）が次を検証する。

1. `tokens.css` と `styles/themes/*.css` 以外の CSS に生の色リテラル（`#...`・`rgb()` など）が無いこと
2. `features/`・`app/` の TSX に生の色リテラルや、見た目プロパティを直書きした `style={{ ... }}` が無いこと

詳細はリポジトリルートの `AGENTS.md`「スタイル／デザイントークン」を参照。
