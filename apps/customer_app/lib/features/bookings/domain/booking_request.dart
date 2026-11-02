class CreateBookingRequest {
  final String serviceId;
  final String addressId;
  final String jobDescription;
  final String scheduledDate;
  final String scheduledTimeSlot;
  final String pricingModel;
  final int? hours;
  final String? customerNotes;
  final List<String>? attachments;
  final String? idempotencyKey;

  CreateBookingRequest({
    required this.serviceId,
    required this.addressId,
    this.jobDescription = '',
    required dynamic scheduledDate,
    this.scheduledTimeSlot = '10:00 - 12:00',
    this.pricingModel = 'FIXED_PRICE',
    this.hours,
    this.customerNotes,
    this.attachments,
    this.idempotencyKey,
  }) : scheduledDate = scheduledDate is DateTime
            ? scheduledDate.toIso8601String()
            : scheduledDate.toString();

  Map<String, dynamic> toJson() => {
        'serviceId': serviceId,
        'addressId': addressId,
        if (jobDescription.isNotEmpty) 'jobDescription': jobDescription,
        'scheduledDate': scheduledDate,
        'scheduledTimeSlot': scheduledTimeSlot,
        'pricingModel': pricingModel,
        if (hours != null) 'hours': hours,
        if (customerNotes != null && customerNotes!.isNotEmpty)
          'customerNotes': customerNotes,
        if (attachments != null && attachments!.isNotEmpty)
          'attachments': attachments,
        if (idempotencyKey != null) 'idempotencyKey': idempotencyKey,
      };
}
