/**
 * Mock WhatsApp Service Interface for JIGZO.
 * Under production this will integrate with Meta's official WhatsApp Business Cloud API.
 */
class WhatsAppService {
  /**
   * Sends the unique puzzle completion link to a recipient.
   * @param {string} recipientPhone 
   * @param {string} publicId 
   * @param {string} senderName 
   * @returns {Promise<boolean>}
   */
  async sendPuzzle(recipientPhone, publicId, senderName) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const link = `${frontendUrl}/p/${publicId}`;
    console.log(`[WhatsAppService] Sending puzzle message to ${recipientPhone}:`);
    console.log(`----------------------------------------`);
    console.log(`Hey! ${senderName} sent you a JIGZO surprise puzzle!`);
    console.log(`Solve it here to reveal their personal message: ${link}`);
    console.log(`----------------------------------------`);
    return true;
  }

  /**
   * Alerts the sender that a recipient completed the puzzle.
   * @param {string} senderPhone 
   * @param {object} details { recipientName, durationSeconds, completedAt }
   * @returns {Promise<boolean>}
   */
  async sendRevealAlert(senderPhone, { recipientName, durationSeconds }) {
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;
    const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

    console.log(`[WhatsAppService] Sending Reveal Alert to Sender ${senderPhone}:`);
    console.log(`----------------------------------------`);
    console.log(`Reveal Alert! ${recipientName} has just completed your JIGZO puzzle!`);
    console.log(`It took them ${timeStr} to solve it.`);
    console.log(`----------------------------------------`);
    return true;
  }
}

module.exports = new WhatsAppService();
