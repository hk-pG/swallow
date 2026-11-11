# Chrome 拡張の配布（Manifest V3）

最終更新: 2026-11-11

対象は Chrome だけ（Manifest V3、`minimum_chrome_version` 120）。Firefox 用の `browser_specific_settings` は置かない。Chrome Web Store への申請とアップロードはしない。署名の方式と、β として配る時期（Q6）は未決なので、ここでは方針だけを書く。

## いま配るもの

開発者が自分の Chrome に、未パックのビルドを読み込む。自動更新はしない。

| 項目                 | 値                                                        |
| -------------------- | --------------------------------------------------------- |
| 開発用 ID            | `fpcegcbemljdnihmoaejmmbpijdffgfn`                        |
| ストア ID            | 未設定。`STORE_EXTENSION_ID` は `None`                    |
| 読み込むディレクトリ | `apps/extension/dist`（`manifest.json` が直下にあること） |
| 手渡し用 zip         | `apps/extension/swallow-extension-0.1.0-sideload.zip`     |

開発用 ID は `apps/extension/public/manifest.json` の `key`（RSA 公開鍵）から決まる。定数は `apps/extension/src/pinnedExtensionId.ts` の `PINNED_EXTENSION_ID`。デスクトップ側の同じ文字列は `apps/desktop/src-tauri/src/infra/http_api.rs` の `DEVELOPMENT_EXTENSION_ID`。秘密鍵はリポジトリに無い。未パックの読み込みに秘密鍵は要らない。

zip は dist のファイルをアーカイブの直下に入れる（`manifest.json` が先頭階層）。`key` は残す。ソースマップと秘密鍵ファイルは入れない。この zip は Chrome Web Store にアップロードしない。下書きの新規アイテムも作らない。

## 開発者のサイドロード

Chrome 120 以降。リポジトリのルートで実行する。

```sh
pnpm install
pnpm --filter @swallow/extension build
pnpm --filter @swallow/extension pack:sideload
```

`pack:sideload` は `apps/extension/dist` を読み、`apps/extension/swallow-extension-<version>-sideload.zip` のパスを表示する。いまの `manifest.json` の `version` は `0.1.0` なので、ファイル名は `swallow-extension-0.1.0-sideload.zip` になる。`dist/manifest.json` が無いとき、開発用 ID と違う `key` のとき、Firefox 向け設定や `update_url` があるとき、秘密鍵が混ざるときは zip を書かず終了する。

### 読み込む

1. 自分のマシンでビルドした `apps/extension/dist` を使う。別のマシンへ渡すときは zip を空のディレクトリへ展開し、展開先の直下に `manifest.json` があることを確認する。`chunks/` も同じ階層関係のまま残す。
2. `chrome://extensions` を開く。
3. デベロッパーモードをオンにする。
4. 「パッケージ化されていない拡張機能を読み込む」を選び、`manifest.json` があるディレクトリを指定する。
5. カードの ID が `fpcegcbemljdnihmoaejmmbpijdffgfn` であることを確認する。

デスクトップアプリでライブラリを開いた状態で、ページ上の画像を右クリックし「Swallow に保存」を選ぶ。ID が違う拡張は `403` になり、ライブラリには書き込まない。

`apps/extension` のルートは読み込まない。マニフェストの原本は `public/` にあり、サービスワーカーの `background.js` はビルド後の `dist` にしか無い。

「拡張機能をパッケージ化」は使わない。秘密鍵を渡さないと Chrome が新しい鍵と別の ID を作り、デスクトップは `403` にする。画面が `.pem` を書き出しても、リポジトリには置かない。

## 拡張 ID の運用

許可する Origin は `http_api.rs` の次の定数だけである。比較は `chrome-extension://` とその ID を繋げた文字列との完全一致で、接頭辞だけでは通さない。

