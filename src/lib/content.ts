/**
 * The one place the site reads its content.
 *
 * Every page — the home previews and the full section pages — gets its items from these
 * functions, so visibility (drafts, unconfirmed people, excluded papers), sort order and
 * joins are decided once. The home page only adds a selector (`preview*`) on top of the
 * same lists, which is what keeps a preview and its page from disagreeing.
 *
 * Draft activities and unpublished people are hidden unless PREVIEW_DRAFTS=1 (`npm run dev:drafts`).
 */
import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import type { Lang } from '../i18n/ui';

export const SHOW_DRAFTS = process.env.PREVIEW_DRAFTS === '1';

export type Pub = CollectionEntry<'publications'>;
export type Thread = CollectionEntry<'themes'>;
export type Person = CollectionEntry<'people'>;
export type Activity = CollectionEntry<'activities'>;
export type Project = CollectionEntry<'projects'>;
export type Thesis = CollectionEntry<'theses'>;

/** How many items each home preview shows. Sized so every panel fits the drum (≤ 70dvh). */
export const PREVIEW = { publications: 6, members: 8, activities: 3 } as const;

const memo = new Map<string, Promise<unknown>>();
function once<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (import.meta.env.DEV) return fn();   // the dev server reloads content; never serve a stale list
  if (!memo.has(key)) memo.set(key, fn());
  return memo.get(key) as Promise<T>;
}

// ---------------------------------------------------------------- threads

export const threads = () =>
  once('threads', async () => (await getCollection('themes')).sort((a, b) => a.data.order - b.data.order));

export async function threadById(): Promise<Record<string, Thread['data']>> {
  return Object.fromEntries((await threads()).map((t) => [t.id, t.data]));
}

// ---------------------------------------------------------------- publications

/**
 * Order inside a year: journal < conference < book < other, then by the former NSTC catalogue number
 * (A1, B3 …); papers added later have no number and follow, by title. Same order as scripts/lib/data.mjs.
 */
const TYPE_LETTER: Record<string, string> = { journal: 'A', conference: 'B', book: 'C', other: 'D' };
function refKey(p: Pub): [string, number] {
  const m = (p.data.ref ?? '').match(/^([A-Z]+)(\d+)$/);
  return m ? [m[1], Number(m[2])] : [TYPE_LETTER[p.data.type] ?? 'Z', 1e6];
}

export function byRecency(a: Pub, b: Pub) {
  const [la, na] = refKey(a);
  const [lb, nb] = refKey(b);
  return b.data.year - a.data.year || la.localeCompare(lb) || na - nb || a.data.title.localeCompare(b.data.title);
}

export const publications = () => once('pubs', async () => (await getCollection('publications')).sort(byRecency));

export async function publicationsIn(thread: string) {
  return (await publications()).filter((p) => p.data.theme === thread);
}

export async function countsByThread(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const p of await publications()) if (p.data.theme) out[p.data.theme] = (out[p.data.theme] ?? 0) + 1;
  return out;
}

/** Featured papers in curated order; papers with a real image go first; topped up with the most recent. */
export async function featured(n: number, pool?: Pub[]) {
  const all = pool ?? (await publications());
  const ranked = all.filter((p) => p.data.featured).sort((a, b) => a.data.featured! - b.data.featured!);
  const withImage = ranked.filter((p) => p.data.image);
  const chosen = [...withImage, ...ranked.filter((p) => !p.data.image)].slice(0, n);
  for (const p of all) {
    if (chosen.length >= n) break;
    if (!chosen.includes(p)) chosen.push(p);
  }
  return chosen.slice(0, n);
}

export async function publicationsBySlug(ids: { id: string }[]) {
  const all = await publications();
  return ids.map((r) => all.find((p) => p.id === r.id)).filter((p): p is Pub => !!p).sort(byRecency);
}

// ---------------------------------------------------------------- people and theses
// Source: src/content/people/*.md + data/theses.json → npm run data → src/data/theses.json

export const ROLE_ORDER = ['director', 'faculty', 'postdoc', 'phd', 'master', 'researcher', 'assistant', 'alumni'] as const;

/** Everyone the lab publishes (`publish: Y` in the workbook), in role order, then `order`, then entry year. */
export const people = () =>
  once('people', async () =>
    (await getCollection('people', ({ data }) => SHOW_DRAFTS || data.publish)).sort(
      (a, b) =>
        ROLE_ORDER.indexOf(a.data.role) - ROLE_ORDER.indexOf(b.data.role) ||
        a.data.order - b.data.order ||
        (a.data.cohort ?? 9999) - (b.data.cohort ?? 9999) ||
        a.data.name.localeCompare(b.data.name),
    ),
  );

export async function director() {
  return (await people()).find((p) => p.data.role === 'director');
}

export async function members() {
  return (await people()).filter((p) => p.data.role !== 'director' && p.data.role !== 'alumni');
}

