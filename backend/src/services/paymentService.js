/**
 * Mock Payment Service Interface for JIGZO.
 * Under production this will integrate with Stripe, PayPal, or similar providers.
 */
class PaymentService {
  /**
   * Generates a mock checkout session link.
   * @param {string} orderId 
   * @param {number} total 
   * @param {string} currency 
   * @returns {Promise<{checkoutUrl: string, reference: string}>}
   */
  async createCheckout(orderId, total, currency = 'USD') {
    console.log(`[PaymentService] Creating checkout session for Order: ${orderId}, Total: ${currency}${total}`);
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Return a mock checkout page url and reference ID
    return {
      checkoutUrl: `https://checkout.mock-payment.com/pay/${orderId}?amount=${total}`,
      reference: `ref_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  /**
   * Simulates webhook signature verification.
   * @param {string} bodyPayload 
   * @param {string} signatureHeader 
   * @returns {boolean}
   */
  verifyWebhook(bodyPayload, signatureHeader) {
    console.log(`[PaymentService] Verifying webhook signature...`);
    const secret = process.env.PAYMENT_WEBHOOK_SECRET || 'mock_webhook_secret_key';
    // Mock successful verification
    return signatureHeader === `sha256=${secret}`;
  }
}

module.exports = new PaymentService();
