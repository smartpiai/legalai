/**
 * Main Layout Component
 * Provides the main application structure with responsive navigation
 */
import React, { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { Menu, X, Bell, Settings, User, LogOut } from 'lucide-react'
import { AutoBreadcrumbs } from '@/components/navigation/Breadcrumbs'
import { Container } from '@/components/layout/Container'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/store/auth'
import { cn } from '@/lib/utils'
import { routeMapping } from '@/router'

const navigationItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/contracts', label: 'Contracts' },
  { href: '/documents', label: 'Documents' },
  { href: '/templates', label: 'Templates' },
  { href: '/workflows', label: 'Workflows' },
  { href: '/reports', label: 'Reports' },
]

export function MainLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const location = useLocation()
  const { user, logout } = useAuthStore()

  const isActiveRoute = (href: string) => {
    return location.pathname.startsWith(href)
  }

  const handleLogout = () => {
    logout()
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Container size="full" noPadding>
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              {/* Logo and Brand */}
              <div className="flex items-center">
                <Link to="/" className="flex items-center space-x-2">
                  <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
                    <div className="h-4 w-4 rounded-sm bg-primary-foreground" />
                  </div>
                  <span className="text-xl font-bold text-foreground hidden sm:block">
                    Legal AI Platform
                  </span>
                </Link>
              </div>

              {/* Desktop Navigation */}
              <nav className="hidden md:flex items-center space-x-6">
                {navigationItems.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      'text-sm font-medium transition-colors hover:text-primary',
                      isActiveRoute(item.href)
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              {/* Right Side Actions */}
              <div className="flex items-center space-x-4">
                {/* Notifications */}
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-4 w-4" />
                  <span className="sr-only">Notifications</span>
                </Button>

                {/* User Menu */}
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="relative"
                  >
                    <User className="h-4 w-4" />
                    <span className="sr-only">User menu</span>
                  </Button>

                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-popover rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                      <div className="p-4 border-b border-border">
                        <div className="text-sm font-medium text-foreground">
                          {user?.full_name || 'User'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {user?.email}
                        </div>
                      </div>
                      <div className="py-1">
                        <Link
                          to="/profile"
                          className="flex items-center px-4 py-2 text-sm text-foreground hover:bg-accent"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <Settings className="mr-2 h-4 w-4" />
                          Settings
                        </Link>
                        <button
                          onClick={handleLogout}
                          className="flex w-full items-center px-4 py-2 text-sm text-foreground hover:bg-accent"
                        >
                          <LogOut className="mr-2 h-4 w-4" />
                          Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Mobile Menu Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                  {mobileMenuOpen ? (
                    <X className="h-4 w-4" />
                  ) : (
                    <Menu className="h-4 w-4" />
                  )}
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </div>
            </div>
          </div>
        </Container>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 bg-background border-b border-border">
              {navigationItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'block px-3 py-2 rounded-md text-base font-medium transition-colors',
                    isActiveRoute(item.href)
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Breadcrumbs */}
      <Container size="full" className="py-3 border-b border-border bg-muted/40">
        <AutoBreadcrumbs routeMapping={routeMapping} />
      </Container>

      {/* Main Content */}
      <main className="flex-1">
        <Container size="full" className="py-6 sm:py-8">
          <Outlet key={location.pathname} />
        </Container>
      </main>
    </div>
  )
}
