// server/emailService.js
require('dotenv').config();
const nodemailer = require('nodemailer');
const dns = require('dns');

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const SMTP_HOST = process.env.EMAIL_HOST;
const SMTP_PORT = Number(process.env.EMAIL_PORT || 465);
const SMTP_USER = process.env.EMAIL_USER;
const SMTP_PASS = process.env.EMAIL_PASS;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || SMTP_USER;
const SMTP_FORCE_IPV4 = parseBoolean(process.env.EMAIL_FORCE_IPV4, true);
const SMTP_SECURE =
  process.env.EMAIL_SECURE === undefined
    ? SMTP_PORT === 465
    : parseBoolean(process.env.EMAIL_SECURE);
const SMTP_REQUIRE_TLS = parseBoolean(process.env.EMAIL_REQUIRE_TLS, !SMTP_SECURE);

const createTransporter = ({ port, secure, requireTLS }) => {
  const lookup = SMTP_FORCE_IPV4
    ? (hostname, options, callback) => dns.lookup(hostname, { family: 4 }, callback)
    : undefined;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure,
    requireTLS,
    lookup,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    connectionTimeout: Number(process.env.EMAIL_CONNECTION_TIMEOUT_MS || 20000),
    greetingTimeout: Number(process.env.EMAIL_GREETING_TIMEOUT_MS || 15000),
    socketTimeout: Number(process.env.EMAIL_SOCKET_TIMEOUT_MS || 30000),
  });
};

// Primary transporter follows environment configuration.
const primaryTransporter = createTransporter({
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  requireTLS: SMTP_REQUIRE_TLS,
});

// Fallback for Gmail-like SMTP when SSL(465) is blocked in hosted environments.
const fallbackTransporter = createTransporter({
  port: 587,
  secure: false,
  requireTLS: true,
});

const sendViaResend = async ({ to, subject, text, html }) => {
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    throw new Error('Resend is not configured');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `CareerNest <${RESEND_FROM_EMAIL}>`,
      to: [to],
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend failed (${response.status}): ${body}`);
  }
};

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

    const mailOptions = {
      from: `"CareerNest" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html: finalHtml,
    };

    try {
      await primaryTransporter.sendMail(mailOptions);
    } catch (error) {
      const isGmailHost = /gmail\.com$/i.test(SMTP_HOST || '');
      const isConnectionFailure = ['ETIMEDOUT', 'ECONNREFUSED', 'ESOCKET'].includes(error.code);
      const canUseFallback = isGmailHost && SMTP_PORT !== 587 && isConnectionFailure;
      const canUseResendFallback = Boolean(RESEND_API_KEY && RESEND_FROM_EMAIL && isConnectionFailure);

      if (canUseFallback) {
        console.warn(
          `Primary SMTP failed (${error.code}). Retrying with STARTTLS on 587 for ${SMTP_HOST}...`
        );

        try {
          await fallbackTransporter.sendMail(mailOptions);
          return;
        } catch (fallbackError) {
          if (!canUseResendFallback) {
            throw fallbackError;
          }

          console.warn(
            `SMTP fallback failed (${fallbackError.code || 'UNKNOWN'}). Retrying via Resend API...`
          );
          await sendViaResend(mailOptions);
          return;
        }
      }

      if (canUseResendFallback) {
        console.warn(`Primary SMTP failed (${error.code}). Retrying via Resend API...`);
        await sendViaResend(mailOptions);
        return;
      }

      throw error;
    }

    console.log(`Email sent successfully to ${to}`);
  } catch (error) {
    console.error('Error sending email:', {
      code: error.code,
      command: error.command,
      message: error.message,
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
    });
    throw new Error('Failed to send email');
  }
};

module.exports = { sendEmail };