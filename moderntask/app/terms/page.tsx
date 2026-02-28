import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" size="sm" asChild className="mb-6 -ml-2 text-muted-foreground hover:text-foreground">
            <Link href="/">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Back to Dashboard
            </Link>
          </Button>
          <h1 className="text-4xl font-bold text-foreground mb-2">Terms of Service</h1>
          <p className="text-muted-foreground">Last updated: November 19, 2025</p>
        </div>

        {/* Content card */}
        <div className="bg-card border border-border rounded-xl shadow-sm p-8 space-y-8 text-sm leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">
              By accessing and using Meridian's AI-powered lead generation platform ("Service"), you accept and agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Description of Service</h2>
            <p className="text-muted-foreground mb-3">
              Meridian provides an automated platform for B2B lead research, qualification, and outreach. The Service uses artificial intelligence to:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-muted-foreground">
              <li>Search for potential business leads using third-party data providers</li>
              <li>Research and analyze company information</li>
              <li>Qualify leads based on your targeting criteria</li>
              <li>Generate personalized email content</li>
              <li>Send and track email campaigns</li>
              <li>Provide analytics and performance insights</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. User Accounts</h2>
            <p className="text-muted-foreground mb-3">You must create an account to use the Service. You agree to:</p>
            <ul className="list-disc pl-6 space-y-1.5 text-muted-foreground">
              <li>Provide accurate and complete registration information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Promptly update your account information if it changes</li>
              <li>Accept responsibility for all activities under your account</li>
              <li>Notify us immediately of any unauthorized access</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Acceptable Use Policy</h2>
            <p className="text-muted-foreground mb-3">You agree NOT to use the Service to:</p>
            <ul className="list-disc pl-6 space-y-1.5 text-muted-foreground">
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
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Compliance Requirements</h2>
            <p className="text-muted-foreground mb-3">
              You are responsible for ensuring your use of the Service complies with all applicable laws, including but not limited to:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-muted-foreground">
              <li><span className="font-medium text-foreground">CAN-SPAM Act (USA)</span> — Commercial email requirements</li>
              <li><span className="font-medium text-foreground">CASL (Canada)</span> — Anti-spam legislation</li>
              <li><span className="font-medium text-foreground">GDPR (EU)</span> — Data protection regulations (if applicable)</li>
              <li><span className="font-medium text-foreground">CCPA (California)</span> — Consumer privacy rights</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              Violation of these laws may result in immediate termination of your account without refund.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Third-Party Services</h2>
            <p className="text-muted-foreground mb-3">
              Meridian integrates with third-party services (Apollo.io, OpenAI, Mailgun, etc.). You acknowledge that:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-muted-foreground">
              <li>You must comply with each third-party service's terms of service</li>
              <li>We are not responsible for third-party service availability or performance</li>
              <li>API rate limits and costs may apply based on usage</li>
              <li>You must maintain your own API keys and credentials</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Pricing and Payment</h2>
            <div className="space-y-4 text-muted-foreground">
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">7.1 Subscription Plans</h3>
                <p>Service fees are based on your selected plan and usage tier. You agree to pay all fees on time, provide valid payment information, maintain up-to-date billing details, and accept responsibility for third-party API costs.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">7.2 Billing Cycle</h3>
                <p>Subscriptions are billed monthly or annually. Payment is due at the beginning of each billing period. Failure to pay may result in service suspension or termination.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">7.3 Auto-Renewal</h3>
                <p>Your subscription automatically renews at the end of each billing period unless you cancel before the renewal date. You can cancel at any time through your account settings.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">7.4 Payment Processing</h3>
                <p>Payments are processed securely through Stripe. We do not store your full credit card information on our servers.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">7.5 Refund Policy</h3>
                <p>All fees are non-refundable except as required by law or at our sole discretion. No prorated refunds are issued for mid-cycle cancellations.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">7.6 Failed Payments</h3>
                <p>If a payment fails, we will retry up to three times. If all attempts fail, your account may be suspended until payment is received.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">7.7 Price Changes</h3>
                <p>We reserve the right to change pricing with 30 days' advance notice. You may cancel your subscription before the price change takes effect.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">7.8 Taxes</h3>
                <p>All fees are exclusive of applicable taxes. You are responsible for paying all taxes associated with your purchase.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">7.9 Disputed Charges</h3>
                <p>If you believe you have been incorrectly charged, notify us within 30 days. Chargeback disputes may result in immediate account suspension.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">8. Intellectual Property</h2>
            <p className="text-muted-foreground">
              Meridian and its original content, features, and functionality are owned by us and protected by international copyright, trademark, and other intellectual property laws. You may not copy, modify, distribute, or reverse engineer any part of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">9. Data Ownership</h2>
            <p className="text-muted-foreground">
              You retain ownership of your company data, lead lists, and email content. By using the Service, you grant us a limited license to process your data to provide the Service. We do not sell or share your data with third parties except as necessary to operate the platform (see Privacy Policy).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">10. Disclaimers and Limitations</h2>
            <p className="font-semibold text-foreground mb-3">THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND.</p>
            <ul className="list-disc pl-6 space-y-1.5 text-muted-foreground mb-3">
              <li>We do not guarantee specific results, lead quality, or response rates</li>
              <li>AI-generated content may contain errors or inaccuracies</li>
              <li>Email deliverability depends on many factors outside our control</li>
              <li>Third-party service outages may affect platform functionality</li>
              <li>We are not liable for damages resulting from use of the Service</li>
            </ul>
            <p className="text-muted-foreground">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR LIABILITY IS LIMITED TO THE AMOUNT YOU PAID FOR THE SERVICE IN THE PAST 12 MONTHS.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">11. Indemnification</h2>
            <p className="text-muted-foreground">
              You agree to indemnify and hold harmless Meridian from any claims, damages, losses, or expenses (including legal fees) arising from your use of the Service, violation of these Terms, or infringement of any third-party rights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">12. Termination</h2>
            <p className="text-muted-foreground mb-3">
              We may suspend or terminate your account at any time for violations of these Terms, suspected fraud, or at our discretion. Upon termination:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-muted-foreground">
              <li>Your access to the Service will cease immediately</li>
              <li>We may delete your data after a reasonable retention period</li>
              <li>No refunds will be provided for partial billing periods</li>
              <li>You remain liable for any outstanding fees</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">13. Changes to Terms</h2>
            <p className="text-muted-foreground">
              We reserve the right to modify these Terms at any time. We will notify users of material changes via email or platform notification. Continued use of the Service after changes indicates acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">14. Governing Law</h2>
            <p className="text-muted-foreground">
              These Terms are governed by the laws of New York, without regard to conflict of law principles. Any disputes shall be resolved in the courts of New York.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">15. Contact Information</h2>
            <p className="text-muted-foreground mb-3">For questions about these Terms, please contact us at:</p>
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium text-foreground">Meridian Legal Team</p>
              <p className="text-muted-foreground">Email: legal@getmeridian.ai</p>
              <p className="text-muted-foreground">Address: 35 S Village Dr, 13035, NY</p>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <Link href="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
          {' · '}
          <Link href="/" className="hover:text-foreground transition-colors">
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
