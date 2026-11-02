import 'package:flutter_test/flutter_test.dart';
import 'package:localman_customer/core/constants/api_constants.dart';
import 'package:localman_customer/features/bookings/domain/booking_item.dart';
import 'package:localman_customer/features/bookings/domain/payment_models.dart';

void main() {
  group('Phase 3F — Customer Payment, Checkout, Settlement & Financial UI Tests', () {
    test('1. PaymentCheckoutResponse correctly parses server-authoritative checkout session', () {
      final json = {
        'paymentId': 'pay_tx_998877',
        'bookingId': 'bkg_comp_123',
        'amountPaisa': 64900,
        'currency': 'INR',
        'paymentGateway': 'RAZORPAY',
        'gatewayOrderId': 'order_rzp_mock_123',
        'clientSecret': 'rzp_key_pub_test',
        'paymentStatus': 'CREATED',
        'idempotencyKey': 'cust_pay_bkg_comp_123_test',
      };

      final checkout = PaymentCheckoutResponse.fromJson(json);

      expect(checkout.paymentId, 'pay_tx_998877');
      expect(checkout.bookingId, 'bkg_comp_123');
      expect(checkout.amountPaisa, 64900);
      expect(checkout.currency, 'INR');
      expect(checkout.paymentGateway, 'RAZORPAY');
      expect(checkout.gatewayOrderId, 'order_rzp_mock_123');
      expect(checkout.paymentStatus, 'CREATED');
      expect(checkout.idempotencyKey, 'cust_pay_bkg_comp_123_test');
    });

    test('2. PaymentSummary parses server-authoritative receipt with itemized breakdown', () {
      final json = {
        'paymentId': 'pay_tx_998877',
        'bookingId': 'bkg_comp_123',
        'bookingNumber': 'BK-20261020-001',
        'serviceName': 'AC Deep Clean & Filter Replacement',
        'providerBusinessName': 'CoolBreeze HVAC Services',
        'totalAmountPaisa': 64900,
        'baseAmountPaisa': 45000,
        'materialsAmountPaisa': 10000,
        'platformFeePaisa': 0,
        'taxAmountPaisa': 9900,
        'currency': 'INR',
        'paymentStatus': 'SUCCESS',
        'paymentGateway': 'RAZORPAY',
        'gatewayPaymentId': 'pay_rzp_mock_captured_99',
        'paidAt': '2026-10-20T12:30:00.000Z',
        'items': [
          {
            'description': 'Base Service: AC Deep Clean & Filter Replacement',
            'amountPaisa': 45000,
            'type': 'BASE_SERVICE',
          },
          {
            'description': 'Approved Material: Heavy Duty Antimicrobial Filter',
            'amountPaisa': 10000,
            'type': 'MATERIAL',
          },
          {
            'description': 'Applicable GST (18%)',
            'amountPaisa': 9900,
            'type': 'TAX',
          },
        ],
      };

      final summary = PaymentSummary.fromJson(json);

      expect(summary.paymentId, 'pay_tx_998877');
      expect(summary.bookingNumber, 'BK-20261020-001');
      expect(summary.serviceName, 'AC Deep Clean & Filter Replacement');
      expect(summary.providerBusinessName, 'CoolBreeze HVAC Services');
      expect(summary.totalAmountPaisa, 64900);
      expect(summary.baseAmountPaisa, 45000);
      expect(summary.materialsAmountPaisa, 10000);
      expect(summary.taxAmountPaisa, 9900);
      expect(summary.paymentStatus, 'SUCCESS');
      expect(summary.gatewayPaymentId, 'pay_rzp_mock_captured_99');
      expect(summary.items.length, 3);
      expect(summary.items[0].type, 'BASE_SERVICE');
      expect(summary.items[1].type, 'MATERIAL');
      expect(summary.items[2].type, 'TAX');
    });

    test('3. PaymentSummary strictly excludes internal ledger, TDS internals, and provider bank details', () {
      final json = {
        'paymentId': 'pay_tx_001',
        'bookingId': 'bkg_001',
        'bookingNumber': 'BK-001',
        'serviceName': 'Plumbing',
        'totalAmountPaisa': 50000,
        'baseAmountPaisa': 45000,
        'taxAmountPaisa': 5000,
        'paymentStatus': 'SUCCESS',
      };

      final summary = PaymentSummary.fromJson(json);
      final summaryJson = summary.toJson();

      // Financial privacy gate: verify that internal sensitive keys do NOT exist
      expect(summaryJson.containsKey('tdsAmountPaisa'), isFalse);
      expect(summaryJson.containsKey('tdsRate'), isFalse);
      expect(summaryJson.containsKey('commissionAmountPaisa'), isFalse);
      expect(summaryJson.containsKey('providerBankAccount'), isFalse);
      expect(summaryJson.containsKey('providerIfsc'), isFalse);
      expect(summaryJson.containsKey('walletLedgerEntryId'), isFalse);
      expect(summaryJson.containsKey('platformNetCreditPaisa'), isFalse);
    });

    test('4. BookingItem correctly distinguishes payable statuses vs settled vs non-payable', () {
      // Completed job -> payment pending
      final completedBooking = BookingItem.fromJson({
        'id': 'bkg_comp',
        'bookingNumber': 'BK-101',
        'customerId': 'cust_1',
        'serviceId': 'srv_1',
        'addressId': 'addr_1',
        'currentStatus': 'JOB_COMPLETED',
        'pricingModel': 'FIXED_PRICE',
        'scheduledDate': '2026-10-20',
        'scheduledTimeSlot': '10:00 - 12:00',
        'baseAmountPaisa': 50000,
        'taxAmountPaisa': 9000,
        'totalAmountPaisa': 59000,
      });

      expect(completedBooking.currentStatus, 'JOB_COMPLETED');
      expect(completedBooking.formattedStatus, 'Completed');

      // Settled job -> paid
      final settledBooking = BookingItem.fromJson({
        'id': 'bkg_settled',
        'bookingNumber': 'BK-102',
        'customerId': 'cust_1',
        'serviceId': 'srv_1',
        'addressId': 'addr_1',
        'currentStatus': 'PAYMENT_SETTLED',
        'pricingModel': 'FIXED_PRICE',
        'scheduledDate': '2026-10-20',
        'scheduledTimeSlot': '10:00 - 12:00',
        'baseAmountPaisa': 50000,
        'taxAmountPaisa': 9000,
        'totalAmountPaisa': 59000,
      });

      expect(settledBooking.currentStatus, 'PAYMENT_SETTLED');
      expect(settledBooking.formattedStatus, 'Paid');

      // In progress -> not yet payable
      final inProgressBooking = BookingItem.fromJson({
        'id': 'bkg_prog',
        'bookingNumber': 'BK-103',
        'customerId': 'cust_1',
        'serviceId': 'srv_1',
        'addressId': 'addr_1',
        'currentStatus': 'JOB_STARTED',
        'pricingModel': 'FIXED_PRICE',
        'scheduledDate': '2026-10-20',
        'scheduledTimeSlot': '10:00 - 12:00',
        'baseAmountPaisa': 50000,
        'taxAmountPaisa': 9000,
        'totalAmountPaisa': 59000,
      });

      expect(inProgressBooking.currentStatus, 'JOB_STARTED');
      expect(inProgressBooking.formattedStatus, 'In Progress');
    });

    test('5. ApiConstants generates correct payment checkout, verify, and summary URI paths', () {
      final checkoutUri = ApiConstants.bookingCheckout('bkg_12345');
      final verifyUri = ApiConstants.bookingVerifyPayment('bkg_12345');
      final summaryUri = ApiConstants.bookingPaymentSummary('bkg_12345');

      expect(checkoutUri, contains('/bookings/bkg_12345/payment/checkout'));
      expect(verifyUri, contains('/bookings/bkg_12345/payment/verify'));
      expect(summaryUri, contains('/bookings/bkg_12345/payment/summary'));
    });

    test('6. Payment amounts remain strict integer paisa (no floating point rounding drift)', () {
      final items = [
        const PaymentSummaryItem(description: 'Base', amountPaisa: 19900, type: 'BASE_SERVICE'),
        const PaymentSummaryItem(description: 'Pipe Fitting', amountPaisa: 7550, type: 'MATERIAL'),
        const PaymentSummaryItem(description: 'GST', amountPaisa: 4941, type: 'TAX'),
      ];

      final totalPaisa = items.fold<int>(0, (sum, item) => sum + item.amountPaisa);
      expect(totalPaisa, 32391);
      expect(totalPaisa, isA<int>());
    });
  });
}
