// server/s3Service.js
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const REGION = process.env.AWS_REGION;
const BUCKET = process.env.S3_BUCKET;

const s3 = new S3Client({
  region: REGION,
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  } : undefined,
});

const randomId = () => Math.random().toString(36).slice(2);

/**
 * Upload a local file (from multer temp path) to S3 under the given prefix.
 * Returns the S3 URI (s3://bucket/key)
 */
async function uploadFileFromPath(localPath, keyPrefix = 'career-nest/verification-proofs', originalName = '') {
  const basename = originalName || path.basename(localPath);
  const key = `${keyPrefix}/${Date.now()}-${randomId()}-${basename}`;
  const fileStream = fs.createReadStream(localPath);

  const put = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: fileStream,
  });
  await s3.send(put);
  return `s3://${BUCKET}/${key}`;
}

/**
 * Generate a presigned GET URL for a given s3://bucket/key URI or raw key.
 */
async function getPresignedGetUrl(s3UriOrKey, expiresInSec = 300) {
  const { bucket, key } = parseS3Uri(s3UriOrKey);
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn: expiresInSec });
}

function parseS3Uri(s3UriOrKey) {
  if (s3UriOrKey.startsWith('s3://')) {
    const without = s3UriOrKey.replace('s3://', '');
    const firstSlash = without.indexOf('/');
    const bucket = without.slice(0, firstSlash);
    const key = without.slice(firstSlash + 1);
    return { bucket, key };
  }
  return { bucket: BUCKET, key: s3UriOrKey };
}

module.exports = { uploadFileFromPath, getPresignedGetUrl, parseS3Uri };
