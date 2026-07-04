import React, { useState } from 'react';
import ThemedBackground from './ThemedBackground';

interface LegalPagesProps {
  page: 'terms' | 'privacy';
  onClose: () => void;
}

const LAST_UPDATED = 'June 3, 2026';
const OWNER = 'Colin Zappia';
const EMAIL = 'hello@topcheesehockey.com';
const SITE = 'topcheesehockey.com';
const APP = 'Top Cheese Hockey';

const TermsContent = () => (
  <div className="space-y-8 text-slate-300 text-sm leading-relaxed">
    <p>These Terms of Service govern your use of {APP} (the "Service"), operated by {OWNER} ("I", "me", or "my"), a sole proprietor based in Canada. By accessing or using the Service, you agree to be bound by these terms.</p>

    <section>
      <h3 className="text-white font-black text-base uppercase tracking-wider mb-3">1. Description of Service</h3>
      <p>{APP} is a web-based hockey analytics platform that provides live game tracking, roster management, AI-powered tactical insights, and game summary report generation for hockey coaches and team staff.</p>
    </section>

    <section>
      <h3 className="text-white font-black text-base uppercase tracking-wider mb-3">2. Subscriptions & Billing</h3>
      <p className="mb-2">The Service is offered on a subscription basis with the following plans: Basic ($9.99/month), Pro ($14.99/month), and Team ($29.99/month for up to 5 users).</p>
      <p className="mb-2">All new subscriptions include a 7-day free trial. You will not be charged during the trial period. After the trial ends, your chosen subscription fee will be billed automatically on a monthly basis.</p>
      <p className="mb-2">Payments are processed securely by Stripe. I do not store your credit card information.</p>
      <p>Subscription fees are non-refundable except where required by applicable Canadian law. You may cancel your subscription at any time and will retain access until the end of your current billing period.</p>
    </section>

    <section>
      <h3 className="text-white font-black text-base uppercase tracking-wider mb-3">3. Acceptable Use</h3>
      <p className="mb-2">You agree to use the Service only for lawful purposes and in accordance with these Terms. You agree not to:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li>Share your account credentials with unauthorized users</li>
        <li>Attempt to reverse engineer, copy, or redistribute the Service</li>
        <li>Use the Service to transmit harmful, offensive, or illegal content</li>
        <li>Attempt to gain unauthorized access to any part of the Service</li>
        <li>Use automated tools to scrape or extract data from the Service</li>
      </ul>
    </section>

    <section>
      <h3 className="text-white font-black text-base uppercase tracking-wider mb-3">4. Intellectual Property</h3>
      <p>All content, features, and functionality of the Service — including but not limited to the software, design, text, graphics, and logos — are owned by {OWNER} and are protected by applicable Canadian and international intellectual property laws. You may not reproduce, distribute, or create derivative works without my express written permission.</p>
    </section>

    <section>
      <h3 className="text-white font-black text-base uppercase tracking-wider mb-3">5. AI-Generated Content</h3>
      <p>The Service uses artificial intelligence to generate tactical insights, roster data, and game summaries. These are provided for informational and coaching purposes only. I make no warranties regarding the accuracy, completeness, or fitness for any particular purpose of AI-generated content. You are solely responsible for any decisions made based on this content.</p>
    </section>

    <section>
      <h3 className="text-white font-black text-base uppercase tracking-wider mb-3">6. Disclaimer of Warranties</h3>
      <p>The Service is provided "as is" and "as available" without any warranties of any kind, either express or implied. I do not warrant that the Service will be uninterrupted, error-free, or free of viruses or other harmful components.</p>
    </section>

    <section>
      <h3 className="text-white font-black text-base uppercase tracking-wider mb-3">7. Limitation of Liability</h3>
      <p>To the fullest extent permitted by applicable law, {OWNER} shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of the Service, even if advised of the possibility of such damages.</p>
    </section>

    <section>
      <h3 className="text-white font-black text-base uppercase tracking-wider mb-3">8. Changes to Terms</h3>
      <p>I reserve the right to modify these Terms at any time. I will notify you of significant changes by email or by posting a notice on the Service. Your continued use of the Service after changes take effect constitutes your acceptance of the revised Terms.</p>
    </section>

    <section>
      <h3 className="text-white font-black text-base uppercase tracking-wider mb-3">9. Governing Law</h3>
      <p>These Terms are governed by and construed in accordance with the laws of Canada and the province of Ontario. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the courts of Ontario, Canada.</p>
    </section>

    <section>
      <h3 className="text-white font-black text-base uppercase tracking-wider mb-3">10. Contact</h3>
      <p>For any questions about these Terms, please contact me at <a href={`mailto:${EMAIL}`} className="text-cyan-400 hover:text-cyan-300">{EMAIL}</a>.</p>
    </section>
  </div>
);

