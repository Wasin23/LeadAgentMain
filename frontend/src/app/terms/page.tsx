'use client';

import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 mb-6"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to Dashboard
          </Link>
          
          <h1 className="text-4xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
            Terms of Service
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            Last updated: November 19, 2025
          </p>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 p-8 space-y-8">
          
          <section>
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              1. Acceptance of Terms
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
              By accessing and using Meridian's AI-powered lead generation platform ("Service"), you accept and agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              2. Description of Service
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
              Meridian provides an automated platform for B2B lead research, qualification, and outreach. The Service uses artificial intelligence to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-neutral-700 dark:text-neutral-300 leading-relaxed mt-4">
              <li>Search for potential business leads using third-party data providers</li>
              <li>Research and analyze company information</li>
              <li>Qualify leads based on your targeting criteria</li>
              <li>Generate personalized email content</li>
              <li>Send and track email campaigns</li>
              <li>Provide analytics and performance insights</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              3. User Accounts
            </h2>
            <div className="space-y-4 text-neutral-700 dark:text-neutral-300 leading-relaxed">
              <p>
                You must create an account to use the Service. You agree to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide accurate and complete registration information</li>
                <li>Maintain the security of your account credentials</li>
                <li>Promptly update your account information if it changes</li>
                <li>Accept responsibility for all activities under your account</li>
                <li>Notify us immediately of any unauthorized access</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              4. Acceptable Use Policy
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
              You agree NOT to use the Service to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-neutral-700 dark:text-neutral-300 leading-relaxed">
              <li>Send spam, unsolicited bulk emails, or deceptive messages</li>
              <li>Violate any applicable laws, including CAN-SPAM, CASL, or anti-spam regulations</li>
              <li>Harvest or scrape data without proper authorization</li>
              <li>Impersonate others or misrepresent your identity</li>
              <li>Distribute malware, viruses, or harmful code</li>
              <li>Interfere with the Service's security or infrastructure</li>
              <li>Use the Service for illegal, fraudulent, or malicious purposes</li>
              <li>Target individuals who have opted out of communications</li>
              <li>Send emails to purchased or non-permissioned contact lists</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              5. Compliance Requirements
            </h2>
            <div className="space-y-4 text-neutral-700 dark:text-neutral-300 leading-relaxed">
              <p>You are responsible for ensuring your use of the Service complies with all applicable laws, including but not limited to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>CAN-SPAM Act (USA)</strong> - Commercial email requirements</li>
                <li><strong>CASL (Canada)</strong> - Anti-spam legislation</li>
                <li><strong>GDPR (EU)</strong> - Data protection regulations (if applicable)</li>
                <li><strong>CCPA (California)</strong> - Consumer privacy rights</li>
              </ul>
              <p className="mt-4">
                Violation of these laws may result in immediate termination of your account without refund.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              6. Third-Party Services
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
              Meridian integrates with third-party services (Apollo.io, OpenAI, Mailgun, etc.). You acknowledge that:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-neutral-700 dark:text-neutral-300 leading-relaxed mt-4">
              <li>You must comply with each third-party service's terms of service</li>
              <li>We are not responsible for third-party service availability or performance</li>
              <li>API rate limits and costs may apply based on usage</li>
              <li>You must maintain your own API keys and credentials</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              7. Pricing and Payment
            </h2>
            <div className="space-y-4 text-neutral-700 dark:text-neutral-300 leading-relaxed">
              <p>
                Service fees are based on your selected plan and usage. You agree to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Pay all fees associated with your account on time</li>
                <li>Provide valid payment information</li>
                <li>Accept that fees are non-refundable except as required by law</li>
                <li>Be responsible for API usage costs from third-party providers</li>
              </ul>
              <p className="mt-4">
                We reserve the right to change pricing with 30 days' notice to active users.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              8. Intellectual Property
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
              Meridian and its original content, features, and functionality are owned by us and are protected by international copyright, trademark, and other intellectual property laws. You may not copy, modify, distribute, or reverse engineer any part of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              9. Data Ownership
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
              You retain ownership of your company data, lead lists, and email content. By using the Service, you grant us a limited license to process your data to provide the Service. We do not sell or share your data with third parties except as necessary to operate the platform (see Privacy Policy).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              10. Disclaimers and Limitations
            </h2>
            <div className="space-y-4 text-neutral-700 dark:text-neutral-300 leading-relaxed">
              <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND.
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>We do not guarantee specific results, lead quality, or response rates</li>
                <li>AI-generated content may contain errors or inaccuracies</li>
                <li>Email deliverability depends on many factors outside our control</li>
                <li>Third-party service outages may affect platform functionality</li>
                <li>We are not liable for damages resulting from use of the Service</li>
              </ul>
              <p className="mt-4">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR LIABILITY IS LIMITED TO THE AMOUNT YOU PAID FOR THE SERVICE IN THE PAST 12 MONTHS.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              11. Indemnification
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
              You agree to indemnify and hold harmless Meridian from any claims, damages, losses, or expenses (including legal fees) arising from your use of the Service, violation of these Terms, or infringement of any third-party rights.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              12. Termination
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
              We may suspend or terminate your account at any time for violations of these Terms, suspected fraud, or at our discretion. You may cancel your account at any time through account settings. Upon termination:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-neutral-700 dark:text-neutral-300 leading-relaxed mt-4">
              <li>Your access to the Service will cease immediately</li>
              <li>We may delete your data after a reasonable retention period</li>
              <li>No refunds will be provided for partial billing periods</li>
              <li>You remain liable for any outstanding fees</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              13. Changes to Terms
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
              We reserve the right to modify these Terms at any time. We will notify users of material changes via email or platform notification. Continued use of the Service after changes indicates acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              14. Governing Law
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
              These Terms are governed by the laws of [Your Jurisdiction], without regard to conflict of law principles. Any disputes shall be resolved in the courts of [Your Jurisdiction].
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              15. Contact Information
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
              For questions about these Terms, please contact us at:
            </p>
            <div className="mt-4 p-4 bg-neutral-100 dark:bg-neutral-700 rounded-lg">
              <p className="text-neutral-900 dark:text-neutral-100 font-medium">Meridian Legal Team</p>
              <p className="text-neutral-700 dark:text-neutral-300">Email: legal@meridian.com</p>
              <p className="text-neutral-700 dark:text-neutral-300">Address: [Your Company Address]</p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-neutral-600 dark:text-neutral-400">
          <Link href="/privacy" className="hover:text-neutral-900 dark:hover:text-neutral-100">
            Privacy Policy
          </Link>
          {' '} | {' '}
          <Link href="/" className="hover:text-neutral-900 dark:hover:text-neutral-100">
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
