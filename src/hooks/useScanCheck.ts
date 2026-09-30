import { useEffect, useState } from "react";
import type { QrDesign } from "../lib/design";
import { verifyScan, type ScanResult } from "../lib/scanCheck";

export type ScanState = ScanResult | { status: "checking" } | { status: "idle" };

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
        const result = await verifyScan(blob, payload);
        if (!cancelled) setState(result);
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
