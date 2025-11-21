'use client';

import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

export default function PrivacyPolicyPage() {
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
            Privacy Policy
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            Last updated: November 19, 2025
          </p>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 p-8 space-y-8">
          
          <section>
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              1. Introduction
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
              Meridian ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered lead generation and outreach platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              2. Information We Collect
            </h2>
            <div className="space-y-4 text-neutral-700 dark:text-neutral-300 leading-relaxed">
              <div>
                <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Account Information</h3>
                <p>When you create an account, we collect your username, email address, and encrypted password.</p>
              </div>
              
              <div>
                <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Company Profile</h3>
                <p>You provide company information including name, industry, services, website, contact details, and marketing materials.</p>
              </div>
              
              <div>
                <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Lead Data</h3>
                <p>Our platform processes lead information you obtain through third-party services, including names, email addresses, companies, and job titles.</p>
              </div>
              
              <div>
                <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Email Communications</h3>
                <p>We track email opens, clicks, and replies to provide analytics and improve your outreach campaigns.</p>
              </div>
              
              <div>
                <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Usage Data</h3>
                <p>We collect information about how you interact with our platform, including API usage, feature engagement, and performance metrics.</p>
              </div>
              
              <div>
                <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Payment Information</h3>
                <p>When you subscribe to our service, we collect billing information including your name, billing address, and payment method details. Credit card information is processed and stored securely by our payment processor (Stripe) and is not stored on our servers. We retain transaction history, invoice details, and subscription status for accounting and legal compliance purposes.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              3. How We Use Your Information
            </h2>
            <ul className="list-disc pl-6 space-y-2 text-neutral-700 dark:text-neutral-300 leading-relaxed">
              <li>Provide and maintain our AI-powered lead research and email automation services</li>
              <li>Generate personalized email content using GPT-4</li>
              <li>Search for and qualify leads based on your targeting criteria</li>
              <li>Track email engagement and provide analytics</li>
              <li>Process payments, manage your subscription, and send billing notifications</li>
              <li>Generate invoices and maintain transaction records for tax and accounting purposes</li>
              <li>Detect and prevent fraudulent transactions or unauthorized access</li>
              <li>Send important service updates, security notifications, and subscription reminders</li>
              <li>Improve our platform through usage analytics</li>
              <li>Comply with legal obligations including tax reporting and financial regulations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              4. Third-Party Services
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
              Meridian integrates with the following third-party services. Each service has its own privacy policy:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-neutral-700 dark:text-neutral-300 leading-relaxed">
              <li><strong>OpenAI (GPT-4)</strong> - AI-powered email generation and lead qualification</li>
              <li><strong>Apollo.io</strong> - Lead search and contact data enrichment</li>
              <li><strong>Mailgun</strong> - Email delivery and tracking infrastructure</li>
              <li><strong>Serper</strong> - Company research and web search</li>
              <li><strong>Amazon Web Services (AWS)</strong> - Cloud hosting and data storage</li>
              <li><strong>Zilliz</strong> - Vector database for tracking and analytics</li>
              <li><strong>Stripe</strong> - Secure payment processing and subscription management (your payment card details are not stored on our servers)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              5. Data Storage and Security
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
              Your data is stored securely using AWS DynamoDB and Zilliz cloud databases with encryption at rest and in transit. We implement industry-standard security measures including JWT authentication, HTTPS encryption, and regular security audits. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              6. Data Retention
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
              We retain your data for as long as your account is active or as needed to provide services. You can request deletion of your account and associated data at any time through your account settings. Some data may be retained for legal or legitimate business purposes even after account deletion.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              7. Your Rights
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
              You have the right to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-neutral-700 dark:text-neutral-300 leading-relaxed">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Export your data in a portable format</li>
              <li>Opt-out of marketing communications</li>
              <li>Object to automated decision-making</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              8. CAN-SPAM Compliance
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
              All emails sent through Meridian include:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-neutral-700 dark:text-neutral-300 leading-relaxed mt-4">
              <li>Accurate sender information</li>
              <li>Clear subject lines</li>
              <li>Your physical business address</li>
              <li>An unsubscribe link</li>
              <li>Prompt processing of opt-out requests (within 10 business days)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              9. Cookies and Tracking
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
              We use cookies and similar tracking technologies to maintain your session, remember preferences, and analyze platform usage. Email tracking pixels are embedded in outbound emails to track opens and engagement.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              10. Changes to This Policy
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of material changes by email or through a prominent notice on our platform. Your continued use of Meridian after changes indicates acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              11. Contact Us
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
              If you have questions about this Privacy Policy or how we handle your data, please contact us at:
            </p>
            <div className="mt-4 p-4 bg-neutral-100 dark:bg-neutral-700 rounded-lg">
              <p className="text-neutral-900 dark:text-neutral-100 font-medium">Meridian Privacy Team</p>
              <p className="text-neutral-700 dark:text-neutral-300">Email: privacy@meridian.com</p>
              <p className="text-neutral-700 dark:text-neutral-300">Address: [Your Company Address]</p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-neutral-600 dark:text-neutral-400">
          <Link href="/terms" className="hover:text-neutral-900 dark:hover:text-neutral-100">
            Terms of Service
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
