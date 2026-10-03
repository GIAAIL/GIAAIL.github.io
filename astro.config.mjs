// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// GitHub Pages:
//  - user/organisation page  (repo named <owner>.github.io)  → site: 'https://<owner>.github.io', base: '/'
//  - project page            (any other repo name)            → site: 'https://<owner>.github.io', base: '/<repo>'
//  - custom domain later     → site: 'https://ail.example.tw', base: '/'
// BASE_PATH can also be set by the deploy workflow; '/' is the default.
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  site: process.env.SITE_URL || 'https://ailgia.github.io',
  base,
  trailingSlash: 'always',
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh'],
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: false,
    },
  },
  build: {
    format: 'directory',
  },
  integrations: [
    sitemap({
      i18n: { defaultLocale: 'en', locales: { en: 'en', zh: 'zh-Hant' } },
      // the root only forwards to a language
      filter: (page) => /\/(en|zh)\//.test(page),
    }),
  ],
});
