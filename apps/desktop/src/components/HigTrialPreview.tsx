/**
 * Static shell for evaluating the Apple HIG trial without a Tauri library session.
 * Open via `?higPreview=1` in the Vite dev server.
 */
export function HigTrialPreview() {
  return (
    <div className="layout" data-hig-preview="true">
      <aside className="sidebar">
        <div className="library-header">
          <div className="library-name">Sample Library</div>
          <div className="library-actions">
            <button type="button">新規作成</button>
            <button type="button">開く</button>
          </div>
          <div className="ui-trial-toggle">
            <span>UI 試作</span>
            <label>
              <input type="checkbox" checked readOnly />
              Apple HIG Foundations
            </label>
          </div>
        </div>
        <nav aria-label="スマートビュー">
          <button type="button" className="nav-item" aria-current="page">
            すべてのアイテム
          </button>
          <button type="button" className="nav-item">
            未整理
          </button>
          <button type="button" className="nav-item">
            ゴミ箱
          </button>
        </nav>
        <section className="sidebar-section folder-section">
          <div className="sidebar-section-header folder-header">
            <h2 className="sidebar-section-title">フォルダ</h2>
            <button type="button" className="sidebar-icon-button" aria-label="追加">
              +
            </button>
          </div>
          <div className="folder-line">
            <button type="button" className="nav-item">
              Characters
            </button>
          </div>
          <div className="folder-line">
            <button type="button" className="nav-item">
              Environments
            </button>
          </div>
        </section>
        <section className="sidebar-section">
          <div className="sidebar-section-header">
            <h2 className="sidebar-section-title">タグ</h2>
          </div>
          <ul className="tag-list">
            <li className="tag-row">
              <button type="button" className="nav-item tag-nav-item">
                concept
              </button>
            </li>
            <li className="tag-row">
              <button type="button" className="nav-item tag-nav-item">
                final
              </button>
            </li>
          </ul>
        </section>
      </aside>

      <main className="content" style={{ ["--item-thumb-size" as string]: "140px" }}>
        <div className="ui-trial-banner" role="note">
          <strong>HIG 試作プレビュー</strong> — 静的モック。ライブラリ I/O は使いません。
        </div>
        <header className="toolbar">
          <input className="search" type="search" defaultValue="" placeholder="名前・タグ・注釈で検索" />
          <button type="button" className="advanced-search-toggle">
            詳細検索
          </button>
          <div className="view-mode-toggle" role="group" aria-label="表示モード">
            <button type="button" className="view-mode-button" aria-pressed="true">
              グリッド
            </button>
            <button type="button" className="view-mode-button" aria-pressed="false">
              リスト
            </button>
          </div>
          <button type="button">クイックルック</button>
          <button type="button">ファイル取り込み</button>
        </header>
        <section className="grid" aria-label="アイテム">
          {["hero-sky", "portrait-a", "prop-cup", "texture-wood", "ui-frame", "ref-pose"].map(
            (name, index) => (
              <button
                key={name}
                type="button"
                className="grid-item"
                aria-pressed={index === 1}
              >
                <div className="grid-thumb">
                  <span className="grid-thumb-placeholder">{name.slice(0, 2).toUpperCase()}</span>
                </div>
                <span className="grid-name">{name}</span>
              </button>
            ),
          )}
        </section>
      </main>

      <aside className="inspector">
        <div className="inspector-body">
          <div className="inspector-field">
            <label className="inspector-label" htmlFor="hig-preview-name">
              名前
            </label>
            <input id="hig-preview-name" className="inspector-input" defaultValue="portrait-a" />
          </div>
          <div className="inspector-field">
            <label className="inspector-label" htmlFor="hig-preview-note">
              注釈
            </label>
            <textarea
              id="hig-preview-note"
              className="inspector-input"
              rows={3}
              defaultValue="キーアート候補。暖色寄り。"
            />
          </div>
          <section className="inspector-section">
            <h3>タグ</h3>
            <ul className="chip-list">
              <li className="chip">concept</li>
              <li className="chip">portrait</li>
            </ul>
          </section>
          <section className="inspector-section">
            <h3>プロパティ</h3>
            <dl className="inspector-props">
              <dt>形式</dt>
              <dd>PNG</dd>
              <dt>サイズ</dt>
              <dd>2048 × 2048</dd>
            </dl>
          </section>
        </div>
        <p className="app-info">Swallow preview</p>
      </aside>
    </div>
  );
}
