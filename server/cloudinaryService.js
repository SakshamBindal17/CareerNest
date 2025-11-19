// server/cloudinaryService.js
const cloudinary = require('cloudinary').v2;
const path = require('path');
require('dotenv').config();

// Configuration using environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Uploads a file (image or pdf) to Cloudinary.
 * @param {string} filePath - Path to the temporary file saved by multer.
 * @param {string} folder - The folder name in Cloudinary.
 * @returns {Promise<string>} The secure URL of the uploaded file.
 */
const uploadFile = async (filePath, folder, originalName = '', mimeType = '') => {
  try {
    // Prefer mimetype to determine resource type
    const ext = path.extname(originalName || filePath).toLowerCase();
    const type = (mimeType || '').toLowerCase();

    let resourceType = 'auto';
    if (type === 'application/pdf' || ext === '.pdf') resourceType = 'raw';
    else if (type.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) resourceType = 'image';

    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: resourceType,
      use_filename: true,
      unique_filename: true,
      ...(originalName ? { filename_override: originalName } : {}),
    });
    return result.secure_url;
  } catch (error) {
    console.error('Cloudinary Upload Error:', error);
    // --- THIS IS THE FIX ---
    throw new Error('Failed to upload file. Please try again later.');
    // --- END OF FIX ---
  }
};

module.exports = { uploadFile };