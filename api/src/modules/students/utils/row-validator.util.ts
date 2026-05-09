import { EXCEL_COLUMNS, TERM_COLUMNS } from '../constants/excel.constants';
import { TermType } from '../../fees/entities/fee.entity';

export const TERM_COLUMN_TO_ENUM: Record<string, TermType> = {
  [EXCEL_COLUMNS.TERM_1]: TermType.FIRST,
  [EXCEL_COLUMNS.TERM_2]: TermType.SECOND,
  [EXCEL_COLUMNS.TERM_3]: TermType.THIRD,
  [EXCEL_COLUMNS.TERM_4]: TermType.FOURTH,
  [EXCEL_COLUMNS.TERM_5]: TermType.FIFTH,
};

const TERM_TO_DISCOUNT_COL: Record<string, string> = {
  [EXCEL_COLUMNS.TERM_1]: EXCEL_COLUMNS.TERM_1_DISCOUNT,
  [EXCEL_COLUMNS.TERM_2]: EXCEL_COLUMNS.TERM_2_DISCOUNT,
  [EXCEL_COLUMNS.TERM_3]: EXCEL_COLUMNS.TERM_3_DISCOUNT,
  [EXCEL_COLUMNS.TERM_4]: EXCEL_COLUMNS.TERM_4_DISCOUNT,
  [EXCEL_COLUMNS.TERM_5]: EXCEL_COLUMNS.TERM_5_DISCOUNT,
};

export interface NormalisedRow {
  name: string;
  email: string;
  phoneNumber: string;
  admissionNumber: string;
  class: string;
  section: string;
  rollNo: string;
  academicYear: string;
  imgUrl: string | null;
  term: TermType;
  amount: number;
}

export interface FieldError {
  field: string;
  reason: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?\d{7,15}$/;
const ACADEMIC_YEAR_RE = /^(\d{4})-(\d{4})$/;

export type ValidationResult =
  | { ok: true; value: NormalisedRow }
  | { ok: false; errors: FieldError[] };

export function validateAndNormalise(
  raw: Record<string, unknown>,
): ValidationResult {
  const errors: FieldError[] = [];

  const name = asTrimmedString(raw[EXCEL_COLUMNS.NAME]);
  if (!name) errors.push({ field: EXCEL_COLUMNS.NAME, reason: 'required' });

  const emailRaw = asTrimmedString(raw[EXCEL_COLUMNS.EMAIL]);
  let email = '';
  if (!emailRaw) {
    errors.push({ field: EXCEL_COLUMNS.EMAIL, reason: 'required' });
  } else if (!EMAIL_RE.test(emailRaw)) {
    errors.push({ field: EXCEL_COLUMNS.EMAIL, reason: 'invalid format' });
  } else {
    email = emailRaw.toLowerCase();
  }

  const phoneNumber = asTrimmedString(raw[EXCEL_COLUMNS.PHONE]);
  if (!phoneNumber) {
    errors.push({ field: EXCEL_COLUMNS.PHONE, reason: 'required' });
  } else if (!PHONE_RE.test(phoneNumber)) {
    errors.push({
      field: EXCEL_COLUMNS.PHONE,
      reason: 'must be 7–15 digits, optional leading +',
    });
  }

  const admissionNumber = asTrimmedString(raw[EXCEL_COLUMNS.ADMISSION]);
  if (!admissionNumber) {
    errors.push({ field: EXCEL_COLUMNS.ADMISSION, reason: 'required' });
  }

  const cls = asTrimmedString(raw[EXCEL_COLUMNS.CLASS]);
  if (!cls) errors.push({ field: EXCEL_COLUMNS.CLASS, reason: 'required' });

  const section = asTrimmedString(raw[EXCEL_COLUMNS.SECTION]);
  if (!section) {
    errors.push({ field: EXCEL_COLUMNS.SECTION, reason: 'required' });
  }

  const rollNo = asTrimmedString(raw[EXCEL_COLUMNS.ROLL_NO]);
  if (!rollNo) {
    errors.push({ field: EXCEL_COLUMNS.ROLL_NO, reason: 'required' });
  }

  const academicYear = asTrimmedString(raw[EXCEL_COLUMNS.ACADEMIC_YEAR]);
  if (!academicYear) {
    errors.push({ field: EXCEL_COLUMNS.ACADEMIC_YEAR, reason: 'required' });
  } else {
    const m = academicYear.match(ACADEMIC_YEAR_RE);
    if (!m) {
      errors.push({
        field: EXCEL_COLUMNS.ACADEMIC_YEAR,
        reason: 'must be in YYYY-YYYY format',
      });
    } else if (Number(m[2]) !== Number(m[1]) + 1) {
      errors.push({
        field: EXCEL_COLUMNS.ACADEMIC_YEAR,
        reason: 'end year must be start year + 1',
      });
    }
  }

  const imgUrl = asTrimmedString(raw[EXCEL_COLUMNS.IMG_URL]) || null;

  const termHits = TERM_COLUMNS.filter((col) => {
    const v = raw[col];
    return v !== undefined && v !== null && v !== '';
  });

  let term: TermType | null = null;
  let amount = 0;

  if (termHits.length === 0) {
    errors.push({
      field: 'Term Fee',
      reason: 'no term fee column has a value',
    });
  } else if (termHits.length > 1) {
    errors.push({
      field: 'Term Fee',
      reason: `multiple term columns set (${termHits.join(', ')}); expected exactly one`,
    });
  } else {
    const termCol = termHits[0];
    term = TERM_COLUMN_TO_ENUM[termCol];
    const parsed = toPositiveAmount(raw[termCol]);
    if (parsed === null) {
      errors.push({ field: termCol, reason: 'must be a positive number' });
    } else {
      amount = parsed;
    }
  }

  if (errors.length || !term) return { ok: false, errors };

  return {
    ok: true,
    value: {
      name,
      email,
      phoneNumber,
      admissionNumber,
      class: cls,
      section,
      rollNo,
      academicYear,
      imgUrl,
      term,
      amount,
    },
  };
}

function asTrimmedString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function toPositiveAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}