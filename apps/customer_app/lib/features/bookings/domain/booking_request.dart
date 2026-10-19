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

  const CreateBookingRequest({
    required this.serviceId,
    required this.addressId,
    required this.jobDescription,
    required this.scheduledDate,
    required this.scheduledTimeSlot,
    required this.pricingModel,
    this.hours,
    this.customerNotes,
    this.attachments,
    this.idempotencyKey,
  });

  Map<String, dynamic> toJson() => {
        'serviceId': serviceId,
        'addressId': addressId,
        'jobDescription': jobDescription,
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
