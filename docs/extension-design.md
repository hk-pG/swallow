# Chrome 拡張の設計（保存機能の前）

最終更新: 2026-11-11

雛形で決めたこと。画像の保存 UI とデスクトップ側の拡張 ID allowlist は、この文書のあとに実装する。デスクトップの HTTP API 実装は変えない。

## 対象

Chrome のみ（Manifest V3、`minimum_chrome_version` 120）。Firefox 用の `browser_specific_settings` は置かない。

## 拡張 ID

| 項目    | 値                                                                                                          |
| ------- | ----------------------------------------------------------------------------------------------------------- |
| 拡張 ID | `fpcegcbemljdnihmoaejmmbpijdffgfn`                                                                          |
| 正本    | `apps/extension/public/manifest.json` の `key`（RSA 公開鍵 SPKI DER の Base64）                             |
| 定数    | `apps/extension/src/pinnedExtensionId.ts` の `PINNED_EXTENSION_ID`                                          |
| 計算    | 公開鍵バイト列の SHA-256 の先頭 16 バイトを、16 進の `0-9a-f` ではなく `a-p` に写像する（Chrome の拡張 ID） |

秘密鍵はリポジトリに置かない。`key` があるので、未パックの読み込みではこの ID が安定する。CRX の署名や、同じ ID での Chrome Web Store 公開には、リポジトリ外で保管した秘密鍵が別途必要になる。この雛形の生成では秘密鍵を残していない。ストア公開で別 ID になる場合は、allowlist にその ID を足す（#92）。

#92 はこの ID をデスクトップの Origin allowlist に使う。この変更では allowlist を実装しない。ランタイムは従来どおり `chrome-extension://` 接頭辞のみを見る。

## API の前提（デスクトップは変更しない）

- 待ち受けは `127.0.0.1:41600`（`DEFAULT_API_PORT`）。`localhost` は `::1` に解決されることがあり、その場合は接続できない。リクエストの Host は `127.0.0.1:41600` にする。
- `GET /api/app/info` → `AppInfo`。`POST /api/items?name=&ext=&url=` にファイル本体を載せ、成功は `201` と `ItemMetadata`。
- `url` クエリは元ページの URL（`ItemMetadata.url`）であり、画像の取得先ではない。デスクトップは画像 URL を取りに行かない。
- Origin が無いリクエストは拒否される。許される Origin は `chrome-extension://` だけ。CORS ヘッダも OPTIONS も無い。

パスと型は `@swallow/shared` の `HTTP_API_ROUTES` / `API_PATHS` を使う。拡張のソースに `/api/...` の直書きを置かない（`scripts/ci/http-api-contract.mjs` が失敗させる）。

## host_permissions

保存を実装するときに manifest へ足す。雛形には未使用の host permission を付けない。

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

## この雛形がやらないこと

- コンテキストメニューと保存（#12 の残り）
- デスクトップの拡張 ID allowlist と、未知 ID を 403 にするテスト（#92）
