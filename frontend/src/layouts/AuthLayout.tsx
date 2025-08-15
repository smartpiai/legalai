/**
 * Auth Layout Component
 * Sophisticated split-screen layout based on TailAdmin dashboard patterns
 */
import React from 'react'
import { Outlet, Link } from 'react-router-dom'
import { GridShape } from '@/components/common/GridShape'
import { ThemeToggler } from '@/components/common/ThemeToggler'

export function AuthLayout() {
  return (
    <div className="relative p-6 bg-white z-1 dark:bg-gray-900 sm:p-0">
      <div className="relative flex flex-col justify-center w-full h-screen lg:flex-row dark:bg-gray-900 sm:p-0">
        {/* Left Side - Auth Form */}
        <div className="flex items-center justify-center w-full lg:w-1/2 p-6 sm:p-12">
          <div className="w-full max-w-md">
            <Outlet />
          </div>
        </div>

        {/* Right Side - Branded Panel */}
        <div className="items-center hidden w-full h-full lg:w-1/2 bg-brand-950 dark:bg-gray-950 lg:grid relative">
          <div className="relative flex items-center justify-center z-1">
            <GridShape />
            <div className="flex flex-col items-center max-w-xs text-center">
              <Link to="/dashboard" className="block mb-6">
                <div className="flex items-center space-x-3">
                  <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center">
                    <div className="h-6 w-6 rounded-md bg-white" />
                  </div>
                  <span className="text-2xl font-bold text-white">
                    Legal AI Platform
                  </span>
                </div>
              </Link>
              <h2 className="text-xl font-semibold text-white mb-4">
                Enterprise Contract Management
              </h2>
              <p className="text-center text-gray-300 leading-relaxed">
                Streamline your legal operations with AI-powered contract analysis, 
                intelligent document processing, and comprehensive workflow automation.
              </p>
              
              {/* Feature Highlights */}
              <div className="mt-8 space-y-3 text-sm text-gray-300">
                <div className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                  <span>AI-Powered Contract Analysis</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                  <span>Intelligent Document Processing</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                  <span>Advanced Workflow Automation</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Theme Toggle */}
        <div className="fixed z-50 hidden bottom-6 right-6 sm:block">
          <ThemeToggler />
        </div>
      </div>
    </div>
  )
}