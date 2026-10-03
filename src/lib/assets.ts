import { existsSync } from 'node:fs';
import { join } from 'node:path';

const PUBLIC = join(process.cwd(), 'public');

/**
 * Build-time check for a file under public/. Lets templates skip an <img>
 * whose file has not been added yet, instead of rendering a broken image.
 */
export function publicExists(path?: string): boolean {
  if (!path) return false;
  return existsSync(join(PUBLIC, path.replace(/^\//, '')));
}

/** Resolve a public/ path to a URL that respects the configured base. */
export function publicUrl(path: string): string {
  return import.meta.env.BASE_URL + path.replace(/^\//, '');
}

/** Image URL if the file exists, else null. */
export function imageIfExists(path?: string): string | null {
  return publicExists(path) ? publicUrl(path!) : null;
}
