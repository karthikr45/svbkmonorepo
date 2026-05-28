import { Injectable } from '@nestjs/common';
import { FeesService } from '../fees/fees.service';
import { ParsedRow } from './utils/excel-parser.util';
import {
  validateAndNormalise,
  NormalisedRow,
} from './utils/row-validator.util';
import {
  RowStatus,
  ValidatedRow,
  ValidateUploadResponseDto,
} from './dto/upload.dto';
import { TermType } from '../fees/entities/fee.entity';

export interface ValidationOutput {
  response: ValidateUploadResponseDto;
  validRows: NormalisedRow[];
}

/**
 * Combines pure field-level validation (from `row-validator.util`) with
 * DB-based checks (duplicate within file, already-exists in fees table).
 *
 * Pure validation is unit-tested; this service stays thin.
 */
@Injectable()
export class UploadValidationService {
  constructor(private readonly feesService: FeesService) {}

  async validate(
    parsedRows: ParsedRow[],
    tenantId: string,
    branch: string,
  ): Promise<ValidationOutput> {
    const jwtBranch = (branch ?? '').trim();
    // Stage 1: field-level validation
    const stage1 = parsedRows.map((r) => {
      const result = validateAndNormalise(r.values);
      // Stage 1b: branch authorisation. If the caller has a branch on
      // their JWT, every row's Branch column must equal it. Tenant
      // admins can only upload for their own branch — mixing branches
      // in one Excel is rejected at row level so the admin sees which
      // rows are wrong rather than getting a single global error.
      if (result.ok && jwtBranch) {
        const offending = result.values.find(
          (v) => v.schoolCode.toLowerCase() !== jwtBranch.toLowerCase(),
        );
        if (offending) {
          return {
            rowNumber: r.rowNumber,
            raw: r.values,
            result: {
              ok: false as const,
              errors: [
                {
                  field: 'School Code',
                  reason: `school code "${offending.schoolCode}" not allowed; you can only upload for "${jwtBranch}"`,
                },
              ],
            },
          };
        }
      }
      return { rowNumber: r.rowNumber, raw: r.values, result };
    });

    // Stage 2: intra-file duplicate detection (across all expanded terms)
    const keyCount = new Map<string, number>();
    for (const s of stage1) {
      if (s.result.ok) {
        for (const v of s.result.values) {
          const k = this.feeKey(v.schoolCode, v.admissionNumber, v.academicYear, v.term);
          keyCount.set(k, (keyCount.get(k) ?? 0) + 1);
        }
      }
    }

    // Stage 3: single query to find any already-existing fees
    const allValuesForExisting = stage1
      .filter((s) => s.result.ok)
      .flatMap((s) => (s.result as { ok: true; values: NormalisedRow[] }).values);

    const existing = await this.feesService.findExistingByKeys(
      tenantId,
      branch,
      allValuesForExisting.map((r) => ({
        admissionNumber: r.admissionNumber,
        academicYear: r.academicYear,
      })),
    );

    // findExistingByKeys is scoped to the JWT branch, so every existing
    // row is for that branch. Tag them with jwtBranch (or the row's own
    // branch when JWT branch is unset for super-admin uploads).
    const existingSet = new Set(
      existing.map((e) =>
        this.feeKey(jwtBranch, e.admissionNumber, e.academicYear, e.term),
      ),
    );

    // Stage 4: assemble per-row results
    const validated: ValidatedRow[] = stage1.map((s) => {
      if (!s.result.ok) {
        return {
          rowNumber: s.rowNumber,
          status: RowStatus.ERROR,
          message: s.result.errors
            .map((e) => `${e.field}: ${e.reason}`)
            .join('; '),
          isTermExists: false,
          data: s.raw,
        };
      }

      const errors: string[] = [];
      let anyTermExists = false;

      for (const v of s.result.values) {
        const key = this.feeKey(v.schoolCode, v.admissionNumber, v.academicYear, v.term);
        if ((keyCount.get(key) ?? 0) > 1) {
          errors.push(
            `Duplicate within file: ${v.term} for admission ${v.admissionNumber} (${v.academicYear}) appears more than once — keep only one row per term`,
          );
        }
        if (existingSet.has(key)) {
          anyTermExists = true;
          errors.push(
            `${v.term} already exists for admission ${v.admissionNumber} (${v.academicYear}). Excel is insert-only — to change an existing fee, edit it from the Students table.`,
          );
        }
      }

      if (errors.length) {
        return {
          rowNumber: s.rowNumber,
          status: RowStatus.ERROR,
          message: errors.join('; '),
          isTermExists: anyTermExists,
          data: s.raw,
        };
      }

      return {
        rowNumber: s.rowNumber,
        status: RowStatus.VALID,
        message: '',
        isTermExists: false,
        data: s.raw,
      };
    });

    const counts = validated.reduce(
      (acc, r) => {
        if (r.status === RowStatus.VALID) acc.valid++;
        else acc.error++;
        return acc;
      },
      { valid: 0, error: 0 },
    );

    const validRows = stage1
      .filter((s, idx) => s.result.ok && validated[idx].status === RowStatus.VALID)
      .flatMap(
        (s) => (s.result as { ok: true; values: NormalisedRow[] }).values,
      );

    return {
      response: {
        totalRows: validated.length,
        validCount: counts.valid,
        errorCount: counts.error,
        rows: validated,
      },
      validRows,
    };
  }

  private feeKey(
    branch: string,
    admission: string,
    year: string,
    term: TermType,
  ): string {
    return `${branch.toLowerCase()}::${admission}::${year}::${term}`;
  }
}