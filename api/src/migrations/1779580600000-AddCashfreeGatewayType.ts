import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Widen the `tenant_configurations.gateway_type` Postgres enum to
 * accept 'cashfree' alongside 'razorpay'. The payment routing layer
 * (PaymentsService.resolveActiveGateway, PaymentGatewayFactory,
 * CashfreeGateway, unified webhook) already handles Cashfree end-to-end;
 * only this enum was preventing admins from selecting it.
 *
 * Postgres makes ALTER TYPE ADD VALUE idempotent only via IF NOT EXISTS
 * (PG 9.6+). Safe to re-run.
 */
export class AddCashfreeGatewayType1779580600000
  implements MigrationInterface
{
  name = 'AddCashfreeGatewayType1779580600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "tenant_configurations_gateway_type_enum" ADD VALUE IF NOT EXISTS 'cashfree'`,
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Postgres does not support removing a value from an enum. Leaving
    // 'cashfree' as a permitted value is harmless if no row uses it.
  }
}
