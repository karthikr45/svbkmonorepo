import { Injectable } from '@nestjs/common';

@Injectable()
export class DashboardService {
  async getSummary(_tenantId: string, _role: string): Promise<any> {
    // TODO: aggregate key metrics (total fees, paid, pending, overdue) — tenantId from JWT
    throw new Error('Not implemented');
  }

  async getRecentActivity(_tenantId: string): Promise<any[]> {
    // TODO: implement
    throw new Error('Not implemented');
  }

  async getChartData(_tenantId: string, _type: string): Promise<any> {
    // TODO: implement — return data for charts
    throw new Error('Not implemented');
  }
}
