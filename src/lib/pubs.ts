import type { CollectionEntry } from 'astro:content';

type Pub = CollectionEntry<'publications'>['data'];

/** Names emphasised in author lists (the lab PI). */
export const SELF = ['June-Hao Hou', 'June-Hao Ho'];

/** Real image URL (base-aware) or null; callers draw the dotted placeholder when null. */
export function pubImage(d: Pub): string | null {
  if (!d.image) return null;
  return import.meta.env.BASE_URL + d.image.replace(/^\//, '');
}

/** "CAADRIA 2026" stays as is; "Leonardo" becomes "Leonardo, 2018". */
export function venueWithYear(d: Pub): string {
  const v = d.venueShort ?? d.venue ?? '';
  return v.includes(String(d.year)) ? v : [v, d.year].filter(Boolean).join(', ');
}

/** Venue and year for list kickers: "CAADRIA 2026", "Journal of Computational Design and Engineering · 2026". */
export function venueKicker(d: Pub): string {
  const v = d.venueShort ?? d.venue ?? '';
  return v.includes(String(d.year)) ? v : [v, d.year].filter(Boolean).join(' · ');
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function formatAuthors(authors: string[]): string {
  return authors.join(', ');
}

/** Author list as HTML with the PI in <b> (the home page's style for it). */
export function authorsHtml(authors: string[]): string {
  return authors.map((a) => (SELF.includes(a) ? `<b>${esc(a)}</b>` : esc(a))).join(', ');
}

/** One-line venue description: "CAADRIA 2026, Hsinchu, Taiwan" / "Leonardo, 51(3), 2018". */
export function venueLine(d: Pub): string {
  if (d.type === 'journal') return [d.venue, d.volume, String(d.year)].filter(Boolean).join(', ');
  if (d.type === 'conference') return [d.venueShort ?? d.venue, d.location].filter(Boolean).join(', ');
  if (d.type === 'book') return [d.role, d.publisher, String(d.year)].filter(Boolean).join(', ');
  return [d.venueShort ?? d.venue, String(d.year)].filter(Boolean).join(', ');
}

/** YouTube / Vimeo embed URL, or null. */
export function videoEmbed(url?: string): string | null {
  if (!url) return null;
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]+)/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}
