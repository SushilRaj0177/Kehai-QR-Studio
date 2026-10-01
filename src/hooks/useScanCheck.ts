import { useEffect, useState } from "react";
import type { QrDesign } from "../lib/design";
import type { ScanResult, StressResult } from "../lib/scanCheck";

// The decoder (jsQR, ~130 kB) isn't needed to draw the page, so it lives in
// its own chunk. Loading starts as soon as this module runs, in parallel
// with the first render, and by the first check it's usually ready.
let decoder: Promise<typeof import("../lib/scanCheck")> | null = null;
const loadDecoder = () => (decoder ??= import("../lib/scanCheck"));
if (typeof window !== "undefined") queueMicrotask(() => void loadDecoder().catch(() => (decoder = null)));

export type ScanState =
  | (ScanResult & { stress?: StressResult })
  | { status: "checking" }
  | { status: "idle" }
  /** The checker itself couldn't run (decoder failed to load, canvas unavailable). Says nothing about the code. */
  | { status: "error" };

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
      let result: ScanResult;
      let blob: Blob | null;
      let mod: Awaited<ReturnType<typeof loadDecoder>>;
      try {
        blob = await getBlob("png");
        if (cancelled || !blob) return;
        mod = await loadDecoder();
        result = await mod.verifyScan(blob, payload);
      } catch {
        // A failure of the *checker* must never be reported as "won't scan":
        // that would condemn perfectly good codes.
        decoder = null; // let the next check retry the import
        if (!cancelled) setState({ status: "error" });
        return;
      }
      if (cancelled) return;
      setState(result);
      // Only worth stress-testing a code that decodes in the first place.
      // It's an extra: if it fails on some browser, the verified result stands.
      if (result.status !== "ok") return;
      try {
        const stress = await mod.stressTest(blob, payload);
        if (!cancelled) setState({ ...result, stress });
      } catch {
        /* keep the verified result without stress chips */
      }
    }, delay);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [payload, design, getBlob, delay]);

  return state;
}
