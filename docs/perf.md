# ライブラリ性能計測（再現手順）

大規模ライブラリ（1 万件・5 万件など）での一覧・検索・取り込み、およびフロント側の合成 DOM 計測の手順です。アプリ本体の最適化は行いません。

## 前提

- Rust toolchain（`rust-toolchain.toml`）
- `pnpm install` 済み
- 計測用バイナリ: `swallow_perf`（feature `perf-bin`）

## クイック実行

```sh
pnpm perf
```

環境変数（任意）:

| 変数                 | 既定                   | 意味                     |
| -------------------- | ---------------------- | ------------------------ |
| `PERF_SEED`          | `42`                   | 生成データのシード       |
| `PERF_COUNTS`        | `10000 50000`          | 件数（スペース区切り）   |
| `PERF_LIST_RUNS`     | `7`                    | `read_items` 反復回数    |
| `PERF_IMPORT_COUNT`  | `50`                   | 1 回の取り込みファイル数 |
| `PERF_IMPORT_RUNS`   | `5`                    | 取り込みベンチ反復       |
| `PERF_FRONTEND_RUNS` | `5`                    | フロントベンチ反復       |
| `PERF_RESULTS_DIR`   | `scripts/perf/results` | 出力先                   |

生成ライブラリは `scripts/perf/.data/`（gitignore）。

## 個別コマンド

```sh
# ビルド
cargo build --release --features perf-bin --bin swallow_perf --manifest-path apps/desktop/src-tauri/Cargo.toml

# データ生成（固定シード）
./target/release/swallow_perf generate --count 10000 --seed 42 --out scripts/perf/.data/library-10000

# Rust: 一覧（read_items）
./target/release/swallow_perf bench list --library scripts/perf/.data/library-10000 --runs 7

# Rust: 取り込み（既存ライブラリへ N ファイル）
./target/release/swallow_perf bench import --library scripts/perf/.data/library-10000 --count 50 --seed 42 --runs 5

# フロント（happy-dom + 本番 filterItems / ItemGrid）
cd apps/desktop && pnpm exec tsx perf/frontend-bench.mts ../../scripts/perf/.data/items-10000.json ../../scripts/perf/results/frontend-10000.json 5
```

## 計測レイヤー

| シナリオ             | レイヤー                    | 備考                                         |
| -------------------- | --------------------------- | -------------------------------------------- |
| 一覧（バックエンド） | Rust `item::read_items`     | Tauri `list_items` と同経路                  |
| 取り込み             | Rust `import::import_files` | 既存ライブラリへの追込                       |
| 検索                 | TS `filterItems`            | メモリ上の全件フィルタ（IPC 後）             |
| 一覧描画・スクロール | happy-dom + `ItemGrid`      | WebView/Tauri 実機は別途（Cloud では未計測） |

## 結果の読み方

`scripts/perf/results/*.json` に各シナリオの `runsMs`・中央値・min/max を保存します。`environment.json` に OS・CPU・メモリ・コミット SHA を記録します。
