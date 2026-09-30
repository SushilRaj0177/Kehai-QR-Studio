import { useEffect, useState } from "react";
import type { QrDesign } from "../lib/design";
import type { ScanResult, StressResult } from "../lib/scanCheck";

// The decoder (jsQR, ~130 kB) isn't needed to draw the page, so it lives in
// its own chunk. Loading starts as soon as this module runs, in parallel
// with the first render, and by the first check it's usually ready.
let decoder: Promise<typeof import("../lib/scanCheck")> | null = null;
const loadDecoder = () => (decoder ??= import("../lib/scanCheck"));
if (typeof window !== "undefined") queueMicrotask(() => void loadDecoder().catch(() => (decoder = null)));

export type ScanState = (ScanResult & { stress?: StressResult }) | { status: "checking" } | { status: "idle" };

/**
 * Decodes the rendered code shortly after every change (debounced so
 * dragging a colour picker doesn't queue dozens of decodes) and reports
 * whether it scans back to exactly the intended payload.
 */
export function useScanCheck(
  payload: string | null,
  design: QrDesign,
  getBlob: (ext?: "png" | "svg") => Promise<Blob | null>,
  delay = 250,
): ScanState {
  const [state, setState] = useState<ScanState>({ status: "idle" });

  useEffect(() => {
    if (!payload) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setState({ status: "checking" });
    const timer = window.setTimeout(async () => {
      try {
        const blob = await getBlob("png");
        if (cancelled || !blob) return;
        const { verifyScan, stressTest } = await loadDecoder();
        const result = await verifyScan(blob, payload);
        if (cancelled) return;
        setState(result);
        // Only worth stress-testing a code that decodes in the first place.
        if (result.status === "ok") {
          const stress = await stressTest(blob, payload);
          if (!cancelled) setState({ ...result, stress });
        }
      } catch {
        if (!cancelled) setState({ status: "unreadable" });
      }
    }, delay);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [payload, design, getBlob, delay]);

  return state;
}
