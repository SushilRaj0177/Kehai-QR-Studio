import { describe, expect, it } from "vitest";
import {
  encodeContact,
  validateContact,
  encode,
  encodeWifi,
  escapeWifi,
  isEmpty,
  normalizePhone,
  normalizeUrl,
  validateEmail,
  validatePhone,
  validateText,
  validateUrl,
  validateWifi,
  MAX_TEXT_LENGTH,
  type WifiFields,
} from "./qrTypes";

describe("URL", () => {
  it("adds https:// to bare domains", () => {
    expect(normalizeUrl("gdg.community.dev")).toBe("https://gdg.community.dev");
    expect(normalizeUrl("http://example.com")).toBe("http://example.com");
  });

  it.each(["https://example.com", "example.com/path?q=1", "http://localhost:3000", "https://192.168.1.10/x"])(
    "accepts %s",
    (url) => expect(validateUrl({ url })).toEqual({}),
  );

  it.each([
    ["", /Enter/],
    ["   ", /Enter/],
    ["not a url", /spaces/],
    ["example", /domain ending/],
    ["ftp://example.com", /http/],
    ["https://", /valid URL/],
  ])("rejects %j", (url, message) => {
    expect(validateUrl({ url }).url).toMatch(message);
  });

  it("encodes the normalized URL", () => {
    expect(encode("url", { url: " kehai.dev " })).toBe("https://kehai.dev");
  });
});

describe("Text", () => {
  it("requires content", () => {
    expect(validateText({ text: "  " }).text).toBeTruthy();
  });
  it("caps the length", () => {
    expect(validateText({ text: "a".repeat(MAX_TEXT_LENGTH + 1) }).text).toMatch(/under/);
  });
  it("encodes text verbatim, including unicode", () => {
    expect(encode("text", { text: "こんにちは 🌸" })).toBe("こんにちは 🌸");
  });
});

