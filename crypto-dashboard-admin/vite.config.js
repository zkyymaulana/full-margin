import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import includeHTML from "vite-plugin-include-html";

export default defineConfig({
  plugins: [
    tailwindcss(),
    includeHTML({
      include: /src\/.*\.html$/, // aktifkan include untuk semua file di src/
    }),
  ],
});
