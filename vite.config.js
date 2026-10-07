import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ command }) => ({
  base: "./",
  worker: { format: "es" },
  plugins: [
    react(),
    {
      name: "desktop-csp",
      transformIndexHtml(html) {
        if (command !== "build") return html;
        return {
          html,
          tags: [
            {
              tag: "meta",
              attrs: {
                "http-equiv": "Content-Security-Policy",
                content:
                  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'",
              },
              injectTo: "head-prepend",
            },
          ],
        };
      },
    },
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "cmdk", "@radix-ui/react-dialog"],
          sanitize: ["dompurify"],
        },
      },
    },
  },
}));
