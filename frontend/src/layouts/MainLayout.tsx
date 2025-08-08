/**
 * Main Layout Component
 * Provides the main application structure with navigation
 */
import { Outlet } from 'react-router-dom'
import { AutoBreadcrumbs } from '@/components/navigation/Breadcrumbs'
import { routeMapping } from '@/router'

export function MainLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">Legal AI Platform</h1>
            </div>
            <nav className="flex space-x-4">
              <a href="/dashboard" className="text-gray-700 hover:text-gray-900">Dashboard</a>
              <a href="/contracts" className="text-gray-700 hover:text-gray-900">Contracts</a>
              <a href="/documents" className="text-gray-700 hover:text-gray-900">Documents</a>
              <a href="/templates" className="text-gray-700 hover:text-gray-900">Templates</a>
              <a href="/workflows" className="text-gray-700 hover:text-gray-900">Workflows</a>
            </nav>
          </div>
        </div>
      </header>

      {/* Breadcrumbs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <AutoBreadcrumbs routeMapping={routeMapping} />
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  )
}