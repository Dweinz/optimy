import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the built dist/ works from any URL —
  // a domain root, a GitHub Pages subpath, or an itch.io iframe.
  base: './',
});
