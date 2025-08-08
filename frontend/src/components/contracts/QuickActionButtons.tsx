/**
 * QuickActionButtons component
 * Provides quick access to common contract management actions
 */
import { useState } from 'react'
import { 
  Plus, 
  Upload, 
  Download, 
  FileBarChart,
  ChevronDown,
  X,
  MoreHorizontal,
  Check,
  Archive,
  Trash2,
  RefreshCw,
  AlertCircle,
  Menu
} from 'lucide-react'
import { cn } from '@/utils/cn'

export interface Contract {
  id: string
  title: string
  status: string
  type: string
}

interface LoadingStates {
  newContract?: boolean
  uploadDocument?: boolean
  importTemplates?: boolean
  generateReport?: boolean
  bulkActions?: boolean
}

interface Permissions {
  canCreateContract?: boolean
  canUploadDocument?: boolean
  canImportTemplates?: boolean
  canGenerateReport?: boolean
  canBulkDelete?: boolean
  canBulkArchive?: boolean
  canBulkExport?: boolean
  canBulkStatusChange?: boolean
}

interface QuickActionButtonsProps {
  selectedContracts?: Contract[]
  selectedCount?: number
  className?: string
  variant?: 'default' | 'compact'
  showMobileMenu?: boolean
  isLoading?: LoadingStates
  permissions?: Permissions
  error?: string
  onNewContract?: () => void
  onUploadDocument?: () => void
  onImportTemplates?: () => void
  onGenerateReport?: () => void
  onBulkStatusChange?: (contracts: Contract[]) => void
  onBulkExport?: (contracts: Contract[]) => void
  onBulkDelete?: (contracts: Contract[]) => void
  onBulkArchive?: (contracts: Contract[]) => void
  onClearSelection?: () => void
  onRetry?: () => void
}

