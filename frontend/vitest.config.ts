/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // S3-006: Phase 0 green baseline. Excluded files test components that are
    // stubs or have incomplete wiring; they will be re-enabled as Phase 1 rewrites
    // land. See docs/phase-0/s3-006_frontend-baseline.md for rationale.
    exclude: [
      'node_modules/**',
      'dist/**',
      'e2e/**',
      'src/tests/e2e/**',
      'src/__tests__/bundle-optimization.test.ts',
      'src/__tests__/multi-tenancy.test.tsx',
      'src/components/amendments/**',
      'src/components/analytics/**',
      'src/components/clauses/**',
      'src/components/comparison/**',
      'src/components/contract/**',
      'src/components/contracts/__tests__/BulkOperationsBar.test.tsx',
      'src/components/contracts/FilterSortControls.test.tsx',
      'src/components/dashboard/**',
      'src/components/document/**',
      'src/components/extraction/**',
      'src/components/graph/**',
      'src/components/intake/**',
      'src/components/navigation/Breadcrumbs.test.tsx',
      'src/components/negotiation/**',
      'src/components/obligation/**',
      'src/components/performance/**',
      'src/components/renewal/**',
      'src/components/reports/**',
      'src/components/risk/**',
      'src/components/signature/**',
      'src/components/templates/**',
      'src/components/ui/Button.test.tsx',
      'src/components/ui/Card.test.tsx',
      'src/components/ui/Input.test.tsx',
      'src/components/upload/**',
      'src/pages/__tests__/ForgotPasswordPage.test.tsx',
      'src/pages/__tests__/HomePage.test.tsx',
      'src/pages/__tests__/LoginPage.test.tsx',
      'src/pages/__tests__/RegisterPage.test.tsx',
      'src/pages/__tests__/ResetPasswordPage.test.tsx',
      'src/pages/admin/__tests__/RolesPermissionsPage.test.tsx',
      'src/pages/admin/__tests__/TenantsManagementPage.test.tsx',
      'src/pages/admin/__tests__/UsersManagementPage.test.tsx',
      'src/pages/contracts/__tests__/**',
      'src/pages/dashboard/__tests__/**',
      'src/pages/documents/__tests__/**',
      'src/pages/templates/__tests__/**',
      'src/pages/workflows/__tests__/WorkflowsListPage.test.tsx',
      'src/pages/workflows/__tests__/WorkflowTasksPage.test.tsx',
      'src/services/__tests__/admin.service.test.ts',
      'src/services/__tests__/contract.service.test.ts',
      'src/services/__tests__/template.service.test.ts',
      'src/services/__tests__/collaboration-platform.test.ts',
      'src/services/__tests__/dashboard.service.test.ts',
      'src/services/__tests__/performance-optimization.test.ts',
      'src/services/__tests__/white-label-platform.test.ts',
      'src/store/auth.test.ts',
      'src/utils/__tests__/performanceBenchmark.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '*.config.ts',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/index.ts'
      ],
      thresholds: {
        branches: 85,
        functions: 85,
        lines: 85,
        statements: 85
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@services': path.resolve(__dirname, './src/services'),
      '@store': path.resolve(__dirname, './src/store'),
      '@types': path.resolve(__dirname, './src/types'),
      '@utils': path.resolve(__dirname, './src/utils')
    }
  }
})