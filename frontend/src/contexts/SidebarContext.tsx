import React, { createContext, useContext, useState, ReactNode } from 'react'

interface SidebarContextType {
  isExpanded: boolean
  isMobileOpen: boolean
  isHovered: boolean
  setIsExpanded: (expanded: boolean) => void
  setIsMobileOpen: (open: boolean) => void
  setIsHovered: (hovered: boolean) => void
  toggleSidebar: () => void
  toggleMobileSidebar: () => void
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

export const useSidebar = () => {
  const context = useContext(SidebarContext)
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}

interface SidebarProviderProps {
  children: ReactNode
}

export const SidebarProvider: React.FC<SidebarProviderProps> = ({ children }) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const toggleSidebar = () => {
    setIsExpanded(!isExpanded)
  }

  const toggleMobileSidebar = () => {
    setIsMobileOpen(!isMobileOpen)
  }

  const value: SidebarContextType = {
    isExpanded,
    isMobileOpen,
    isHovered,
    setIsExpanded,
    setIsMobileOpen,
    setIsHovered,
    toggleSidebar,
    toggleMobileSidebar,
  }

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  )
}