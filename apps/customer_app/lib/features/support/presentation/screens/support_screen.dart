import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

class SupportScreen extends StatelessWidget {
  const SupportScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Customer Support'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppTheme.brandPrimary,
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.headset_mic_outlined, color: AppTheme.brandAccent, size: 28),
                      SizedBox(width: 12),
                      Text(
                        'LocalMan Care',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: 10),
                  Text(
                    'We are here to help you 7 days a week from 7:00 AM to 10:00 PM.',
                    style: TextStyle(color: Colors.white70, fontSize: 13, height: 1.4),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            const Text(
              'Direct Assistance',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppTheme.brandPrimary),
            ),
            const SizedBox(height: 12),

            _SupportCard(
              icon: Icons.phone_in_talk_outlined,
              title: 'Customer Helpline',
              subtitle: '1800-LOCAL-MAN (Toll Free)',
            ),
            const SizedBox(height: 10),
            _SupportCard(
              icon: Icons.email_outlined,
              title: 'Email Support',
              subtitle: 'support@localman.in',
            ),
            const SizedBox(height: 10),
            _SupportCard(
              icon: Icons.security_outlined,
              title: 'Safety & Grievance Officer',
              subtitle: 'grievance@localman.in',
            ),

            const SizedBox(height: 28),

            const Text(
              'Frequently Asked Questions',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppTheme.brandPrimary),
            ),
            const SizedBox(height: 12),

            _FaqTile(
              question: 'How does LocalMan verify service pros?',
              answer: 'All professionals on LocalMan undergo mandatory Aadhaar verification, police background screening, and skill evaluation before taking jobs.',
            ),
            _FaqTile(
              question: 'When is the service start OTP required?',
              answer: 'When your assigned professional reaches your doorstep, share the 6-digit start OTP visible on your booking screen to formally begin the job.',
            ),
            _FaqTile(
              question: 'How do extra material payments work?',
              answer: 'If parts or materials are required, the provider submits an itemized quote in their partner app. You approve and pay before any purchase is finalized.',
            ),
          ],
        ),
      ),
    );
  }
}

class _SupportCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;

  const _SupportCard({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Row(
        children: [
          Icon(icon, color: AppTheme.brandPrimary, size: 24),
          const SizedBox(width: 14),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
              const SizedBox(height: 2),
              Text(subtitle, style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
            ],
          ),
        ],
      ),
    );
  }
}

class _FaqTile extends StatelessWidget {
  final String question;
  final String answer;

  const _FaqTile({required this.question, required this.answer});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: ExpansionTile(
        title: Text(
          question,
          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
        ),
        childrenPadding: const EdgeInsets.only(left: 16, right: 16, bottom: 16),
        children: [
          Text(
            answer,
            style: TextStyle(color: Colors.grey.shade700, fontSize: 13, height: 1.4),
          ),
        ],
      ),
    );
  }
}