/** Theses, newest first; only those whose author is published. */
export const theses = () =>
  once('theses', async () => {
    const visible = new Set((await people()).map((p) => p.id));
    return (await getCollection('theses', ({ data }) => visible.has(data.person.id))).sort(
      (a, b) => b.data.year - a.data.year || a.id.localeCompare(b.id),
    );
  });

export async function thesesByPerson(): Promise<Map<string, Thesis[]>> {
  const m = new Map<string, Thesis[]>();
  for (const t of await theses()) {
    if (!m.has(t.data.person.id)) m.set(t.data.person.id, []);
    m.get(t.data.person.id)!.push(t);
  }
  return m;
}

export async function thesesIn(thread: string) {
  return (await theses()).filter((t) => t.data.thread?.id === thread);
}

/** Theses that a paper came out of (the thesis lists the paper's slug in `pubs`). */
export async function thesesForPublication(slug: string) {
  return (await theses()).filter((t) => t.data.pubs.some((r) => r.id === slug));
}

export type Alumnus = { person: Person; thesis?: Thesis; level: 'PhD' | 'MS'; anchor: boolean };

/**
 * People › Alumni: one entry per thesis supervised since 2007, newest first — current members'
 * earlier theses included, so the record of theses is complete — plus alumni without a thesis
 * record. `anchor` marks the entry that carries the person's #id (alumni only; current members
 * already have theirs in Members).
 */
export const alumni = () =>
  once('alumni', async () => {
    const ppl = await people();
    const byId = new Map(ppl.map((p) => [p.id, p]));
    const rows: Alumnus[] = [];
    const withThesis = new Set<string>();
    for (const t of await theses()) {
      const p = byId.get(t.data.person.id);
      if (!p) continue;                                   // unpublished people stay out
      withThesis.add(p.id);
      rows.push({ person: p, thesis: t, level: t.data.degree, anchor: false });
    }
    for (const p of ppl) {
      if (p.data.role === 'alumni' && !withThesis.has(p.id))
        rows.push({ person: p, level: /^PhD/i.test(p.data.degree ?? '') ? 'PhD' : 'MS', anchor: false });
    }
    const year = (a: Alumnus) => a.thesis?.data.year ?? Number(a.person.data.degree?.match(/\d{4}/)?.[0] ?? 0);
    rows.sort((a, b) => year(b) - year(a) || a.person.data.name.localeCompare(b.person.data.name));
    const anchored = new Set<string>();
    for (const r of rows) {
      if (r.person.data.role === 'alumni' && !anchored.has(r.person.id)) { r.anchor = true; anchored.add(r.person.id); }
    }
    return rows;
  });

// ---------------------------------------------------------------- activities

/** Display order of activity types (filters, labels). */
export const ACTIVITY_TYPES = ['exhibition', 'festival', 'curation', 'conference', 'talk', 'workshop', 'jury', 'award', 'press', 'writing'] as const;

/** Newest first: year, then exact date within the year, then title. */
export const activities = () =>
  once('activities', async () =>
    (await getCollection('activities', ({ data }) => SHOW_DRAFTS || !data.draft)).sort(
      (a, b) =>
        b.data.year - a.data.year ||
        (b.data.date ?? '').localeCompare(a.data.date ?? '') ||
        a.data.title.localeCompare(b.data.title),
    ),
  );

export const activityYear = (a: Activity) => a.data.year;

// ---------------------------------------------------------------- projects, pages

/** A thread's projects: research series first (low `order`), then funded projects, newest first. Drafts stay hidden. */
export async function projectsIn(thread: string) {
  const start = (p: Project) => p.data.start ?? Number(p.data.years?.match(/\d{4}/)?.[0] ?? 0);
  return (await getCollection('projects', ({ data }) => data.theme.id === thread && (SHOW_DRAFTS || !data.draft))).sort(
    (a, b) => a.data.order - b.data.order || start(b) - start(a) || a.data.title.localeCompare(b.data.title),
  );
}

export async function aboutPage(lang: Lang) {
  const page = (await getEntry('pages', `${lang}/about`)) ?? (await getEntry('pages', 'en/about'));
  if (!page) throw new Error('Missing src/content/pages/en/about.md');
  return page;
}

// ---------------------------------------------------------------- home previews

/** The home list: the papers ranked `featured` 1–6 in data/publications.json, in that order (topped up with the newest). */
export async function previewPublications() {
  const all = await publications();
  const ranked = all.filter((p) => p.data.featured).sort((a, b) => a.data.featured! - b.data.featured!);
  return [...ranked, ...all.filter((p) => !p.data.featured)].slice(0, PREVIEW.publications);
}

export async function previewMembers() {
  return (await members()).slice(0, PREVIEW.members);
}

/** Featured activities first, then the newest; media coverage and writing stay on the Activities page. */
export async function previewActivities() {
  const all = (await activities()).filter((a) => a.data.type !== 'press' && a.data.type !== 'writing');
  return [...all.filter((a) => a.data.featured), ...all.filter((a) => !a.data.featured)].slice(0, PREVIEW.activities);
}
