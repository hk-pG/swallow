/**
 * Frontend perf: filterItems + ItemGrid on happy-dom (not Tauri WebView).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import type { ItemMetadata } from "@swallow/shared";
import { filterItems } from "@swallow/shared";
import { Window } from "happy-dom";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { summarize } from "../../../scripts/perf/lib/stats.mjs";
import { ItemGrid } from "../src/features/items/components/ItemGrid.tsx";

/** Thumbnail path を避け、convertFileSrc を呼ばない（描画コストのみ計測）。 */
function withoutThumbnails(items: ItemMetadata[]): ItemMetadata[] {
  return items.map((item) => ({ ...item, ext: "txt" }));
}

const SEARCH_QUERIES = ["", "asset-01234", "findsample", "tag42 asset"];

function setGlobals(window: Window) {
  (globalThis as typeof globalThis & { window: Window }).window = window as unknown as Window &
    typeof globalThis;
  (globalThis as typeof globalThis & { document: Document }).document =
    window.document as unknown as Document;
}

function benchSearch(items: ItemMetadata[], runs: number) {
  const results: Record<string, ReturnType<typeof summarize> & { visibleCount?: number }> = {};
  for (const query of SEARCH_QUERIES) {
    const samples: number[] = [];
    let visibleCount = 0;
    for (let i = 0; i < runs; i++) {
      const t0 = performance.now();
      const filtered = filterItems(items, { kind: "all" }, query);
      const t1 = performance.now();
      samples.push(t1 - t0);
      if (i === 0) visibleCount = filtered.length;
    }
    results[`search:${query || "(empty)"}`] = { ...summarize(samples), visibleCount };
  }
  return results;
}

function benchRenderGrid(items: ItemMetadata[], runs: number) {
  const visible = withoutThumbnails(filterItems(items, { kind: "all" }, ""));
  const samples: number[] = [];
  for (let i = 0; i < runs; i++) {
    const window = new Window({ url: "http://localhost" });
    setGlobals(window);
    const doc = window.document;
    doc.body.innerHTML = `<style>
      .grid { display: grid; grid-template-columns: repeat(6, 120px); gap: 8px; height: 480px; overflow: auto; }
      .grid-cell { height: 120px; border: 1px solid #ccc; }
    </style><div id="root"></div>`;
    const rootEl = doc.getElementById("root");
    if (!rootEl) throw new Error("missing #root");
    const root = createRoot(rootEl as unknown as Element);
    const noop = () => {};
    const selection = { ids: new Set<string>(), focus: null as string | null };
    const t0 = performance.now();
    root.render(
      createElement(ItemGrid, {
        libraryPath: "/tmp/perf-library",
        items: visible,
        selection,
        onSelect: noop,
        onSelectAll: noop,
        onClearSelection: noop,
      }),
    );
    const t1 = performance.now();
    samples.push(t1 - t0);
    root.unmount();
    window.close();
  }
  return summarize(samples);
}

function benchScrollGrid(items: ItemMetadata[], runs: number) {
  const visible = withoutThumbnails(filterItems(items, { kind: "all" }, ""));
  const samples: number[] = [];
  for (let i = 0; i < runs; i++) {
    const window = new Window({ url: "http://localhost" });
    setGlobals(window);
    const doc = window.document;
    doc.body.innerHTML = `<style>
      .grid { display: grid; grid-template-columns: repeat(6, 120px); gap: 8px; }
      .grid-cell { height: 120px; }
    </style><div id="scroller" style="height:400px;overflow:auto"><div id="mount"></div></div>`;
    const mount = doc.getElementById("mount");
    const scroller = doc.getElementById("scroller");
    if (!mount || !scroller) throw new Error("missing scroll container");
    const root = createRoot(mount as unknown as Element);
    const noop = () => {};
    const selection = { ids: new Set<string>(), focus: null as string | null };
    root.render(
      createElement(ItemGrid, {
        libraryPath: "/tmp/perf-library",
        items: visible,
        selection,
        onSelect: noop,
        onSelectAll: noop,
        onClearSelection: noop,
      }),
    );
    const t0 = performance.now();
    const steps = 25;
    const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    for (let s = 0; s <= steps; s++) {
      scroller.scrollTop = (maxScroll * s) / steps;
    }
    const t1 = performance.now();
    samples.push(t1 - t0);
    root.unmount();
    window.close();
  }
  return summarize(samples);
}

const itemsPath = process.argv[2];
const outPath = process.argv[3];
const runs = Number(process.argv[4] ?? "5");
if (!itemsPath || !outPath) {
  console.error("usage: frontend-bench.mts <items.json> <out.json> [runs]");
  process.exit(1);
}

const items = JSON.parse(readFileSync(itemsPath, "utf8")) as ItemMetadata[];
const renderRuns = items.length >= 20_000 ? 2 : Math.min(runs, 3);

const payload = {
  layer: "frontend_synthetic_happy_dom",
  itemCount: items.length,
  note: "filterItems / ItemGrid は本番コード。happy-dom 上の合成 DOM（Tauri WebView・実ディスプレイではない）。",
  search: benchSearch(items, runs),
  listRenderGrid: benchRenderGrid(items, renderRuns),
  scrollGrid: benchScrollGrid(items, Math.min(runs, 3)),
};

writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`wrote ${outPath}`);
