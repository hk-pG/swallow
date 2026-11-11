# Chrome 拡張の設計

最終更新: 2026-11-11

雛形で決めたことと、デスクトップ HTTP API が受け付ける拡張 ID。保存 UI は `apps/extension` にある。サイドロードと、未公開のストア配布方針は [extension-distribution.md](./extension-distribution.md)。

## 対象

Chrome のみ（Manifest V3、`minimum_chrome_version` 120）。Firefox 用の `browser_specific_settings` は置かない。

## 拡張 ID

| 項目       | 値                                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| 開発用 ID  | `fpcegcbemljdnihmoaejmmbpijdffgfn`                                                                          |
| ストア ID  | 未設定。記入箇所は下の `STORE_EXTENSION_ID` だけ                                                            |
| 正本       | `apps/extension/public/manifest.json` の `key`（RSA 公開鍵 SPKI DER の Base64）                             |
| 拡張の定数 | `apps/extension/src/pinnedExtensionId.ts` の `PINNED_EXTENSION_ID`                                          |
| 計算       | 公開鍵バイト列の SHA-256 の先頭 16 バイトを、16 進の `0-9a-f` ではなく `a-p` に写像する（Chrome の拡張 ID） |

秘密鍵はリポジトリに置かない。`key` があるので、未パックの読み込みではこの ID が安定する。ストアへ出したときの ID と、署名をどうするかは [extension-distribution.md](./extension-distribution.md) に書く。この雛形の生成では秘密鍵を残していない。

## サイドロードとストア ID

デスクトップの Origin 判定は `apps/desktop/src-tauri/src/infra/http_api.rs` にある。許可するのは次の ID だけである。

| 定数                       | 役割                                             | いまの値                           |
| -------------------------- | ------------------------------------------------ | ---------------------------------- |
| `DEVELOPMENT_EXTENSION_ID` | 未パック / サイドロード                          | `fpcegcbemljdnihmoaejmmbpijdffgfn` |
| `STORE_EXTENSION_ID`       | Chrome Web Store。未公開のあいだの唯一の記入箇所 | `None`                             |

比較は `Origin` 全体が `chrome-extension://` とその ID を繋げた文字列と完全一致すること。大文字、末尾の `/`、余分な文字、別 ID は 403 になる。`chrome-extension://` という接頭辞だけでは許可しない。

### サイドロード

手順（ビルド、zip、`chrome://extensions` への読み込み、更新）は [extension-distribution.md](./extension-distribution.md)。開発時は、ビルドした拡張を Chrome の「パッケージ化されていない拡張機能を読み込む」で読み込む。`manifest.json` の `key`（公開鍵）が ID を決めるので、秘密鍵は要らない。読み込むたびに Origin は `chrome-extension://fpcegcbemljdnihmoaejmmbpijdffgfn` になる。デスクトップはこの Origin を許可する。

`key` を外した拡張や、別の公開鍵の拡張は別 ID になり、`GET /api/app/info` も `POST /api/items` も 403 になる。ライブラリには書き込まない。

### ストア ID を足すとき

Chrome Web Store の拡張 ID は未定。署名の方式と、β として配る時期は決めていない。申請や公開はせず、方針は [extension-distribution.md](./extension-distribution.md) に書く。

決まるまで `STORE_EXTENSION_ID` は `None` のままにし、別の定数やリストは足さない。公開後に分かった 32 文字（`a-p`）を `STORE_EXTENSION_ID` にだけ入れる。開発用 ID はサイドロード用に残す。通る Origin は、`chrome-extension://` に開発用 ID を繋げた文字列か、ストア ID を設定したあとはそれにストア ID を繋げた文字列か、のどちらかと完全一致するものだけである。

## API の前提

- 待ち受けは `127.0.0.1:41600`（`DEFAULT_API_PORT`）。`localhost` は `::1` に解決されることがあり、その場合は接続できない。リクエストの Host は `127.0.0.1:41600` にする。
- `GET /api/app/info` → `AppInfo`。`POST /api/items?name=&ext=&url=` にファイル本体を載せ、成功は `201` と `ItemMetadata`。
- `url` クエリは元ページの URL（`ItemMetadata.url`）であり、画像の取得先ではない。デスクトップは画像 URL を取りに行かない。
- Origin が無い、`chrome-extension://` ではない、または公式 ID と完全一致しないリクエストは拒否される。CORS ヘッダも OPTIONS も無い。

パスと型は `@swallow/shared` の `HTTP_API_ROUTES` / `API_PATHS` を使う。拡張のソースに `/api/...` の直書きを置かない（`scripts/ci/http-api-contract.mjs` が失敗させる）。

## host_permissions

保存 UI の manifest は次の権限を使う。

| 権限                          | 理由                                                                     |
| ----------------------------- | ------------------------------------------------------------------------ |
| `http://127.0.0.1:41600/*`    | デスクトップ API。`activeTab` ではループバックを覆えない                 |
| `https://*/*` と `http://*/*` | ページとは別ホストの画像 URL をサービスワーカーから取得する              |
| `scripting`                   | `blob:` をタブ内で読む。コンテキストメニューのユーザー操作と組み合わせる |
| `notifications`               | アプリ未起動などを、画面の無いコンテキストメニューから知らせる           |
| `contextMenus`                | 「Swallow に保存」                                                       |

API を呼ぶ `fetch` はサービスワーカーから行う。コンテンツスクリプトの `fetch` はページの Origin になり、デスクトップが 403 にする。`host_permissions` 付きの拡張 `fetch` は CORS を通さないので、サーバに `Access-Control-Allow-Origin` が無くてもよい。

## 画像バイトの取得

拡張がバイト列を用意して `POST` する。

| 種別                     | 扱い                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `http:` / `https:`       | サービスワーカーが `credentials: "include"` で取得し、そのホストの Cookie を載せる                                                         |
| `data:`                  | 拡張内でデコードする。ネットワークに出さない                                                                                               |
| `blob:`                  | ページに紐づき、サービスワーカーからは取れない。`scripting` でタブ内の関数が読み、`ArrayBuffer` をサービスワーカーへ返す                   |
| 認証だけでは取れないもの | ページ JS だけが持つ `Authorization`、期限切れの署名 URL、tainted canvas。取得失敗として扱う。URL だけ渡してデスクトップに代行取得させない |

`chrome.runtime.sendMessage` で載るバイト列には上限がある。超えそうな場合は失敗として知らせ、黙って欠落させない。

## アプリが起動していないときの表示

接続失敗（`fetch` が reject する、接続拒否）と、HTTP のエラーを混ぜない。リトライはしない。コンテキストメニューには画面がないので `chrome.notifications` を使う。ポップアップを出す場合は同じ文面にする。

| 結果                 | 表示                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------ |
| 接続失敗             | Swallow が起動していません。デスクトップアプリを開いてからもう一度保存してください。 |
| 403                  | この拡張からのリクエストは拒否されました。                                           |
| 503 `libraryNotOpen` | ライブラリが開かれていません。                                                       |
| その他の `ApiError`  | 返ってきた `message` をそのまま出す。                                                |
| JSON でない応答      | 保存に失敗しました。                                                                 |

先に `GET /api/app/info` で生死を見てから `POST` してもよい。必須にはしない。接続失敗と 503 は別の文面にする。

## まだやらないこと

- Chrome Web Store への申請とストア ID の記入（`STORE_EXTENSION_ID` は `None`）
- 拡張パッケージの署名と、β として配る時期
