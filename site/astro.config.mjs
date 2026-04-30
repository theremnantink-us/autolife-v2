// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://autolife-detail.ru',
  integrations: [react(), sitemap()],
  build: { format: 'directory' },
  vite: {
    server: {
      proxy: {
        '/api.php':        'http://localhost:8080',
        '/busy_dates.php': 'http://localhost:8080',
        '/health.php':     'http://localhost:8080',
        '/csrf.php':       'http://localhost:8080',
      },
    },
  },
});
