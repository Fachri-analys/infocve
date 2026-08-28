const idDateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const idDateShortFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/** "10 Desember 2021" */
export function formatDateId(iso: string): string {
  return idDateFormatter.format(new Date(iso));
}

/** "10 Des 2021" — used in tight card layouts */
export function formatDateShortId(iso: string): string {
  return idDateShortFormatter.format(new Date(iso));
}

export function formatCvssScore(score: number): string {
  return score.toFixed(1);
}

/**
 * Safely serializes a value for embedding in a `<script>` tag via
 * `dangerouslySetInnerHTML` (used for JSON-LD structured data). Plain
 * `JSON.stringify` does not escape `<`, so a value containing the literal
 * text `</script>` — plausible here, since CVE descriptions originate from
 * the external NVD API — could terminate the script tag early and let the
 * rest of the string be parsed as HTML. Escaping `<` to its Unicode form is
 * semantically identical JSON (parsers treat `\u003c` and `<` the same way)
 * but can never be read as an HTML tag delimiter.
 */
export function safeJsonLdStringify(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function formatNumberId(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}…`;
}
