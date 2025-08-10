/**
 * Optimized Vite configuration with code splitting
 * Following TDD - GREEN phase: Enhanced build configuration
 */

import { defineConfig, loadEnv, splitVendorChunkPlugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import viteCompression from 'vite-plugin-compression';
import { VitePWA } from 'vite-plugin-pwa';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isDev = mode === 'development';
  const isProd = mode === 'production';
  
  return {
    plugins: [
      react(),
      
      // Split vendor chunks
      splitVendorChunkPlugin(),
      
      // PWA support with service worker
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
        manifest: {
          name: 'Legal AI Platform',
          short_name: 'LegalAI',
          theme_color: '#1f2937',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/api\./,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 // 24 hours
                }
              }
            }
          ]
        }
      }),
      
      // Compression
      viteCompression({
        algorithm: 'gzip',
        threshold: 10240, // 10KB
      }),
      
      viteCompression({
        algorithm: 'brotliCompress',
        threshold: 10240,
        ext: '.br',
      }),
      
      // Legacy browser support
      legacy({
        targets: ['defaults', 'not IE 11'],
        modernPolyfills: ['es.promise.finally', 'es/map', 'es/set'],
      }),
      
      // Bundle analyzer (only in build)
      isProd && visualizer({
        open: false,
        filename: 'dist/stats.html',
        gzipSize: true,
        brotliSize: true,
      }),
    ].filter(Boolean),
    
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@pages': path.resolve(__dirname, './src/pages'),
        '@utils': path.resolve(__dirname, './src/utils'),
        '@services': path.resolve(__dirname, './src/services'),
        '@store': path.resolve(__dirname, './src/store'),
        '@hooks': path.resolve(__dirname, './src/hooks'),
      },
    },
    
    build: {
      target: 'es2015',
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: isDev,
      minify: isProd ? 'terser' : false,
      
      terserOptions: {
        compress: {
          drop_console: isProd,
          drop_debugger: isProd,
          pure_funcs: isProd ? ['console.log', 'console.info'] : [],
        },
      },
      
      // Chunk size warnings
      chunkSizeWarningLimit: 500,
      
      rollupOptions: {
        output: {
          // Manual chunks for better caching
          manualChunks: (id) => {
            // Core vendor chunks
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom')) {
                return 'react-vendor';
              }
              if (id.includes('react-router')) {
                return 'router-vendor';
              }
              if (id.includes('@tanstack/react-query')) {
                return 'query-vendor';
              }
              if (id.includes('zustand')) {
                return 'state-vendor';
              }
              if (id.includes('@headlessui') || id.includes('@heroicons')) {
                return 'ui-vendor';
              }
              if (id.includes('recharts') || id.includes('d3')) {
                return 'charts-vendor';
              }
              if (id.includes('pdf') || id.includes('pdfjs')) {
                return 'pdf-vendor';
              }
              if (id.includes('lodash')) {
                return 'utils-vendor';
              }
              // All other vendor deps
              return 'vendor';
            }
            
            // Feature-based chunks
            if (id.includes('src/pages/Contracts') || id.includes('src/components/contracts')) {
              return 'contracts';
            }
            if (id.includes('src/pages/Templates') || id.includes('src/components/templates')) {
              return 'templates';
            }
            if (id.includes('src/pages/Analytics') || id.includes('src/components/analytics')) {
              return 'analytics';
            }
            if (id.includes('src/pages/Workflow') || id.includes('src/components/workflow')) {
              return 'workflow';
            }
            if (id.includes('src/pages/Admin') || id.includes('src/components/admin')) {
              return 'admin';
            }
            
            // Common utilities
            if (id.includes('src/utils') || id.includes('src/hooks')) {
              return 'common';
            }
          },
          
          // Asset naming
          entryFileNames: isProd ? '[name].[hash].js' : '[name].js',
          chunkFileNames: isProd ? '[name].[hash].js' : '[name].js',
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name.split('.');
            const ext = info[info.length - 1];
            
            if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
              return `images/[name].[hash][extname]`;
            }
            if (/woff2?|ttf|otf|eot/i.test(ext)) {
              return `fonts/[name].[hash][extname]`;
            }
            
            return isProd ? '[name].[hash][extname]' : '[name][extname]';
          },
        },
        
        // External dependencies (for CDN)
        external: isProd ? [] : [],
      },
    },
    
    // CSS optimization
    css: {
      modules: {
        localsConvention: 'camelCase',
        generateScopedName: isProd ? '[hash:base64:5]' : '[name]__[local]__[hash:base64:5]',
      },
      preprocessorOptions: {
        scss: {
          additionalData: `@import "@/styles/variables.scss";`,
        },
      },
      postcss: {
        plugins: [
          require('tailwindcss'),
          require('autoprefixer'),
          isProd && require('cssnano')({
            preset: ['default', {
              discardComments: {
                removeAll: true,
              },
            }],
          }),
        ].filter(Boolean),
      },
    },
    
    // Optimization
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@tanstack/react-query',
        'zustand',
      ],
      exclude: [
        '@vite/client',
        '@vite/env',
      ],
    },
    
    // Server configuration
    server: {
      port: 3000,
      host: true,
      hmr: {
        overlay: true,
      },
      // Preload critical chunks
      headers: {
        'Link': [
          '</assets/react-vendor.js>; rel=preload; as=script',
          '</assets/router-vendor.js>; rel=preload; as=script',
          '</assets/common.js>; rel=preload; as=script',
        ].join(', '),
      },
    },
    
    // Preview server
    preview: {
      port: 3001,
      host: true,
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    },
    
    // Worker configuration
    worker: {
      format: 'es',
      plugins: [],
    },
  };
});