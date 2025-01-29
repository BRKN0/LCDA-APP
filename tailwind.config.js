/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts,scss}",
    "./node_modules/@angular/material/**/*.js", // Ensure Material is included
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
