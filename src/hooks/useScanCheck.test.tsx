import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_DESIGN } from "../lib/design";

const verifyScan = vi.fn();
const stressTest = vi.fn();
vi.mock("../lib/scanCheck", () => ({ verifyScan: (...a: unknown[]) => verifyScan(...a), stressTest: (...a: unknown[]) => stressTest(...a) }));

const { useScanCheck } = await import("./useScanCheck");
const getBlob = async () => new Blob(["png"], { type: "image/png" });

describe("useScanCheck", () => {
  beforeEach(() => {
    verifyScan.mockReset();
    stressTest.mockReset();
  });

  it("adds stress results to a verified scan", async () => {
    verifyScan.mockResolvedValue({ status: "ok", decoded: "x" });
    stressTest.mockResolvedValue({ small: true, blur: true, dim: false });
    const { result } = renderHook(() => useScanCheck("x", DEFAULT_DESIGN, getBlob, 0));
    await waitFor(() => expect(result.current).toEqual({ status: "ok", decoded: "x", stress: { small: true, blur: true, dim: false } }));
  });

  it("a failing stress test never turns a verified scan into 'won't scan'", async () => {
    verifyScan.mockResolvedValue({ status: "ok", decoded: "x" });
    stressTest.mockRejectedValue(new Error("canvas filter unsupported"));
    const { result } = renderHook(() => useScanCheck("x", DEFAULT_DESIGN, getBlob, 0));
    await waitFor(() => expect(stressTest).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current).toEqual({ status: "ok", decoded: "x" });
  });

  it("a broken checker reports 'error', not 'unreadable'", async () => {
    verifyScan.mockRejectedValue(new Error("createImageBitmap failed"));
    const { result } = renderHook(() => useScanCheck("x", DEFAULT_DESIGN, getBlob, 0));
    await waitFor(() => expect(result.current).toEqual({ status: "error" }));
  });
});
