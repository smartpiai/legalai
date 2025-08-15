/**
 * App Layout with Sophisticated Sidebar
 * Based on TailAdmin dashboard patterns
 */
import React, { useState, useCallback, useEffect } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { 
  Menu, 
  X, 
  Bell, 
  Settings, 
  User, 
  LogOut, 
  FileText, 
  Folder, 
  Workflow, 
  BarChart3,
  Users,
  Shield,
  ChevronDown,
  MoreHorizontal
} from 'lucide-react'
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext'
import { Container } from '@/components/layout/Container'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/store/auth'
import { cn } from '@/lib/utils'

type NavItem = {
  name: string
  icon: React.ReactNode
  path?: string
  subItems?: { name: string; path: string; new?: boolean }[]
}

const legalNavItems: NavItem[] = [
  {
    icon: <BarChart3 className="size-6" />,
    name: "Dashboard",
    path: "/dashboard"
  },
  {
    icon: <FileText className="size-6" />,
    name: "Contracts",
    subItems: [
      { name: "All Contracts", path: "/contracts" },
      { name: "Create Contract", path: "/contracts/new" },
      { name: "Contract Analytics", path: "/contracts/analytics" }
    ]
  },
  {
    icon: <Folder className="size-6" />,
    name: "Documents",
    subItems: [
      { name: "All Documents", path: "/documents" },
      { name: "Upload Document", path: "/documents/upload" }
    ]
  },
  {
    icon: <Workflow className="size-6" />,
    name: "Templates",
    subItems: [
      { name: "Template Library", path: "/templates" },
      { name: "Create Template", path: "/templates/new" }
    ]
  }
]

const adminNavItems: NavItem[] = [
  {
    icon: <Users className="size-6" />,
    name: "User Management",
    subItems: [
      { name: "Users", path: "/admin/users" },
      { name: "Roles & Permissions", path: "/admin/roles" }
    ]
  },
  {
    icon: <Shield className="size-6" />,
    name: "System",
    subItems: [
      { name: "Settings", path: "/admin/settings" },
      { name: "Audit Logs", path: "/admin/audit" }
    ]
  }
]

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar()
  const location = useLocation()
  const [openSubmenu, setOpenSubmenu] = useState<{
    type: "main" | "admin"
    index: number
  } | null>(null)

  const isActive = useCallback(
    (path: string) => location.pathname === path || location.pathname.startsWith(path + '/'),
    [location.pathname]
  )

  // Auto-open submenu if current path matches
  useEffect(() => {
    let submenuMatched = false
    ;["main", "admin"].forEach((menuType) => {
      const items = menuType === "main" ? legalNavItems : adminNavItems
      items.forEach((nav, index) => {
        if (nav.subItems) {
          nav.subItems.forEach((subItem) => {
            if (isActive(subItem.path)) {
              setOpenSubmenu({ type: menuType as "main" | "admin", index })
              submenuMatched = true
            }
          })
        }
      })
    })

    if (!submenuMatched) {
      setOpenSubmenu(null)
    }
  }, [location, isActive])

  const handleSubmenuToggle = (index: number, menuType: "main" | "admin") => {
    setOpenSubmenu((prev) => {
      if (prev && prev.type === menuType && prev.index === index) {
        return null
      }
      return { type: menuType, index }
    })
  }

  const renderMenuItems = (items: NavItem[], menuType: "main" | "admin") => (
    <ul className="flex flex-col gap-2">
      {items.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <div>
              <button
                onClick={() => handleSubmenuToggle(index, menuType)}
                className={cn(
                  "menu-item group cursor-pointer",
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? "menu-item-active"
                    : "menu-item-inactive",
                  !isExpanded && !isHovered ? "lg:justify-center" : "lg:justify-start"
                )}
              >
                <span
                  className={cn(
                    "menu-item-icon-size",
                    openSubmenu?.type === menuType && openSubmenu?.index === index
                      ? "menu-item-icon-active"
                      : "menu-item-icon-inactive"
                  )}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className="text-theme-sm font-medium">{nav.name}</span>
                )}
                {(isExpanded || isHovered || isMobileOpen) && (
                  <ChevronDown
                    className={cn(
                      "ml-auto w-5 h-5 transition-transform duration-200",
                      openSubmenu?.type === menuType && openSubmenu?.index === index
                        ? "rotate-180 text-brand-500"
                        : "text-gray-500"
                    )}
                  />
                )}
              </button>
              
              {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
                <div
                  className={cn(
                    "overflow-hidden transition-all duration-300",
                    openSubmenu?.type === menuType && openSubmenu?.index === index
                      ? "max-h-96 mt-2"
                      : "max-h-0"
                  )}
                >
                  <ul className="space-y-1 ml-9">
                    {nav.subItems.map((subItem) => (
                      <li key={subItem.name}>
                        <Link
                          to={subItem.path}
                          className={cn(
                            "block px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                            isActive(subItem.path)
                              ? "bg-brand-50 text-brand-500 dark:bg-brand-500/[0.12] dark:text-brand-400"
                              : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
                          )}
                        >
                          {subItem.name}
                          {subItem.new && (
                            <span className="ml-2 px-2 py-0.5 text-xs font-medium uppercase bg-brand-50 text-brand-500 rounded-full">
                              new
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            nav.path && (
              <Link
                to={nav.path}
                className={cn(
                  "menu-item group",
                  isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                )}
              >
                <span
                  className={cn(
                    "menu-item-icon-size",
                    isActive(nav.path) ? "menu-item-icon-active" : "menu-item-icon-inactive"
                  )}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className="text-theme-sm font-medium">{nav.name}</span>
                )}
              </Link>
            )
          )}
        </li>
      ))}
    </ul>
  )

  return (
    <aside
      className={cn(
        "fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200",
        isExpanded || isMobileOpen ? "w-[290px]" : isHovered ? "w-[290px]" : "w-[90px]",
        isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Logo */}
      <div
        className={cn(
          "py-8 flex",
          !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
        )}
      >
        <Link to="/dashboard">
          {isExpanded || isHovered || isMobileOpen ? (
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-md bg-brand-500 flex items-center justify-center">
                <div className="h-4 w-4 rounded-sm bg-white" />
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white/90">
                Legal AI
              </span>
            </div>
          ) : (
            <div className="h-8 w-8 rounded-md bg-brand-500 flex items-center justify-center">
              <div className="h-4 w-4 rounded-sm bg-white" />
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <div className="flex flex-col gap-6">
            {/* Main Menu */}
            <div>
              <h2
                className={cn(
                  "mb-4 text-xs uppercase flex leading-[20px] text-gray-400",
                  !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
                )}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Legal Platform"
                ) : (
                  <MoreHorizontal className="size-6" />
                )}
              </h2>
              {renderMenuItems(legalNavItems, "main")}
            </div>

            {/* Admin Menu */}
            <div>
              <h2
                className={cn(
                  "mb-4 text-xs uppercase flex leading-[20px] text-gray-400",
                  !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
                )}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Administration"
                ) : (
                  <MoreHorizontal className="size-6" />
                )}
              </h2>
              {renderMenuItems(adminNavItems, "admin")}
            </div>
          </div>
        </nav>
      </div>
    </aside>
  )
}

