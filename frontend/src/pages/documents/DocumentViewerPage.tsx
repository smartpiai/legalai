/**
 * DocumentViewerPage Component
 * Comprehensive document viewer with metadata, annotations, and actions
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import {
  DocumentIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
  ShareIcon,
  PencilSquareIcon,
  TrashIcon,
  PlusCircleIcon,
  MagnifyingGlassIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  Bars3Icon,
  XMarkIcon,
  ChatBubbleLeftIcon,
  TagIcon,
  CalendarIcon,
  UserIcon,
  DocumentTextIcon,
  ClockIcon,
  FolderIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { Button } from '../../components/ui/Button'
import { Breadcrumbs } from '../../components/navigation/Breadcrumbs'
import { PDFViewer } from '../../components/document/PDFViewer'
import documentService from '../../services/document.service'

interface Document {
  id: string
  title: string
  description?: string
  fileType: string
  fileName: string
  fileSize: number
  pageCount?: number
  uploadDate: string
  uploadedBy: string
  department?: string
  tags: string[]
  categories: string[]
  confidentialityLevel?: string
  contentUrl: string
  downloadUrl?: string
  versions: DocumentVersion[]
  annotations: DocumentAnnotation[]
  comments: DocumentComment[]
  permissions: DocumentPermissions
}

interface DocumentVersion {
  id: string
  version: string
  uploadDate: string
  uploadedBy: string
  changes: string
}

interface DocumentAnnotation {
  id: string
  page: number
  x: number
  y: number
  text: string
  author: string
  createdAt: string
}

interface DocumentComment {
  id: string
  text: string
  author: string
  createdAt: string
}

interface DocumentPermissions {
  canView: boolean
  canDownload: boolean
  canEdit: boolean
  canDelete: boolean
  canShare: boolean
  canAnnotate: boolean
}

export default function DocumentViewerPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  // State management
  const [document, setDocument] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [newComment, setNewComment] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Responsive design
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
      if (window.innerWidth < 768) {
        setSidebarOpen(false)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Load document data
  useEffect(() => {
    const loadDocument = async () => {
      if (!id) {
        setError('Document ID not provided')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)
        const docData = await documentService.getDocument(id)
        setDocument(docData)

        // Log document view for audit
        console.log('Document viewed:', {
          documentId: id,
          userId: 'current-user-id', // Would come from auth context
          timestamp: new Date().toISOString()
        })
      } catch (err: any) {
        console.error('Failed to load document:', err)
        if (err.response?.status === 403) {
          setError(err.response.data?.message || 'Unauthorized access')
        } else if (err.response?.status === 404) {
          setError('Document not found')
        } else {
          setError(err.message || 'Error loading document')
        }
      } finally {
        setLoading(false)
      }
    }

    loadDocument()
  }, [id])

  // Breadcrumb configuration
  const breadcrumbItems = useMemo(() => [
    { label: 'Home', path: '/' },
    { label: 'Documents', path: '/documents' },
    { label: document?.title || 'Document', path: location.pathname }
  ], [document?.title, location.pathname])

  // Document actions
  const handleDownload = useCallback(async () => {
    if (!document || !document.permissions.canDownload) return

    try {
      setActionLoading('download')
      const blob = await documentService.downloadDocument(document.id)
      
      // Create download link
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = document.fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download failed:', err)
      setError('Failed to download document')
    } finally {
      setActionLoading(null)
    }
  }, [document])

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  const handleShare = useCallback(() => {
    if (!document) return
    
    const shareUrl = window.location.href
    if (navigator.share) {
      navigator.share({
        title: document.title,
        url: shareUrl
      })
    } else {
      navigator.clipboard.writeText(shareUrl)
      // Would show toast notification in real app
      console.log('Share URL copied to clipboard')
    }
  }, [document])

  const handleEdit = useCallback(() => {
    if (!document) return
    navigate(`/documents/${document.id}/edit`)
  }, [document, navigate])

  const handleDelete = useCallback(async () => {
    if (!document || !document.permissions.canDelete) return

    const confirmed = window.confirm(
      'Are you sure you want to delete this document? This action cannot be undone.'
    )

    if (!confirmed) return

    try {
      setActionLoading('delete')
      await documentService.deleteDocument(document.id)
      navigate('/documents')
    } catch (err) {
      console.error('Delete failed:', err)
      setError('Failed to delete document')
    } finally {
      setActionLoading(null)
    }
  }, [document, navigate])

  const handleAddToContract = useCallback(() => {
    if (!document) return
    navigate(`/contracts/create?documentId=${document.id}`)
  }, [document, navigate])

  const handleAddComment = useCallback(async () => {
    if (!newComment.trim() || !document?.permissions.canAnnotate) return

    // Would implement actual comment API call here
    console.log('Adding comment:', newComment)
    setNewComment('')
  }, [newComment, document])

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  const getFileTypeLabel = (fileType: string): string => {
    const typeMap: Record<string, string> = {
      pdf: 'PDF Document',
      docx: 'Word Document',
      doc: 'Word Document',
      xlsx: 'Excel Spreadsheet',
      xls: 'Excel Spreadsheet',
      txt: 'Text Document'
    }
    return typeMap[fileType.toLowerCase()] || 'Document'
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-96">
          <div className="text-center" role="status" aria-live="polite">
            <DocumentIcon className="h-12 w-12 text-gray-400 mx-auto mb-4 animate-pulse" />
            <p className="text-gray-600">Loading document...</p>
            <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full mx-auto mt-4" />
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error loading document</h2>
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={() => navigate('/documents')} variant="primary">
              Back to Documents
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!document) {
    return null
  }

  return (
    <div className={`min-h-screen bg-gray-50 ${fullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Breadcrumbs */}
      {!fullscreen && (
        <div className="bg-white border-b px-4 py-3">
          <Breadcrumbs items={breadcrumbItems} />
        </div>
      )}

      {/* Main Content */}
      <div 
        data-testid="document-viewer-container"
        className={`flex h-full ${fullscreen ? 'fullscreen h-screen' : 'h-[calc(100vh-4rem)]'} ${
          isMobile ? 'mobile-layout' : ''
        }`}
      >
        {/* Sidebar */}
        <div
          data-testid="metadata-sidebar"
          className={`${
            sidebarOpen ? 'w-80' : 'w-0'
          } ${sidebarOpen ? 'block' : 'hidden'} bg-white border-r overflow-y-auto transition-all duration-200`}
        >
          <div className="p-4">
            {/* Document Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <h1 className="text-xl font-semibold text-gray-900 mb-1">
                  {document.title}
                </h1>
                <p className="text-sm text-gray-500">{document.fileName}</p>
                <p className="text-sm text-gray-500">{getFileTypeLabel(document.fileType)}</p>
              </div>
              {isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Close sidebar"
                >
                  <XMarkIcon className="h-5 w-5" />
                </Button>
              )}
            </div>

            {/* Document Information */}
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">Document Information</h3>
                <div className="space-y-3 text-sm">
                  {document.description && (
                    <div>
                      <span className="text-gray-500">Description:</span>
                      <p className="mt-1 text-gray-900">{document.description}</p>
                    </div>
                  )}
                  <div className="flex items-center">
                    <UserIcon className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-gray-500 mr-2">Uploaded by:</span>
                    <span className="text-gray-900">{document.uploadedBy}</span>
                  </div>
                  <div className="flex items-center">
                    <CalendarIcon className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-gray-500 mr-2">Upload date:</span>
                    <span className="text-gray-900">
                      {format(new Date(document.uploadDate), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <DocumentIcon className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-gray-500 mr-2">File size:</span>
                    <span className="text-gray-900">{formatFileSize(document.fileSize)}</span>
                  </div>
                  {document.pageCount && (
                    <div className="flex items-center">
                      <DocumentTextIcon className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-gray-500 mr-2">Pages:</span>
                      <span className="text-gray-900">{document.pageCount} pages</span>
                    </div>
                  )}
                  {document.department && (
                    <div className="flex items-center">
                      <FolderIcon className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-gray-500 mr-2">Department:</span>
                      <span className="text-gray-900">{document.department}</span>
                    </div>
                  )}
                  {document.confidentialityLevel && (
                    <div className="flex items-center">
                      <ShieldCheckIcon className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-gray-500 mr-2">Confidentiality:</span>
                      <span className="text-gray-900">{document.confidentialityLevel}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Tags and Categories */}
              {(document.tags.length > 0 || document.categories.length > 0) && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Tags & Categories</h3>
                  <div className="space-y-2">
                    {document.tags.length > 0 && (
                      <div>
                        <div className="flex flex-wrap gap-1">
                          {document.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                            >
                              <TagIcon className="h-3 w-3 mr-1" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {document.categories.length > 0 && (
                      <div>
                        <div className="flex flex-wrap gap-1">
                          {document.categories.map((category) => (
                            <span
                              key={category}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800"
                            >
                              {category}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Version History */}
              {document.versions.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Version History</h3>
                  <div className="space-y-2">
                    {document.versions.map((version) => (
                      <div key={version.id} className="border rounded p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">v{version.version}</span>
                          <span className="text-xs text-gray-500">
                            {format(new Date(version.uploadDate), 'MMM d, yyyy')}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mb-1">{version.uploadedBy}</p>
                        <p className="text-xs text-gray-700">{version.changes}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Annotations & Comments */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">Annotations & Comments</h3>
                <div className="space-y-3">
                  {/* Annotations */}
                  {document.annotations.map((annotation) => (
                    <div key={annotation.id} className="border rounded p-3 bg-yellow-50">
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-xs font-medium text-yellow-800">
                          Page {annotation.page} Annotation
                        </span>
                        <span className="text-xs text-gray-500">
                          {format(new Date(annotation.createdAt), 'MMM d')}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mb-1">{annotation.author}</p>
                      <p className="text-sm text-gray-900">{annotation.text}</p>
                    </div>
                  ))}

                  {/* Comments */}
                  {document.comments.map((comment) => (
                    <div key={comment.id} className="border rounded p-3">
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-xs font-medium">{comment.author}</span>
                        <span className="text-xs text-gray-500">
                          {format(new Date(comment.createdAt), 'MMM d')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-900">{comment.text}</p>
                    </div>
                  ))}

                  {/* Add Comment */}
                  {document.permissions.canAnnotate ? (
                    <div className="space-y-2">
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Add a comment..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none"
                        rows={3}
                      />
                      <Button
                        size="sm"
                        onClick={handleAddComment}
                        disabled={!newComment.trim()}
                      >
                        Add Comment
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 italic">
                      You do not have permission to add comments
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Viewer Area */}
        <div className="flex-1 flex flex-col">
          {/* Action Bar */}
          <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {/* Sidebar Toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label="Toggle sidebar"
              >
                <Bars3Icon className="h-5 w-5" />
              </Button>

              {/* Search */}
              <div className="relative">
                <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search in document..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm w-64"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2">
              {!isMobile ? (
                // Desktop Actions
                <>
                  {document.permissions.canDownload && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDownload}
                      loading={actionLoading === 'download'}
                      aria-label="Download document"
                    >
                      <ArrowDownTrayIcon className="h-5 w-5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handlePrint}
                    aria-label="Print document"
                  >
                    <PrinterIcon className="h-5 w-5" />
                  </Button>
                  {document.permissions.canShare && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleShare}
                      aria-label="Share document"
                    >
                      <ShareIcon className="h-5 w-5" />
                    </Button>
                  )}
                  {document.permissions.canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleEdit}
                      aria-label="Edit metadata"
                    >
                      <PencilSquareIcon className="h-5 w-5" />
                    </Button>
                  )}
                  {document.permissions.canDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDelete}
                      loading={actionLoading === 'delete'}
                      aria-label="Delete document"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleAddToContract}
                    aria-label="Add to contract"
                  >
                    <PlusCircleIcon className="h-5 w-5" />
                  </Button>
                </>
              ) : (
                // Mobile Actions - Dropdown
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="More actions"
                >
                  <Bars3Icon className="h-5 w-5" />
                </Button>
              )}

              {/* Fullscreen Toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFullscreen(!fullscreen)}
                aria-label={fullscreen ? 'Exit full screen' : 'Enter full screen'}
              >
                {fullscreen ? (
                  <ArrowsPointingInIcon className="h-5 w-5" />
                ) : (
                  <ArrowsPointingOutIcon className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>

          {/* Document Content */}
          <div className="flex-1 overflow-hidden">
            {document.fileType === 'pdf' ? (
              <PDFViewer
                fileUrl={document.contentUrl}
                enableSearch={true}
                enableTextSelection={true}
                enableAnnotations={document.permissions.canAnnotate}
                annotations={document.annotations}
                onDownload={document.permissions.canDownload ? handleDownload : undefined}
                onPrint={handlePrint}
              />
            ) : (
              <div 
                data-testid="document-viewer"
                className="flex items-center justify-center h-full bg-gray-100"
              >
                <div className="text-center">
                  <DocumentIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Document preview not available
                  </h3>
                  <p className="text-gray-500 mb-4">{document.fileName}</p>
                  {document.permissions.canDownload && (
                    <Button onClick={handleDownload}>
                      Download to view
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
