/**
 * Excel column headers for the bulk students+fees upload.
 *
 * Header strings are case-sensitive and must match what schools paste
 * into their Excel. Synonyms (e.g. "PHONE" / "Phone Number" / "Mobile")
 * should be normalised in the parser, not added here.
 *
 * The Excel is the *broad* view: it carries Branch + per-term Discount
 * so a single file can be uploaded for any branch and any number of
 * concession rules. The UI table view is the *compact* view computed
 * from this data + payment history.
 */
export const EXCEL_COLUMNS = {
  // Identity / placement
  BRANCH: 'Branch',
  ACADEMIC_YEAR: 'Academic Year',
  ADMISSION: 'ADMISSION',
  NAME: 'NAME',
  EMAIL: 'e-mail',
  PHONE: 'Phone number',
  CLASS: 'Class',
  SECTION: 'Section',
  ROLL_NO: 'Roll No',
  IMG_URL: 'imgUrl',

  // Fees per term — original amount
  TERM_1: '1st Term Fee',
  TERM_2: '2nd Term Fee',
  TERM_3: '3rd Term Fee',
  TERM_4: '4th Term Fee',
  TERM_5: '5th Term Fee',

  // Discounts per term — sibling, staff, EWS, scholarship, etc.
  TERM_1_DISCOUNT: '1st Term Discount',
  TERM_2_DISCOUNT: '2nd Term Discount',
  TERM_3_DISCOUNT: '3rd Term Discount',
  TERM_4_DISCOUNT: '4th Term Discount',
  TERM_5_DISCOUNT: '5th Term Discount',
} as const;

export const REQUIRED_STUDENT_COLUMNS = [
  EXCEL_COLUMNS.BRANCH,
  EXCEL_COLUMNS.ACADEMIC_YEAR,
  EXCEL_COLUMNS.ADMISSION,
  EXCEL_COLUMNS.NAME,
  EXCEL_COLUMNS.EMAIL,
  EXCEL_COLUMNS.PHONE,
  EXCEL_COLUMNS.CLASS,
  EXCEL_COLUMNS.SECTION,
  EXCEL_COLUMNS.ROLL_NO,
] as const;

export const TERM_COLUMNS = [
  EXCEL_COLUMNS.TERM_1,
  EXCEL_COLUMNS.TERM_2,
  EXCEL_COLUMNS.TERM_3,
  EXCEL_COLUMNS.TERM_4,
  EXCEL_COLUMNS.TERM_5,
] as const;

export const TERM_DISCOUNT_COLUMNS = [
  EXCEL_COLUMNS.TERM_1_DISCOUNT,
  EXCEL_COLUMNS.TERM_2_DISCOUNT,
  EXCEL_COLUMNS.TERM_3_DISCOUNT,
  EXCEL_COLUMNS.TERM_4_DISCOUNT,
  EXCEL_COLUMNS.TERM_5_DISCOUNT,
] as const;

/** Pairs of (fee column, discount column) — used by the parser to
 * generate one fee record per non-empty term. */
export const TERM_DEFINITIONS = [
  { feeCol: EXCEL_COLUMNS.TERM_1, discountCol: EXCEL_COLUMNS.TERM_1_DISCOUNT },
  { feeCol: EXCEL_COLUMNS.TERM_2, discountCol: EXCEL_COLUMNS.TERM_2_DISCOUNT },
  { feeCol: EXCEL_COLUMNS.TERM_3, discountCol: EXCEL_COLUMNS.TERM_3_DISCOUNT },
  { feeCol: EXCEL_COLUMNS.TERM_4, discountCol: EXCEL_COLUMNS.TERM_4_DISCOUNT },
  { feeCol: EXCEL_COLUMNS.TERM_5, discountCol: EXCEL_COLUMNS.TERM_5_DISCOUNT },
] as const;

export const MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
export const MAX_UPLOAD_ROWS = 10_000;

/** Sample row used by the downloadable template. */
export const SAMPLE_ROW: Record<string, string | number> = {
  [EXCEL_COLUMNS.BRANCH]: 'Main',
  [EXCEL_COLUMNS.ACADEMIC_YEAR]: '2025-2026',
  [EXCEL_COLUMNS.ADMISSION]: 'ADM-2024-001',
  [EXCEL_COLUMNS.NAME]: 'Arjun Kumar',
  [EXCEL_COLUMNS.EMAIL]: 'arjun@example.com',
  [EXCEL_COLUMNS.PHONE]: '+91-9876543210',
  [EXCEL_COLUMNS.CLASS]: '7',
  [EXCEL_COLUMNS.SECTION]: 'A',
  [EXCEL_COLUMNS.ROLL_NO]: '1',
  [EXCEL_COLUMNS.IMG_URL]: '',
  [EXCEL_COLUMNS.TERM_1]: 25000,
  [EXCEL_COLUMNS.TERM_1_DISCOUNT]: 0,
  [EXCEL_COLUMNS.TERM_2]: 25000,
  [EXCEL_COLUMNS.TERM_2_DISCOUNT]: 0,
  [EXCEL_COLUMNS.TERM_3]: 25000,
  [EXCEL_COLUMNS.TERM_3_DISCOUNT]: 0,
  [EXCEL_COLUMNS.TERM_4]: 25000,
  [EXCEL_COLUMNS.TERM_4_DISCOUNT]: 0,
  [EXCEL_COLUMNS.TERM_5]: 0,
  [EXCEL_COLUMNS.TERM_5_DISCOUNT]: 0,
};
