import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Payment } from './entities/payment.entity';
import { Transaction } from './entities/transaction.entity';
import { PaymentAuditLog } from './entities/payment-audit-log.entity';
import { Fee } from '../fees/entities/fee.entity';
import { PaymentAuditService } from './payment-audit.service';
import { PaymentGatewayFactory } from './gateways/payment-gateway.factory';
import { RazorpayGateway } from './gateways/razorpay.gateway';
import { CashfreeGateway } from './gateways/cashfree.gateway';
import { WebhookVerificationService } from './webhooks/webhook-verification.service';
import { WebhookHandlerService } from './webhooks/webhook-handler.service';
import { WebhookGatewayDetectorService } from './webhooks/webhook-gateway-detector.service';
import { UnifiedWebhookService } from './webhooks/unified-webhook.service';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, Transaction, PaymentAuditLog, Fee])],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentAuditService,
    PaymentGatewayFactory,
    RazorpayGateway,
    CashfreeGateway,
    WebhookVerificationService,
    WebhookHandlerService,
    WebhookGatewayDetectorService,
    UnifiedWebhookService,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
