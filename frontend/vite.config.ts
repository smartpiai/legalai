import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath, URL } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  // Load environment variables from .env files
  const env = loadEnv(mode, path.resolve(__dirname, '../'), '')
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: env.FRONTEND_HOST || '0.0.0.0',
      port: parseInt(env.FRONTEND_PORT || '3000'),
      proxy: {
        '/api': {
          target: `http://${env.BACKEND_HOST || 'localhost'}:${env.BACKEND_PORT || '8000'}`,
          changeOrigin: true,
          secure: false,
          timeout: 30000,
        },
      },
    },
    define: {
      // Expose environment variables to the frontend (prefixed with VITE_)
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(
        env.VITE_API_BASE_URL || `http://${env.BACKEND_HOST || 'localhost'}:${env.BACKEND_PORT || '8000'}/api/v1`
      ),
      'import.meta.env.VITE_APP_NAME': JSON.stringify(
        env.VITE_APP_NAME || 'Legal AI Platform'
      ),
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(
        env.VERSION || '1.0.0'
      ),
      'import.meta.env.VITE_ENVIRONMENT': JSON.stringify(
        env.ENVIRONMENT || 'development'
      ),
      'import.meta.env.VITE_ENABLE_ANALYTICS': JSON.stringify(
        env.VITE_ENABLE_ANALYTICS || 'false'
      ),
    },
    build: {
      outDir: 'dist',
      sourcemap: env.ENVIRONMENT === 'development',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            router: ['react-router-dom'],
            ui: ['@headlessui/react', '@heroicons/react'],
          },
        },
      },
    },
  }
})
