import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the built dist/ works from any URL,
  // including the GitHub Pages subpath.
  base: './',
});
