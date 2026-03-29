/**
 * Converts input strings into URL-safe slugs while keeping support for Arabic characters.
 * Normalization steps:
 * 1. Normalize unicode to remove diacritics.
 * 2. Trim surrounding whitespace.
 * 3. Convert whitespace clusters into single hyphens.
 * 4. Strip any character that is not alphanumeric, Arabic, or a hyphen.
 * 5. Collapse duplicate hyphens and lowercase the result.
 */
export function slugify(value: string): string {
  if (!value) {
    return "";
  }

  const withoutMarks = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

  const slug = withoutMarks
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u0600-\u06FF-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return slug;
}

/**
 * Utility helper to compare two strings using their slugified form.
 */
export function slugEquals(a: string, b: string): boolean {
  return slugify(a) === slugify(b);
}
