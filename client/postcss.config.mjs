// Note: Having both postcss.config.js and postcss.config.mjs can be confusing.
// Next.js will typically pick the .js file. We mirror the same plugins here to avoid mismatches.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    autoprefixer: {},
  },
};

export default config;
