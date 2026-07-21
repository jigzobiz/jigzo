const fs = require('fs');
const path = require('path');

class ImageService {
  /**
   * Saves a base64 encoded crop image data string as a local file.
   * @param {string} base64Data
   * @param {string} publicId
   * @returns {Promise<string>} Static asset URL route for the saved image.
   */
  async saveCropImage(base64Data, publicId) {
    if (!base64Data || !base64Data.startsWith('data:image')) {
      throw new Error('Invalid image format. Expected base64 image data.');
    }

    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error('Could not parse base64 image content.');
    }

    const ext = matches[1].split('/')[1] || 'jpg';
    const buffer = Buffer.from(matches[2], 'base64');

    const storagePath = process.env.IMAGE_STORAGE_PATH || './uploads';

    // Ensure upload directory exists
    if (!fs.existsSync(storagePath)) {
      fs.mkdirSync(storagePath, { recursive: true });
    }

    const filename = `${publicId}.${ext}`;
    const filePath = path.join(storagePath, filename);

    await fs.promises.writeFile(filePath, buffer);
    console.log(`[ImageService] Saved uploaded file to ${filePath}`);

    // Return the relative URL path
    return `/uploads/${filename}`;
  }
}

module.exports = new ImageService();
