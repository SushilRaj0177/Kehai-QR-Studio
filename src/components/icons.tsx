import type { QrKind } from "../lib/qrTypes";

const base = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export function KindIcon({ kind }: { kind: QrKind }) {
  switch (kind) {
    case "url":
      return (
        <svg {...base}>
          <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
          <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
        </svg>
      );
    case "text":
      return (
        <svg {...base}>
          <path d="M4 6h16M4 12h16M4 18h10" />
        </svg>
      );
    case "email":
      return (
        <svg {...base}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      );
    case "phone":
      return (
        <svg {...base}>
          <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
        </svg>
      );
    case "contact":
      return (
        <svg {...base}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="9" cy="10" r="2.2" />
          <path d="M5.5 16a3.5 3.5 0 0 1 7 0M15 9h3M15 13h3" />
        </svg>
      );
    case "wifi":
      return (
        <svg {...base}>
          <path d="M5 12.55a11 11 0 0 1 14 0M8.5 16.1a6 6 0 0 1 7 0M2 8.82a15 15 0 0 1 20 0" />
          <path d="M12 20h.01" />
        </svg>
      );
  }
}

export function Icon({ name }: { name: "download" | "copy" | "save" | "sun" | "moon" | "check" | "x" | "alert" | "trash" | "upload" | "arrow" | "github" | "spark" | "share" }) {
  switch (name) {
    case "download":
      return (
        <svg {...base}>
          <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
      );
    case "copy":
      return (
        <svg {...base}>
          <rect x="8" y="8" width="13" height="13" rx="2" />
          <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
        </svg>
      );
    case "save":
      return (
        <svg {...base}>
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
          <path d="M17 21v-8H7v8M7 3v5h8" />
        </svg>
      );
    case "sun":
      return (
        <svg {...base}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      );
    case "moon":
      return (
        <svg {...base}>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      );
    case "check":
      return (
        <svg {...base}>
          <path d="m5 12 5 5L20 7" />
        </svg>
      );
    case "x":
      return (
        <svg {...base}>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      );
    case "alert":
      return (
        <svg {...base}>
          <path d="M12 3 2 20h20L12 3Z" />
          <path d="M12 10v4M12 17h.01" />
        </svg>
      );
    case "trash":
      return (
        <svg {...base}>
          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
        </svg>
      );
    case "upload":
      return (
        <svg {...base}>
          <path d="M12 21V9m0 0-4 4m4-4 4 4M4 7V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2" />
        </svg>
      );
    case "arrow":
      return (
        <svg {...base}>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      );
    case "github":
      return (
        <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.7 1.6.2 2.8.1 3.2.8.8 1.3 1.9 1.3 3.1 0 4.7-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5Z" />
        </svg>
      );
    case "share":
      return (
        <svg {...base}>
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
        </svg>
      );
    case "spark":
      return (
        <svg {...base}>
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.8 2.8M14.9 14.9l2.8 2.8M6.3 17.7l2.8-2.8M14.9 9.1l2.8-2.8" />
        </svg>
      );
  }
}
