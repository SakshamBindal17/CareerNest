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

/**
 * Sends an email.
 * @param {string} to - The recipient's email address.
 * @param {string} subject - The subject line.
 * @param {string} text - The plain text body.
 * @param {string} html - The HTML body.
 */
const sendEmail = async (to, subject, text, html) => {
  try {
    await transporter.sendMail({
      from: `"CareerNest" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      text: text,
      html: html,
    });
    console.log(`Email sent successfully to ${to}`);
  } catch (error) {
    console.error('Error sending email:', error);
    // In a real app, you'd handle this error more gracefully
    throw new Error('Failed to send email');
  }
};

module.exports = { sendEmail };