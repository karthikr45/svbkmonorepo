import { Injectable } from '@nestjs/common';

@Injectable()
export class ReportsService {
  async getFeeCollectionReport(_tenantId: string, _filters: any): Promise<any> {
    // TODO: implement — tenantId from JWT
    throw new Error('Not implemented');
  }

  async getOutstandingFeesReport(_tenantId: string, _filters: any): Promise<any> {
    // TODO: implement
    throw new Error('Not implemented');
  }

  async getPaymentSummaryReport(_tenantId: string, _filters: any): Promise<any> {
    // TODO: implement
    throw new Error('Not implemented');
  }

  async exportReport(_tenantId: string, _type: string, _filters: any): Promise<Buffer> {
    // TODO: implement — export as PDF/Excel
    throw new Error('Not implemented');
  }
}