const AppHeader: React.FC = () => {
  const { isExpanded, isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const { user, logout } = useAuthStore()

  const handleLogout = async () => {
    await logout()
    setUserMenuOpen(false)
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95">
      <Container size="full" noPadding>
        <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Left Side - Menu Toggle */}
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="hidden lg:flex"
            >
              <Menu className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMobileSidebar}
              className="lg:hidden"
            >
              {isMobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>

            <h1 className="text-lg font-semibold text-gray-900 dark:text-white/90 lg:hidden">
              Legal AI Platform
            </h1>
          </div>

          {/* Right Side - User Actions */}
          <div className="flex items-center space-x-4">
            {/* Notifications */}
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-error-500 border-2 border-white dark:border-gray-900" />
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
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-theme-lg border border-gray-200 dark:bg-gray-900 dark:border-gray-800 z-50">
                  <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                    <div className="text-sm font-medium text-gray-900 dark:text-white/90">
                      {user?.full_name || 'User'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {user?.email}
                    </div>
                  </div>
                  <div className="py-2">
                    <Link
                      to="/profile"
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <Settings className="mr-3 h-4 w-4" />
                      Settings
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5"
                    >
                      <LogOut className="mr-3 h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Container>
    </header>
  )
}

const LayoutContent: React.FC = () => {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar()

  return (
    <div className="min-h-screen xl:flex">
      <div>
        <AppSidebar />
        {/* Backdrop for mobile */}
        {isMobileOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => useSidebar().setIsMobileOpen(false)}
          />
        )}
      </div>
      
      <div
        className={cn(
          "flex-1 transition-all duration-300 ease-in-out",
          isExpanded || isHovered ? "lg:ml-[290px]" : "lg:ml-[90px]",
          isMobileOpen ? "ml-0" : ""
        )}
      >
        <AppHeader />
        <main className="p-4 mx-auto max-w-screen-2xl md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export function AppLayout() {
  return (
    <SidebarProvider>
      <LayoutContent />
    </SidebarProvider>
  )
}