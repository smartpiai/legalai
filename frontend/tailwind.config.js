/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './src/pages/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
    './src/layouts/**/*.{js,ts,jsx,tsx}',
    './index.html',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xsm": "375px",
        "xsm": "425px", 
        "sm": "640px",
        "md": "768px",
        "lg": "1024px",
        "xl": "1280px",
        "2xl": "1536px",
        "3xl": "2000px",
      },
    },
    extend: {
      fontFamily: {
        outfit: ['Outfit', 'sans-serif'],
      },
      fontSize: {
        'title-2xl': ['72px', '90px'],
        'title-xl': ['60px', '72px'],
        'title-lg': ['48px', '60px'],
        'title-md': ['36px', '44px'],
        'title-sm': ['30px', '38px'],
        'theme-xl': ['20px', '30px'],
        'theme-sm': ['14px', '20px'],
        'theme-xs': ['12px', '18px'],
      },
      colors: {
        brand: {
          25: '#f2f7ff',
          50: '#ecf3ff',
          100: '#dde9ff',
          200: '#c2d6ff',
          300: '#9cb9ff',
          400: '#7592ff',
          500: '#465fff',
          600: '#3641f5',
          700: '#2a31d8',
          800: '#252dae',
          900: '#262e89',
          950: '#161950',
        },
        success: {
          25: '#f6fef9',
          50: '#ecfdf3',
          100: '#d1fadf',
          200: '#a6f4c5',
          300: '#6ce9a6',
          400: '#32d583',
          500: '#12b76a',
          600: '#039855',
          700: '#027a48',
          800: '#05603a',
          900: '#054f31',
          950: '#053321',
        },
        error: {
          25: '#fffbfa',
          50: '#fef3f2',
          100: '#fee4e2',
          200: '#fecdca',
          300: '#fda29b',
          400: '#f97066',
          500: '#f04438',
          600: '#d92d20',
          700: '#b42318',
          800: '#912018',
          900: '#7a271a',
          950: '#55160c',
        },
        warning: {
          25: '#fffcf5',
          50: '#fffaeb',
          100: '#fef0c7',
          200: '#fedf89',
          300: '#fec84b',
          400: '#fdb022',
          500: '#f79009',
          600: '#dc6803',
          700: '#b54708',
          800: '#93370d',
          900: '#7a2e0e',
          950: '#4e1d09',
        },
      },
      safelist: [
        // Typography
        'text-title-2xl', 'text-title-xl', 'text-title-lg', 'text-title-md', 'text-title-sm',
        'text-theme-xl', 'text-theme-sm', 'text-theme-xs',
        'font-outfit',
        
        // Brand Colors
        'bg-brand-25', 'bg-brand-50', 'bg-brand-100', 'bg-brand-200', 'bg-brand-300',
        'bg-brand-400', 'bg-brand-500', 'bg-brand-600', 'bg-brand-700', 'bg-brand-800',
        'bg-brand-900', 'bg-brand-950',
        'text-brand-25', 'text-brand-50', 'text-brand-100', 'text-brand-200', 'text-brand-300',
        'text-brand-400', 'text-brand-500', 'text-brand-600', 'text-brand-700', 'text-brand-800',
        'text-brand-900', 'text-brand-950',
        'border-brand-300', 'border-brand-500',
        
        // Success Colors
        'bg-success-50', 'bg-success-500', 'bg-success-600',
        'text-success-500', 'text-success-600', 'text-success-700',
        'border-success-300', 'border-success-500',
        
        // Error Colors  
        'bg-error-50', 'bg-error-500', 'bg-error-600',
        'text-error-500', 'text-error-600', 'text-error-700',
        'border-error-200', 'border-error-300', 'border-error-500',
        
        // Warning Colors
        'bg-warning-50', 'bg-warning-500', 'bg-warning-600',
        'text-warning-500', 'text-warning-600',
        'border-warning-300', 'border-warning-500',
        
        // Shadows
        'shadow-theme-xs', 'shadow-theme-sm', 'shadow-theme-md', 'shadow-theme-lg', 'shadow-theme-xl',
        
        // Focus States
        'focus:ring-brand-500', 'focus:ring-brand-500/20', 'focus:border-brand-300',
        'focus:ring-success-500', 'focus:ring-error-500', 'focus:ring-warning-500',
        'ring-brand-500/20', 'ring-opacity-50',
        
        // Hover States
        'hover:bg-brand-600', 'hover:text-brand-600', 'hover:bg-gray-100',
        
        // Dark Mode Classes
        'dark:bg-gray-900', 'dark:text-white/90', 'dark:border-gray-700',
        'dark:bg-white/5', 'dark:text-gray-400', 'dark:hover:text-gray-300',
      ],
      boxShadow: {
        'theme-xs': 'var(--shadow-theme-xs)',
        'theme-sm': 'var(--shadow-theme-sm)',
        'theme-md': 'var(--shadow-theme-md)',
        'theme-lg': 'var(--shadow-theme-lg)',
        'theme-xl': 'var(--shadow-theme-xl)',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
