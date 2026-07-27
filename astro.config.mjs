// @ts-check
import { defineConfig } from 'astro/config';
import markdoc from '@astrojs/markdoc';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  integrations: [
    markdoc({
      allowHTML: false,
    }),
  ],
});
