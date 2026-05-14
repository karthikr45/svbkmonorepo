/**
 * Admission-number generator. Each tenant can configure a template
 * string (Tenant.admissionNumberPattern) and the system fills in the
 * tokens + next zero-padded sequence.
 *
 * Tokens (substituted verbatim if the corresponding context value
 * isn't supplied):
 *   {TENANT}  tenant code
 *   {BRANCH}  branch passed by caller
 *   {YYYY}    4-digit current year
 *   {YY}      2-digit current year
 *   {AY}      academic year as supplied (e.g. "2025-2026")
 *   {AYY}     academic year short (e.g. "25-26")
 *   {#+}      one-or-more `#` = zero-padded running sequence. The
 *             number of #'s controls the field width.
 *
 * Example: pattern "SVBK/{AYY}/{####}", existing rows up to ...0004
 *   → returns "SVBK/25-26/0005".
 */

export interface PatternContext {
  tenantCode?: string | null;
  branch?: string | null;
  academicYear?: string | null;
}

export interface PatternResolution {
  /** The pattern after substituting non-sequence tokens. */
  prefixSuffix: { prefix: string; suffix: string };
  /** Width of the `#+` sequence run found in the pattern. */
  width: number;
  /** A regex that matches any value generated from the pattern, capturing the numeric sequence. */
  matcher: RegExp;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function shortAcademicYear(ay: string | null | undefined): string {
  if (!ay) return '';
  const m = ay.match(/^(\d{4})\D+(\d{4})$/);
  if (!m) return ay;
  return `${m[1].slice(2)}-${m[2].slice(2)}`;
}

function substitute(template: string, ctx: PatternContext): string {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const yy = yyyy.slice(2);
  return template
    .replace(/\{TENANT\}/g, ctx.tenantCode ?? '')
    .replace(/\{BRANCH\}/g, ctx.branch ?? '')
    .replace(/\{YYYY\}/g, yyyy)
    .replace(/\{YY\}/g, yy)
    .replace(/\{AY\}/g, ctx.academicYear ?? '')
    .replace(/\{AYY\}/g, shortAcademicYear(ctx.academicYear));
}

/**
 * Resolves the non-sequence parts of a pattern and the width / matcher
 * for the sequence portion. Returns null if the pattern has no `{#+}`
 * run (i.e. auto-generation is impossible).
 */
export function resolvePattern(
  pattern: string,
  ctx: PatternContext,
): PatternResolution | null {
  const filled = substitute(pattern, ctx);
  const m = filled.match(/\{(#+)\}/);
  if (!m) return null;
  const width = m[1].length;
  const idx = m.index ?? 0;
  const prefix = filled.slice(0, idx);
  const suffix = filled.slice(idx + m[0].length);
  const matcher = new RegExp(
    `^${escapeRegex(prefix)}(\\d{${width},})${escapeRegex(suffix)}$`,
  );
  return { prefixSuffix: { prefix, suffix }, width, matcher };
}

/** Format a sequence number into the pattern. */
export function formatWithSequence(
  res: PatternResolution,
  seq: number,
): string {
  const padded = String(seq).padStart(res.width, '0');
  return `${res.prefixSuffix.prefix}${padded}${res.prefixSuffix.suffix}`;
}

/** Extract the numeric sequence from a value that matches the pattern. */
export function extractSequence(
  res: PatternResolution,
  value: string,
): number | null {
  const m = value.match(res.matcher);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}
