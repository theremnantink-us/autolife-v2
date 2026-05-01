// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

const isGHPages = process.env.GITHUB_ACTIONS === 'true' && process.env.DEPLOY_TARGET !== 'timeweb';

export default defineConfig({
  site: isGHPages ? 'https://theremnantink-us.github.io' : 'https://autolife-detail.ru',
  base: isGHPages ? '/autolife-v2' : '/',
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