const PrivacyContent = () => (
  <div className="space-y-8 text-slate-300 text-sm leading-relaxed">
    <p>This Privacy Policy explains how {OWNER}, operating {APP} at {SITE} ("I", "me", or "my"), collects, uses, and protects your personal information. This policy complies with Canada's Personal Information Protection and Electronic Documents Act (PIPEDA).</p>

    <section>
      <h3 className="text-white font-black text-base uppercase tracking-wider mb-3">1. Information I Collect</h3>
      <p className="mb-2"><strong className="text-white">Account Information:</strong> When you create an account, I collect your name, email address, and password (managed securely by Clerk).</p>
      <p className="mb-2"><strong className="text-white">Payment Information:</strong> Subscription payments are processed by Stripe. I do not store your credit card number, expiry date, or CVV. Stripe may retain billing information as per their own privacy policy.</p>
      <p className="mb-2"><strong className="text-white">Usage Data:</strong> I may collect information about how you use the Service, including game events logged, features used, and session duration, for the purpose of improving the Service.</p>
      <p><strong className="text-white">Game Data:</strong> Roster information, game events, and tactical notes you enter into the Service are stored to provide the Service's functionality.</p>
    </section>

    <section>
      <h3 className="text-white font-black text-base uppercase tracking-wider mb-3">2. How I Use Your Information</h3>
      <ul className="list-disc pl-5 space-y-1">
        <li>To provide, maintain, and improve the Service</li>
        <li>To process your subscription and send billing-related communications</li>
        <li>To send important notices about the Service</li>
        <li>To respond to your support requests</li>
        <li>To detect and prevent fraud or abuse</li>
      </ul>
    </section>

    <section>
      <h3 className="text-white font-black text-base uppercase tracking-wider mb-3">3. Third-Party Services</h3>
      <p className="mb-2">I use the following trusted third-party services to operate {APP}:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong className="text-white">Clerk</strong> — User authentication and account management</li>
        <li><strong className="text-white">Stripe</strong> — Payment processing and subscription management</li>
        <li><strong className="text-white">Google Gemini</strong> — AI-powered features (roster parsing, tactical insights)</li>
        <li><strong className="text-white">Vercel</strong> — Hosting and infrastructure</li>
      </ul>
      <p className="mt-2">Each of these services has their own privacy policy governing how they handle your data.</p>
    </section>

    <section>
      <h3 className="text-white font-black text-base uppercase tracking-wider mb-3">4. Data Sharing</h3>
      <p>I do not sell, trade, or rent your personal information to third parties. I may share information only in the following circumstances:</p>
      <ul className="list-disc pl-5 space-y-1 mt-2">
        <li>With service providers listed above, solely to operate the Service</li>
        <li>When required by law or to respond to legal process</li>
        <li>To protect the rights, property, or safety of {OWNER} or others</li>
      </ul>
    </section>

    <section>
      <h3 className="text-white font-black text-base uppercase tracking-wider mb-3">5. Data Retention</h3>
      <p>I retain your personal information for as long as your account is active or as needed to provide the Service. If you cancel your subscription and delete your account, I will delete your personal data within 30 days, except where retention is required by law.</p>
    </section>

    <section>
      <h3 className="text-white font-black text-base uppercase tracking-wider mb-3">6. Your Rights (PIPEDA)</h3>
      <p className="mb-2">Under PIPEDA, you have the right to:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li>Access the personal information I hold about you</li>
        <li>Request correction of inaccurate information</li>
        <li>Withdraw consent for collection or use of your information</li>
        <li>File a complaint with the Office of the Privacy Commissioner of Canada</li>
      </ul>
      <p className="mt-2">To exercise any of these rights, contact me at <a href={`mailto:${EMAIL}`} className="text-cyan-400 hover:text-cyan-300">{EMAIL}</a>.</p>
    </section>

    <section>
      <h3 className="text-white font-black text-base uppercase tracking-wider mb-3">7. Security</h3>
      <p>I take reasonable measures to protect your personal information from unauthorized access, use, or disclosure. All data is transmitted over encrypted HTTPS connections. However, no method of transmission over the internet is 100% secure.</p>
    </section>

    <section>
      <h3 className="text-white font-black text-base uppercase tracking-wider mb-3">8. Children's Privacy</h3>
      <p>The Service is not directed at children under the age of 13. I do not knowingly collect personal information from children. If you believe a child has provided me with personal information, please contact me and I will delete it promptly.</p>
    </section>

    <section>
      <h3 className="text-white font-black text-base uppercase tracking-wider mb-3">9. Changes to This Policy</h3>
      <p>I may update this Privacy Policy from time to time. I will notify you of significant changes by email or by posting a notice on the Service. Your continued use of the Service after changes take effect constitutes your acceptance of the revised policy.</p>
    </section>

    <section>
      <h3 className="text-white font-black text-base uppercase tracking-wider mb-3">10. Contact</h3>
      <p>For privacy-related questions or concerns, please contact me at <a href={`mailto:${EMAIL}`} className="text-cyan-400 hover:text-cyan-300">{EMAIL}</a>.</p>
    </section>
  </div>
);

const LegalPages: React.FC<LegalPagesProps> = ({ page, onClose }) => {
  return (
    <div className="fixed inset-0 z-[500] overflow-y-auto">
    <ThemedBackground className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="px-6 py-5 flex items-center justify-between border-b border-white/10 bg-black/30 backdrop-blur-sm shrink-0">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            {page === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Last updated: {LAST_UPDATED} · {APP}</p>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors text-lg font-bold"
        >×</button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 sm:px-12 py-8 max-w-3xl mx-auto w-full">
        {page === 'terms' ? <TermsContent /> : <PrivacyContent />}
        <div className="mt-10 pt-6 border-t border-white/10 text-center">
          <p className="text-slate-600 text-xs">© 2026 {APP} · {OWNER} · <a href={`mailto:${EMAIL}`} className="text-cyan-400 hover:text-cyan-300">{EMAIL}</a></p>
        </div>
      </div>
    </ThemedBackground>
    </div>
  );
};

export default LegalPages;
