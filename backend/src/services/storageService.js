const mongoose = require('mongoose');
const { GridFSBucket, ObjectId } = require('mongodb');
const { Readable } = require('stream');

let bucket;

/**
 * Resolves the GridFSBucket instance on the primary mongoose connection.
 * @returns {GridFSBucket}
 */
function getBucket() {
  if (bucket) return bucket;
  if (!mongoose.connection || !mongoose.connection.db) {
    throw new Error('[StorageService] Primary database connection is not active.');
  }
  bucket = new GridFSBucket(mongoose.connection.db, {
    bucketName: 'puzzle_images'
  });
  return bucket;
}

/**
 * Saves a binary image buffer into MongoDB GridFS.
 *
 * @param {Buffer} buffer - The image file buffer.
 * @param {object} metadata
 * @param {string} metadata.filename - File name for storage.
 * @param {string} metadata.contentType - Image mime-type.
 * @param {string} metadata.publicId - Puzzle publicId.
 * @returns {Promise<ObjectId>} The generated GridFS file ObjectId.
 */
async function saveImage(buffer, { filename, contentType, publicId }) {
  const b = getBucket();
  return new Promise((resolve, reject) => {
    const uploadStream = b.openUploadStream(filename, {
      contentType: contentType,
      metadata: {
        originalSize: buffer.length,
        createdAt: new Date(),
        publicId: publicId
      }
    });

    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);

    readable.pipe(uploadStream)
      .on('error', reject)
      .on('finish', () => {
        resolve(uploadStream.id);
      });
  });
}

/**
 * Returns a readable stream for a GridFS image.
 *
 * @param {string|ObjectId} storageId - The GridFS file ID.
 * @returns {import('stream').Readable}
 */
function getImageStream(storageId) {
  const b = getBucket();
  return b.openDownloadStream(new ObjectId(storageId));
}

/**
 * Deletes an image from GridFS.
 *
 * @param {string|ObjectId} storageId - The GridFS file ID.
 * @returns {Promise<void>}
 */
async function deleteImage(storageId) {
  const b = getBucket();
  await b.delete(new ObjectId(storageId));
}

module.exports = {
  saveImage,
  getImageStream,
  deleteImage
};
