/** Minimal URL detection for post bodies (ADR 0028).
 *
 * A link is either an ``http(s)://`` URL or a bare domain token: a contiguous
 * run of labels separated by dots whose final label is 2+ letters (a TLD).
 * Because a bare domain never contains a space, sentence punctuation like
 * "al bar. Fai presto" is not mistaken for a domain — the space breaks the
 * match. Bare domains are linked with an ``https://`` scheme.
 */

// https?:\/\/[^\s<>"']+                  — scheme'd URL, any host
// (?:[a-z0-9-]+\.)+[a-z]{2,}(?:[\/:]...)? — bare domain, optional port/path
const URL_PATTERN = new RegExp(
  String.raw`(?:https?:\/\/[^\s<>"']+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:[\/:][^\s<>"']*)?)`,
  "gi",
);
const TRAILING_PUNCTUATION = /[)\]}>.,;:!?]+$/;

function normalizeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export interface LinkSegment {
  text: string;
  url?: string;
}

export function splitFirstUrl(
  text: string,
): { before: string; url: string; after: string } | null {
  for (const match of text.matchAll(URL_PATTERN)) {
    const trimmed = match[0].replace(TRAILING_PUNCTUATION, "");
    const start = match.index;
    return {
      before: text.slice(0, start),
      url: normalizeUrl(trimmed),
      after: text.slice(start + trimmed.length),
    };
  }
  return null;
}

export function extractFirstUrl(text: string): string | null {
  return splitFirstUrl(text)?.url ?? null;
}

export function linkify(text: string): LinkSegment[] {
  const segments: LinkSegment[] = [];
  let lastEnd = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const trimmed = match[0].replace(TRAILING_PUNCTUATION, "");
    const start = match.index;
    if (start > lastEnd) {
      segments.push({ text: text.slice(lastEnd, start) });
    }
    segments.push({ text: trimmed, url: normalizeUrl(trimmed) });
    // Advance by the trimmed length so punctuation stripped from the URL
    // (e.g. "b!" -> "b" + "!") stays visible as plain text.
    lastEnd = start + trimmed.length;
  }
  if (lastEnd < text.length) {
    segments.push({ text: text.slice(lastEnd) });
  }
  return segments;
}