describe("Email", () => {
  it("validates the address", () => {
    expect(validateEmail({ address: "", subject: "", body: "" }).address).toMatch(/Enter/);
    expect(validateEmail({ address: "nope@", subject: "", body: "" }).address).toMatch(/isn't valid/);
    expect(validateEmail({ address: "a@b.co", subject: "", body: "" })).toEqual({});
  });

  it("builds a mailto link with encoded subject and body", () => {
    expect(encode("email", { address: "hi@gdg.dev", subject: "Hello & welcome", body: "Line 1\nLine 2" })).toBe(
      "mailto:hi@gdg.dev?subject=Hello%20%26%20welcome&body=Line%201%0ALine%202",
    );
    expect(encode("email", { address: "hi@gdg.dev", subject: "", body: "" })).toBe("mailto:hi@gdg.dev");
  });
});

describe("Phone", () => {
  it("normalizes formatting characters away", () => {
    expect(normalizePhone("+91 98765-43210")).toBe("+919876543210");
    expect(normalizePhone("(044) 2745 5510")).toBe("04427455510");
  });

  it.each([
    ["", /Enter/],
    ["abc123", /digits/],
    ["12+34", /start/],
    ["12", /short/],
    ["+1234567890123456", /15 digits/],
  ])("rejects %j", (phone, message) => {
    expect(validatePhone({ phone }).phone).toMatch(message);
  });

  it("encodes a tel: link", () => {
    expect(encode("phone", { phone: "+91 98765 43210" })).toBe("tel:+919876543210");
  });
});

describe("Wi-Fi", () => {
  const base: WifiFields = { ssid: "CampusNet", password: "hunter22", security: "WPA", hidden: false };

  it("escapes the format's special characters", () => {
    expect(escapeWifi(String.raw`a;b,c:d"e\f`)).toBe(String.raw`a\;b\,c\:d\"e\\f`);
  });

  it("encodes WPA, WEP, open and hidden networks", () => {
    expect(encodeWifi(base)).toBe("WIFI:T:WPA;S:CampusNet;P:hunter22;;");
    expect(encodeWifi({ ...base, security: "WEP", password: "abcde" })).toBe("WIFI:T:WEP;S:CampusNet;P:abcde;;");
    expect(encodeWifi({ ...base, security: "nopass", password: "ignored" })).toBe("WIFI:T:nopass;S:CampusNet;;");
    expect(encodeWifi({ ...base, hidden: true })).toBe("WIFI:T:WPA;S:CampusNet;P:hunter22;H:true;;");
  });

  it("escapes special characters inside the SSID and password", () => {
    expect(encodeWifi({ ...base, ssid: "Café;Guest", password: 'p:a,s"s;1' })).toBe(
      String.raw`WIFI:T:WPA;S:Café\;Guest;P:p\:a\,s\"s\;1;;`,
    );
  });

  it("validates WPA password length", () => {
    expect(validateWifi({ ...base, password: "short" }).password).toMatch(/8–63/);
    expect(validateWifi({ ...base, password: "x".repeat(64) }).password).toMatch(/8–63/);
    expect(validateWifi({ ...base, password: "a".repeat(64).replace(/a/g, "f") })).toEqual({});
  });

  it("validates WEP key formats", () => {
    expect(validateWifi({ ...base, security: "WEP", password: "abcd" }).password).toMatch(/WEP/);
    expect(validateWifi({ ...base, security: "WEP", password: "0123456789" })).toEqual({});
    expect(validateWifi({ ...base, security: "WEP", password: "abcdefghijklm" })).toEqual({});
  });

  it("needs no password for open networks", () => {
    expect(validateWifi({ ...base, security: "nopass", password: "" })).toEqual({});
  });

  it("limits the SSID to 32 bytes", () => {
    expect(validateWifi({ ...base, ssid: "é".repeat(17) }).ssid).toMatch(/32 bytes/);
  });
});

describe("encode()", () => {
  it("returns null for invalid input", () => {
    expect(encode("url", { url: "nope" })).toBeNull();
    expect(encode("wifi", { ssid: "", password: "", security: "WPA", hidden: false })).toBeNull();
  });

  it("detects untouched forms", () => {
    expect(isEmpty("email", { address: "", subject: "", body: "" })).toBe(true);
    expect(isEmpty("email", { address: "", subject: "Hi", body: "" })).toBe(false);
  });
});

describe("contact (vCard)", () => {
  const base = { name: "Sushil Raj", org: "", phone: "", email: "", url: "" };
  it("needs only a phone number", () => {
    expect(validateContact({ ...base, phone: "" })).toHaveProperty("phone");
    expect(validateContact({ ...base, name: "", phone: "+91 98765 43210" })).toEqual({});
  });
  it("validates optional fields only when filled", () => {
    const e = validateContact({ ...base, phone: "12", email: "nope", url: "not a url" });
    expect(Object.keys(e).sort()).toEqual(["email", "phone", "url"]);
  });
  it("encodes a vCard 3.0 with split name, normalised phone and escaping", () => {
    expect(encodeContact({ name: "Sushil  Raj", org: "GDG; SRM, Chennai", phone: "+91 98765-43210", email: "a@b.co", url: "kehai.dev" })).toBe(
      [
        "BEGIN:VCARD",
        "VERSION:3.0",
        "N:Raj;Sushil;;;",
        "FN:Sushil Raj",
        "ORG:GDG\\; SRM\\, Chennai",
        "TEL;TYPE=CELL:+919876543210",
        "EMAIL:a@b.co",
        "URL:https://kehai.dev",
        "END:VCARD",
      ].join("\r\n"),
    );
    expect(encodeContact({ ...base, name: "Cher", phone: "123" })).toContain("N:;Cher;;;");
    // No name: the card is named after the number.
    expect(encodeContact({ ...base, name: "", phone: "+91 98765 43210" })).toContain("FN:+919876543210");
  });
});
