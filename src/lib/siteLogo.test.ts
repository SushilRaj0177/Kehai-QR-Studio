import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearSiteLogoCache, fetchSiteLogo, getSiteLogo, logoSources, siteDomain, type LogoDeps } from "./siteLogo";

// Minimal stand-in for a fetch Response (jsdom's Blob and Node's Response don't mix).
const png = (status = 200, type = "image/png") => () =>
  Promise.resolve({ ok: status < 400, status, blob: async () => ({ type }) as Blob } as Response);

function deps(responses: (() => Promise<Response>)[], normalize: LogoDeps["normalize"] = async () => "data:image/png;base64,LOGO") {
  let i = 0;
  const calls: string[] = [];
  const fetchMock = vi.fn((url: RequestInfo | URL) => {
    calls.push(String(url));
    const next = responses[i++];
    return next ? next() : Promise.reject(new TypeError("no more"));
  }) as unknown as typeof fetch;
  return { d: { fetch: fetchMock, normalize } satisfies LogoDeps, calls };
}

beforeEach(() => clearSiteLogoCache());

describe("siteDomain()", () => {
  it.each([
    ["https://gdg.community.dev/gdg-on-campus-srm?x=1", "gdg.community.dev"],
    ["https://www.github.com", "github.com"],
    ["http://WWW.Example.COM/path", "example.com"],
  ])("%s -> %s", (url, domain) => expect(siteDomain(url)).toBe(domain));

  it.each(["http://localhost:3000", "https://192.168.1.10", "not a url", "https://intranet"])("ignores %s", (url) => {
    expect(siteDomain(url)).toBeNull();
  });
});

describe("logoSources()", () => {
  it("only sends the domain, never a path or query", () => {
    for (const src of logoSources("gdg.community.dev")) {
      expect(src).toContain("gdg.community.dev");
      expect(src).not.toContain("gdg-on-campus");
    }
  });
});

describe("fetchSiteLogo()", () => {
  it("uses the first source that works", async () => {
    const { d, calls } = deps([png()]);
    await expect(fetchSiteLogo("github.com", undefined, d)).resolves.toBe("data:image/png;base64,LOGO");
    expect(calls).toHaveLength(1);
  });

  it("falls through CORS failures, HTTP errors and non-images", async () => {
    const { d, calls } = deps([() => Promise.reject(new TypeError("CORS")), png(404), png(200, "text/html")]);
    await expect(fetchSiteLogo("github.com", undefined, d)).resolves.toBeNull();
    expect(calls).toHaveLength(3);
  });

  it("skips images that are too small or can't be decoded", async () => {
    const normalize = vi.fn<LogoDeps["normalize"]>().mockResolvedValueOnce(null).mockResolvedValueOnce("data:image/png;base64,BIG");
    const { d } = deps([png(), png()], normalize);
    await expect(fetchSiteLogo("github.com", undefined, d)).resolves.toBe("data:image/png;base64,BIG");
  });

  it("stops immediately when aborted", async () => {
    const abort = () => Promise.reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
    const { d, calls } = deps([abort, png()]);
    await expect(fetchSiteLogo("github.com", undefined, d)).rejects.toThrow("aborted");
    expect(calls).toHaveLength(1);
  });
});

describe("getSiteLogo()", () => {
  it("looks each domain up once", async () => {
    const { d, calls } = deps([png(), png()]);
    await getSiteLogo("github.com", d);
    await getSiteLogo("github.com", d);
    expect(calls).toHaveLength(1);
  });

  it("never rejects", async () => {
    const { d } = deps([() => Promise.reject(Object.assign(new Error("x"), { name: "AbortError" }))]);
    await expect(getSiteLogo("github.com", d)).resolves.toBeNull();
  });
});
