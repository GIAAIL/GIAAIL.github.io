/** Display helpers for people and theses (src/content/people, data/theses.json). */
import type { CollectionEntry } from 'astro:content';
import type { Lang } from '../i18n/ui';
import { getRelativeLocaleUrl } from 'astro:i18n';

type PersonData = CollectionEntry<'people'>['data'];
type ThesisData = CollectionEntry<'theses'>['data'];

/** "盧虹文 Hung-Wen Lu" on Chinese pages, "Hung-Wen Lu" on English ones (the Chinese name when no romanised one exists yet). */
export function displayName(p: PersonData, lang: Lang): string {
  if (lang === 'zh' && p.name_zh && p.name_zh !== p.name) return `${p.name_zh} ${p.name}`;
  return p.name;
}

/** Where a person's name links to: their own site first, then the profiles they listed. Undefined until one is filled in. */
const LINK_ORDER = ['website', 'linkedin', 'scholar', 'orcid', 'github', 'gitlab', 'instagram', 'nycu', 'cv'] as const;
export function personalLink(p: PersonData): string | undefined {
  const links = p.links as Record<string, string | undefined>;
  for (const k of LINK_ORDER) if (links[k]) return links[k];
  return undefined;
}

/** One name only, for compact lists: the Chinese name on Chinese pages. */
export function shortName(p: PersonData, lang: Lang): string {
  return lang === 'zh' && p.name_zh ? p.name_zh : p.name;
}

const DEGREE = { en: { MS: 'MS', PhD: 'PhD' }, zh: { MS: '碩士', PhD: '博士' } } as const;
const UNI: Record<Lang, Record<string, string>> = { en: { NCTU: 'NCTU', NYCU: 'NYCU' }, zh: { NCTU: '交大', NYCU: '陽明交大' } };

/** "MS 2025, NYCU" / "碩士 2025 · 陽明交大" */
export function degreeLine(t: ThesisData, lang: Lang): string {
  const d = DEGREE[lang][t.degree];
  const u = t.university ? UNI[lang][t.university] ?? t.university : '';
  return [`${d} ${t.year}`, u].filter(Boolean).join(lang === 'zh' ? ' · ' : ', ');
}

export function thesisTitle(t: ThesisData, lang: Lang): string {
  return lang === 'zh' && t.title_zh ? t.title_zh : t.title;
}

/** Language of the title actually shown (an English page falls back to the Chinese title when there is no translation). */
export function thesisTitleLang(t: ThesisData, lang: Lang): string | undefined {
  const shown = thesisTitle(t, lang);
  return lang === 'en' && /[㐀-鿿]/.test(shown) ? 'zh-Hant' : undefined;
}

/** Best public record for a thesis: DOI, then NDLTD, then the NYCU library record. Never a PDF. */
export function thesisHref(t: ThesisData): string | undefined {
  if (t.doi) return t.doi.startsWith('http') ? t.doi : `https://doi.org/${t.doi}`;
  return t.ndltdUrl || t.libraryUrl || undefined;
}

/** Base-aware URL of the thesis's main figure (800 px copy), or null. */
export function thesisImage(t: ThesisData): string | null {
  const src = t.imageSm || t.image;
  return src ? import.meta.env.BASE_URL + src.replace(/^\//, '') : null;
}

/** The thesis's own page on this site. */
export function thesisPage(t: { id: string }, lang: Lang): string {
  return getRelativeLocaleUrl(lang, `theses/${t.id}/`);
}

export function thesisAbstract(t: ThesisData, lang: Lang): string | undefined {
  return lang === 'zh' ? t.abstract_zh || t.abstract : t.abstract || t.abstract_zh;
}

/** A figure's base-aware URL. */
export function figureUrl(src: string): string {
  return import.meta.env.BASE_URL + src.replace(/^\//, '');
}
