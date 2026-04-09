import typography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        status: {
          pending: "#475569",
          in_progress: "#2563eb",
          review: "#d97706",
          done: "#16a34a",
          blocked: "#dc2626",
        },
      },
      typography: {
        invert: {
          css: {
            "--tw-prose-body": "#cbd5e1",
            "--tw-prose-headings": "#f1f5f9",
            "--tw-prose-bold": "#f1f5f9",
            "--tw-prose-links": "#60a5fa",
            "--tw-prose-code": "#fbbf24",
            "--tw-prose-pre-bg": "#0f172a",
            "--tw-prose-pre-code": "#e2e8f0",
            "--tw-prose-quotes": "#94a3b8",
            "--tw-prose-bullets": "#475569",
            "--tw-prose-hr": "#1e293b",
            "--tw-prose-th-borders": "#334155",
            "--tw-prose-td-borders": "#1e293b",
          },
        },
      },
    },
  },
  plugins: [typography],
};
