// server/emailService.js
require('dotenv').config();
const nodemailer = require('nodemailer');

// Create the "transporter" (the thing that sends the email)
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: true, // Use SSL (port 465)
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Utility: produce a plain-text fallback from HTML
const stripHtml = (html) => {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ') // remove tags
    .replace(/&nbsp;/gi, ' ') // common entity
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim();
};

/**
 * Flexible email sender. Supports two call styles:
 * 1. sendEmail(to, subject, plainText, html)
 * 2. sendEmail(to, subject, htmlOnly)  // where htmlOnly contains tags
 * If style (2) is used, we auto-detect HTML and build a plain-text fallback.
 */
const sendEmail = async (to, subject, textOrHtml, html) => {
  try {
    let text = textOrHtml;
    let finalHtml = html;

    // Auto-detect if third argument is actually HTML and html arg missing
    const looksLikeHtml = /<\/?[a-z][^>]*>/i.test(textOrHtml) && !html;
    if (looksLikeHtml) {
      finalHtml = textOrHtml;
      text = stripHtml(textOrHtml);
    }

    await transporter.sendMail({
      from: `"CareerNest" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html: finalHtml,
    });
    console.log(`Email sent successfully to ${to}`);
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send email');
  }
};

module.exports = { sendEmail };