/** Minimal URL detection for post bodies (ADR 0028). */

const URL_PATTERN = /https?:\/\/[^\s<>"']+/;
const TRAILING_PUNCTUATION = /[)\]}>.,;:!?]+$/;

export function splitFirstUrl(
  text: string,
): { before: string; url: string; after: string } | null {
  const match = text.match(URL_PATTERN);
  if (match === null || match.index === undefined) return null;
  const url = match[0].replace(TRAILING_PUNCTUATION, "");
  const end = match.index + url.length;
  return { before: text.slice(0, match.index), url, after: text.slice(end) };
}

export function extractFirstUrl(text: string): string | null {
  return splitFirstUrl(text)?.url ?? null;
}