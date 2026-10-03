import { ui, defaultLang, languages, htmlLang, type Lang, type UIKey } from './ui';
import { getRelativeLocaleUrl } from 'astro:i18n';

export type { Lang };
export { htmlLang };

export function isLang(x: unknown): x is Lang {
  return typeof x === 'string' && x in languages;
}

export function useTranslations(lang: Lang) {
  return function t(key: UIKey): string {
    return (ui[lang] as Record<string, string>)[key] ?? ui[defaultLang][key];
  };
}

/** Locale-aware, base-aware URL: href('zh', 'people/') → /<base>/zh/people/ */
export function href(lang: Lang, path = ''): string {
  return getRelativeLocaleUrl(lang, path);
}

/** Pick a localised field from an object with `_zh` variants; falls back to English. */
export function pick<T extends Record<string, any>>(obj: T, field: string, lang: Lang): string | undefined {
  if (lang === 'zh' && obj[`${field}_zh`]) return obj[`${field}_zh`];
  return obj[field];
}

/** Swap the locale segment of a path: /base/en/people/ → /base/zh/people/. Query and hash are added client-side. */
export function switchLangPath(url: URL, to: Lang): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const path = url.pathname.startsWith(base) ? url.pathname.slice(base.length) : url.pathname;
  const parts = path.split('/');
  if (isLang(parts[1])) parts[1] = to;
  else parts.splice(1, 0, to);
  return base + parts.join('/');
}

/** hreflang alternates for <head>: one per language plus x-default (the language-forwarding root). */
export function alternates(url: URL, site: URL | undefined) {
  const abs = (p: string) => new URL(p, site ?? url).toString();
  return [
    ...langs.map((l) => ({ hreflang: htmlLang[l], href: abs(switchLangPath(url, l)) })),
    { hreflang: 'x-default', href: abs(import.meta.env.BASE_URL) },
  ];
}

export const langs = Object.keys(languages) as Lang[];

/** getStaticPaths helper for pages under src/pages/[lang]/ */
export function langPaths() {
  return langs.map((lang) => ({ params: { lang } }));
}
