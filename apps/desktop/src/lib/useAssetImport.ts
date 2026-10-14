import type { ImportReport } from "@swallow/shared";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { importAssets, pickImportFiles } from "./commands";

export interface AssetImport {
  importing: boolean;
  /** True while files are dragged over `dropTarget` */
  dragOver: boolean;
  report: ImportReport | null;
  error: string | null;
  pickAndImport: () => Promise<void>;
  dismiss: () => void;
}

/** Imports via the file dialog or by dropping files onto `dropTarget`. Inactive while `libraryPath` is null. */
export function useAssetImport(
  libraryPath: string | null,
  dropTarget: RefObject<HTMLElement | null>,
): AssetImport {
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const importPaths = useCallback(
    async (paths: string[]) => {
      if (!libraryPath || paths.length === 0) {
        return;
      }
      setImporting(true);
      setError(null);
      try {
        setReport(await importAssets(libraryPath, paths));
      } catch (e) {
        setReport(null);
        setError(String(e));
      } finally {
        setImporting(false);
      }
    },
    [libraryPath],
  );

  const importPathsRef = useRef(importPaths);
  importPathsRef.current = importPaths;

  useEffect(() => {
    if (!libraryPath) {
      return;
    }
    // Drop positions are physical pixels relative to the webview.
    const isOverTarget = (x: number, y: number) => {
      const rect = dropTarget.current?.getBoundingClientRect();
      if (!rect) {
        return false;
      }
      const scale = window.devicePixelRatio;
      const cx = x / scale;
      const cy = y / scale;
      return cx >= rect.left && cx <= rect.right && cy >= rect.top && cy <= rect.bottom;
    };

    let cancelled = false;
    let unlisten: (() => void) | undefined;
    getCurrentWebview()
      .onDragDropEvent(({ payload }) => {
        switch (payload.type) {
          case "enter":
          case "over":
            setDragOver(isOverTarget(payload.position.x, payload.position.y));
            break;
          case "drop":
            setDragOver(false);
            if (isOverTarget(payload.position.x, payload.position.y)) {
              void importPathsRef.current(payload.paths);
            }
            break;
          case "leave":
            setDragOver(false);
            break;
        }
      })
      .then((fn) => {
        if (cancelled) {
          fn();
        } else {
          unlisten = fn;
        }
      })
      .catch(console.error);

    return () => {
      cancelled = true;
      unlisten?.();
      setDragOver(false);
    };
  }, [libraryPath, dropTarget]);

  const pickAndImport = useCallback(async () => {
    await importPaths(await pickImportFiles());
  }, [importPaths]);

  const dismiss = useCallback(() => {
    setReport(null);
    setError(null);
  }, []);

  return { importing, dragOver, report, error, pickAndImport, dismiss };
}
