import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

// Unit tests never touch the network (e.g. the website-logo lookup).
vi.stubGlobal(
  "fetch",
  vi.fn(() => Promise.reject(new TypeError("Network disabled in unit tests"))),
);