| 定数                       | 役割                                     | いまの値                           |
| -------------------------- | ---------------------------------------- | ---------------------------------- |
| `DEVELOPMENT_EXTENSION_ID` | 未パックのサイドロード                   | `fpcegcbemljdnihmoaejmmbpijdffgfn` |
| `STORE_EXTENSION_ID`       | Chrome Web Store。記入箇所はこの定数だけ | `None`                             |

通る Origin は、開発用 ID に対する `chrome-extension://fpcegcbemljdnihmoaejmmbpijdffgfn` か、ストア ID を設定したあとその ID を同じ形で繋げた文字列か、のどちらか一つと完全一致するものだけである。大文字、末尾の `/`、余分な文字、未知の ID は `403` で、ライブラリには書き込まない。空文字は ID にしない。ストア ID を足すときも、別の配列や定数は増やさない。開発用 ID は残す。

`key` を別の公開鍵に変えると開発用 ID が変わる。そのときは `PINNED_EXTENSION_ID` と `DEVELOPMENT_EXTENSION_ID` を同じ新しい値にするまで、サイドロードは `403` になる。この文書では鍵を回さない。

## 更新

### サイドロード

未パックの拡張を Chrome は自動更新しない。`update_url` は置かない。バージョンを上げなくても、ファイルの差し替えは再読み込みで届く。

1. 同じコマンドでビルドし、渡す相手がいるときは `pack:sideload` で zip を作り直す。
2. 読み込み先ディレクトリの中身を、新しい `dist`（または展開した zip）で置き換える。`key` は変えない。
3. `chrome://extensions` のそのカードで再読み込みする。

ID は `key` が同じあいだ変わらない。デスクトップの allowlist は変更しない。拡張を削除してから読み込むと ID は同じだが、拡張自身の保存データは消える。差し替えは再読み込みにする。

### ストア ID を設定したあと

ストア版を Chrome が更新するのは、Chrome Web Store にその ID のアイテムがあるときだけである。公開はしていない。

デスクトップがストア版の Origin を受理するのは、分かった 32 文字（`a-p`）を `STORE_EXTENSION_ID` に入れたデスクトップを動かしているときだけである。それより前のデスクトップはストア版を `403` にし、ライブラリに書かない。開発用 ID はそのままなので、サイドロードは引き続き使える。

順序は、ストアの ID が分かる、`STORE_EXTENSION_ID` だけをその ID にする、そのデスクトップを使う、ストア版の拡張を入れる、である。拡張だけ先にストア版へ替えると、デスクトップが追従するまで保存は `403` になる。

## 将来のストア配布方針

Q6 は未決である。決めていないのは、署名の方式と、β として配る時期である。日付、限定公開、ストアのベータ枠、タグ `v*` の GitHub Release への同梱は置かない。`.github/workflows/release.yml` はデスクトップのインストーラ用のままにし、この zip は載せない。

いまの配布経路は、デベロッパーモードでの未パック読み込みだけである。CRX のドラッグインストール、自前の更新 XML、企業ポリシーでの強制インストール、Chrome Web Store へのアップロードは、このリポジトリの手順にしない。デスクトップアプリの Apple / Windows 署名（#95）は拡張の署名とは別で、ここでも行わない。

Chrome Web Store のアイテム ID は、ストアが発行する公開鍵から決まる。サイドロード用 zip に `key` が入っていても、ストアはその ID を開発用 ID にはしない。ダッシュボードに表示される公開鍵を `manifest.json` の `key` へ書き戻すと、未パックの ID はストアの ID に変わり、`fpcegcbemljdnihmoaejmmbpijdffgfn` ではなくなる。そのローテーションはしない。

秘密鍵がリポジトリに無いので、CRX を手元で署名して同じ ID を配ることも、今はできない。CRX 署名とストア公開のどちらにするかは Q6 のまま残し、この変更では選ばない。ストア ID が後から分かったときの記入箇所は `STORE_EXTENSION_ID` だけである。
