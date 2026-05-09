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
    // Stage 1: field-level validation
    const stage1 = parsedRows.map((r) => ({
      rowNumber: r.rowNumber,
      raw: r.values,
      result: validateAndNormalise(r.values),
    }));

    // Stage 2: intra-file duplicate detection
    const keyCount = new Map<string, number>();
    for (const s of stage1) {
      if (s.result.ok) {
        const k = this.feeKey(
          s.result.value.admissionNumber,
          s.result.value.academicYear,
          s.result.value.term,
        );
        keyCount.set(k, (keyCount.get(k) ?? 0) + 1);
      }
    }

    // Stage 3: single query to find any already-existing fees
    const passingRows = stage1
      .filter((s) => s.result.ok)
      .map((s) => (s.result as { ok: true; value: NormalisedRow }).value);

    const existing = await this.feesService.findExistingByKeys(
      tenantId,
      branch,
      passingRows.map((r) => ({
        admissionNumber: r.admissionNumber,
        academicYear: r.academicYear,
      })),
    );

    const existingSet = new Set(
      existing.map((e) =>
        this.feeKey(e.admissionNumber, e.academicYear, e.term),
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

      const v = s.result.value;
      const errors: string[] = [];
      const key = this.feeKey(v.admissionNumber, v.academicYear, v.term);

      if ((keyCount.get(key) ?? 0) > 1) {
        errors.push(
          `Duplicate within file: ${v.term} for admission ${v.admissionNumber} (${v.academicYear}) appears more than once`,
        );
      }

      const isTermExists = existingSet.has(key);
      if (isTermExists) {
        errors.push(
          `${v.term} already exists for admission ${v.admissionNumber} (${v.academicYear})`,
        );
      }

      if (errors.length) {
        return {
          rowNumber: s.rowNumber,
          status: RowStatus.ERROR,
          message: errors.join('; '),
          isTermExists,
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
      .map((s) => (s.result as { ok: true; value: NormalisedRow }).value);

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

  private feeKey(admission: string, year: string, term: TermType): string {
    return `${admission}::${year}::${term}`;
  }
}