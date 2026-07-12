import React from 'react';
import { Link } from 'react-router-dom';

export default function TermsPage() {
  return (
    <div className="terms-page">
      {/* ===================== NAV ===================== */}
      <header className="nav">
        <div className="nav__inner">
          <Link to="/" aria-label="Jigzo home">
            <img className="nav__logo" src="/assets/JIGZO-Logo-Black.png" alt="JIGZO" />
          </Link>
          <Link className="btn btn-ghost" to="/create">Create your reveal</Link>
        </div>
      </header>

      <main className="terms-container" style={{ maxWidth: 800, margin: "40px auto 80px", padding: "0 24px", fontFamily: "Archia, sans-serif", lineHeight: 1.7 }}>
        <h1 style={{ fontWeight: 300, fontSize: "clamp(32px, 5vw, 48px)", letterSpacing: "-0.02em", marginBottom: 8 }}>Terms &amp; Conditions</h1>
        <div className="terms-meta" style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: "#A67C3D", marginBottom: 30 }}>Last Updated: July 2026</div>

        <h2>Welcome to JIGZO</h2>
        <p>Thank you for using JIGZO.</p>
        <p>JIGZO is a digital platform that allows users to create personalized puzzle experiences that reveal hidden messages, photos, and memories.</p>
        <p>By accessing or using JIGZO, you agree to these Terms &amp; Conditions. If you do not agree, please do not use the Service.</p>

        <h2>1. Eligibility</h2>
        <p>You must be at least 18 years old or have permission from a parent or legal guardian to use JIGZO.</p>
        <p>By placing an order, you confirm that you have the legal capacity to enter into this agreement.</p>

        <h2>2. Our Service</h2>
        <p>JIGZO allows users to:</p>
        <ul>
          <li>Create personalized digital puzzles</li>
          <li>Upload photos</li>
          <li>Write custom messages</li>
          <li>Send puzzle links to recipients</li>
          <li>Receive puzzle completion insights (where available)</li>
        </ul>
        <p>JIGZO provides the platform only and does not create, edit, or monitor every piece of user-generated content.</p>

        <h2>3. User Responsibilities</h2>
        <p>You agree that all information you provide is accurate.</p>
        <p>You are responsible for:</p>
        <ul>
          <li>Photos you upload</li>
          <li>Messages you write</li>
          <li>Recipient names</li>
          <li>Recipient phone numbers</li>
          <li>Ensuring you have permission to use uploaded content</li>
        </ul>
        <p>You are responsible for correcting any mistakes before placing your order.</p>

        <h2>4. Acceptable Use</h2>
        <p>You agree NOT to use JIGZO for:</p>
        <ul>
          <li>Harassment</li>
          <li>Bullying</li>
          <li>Threats</li>
          <li>Hate speech</li>
          <li>Illegal activities</li>
          <li>Copyright infringement</li>
          <li>Sexual or explicit material</li>
          <li>Defamation</li>
          <li>Spam</li>
          <li>Fraud</li>
          <li>Malware or harmful links</li>
        </ul>
        <p>JIGZO reserves the right to refuse service, suspend accounts, or remove content that violates these rules.</p>

        <h2>5. Intellectual Property</h2>
        <p>You retain ownership of the content you upload.</p>
        <p>By uploading content, you grant JIGZO a temporary license solely to:</p>
        <ul>
          <li>Store</li>
          <li>Process</li>
          <li>Display</li>
          <li>Deliver</li>
        </ul>
        <p>your content for the purpose of providing the Service.</p>
        <p>This license automatically ends when your uploaded content is permanently deleted from our systems.</p>
        <p>All JIGZO branding, logos, software, website design, animations, graphics, and source code remain the property of JIGZO.</p>

        <h2>6. Temporary Storage</h2>
        <p>To protect your privacy:</p>
        <p>Photos, puzzle data, and messages are stored only for the time necessary to provide the Service.</p>
        <p>Unless required by law or for fraud investigations, uploaded content is automatically deleted after the applicable retention period.</p>
        <p>Deleted content cannot be recovered.</p>

        <h2>7. Delivery</h2>
        <p>JIGZO attempts to deliver puzzle links promptly.</p>
        <p>Delivery depends on third-party services including:</p>
        <ul>
          <li>Internet providers</li>
          <li>WhatsApp</li>
          <li>Mobile networks</li>
          <li>Device compatibility</li>
        </ul>
        <p>JIGZO cannot guarantee immediate delivery in every circumstance.</p>

        <h2>8. Recipient Privacy</h2>
        <p>JIGZO respects the privacy of both senders and recipients.</p>
        <p>If a recipient contacts JIGZO requesting the identity of the sender, JIGZO will not disclose that information except where legally required.</p>

        <h2>9. Payments</h2>
        <p>Payments are processed securely by trusted third-party payment providers.</p>
        <p>JIGZO never stores your complete payment card details.</p>
        <p>Prices displayed at checkout include any applicable charges shown before payment.</p>

        <h2>10. Refund Policy</h2>
        <p>Because every JIGZO is personalized, orders generally cannot be cancelled or refunded after creation has started.</p>
        <p>If a technical problem caused solely by JIGZO prevents successful delivery, we will investigate and may offer:</p>
        <ul>
          <li>a replacement,</li>
          <li>a correction,</li>
          <li>or a refund,</li>
        </ul>
        <p>at our discretion.</p>

        <h2>11. Service Availability</h2>
        <p>We strive to provide uninterrupted service.</p>
        <p>However, maintenance, technical failures, or third-party outages may occasionally affect availability.</p>

        <h2>12. Limitation of Liability</h2>
        <p>JIGZO is not responsible for:</p>
        <ul>
          <li>Emotional reactions to messages</li>
          <li>Relationship disputes</li>
          <li>Incorrect recipient details entered by the sender</li>
          <li>Device compatibility issues</li>
          <li>Network failures</li>
          <li>Delays caused by third-party services</li>
        </ul>
        <p>To the maximum extent permitted by applicable law, JIGZO's liability is limited to the amount paid for the affected order.</p>

        <h2>13. Fraud Prevention</h2>
        <p>JIGZO may suspend or permanently block users suspected of:</p>
        <ul>
          <li>Fraud</li>
          <li>Payment abuse</li>
          <li>Repeated misuse</li>
          <li>Illegal activity</li>
        </ul>

        <h2>14. Law Enforcement</h2>
        <p>Where required by law, court order, or other legal process, JIGZO may disclose information to the appropriate authorities.</p>

        <h2>15. Changes</h2>
        <p>We may update these Terms from time to time.</p>
        <p>The latest version will always be published on our website.</p>

        <h2>16. Contact</h2>
        <p>Questions about these Terms may be sent to: <a href="mailto:info@jigzo.biz">info@jigzo.biz</a></p>

        <hr style={{ border: "none", borderTop: "1px solid rgba(28,25,19,0.15)", margin: "60px 0 40px" }} />

        <h1 style={{ fontWeight: 300, fontSize: "clamp(32px, 5vw, 48px)", letterSpacing: "-0.02em", marginBottom: 8 }}>Privacy Policy</h1>
        <div className="terms-meta" style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: "#A67C3D", marginBottom: 30 }}>Last Updated: July 2026</div>

        <h2>Your Privacy Matters</h2>
        <p>JIGZO is built around personal memories.</p>
        <p>Protecting those memories is one of our highest priorities.</p>
        <p>This Privacy Policy explains what information we collect, why we collect it, and how we protect it.</p>

        <h2>Information We Collect</h2>
        <p>When you create a JIGZO, we may collect:</p>
        <p><strong>Sender information:</strong></p>
        <ul>
          <li>Name</li>
          <li>Email address</li>
          <li>Phone number</li>
        </ul>
        <p><strong>Recipient information:</strong></p>
        <ul>
          <li>Name</li>
          <li>Phone number</li>
        </ul>
        <p><strong>Puzzle content:</strong></p>
        <ul>
          <li>Uploaded photos</li>
          <li>Personal messages</li>
        </ul>
        <p><strong>Technical information:</strong></p>
        <ul>
          <li>Browser type</li>
          <li>Device information</li>
          <li>IP address</li>
          <li>Country (derived from IP, if applicable)</li>
          <li>Usage analytics</li>
          <li>Puzzle interaction events (for example, when a puzzle is opened or completed)</li>
        </ul>
        <p><strong>Payment information:</strong></p>
        <p>Payments are securely processed by third-party providers. JIGZO does not store complete payment card details.</p>

        <h2>Why We Collect Information</h2>
        <p>We use your information to:</p>
        <ul>
          <li>Create puzzles</li>
          <li>Deliver puzzle links</li>
          <li>Process payments</li>
          <li>Provide customer support</li>
          <li>Prevent fraud</li>
          <li>Improve the platform</li>
          <li>Generate anonymous service analytics</li>
        </ul>

        <h2>Temporary Photo Storage</h2>
        <p>Uploaded photos are stored temporarily. They are automatically deleted after the applicable retention period unless a longer period is required by law. Deleted photos cannot be restored.</p>

        <h2>Permanent Records</h2>
        <p>For legal, accounting, fraud prevention, customer support, and loyalty features, JIGZO may retain limited information such as:</p>
        <ul>
          <li>Sender name</li>
          <li>Sender email</li>
          <li>Sender phone number</li>
          <li>Purchase history</li>
          <li>Order dates</li>
          <li>Puzzle statistics</li>
        </ul>
        <p>This allows features like: <em>"You've created 17 unforgettable moments."</em> without retaining the uploaded photos or messages.</p>

        <h2>Sharing Information</h2>
        <p>We do not sell your personal information. We may share information only with trusted providers that help us operate JIGZO, such as:</p>
        <ul>
          <li>Payment providers</li>
          <li>WhatsApp delivery services</li>
          <li>Website hosting providers</li>
          <li>Analytics providers</li>
        </ul>
        <p>They may access only the information necessary to provide their services.</p>

        <h2>Recipient Privacy</h2>
        <p>Recipient information is used only to deliver the puzzle experience. We do not use recipient contact information for marketing without consent.</p>

        <h2>Cookies</h2>
        <p>JIGZO may use cookies to:</p>
        <ul>
          <li>Keep the website functioning</li>
          <li>Improve performance</li>
          <li>Understand visitor behavior</li>
          <li>Enhance the user experience</li>
        </ul>

        <h2>Data Security</h2>
        <p>We use reasonable administrative, technical, and organizational measures to help protect your information. However, no internet transmission or electronic storage method can be guaranteed to be completely secure.</p>

        <h2>Your Rights</h2>
        <p>Depending on applicable laws where you live, you may have rights to:</p>
        <ul>
          <li>Access your information</li>
          <li>Correct inaccurate information</li>
          <li>Request deletion (subject to legal obligations)</li>
          <li>Object to certain processing</li>
          <li>Withdraw consent where applicable</li>
        </ul>
        <p>To exercise these rights, contact us at: <a href="mailto:info@jigzo.biz">info@jigzo.biz</a></p>

        <h2>Children's Privacy</h2>
        <p>JIGZO is not intended for children under 13. We do not knowingly collect personal information from children under 13.</p>

        <h2>International Users</h2>
        <p>Your information may be processed in countries different from your own.</p>
        <p>By using JIGZO, you understand that your information may be transferred and processed where our service providers operate, subject to applicable legal safeguards.</p>

        <h2>Policy Updates</h2>
        <p>We may update this Privacy Policy from time to time. The latest version will always appear on our website.</p>

        <h2>Contact</h2>
        <p>For privacy-related questions, contact: <a href="mailto:info@jigzo.biz">info@jigzo.biz</a></p>
      </main>
    </div>
  );
}
