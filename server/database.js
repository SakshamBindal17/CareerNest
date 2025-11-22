require('dotenv').config();
const { Pool } = require('pg');

// The 'pg' library automatically uses the DATABASE_URL environment variable
// if it's available. The connection string from Neon includes the necessary
// `sslmode=require` parameter, so no extra SSL config is needed here.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool: pool // <-- ADD THIS LINE
};