export function QuickActionButtons({
  selectedContracts = [],
  selectedCount = 0,
  className,
  variant = 'default',
  showMobileMenu = false,
  isLoading = {},
  permissions = {
    canCreateContract: true,
    canUploadDocument: true,
    canImportTemplates: true,
    canGenerateReport: true,
    canBulkDelete: true,
    canBulkArchive: true,
    canBulkExport: true,
    canBulkStatusChange: true
  },
  error,
  onNewContract,
  onUploadDocument,
  onImportTemplates,
  onGenerateReport,
  onBulkStatusChange,
  onBulkExport,
  onBulkDelete,
  onBulkArchive,
  onClearSelection,
  onRetry
}: QuickActionButtonsProps) {
  const [showBulkDropdown, setShowBulkDropdown] = useState(false)
  const [showMobileDropdown, setShowMobileDropdown] = useState(false)

  const hasSelection = selectedCount > 0
  const spacingClass = variant === 'compact' ? 'space-x-2' : 'space-x-4'

  // Primary action buttons
  const primaryActions = [
    {
      id: 'new-contract',
      label: 'New Contract',
      icon: Plus,
      onClick: onNewContract,
      loading: isLoading.newContract,
      permission: permissions.canCreateContract,
      ariaLabel: 'Create new contract',
      primary: true
    },
    {
      id: 'upload-document',
      label: 'Upload Document',
      icon: Upload,
      onClick: onUploadDocument,
      loading: isLoading.uploadDocument,
      permission: permissions.canUploadDocument,
      ariaLabel: 'Upload document',
      primary: false
    },
    {
      id: 'import-templates',
      label: 'Import Templates',
      icon: Download,
      onClick: onImportTemplates,
      loading: isLoading.importTemplates,
      permission: permissions.canImportTemplates,
      ariaLabel: 'Import templates',
      primary: false
    },
    {
      id: 'generate-report',
      label: 'Generate Report',
      icon: FileBarChart,
      onClick: onGenerateReport,
      loading: isLoading.generateReport,
      permission: permissions.canGenerateReport,
      ariaLabel: 'Generate report',
      primary: false
    }
  ]

  // Bulk action options
  const bulkActions = [
    {
      id: 'change-status',
      label: 'Change Status',
      icon: Check,
      onClick: () => onBulkStatusChange?.(selectedContracts),
      permission: permissions.canBulkStatusChange
    },
    {
      id: 'export-selected',
      label: 'Export Selected',
      icon: Download,
      onClick: () => onBulkExport?.(selectedContracts),
      permission: permissions.canBulkExport
    },
    {
      id: 'archive-selected',
      label: 'Archive Selected',
      icon: Archive,
      onClick: () => onBulkArchive?.(selectedContracts),
      permission: permissions.canBulkArchive
    },
    {
      id: 'delete-selected',
      label: 'Delete Selected',
      icon: Trash2,
      onClick: () => onBulkDelete?.(selectedContracts),
      permission: permissions.canBulkDelete,
      destructive: true
    }
  ]

  // Filter actions by permission
  const visiblePrimaryActions = primaryActions.filter(action => action.permission)
  const visibleBulkActions = bulkActions.filter(action => action.permission)

  // Render action button
  const renderActionButton = (action: typeof primaryActions[0], index: number) => {
    const Icon = action.icon
    const isDisabled = action.loading || !!error

    return (
      <button
        key={action.id}
        data-testid={`${action.id}-button`}
        onClick={action.onClick}
        disabled={isDisabled}
        tabIndex={0}
        aria-label={action.ariaLabel}
        className={cn(
          'inline-flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
          action.primary 
            ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500' 
            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-blue-500',
          isDisabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {action.loading ? (
          <RefreshCw data-testid="loading-spinner" className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Icon data-testid={`${action.id}-icon`} className="h-4 w-4 mr-2" />
        )}
        {action.label}
      </button>
    )
  }

  // Render bulk actions dropdown
  const renderBulkActions = () => {
    return (
      <div className="relative">
        <button
          data-testid="bulk-actions-dropdown"
          onClick={() => setShowBulkDropdown(!showBulkDropdown)}
          disabled={isLoading.bulkActions}
          tabIndex={0}
          aria-label={`Bulk actions for ${selectedCount} selected contracts`}
          className={cn(
            'inline-flex items-center px-4 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors',
            isLoading.bulkActions && 'opacity-50 cursor-not-allowed'
          )}
        >
          {isLoading.bulkActions ? (
            <RefreshCw data-testid="bulk-loading-spinner" className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <>
              <span>Bulk Actions</span>
              <ChevronDown className="h-4 w-4 ml-2" />
            </>
          )}
        </button>

        {showBulkDropdown && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
            <div className="py-1">
              {visibleBulkActions.map((action) => {
                const Icon = action.icon
                return (
                  <button
                    key={action.id}
                    onClick={() => {
                      action.onClick()
                      setShowBulkDropdown(false)
                    }}
                    className={cn(
                      'flex items-center w-full px-4 py-2 text-sm text-left hover:bg-gray-100',
                      action.destructive ? 'text-red-700 hover:bg-red-50' : 'text-gray-700'
                    )}
                  >
                    <Icon className="h-4 w-4 mr-3" />
                    {action.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Render mobile menu
  const renderMobileMenu = () => {
    const primaryAction = visiblePrimaryActions.find(a => a.primary)
    const secondaryActions = visiblePrimaryActions.filter(a => !a.primary)

    return (
      <div className="flex items-center space-x-2">
        {primaryAction && renderActionButton(primaryAction, 0)}
        
        <div className="relative">
          <button
            data-testid="mobile-menu-button"
            onClick={() => setShowMobileDropdown(!showMobileDropdown)}
            aria-label="More actions"
            className="inline-flex items-center p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Menu className="h-5 w-5" />
          </button>

          {showMobileDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
              <div className="py-1">
                {secondaryActions.map((action) => {
                  const Icon = action.icon
                  return (
                    <button
                      key={action.id}
                      onClick={() => {
                        action.onClick?.()
                        setShowMobileDropdown(false)
                      }}
                      disabled={action.loading}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                    >
                      <Icon className="h-4 w-4 mr-3" />
                      {action.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center justify-between', className)}>
      {/* Error Message */}
      {error && (
        <div className="flex items-center bg-red-50 border border-red-200 rounded-md p-3 mb-4">
          <AlertCircle data-testid="error-icon" className="h-4 w-4 text-red-600 mr-2" />
          <span className="text-sm text-red-700">{error}</span>
          {onRetry && (
            <button
              onClick={onRetry}
              className="ml-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Main Actions Container */}
      <div 
        data-testid="quick-actions-container"
        className={cn('flex items-center', spacingClass)}
        aria-label="Quick contract actions"
      >
        {hasSelection ? (
          // Selection Mode
          <div className="flex items-center space-x-4">
            {/* Selection Info */}
            <div 
              data-testid="selection-info"
              className="flex items-center space-x-2"
              aria-live="polite"
            >
              <span className="text-sm font-medium text-gray-900">
                {selectedCount} selected
              </span>
              <span 
                className="sr-only"
                aria-live="polite"
              >
                {selectedCount} contracts selected
              </span>
              <button
                data-testid="clear-selection-button"
                onClick={onClearSelection}
                className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Bulk Actions */}
            {visibleBulkActions.length > 0 && renderBulkActions()}
          </div>
        ) : (
          // Normal Mode
          <>
            {showMobileMenu ? (
              renderMobileMenu()
            ) : (
              <div className={cn('flex items-center', spacingClass)}>
                {visiblePrimaryActions.map((action, index) => 
                  renderActionButton(action, index)
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}