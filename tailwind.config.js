/** Build the local stylesheet (replaces the slow cdn.tailwindcss.com script) - see README step 4 */
module.exports = {
  content: ['./index.html', './auth.js', './js/**/*.js'],
  theme: { extend: { colors: {
    brand: { 50: '#fff7ed', 100: '#ffedd5', 500: '#f97316', 600: '#ea580c', 700: '#c2410c' },
    robotGrey: { 800: '#1e293b', 900: '#0f172a', 950: '#020617' } } } },
  plugins: [],
};
