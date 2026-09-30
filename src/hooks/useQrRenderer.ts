import { useCallback, useEffect, useRef } from "react";
import QRCodeStyling from "qr-code-styling";
import { toStylingOptions, type QrDesign } from "../lib/design";

/**
 * Owns one qr-code-styling instance and keeps it in sync with the payload
 * and design. The preview canvas and every export come from this same
 * instance, so what you download is exactly what you see.
 */
export function useQrRenderer(payload: string | null, design: QrDesign) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const qrRef = useRef<QRCodeStyling | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!payload) {
      container.replaceChildren();
      qrRef.current = null;
      return;
    }
    const options = toStylingOptions(design, payload);
    if (!qrRef.current) {
      qrRef.current = new QRCodeStyling(options);
      container.replaceChildren();
      qrRef.current.append(container);
    } else {
      qrRef.current.update(options);
      if (!container.firstChild) qrRef.current.append(container);
    }
  }, [payload, design]);

  const getBlob = useCallback(async (extension: "png" | "svg" = "png"): Promise<Blob | null> => {
    const qr = qrRef.current;
    if (!qr) return null;
    const raw = await qr.getRawData(extension);
    return raw instanceof Blob ? raw : null;
  }, []);

  return { containerRef, getBlob };
}
