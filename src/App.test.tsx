import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

// jsdom has no canvas: stand in for the renderer. Rendering itself is
// covered by the Playwright suite in a real browser.
vi.mock("qr-code-styling", () => ({
  default: class {
    append() {}
    update() {}
    async getRawData() {
      return null;
    }
  },
}));

const setup = () => {
  const user = userEvent.setup();
  render(<App />);
  return user;
};

describe("content types", () => {
  it("shows only the inputs for the selected type", async () => {
    const user = setup();
    expect(screen.getByLabelText("Website URL")).toBeInTheDocument();

    await user.click(screen.getByText("Wi-Fi"));
    expect(screen.queryByLabelText("Website URL")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Network name (SSID)")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();

    await user.click(screen.getByText("None"));
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();

    await user.click(screen.getByText("Email"));
    expect(screen.getByLabelText("To")).toBeInTheDocument();
    expect(screen.getByLabelText(/Subject/)).toBeInTheDocument();
  });

  it("keeps what you typed when switching types and back", async () => {
    const user = setup();
    await user.type(screen.getByLabelText("Website URL"), "kehai.dev");
    await user.click(screen.getByText("Phone"));
    await user.click(screen.getByText("URL"));
    expect(screen.getByLabelText("Website URL")).toHaveValue("kehai.dev");
  });
});

describe("validation", () => {
  it("shows an error for an invalid email once the field is left", async () => {
    const user = setup();
    await user.click(screen.getByText("Email"));
    const to = screen.getByLabelText("To");
    await user.type(to, "not-an-email");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.tab();
    expect(await screen.findByRole("alert")).toHaveTextContent("isn't valid");
    expect(to).toHaveAttribute("aria-invalid", "true");
  });

  it("keeps downloads disabled until the input is valid", async () => {
    const user = setup();
    const download = screen.getByRole("button", { name: /^Download$/ });
    expect(download).toBeDisabled();
    await user.type(screen.getByLabelText("Website URL"), "example");
    expect(download).toBeDisabled();
    await user.type(screen.getByLabelText("Website URL"), ".com");
    expect(download).toBeEnabled();
  });

  it("validates Wi-Fi passwords against the chosen security", async () => {
    const user = setup();
    await user.click(screen.getByText("Wi-Fi"));
    await user.type(screen.getByLabelText("Network name (SSID)"), "GDG-Guest");
    await user.type(screen.getByLabelText("Password"), "short");
    await user.tab();
    expect(await screen.findByRole("alert")).toHaveTextContent("8–63");
  });
});

describe("encoded payload", () => {
  it("shows exactly what will be encoded", async () => {
    const user = setup();
    await user.click(screen.getByText("Wi-Fi"));
    await user.type(screen.getByLabelText("Network name (SSID)"), "Lab;1");
    await user.type(screen.getByLabelText("Password"), "password1");
    await user.click(screen.getByLabelText("Hidden network"));
    expect(screen.getByTestId("payload")).toHaveTextContent(String.raw`WIFI:T:WPA;S:Lab\;1;P:password1;H:true;;`);
  });
});

describe("presets", () => {
  it("applies a preset and stays editable afterwards", async () => {
    const user = setup();
    const torii = screen.getByRole("button", { name: /Torii/ });
    await user.click(torii);
    expect(torii).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Code")).toHaveValue("#c8102e");

    const hex = screen.getByLabelText("Code");
    await user.clear(hex);
    // Clearing leaves the leading "#", so type just the digits.
    await user.type(hex, "123456");
    expect(hex).toHaveValue("#123456");
    expect(torii).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Custom")).toBeInTheDocument();
  });

  it("raises error correction when a logo is added", async () => {
    const user = setup();
    const file = new File([new Uint8Array([137, 80, 78, 71])], "logo.png", { type: "image/png" });
    await user.upload(screen.getByTestId("logo-input"), file);
    const ec = screen.getByRole("radiogroup", { name: "Error correction level" });
    await vi.waitFor(() => expect(within(ec).getByLabelText(/H/)).toBeChecked());
  });
});

describe("number fields", () => {
  it("lets you type a size digit by digit, clamping only when you leave the box", async () => {
    const user = setup();
    const size = screen.getByLabelText("Size value");
    await user.clear(size);
    await user.type(size, "256");
    expect(size).toHaveValue(256); // not clamped to 128 at the first "2"
    expect(screen.getByText(/256 × 256 px/)).toBeInTheDocument();

    await user.clear(size);
    await user.type(size, "5000");
    await user.tab();
    expect(size).toHaveValue(1024); // out of range: clamped on blur
  });
});
