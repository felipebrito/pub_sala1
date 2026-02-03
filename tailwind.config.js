/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,tsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: '#020617',
                surface: '#0f172a',
                primary: '#f59e0b', // Amber-500
                accent: '#3b82f6', // Blue-500
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
