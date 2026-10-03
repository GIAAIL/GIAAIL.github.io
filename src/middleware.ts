/**
 * Every link that leaves the site (DOIs, publisher pages, PDFs elsewhere, profiles, videos …)
 * opens in a new tab, so the visitor keeps their place here. Applied to the finished HTML of every
 * page — components and Markdown alike — at build time and in `npm run dev`. Links within the
 * site and mailto: links are left as they are.
 */
import { defineMiddleware } from 'astro:middleware';

const SITE = import.meta.env.SITE ? new URL(import.meta.env.SITE).origin : '';

function openInNewTab(tag: string): string {
  const href = tag.match(/\shref=(["'])(https?:\/\/[^"']+)\1/i);
  if (!href || /\starget=/i.test(tag)) return tag;
  if (SITE && new URL(href[2]).origin === SITE) return tag;
  const rel = tag.match(/\srel=(["'])([^"']*)\1/i);
  let out = tag;
  if (rel) {
    const values = new Set(rel[2].split(/\s+/).filter(Boolean));
    values.add('noopener');
    out = out.replace(rel[0], ` rel="${[...values].join(' ')}"`);
  } else {
    out = out.replace(/^<a\b/i, '<a rel="noopener"');
  }
  return out.replace(/^<a\b/i, '<a target="_blank"');
}

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  if (!(response.headers.get('content-type') ?? '').includes('text/html')) return response;
  const html = await response.text();
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(html.replace(/<a\b[^>]*>/gi, openInNewTab), { status: response.status, statusText: response.statusText, headers });
});
