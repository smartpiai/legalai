import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as pdfjs from 'pdfjs-dist';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassPlusIcon,
  MagnifyingGlassMinusIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  ArrowPathIcon,
  XMarkIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface Annotation {
  id?: string;
  page: number;
  x: number;
  y: number;
  text: string;
}

interface PDFViewerProps {
  fileUrl: string;
  initialPage?: number;
  showThumbnails?: boolean;
  enableSearch?: boolean;
  enableTextSelection?: boolean;
  enableAnnotations?: boolean;
  annotations?: Annotation[];
  lazyLoadPages?: boolean;
  cachePages?: boolean;
  onPageChange?: (page: number) => void;
  onTextSelect?: (text: string) => void;
  onAnnotate?: (annotation: Annotation) => void;
  onDeleteAnnotation?: (id: string) => void;
  onDownload?: () => void;
  onPrint?: () => void;
}

const ZOOM_LEVELS = [25, 50, 75, 100, 125, 150, 200, 300, 400];
const MIN_ZOOM = 25;
const MAX_ZOOM = 400;
const ZOOM_STEP = 25;

export const PDFViewer: React.FC<PDFViewerProps> = ({
  fileUrl,
  initialPage = 1,
  showThumbnails = false,
  enableSearch = false,
  enableTextSelection = false,
  enableAnnotations = false,
  annotations = [],
  lazyLoadPages = false,
  cachePages = false,
  onPageChange,
  onTextSelect,
  onAnnotate,
  onDeleteAnnotation,
  onDownload,
  onPrint,
}) => {
  const [pdf, setPdf] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [numPages, setNumPages] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [zoomMode, setZoomMode] = useState<'custom' | 'fit-width' | 'fit-page'>('custom');
  const [rotation, setRotation] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ page: number; matches: number }>>([]);
  const [currentMatch, setCurrentMatch] = useState(0);
  const [annotationMode, setAnnotationMode] = useState(false);
  const [newAnnotation, setNewAnnotation] = useState<Partial<Annotation> | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [showCopyButton, setShowCopyButton] = useState(false);
  const [copyButtonPosition, setCopyButtonPosition] = useState({ x: 0, y: 0 });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const pageCache = useRef<Map<number, pdfjs.PDFPageProxy>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  // Load PDF document
  useEffect(() => {
    const loadPDF = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const loadingTask = pdfjs.getDocument(fileUrl);
        const pdfDoc = await loadingTask.promise;
        setPdf(pdfDoc);
        setNumPages(pdfDoc.numPages);
        setIsLoading(false);
      } catch (err) {
        setError('Failed to load PDF');
        setIsLoading(false);
      }
    };
    
    loadPDF();
    
    return () => {
      if (pdf) {
        pdf.destroy();
      }
      pageCache.current.clear();
    };
  }, [fileUrl]);

  // Render current page
  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    
    const renderPage = async () => {
      let page: pdfjs.PDFPageProxy;
      
      // Check cache first
      if (cachePages && pageCache.current.has(currentPage)) {
        page = pageCache.current.get(currentPage)!;
      } else {
        page = await pdf.getPage(currentPage);
        if (cachePages) {
          pageCache.current.set(currentPage, page);
        }
      }
      
      const viewport = page.getViewport({ 
        scale: zoom / 100,
        rotation: rotation,
      });
      
      const canvas = canvasRef.current!;
      const context = canvas.getContext('2d')!;
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };
      
      await page.render(renderContext).promise;
      
      // Render text layer if text selection is enabled
      if (enableTextSelection && textLayerRef.current) {
        const textContent = await page.getTextContent();
        textLayerRef.current.innerHTML = '';
        
        textContent.items.forEach((item: any) => {
          const span = document.createElement('span');
          span.textContent = item.str;
          span.style.position = 'absolute';
          textLayerRef.current!.appendChild(span);
        });
      }
      
      // Clean up if not caching
      if (!cachePages && !pageCache.current.has(currentPage)) {
        page.destroy();
      }
    };
    
    renderPage();
  }, [pdf, currentPage, zoom, rotation, enableTextSelection, cachePages]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case '+':
          case '=':
            e.preventDefault();
            handleZoomIn();
            break;
          case '-':
            e.preventDefault();
            handleZoomOut();
            break;
          case '0':
            e.preventDefault();
            setZoom(100);
            setZoomMode('custom');
            break;
        }
      } else {
        switch (e.key) {
          case 'ArrowLeft':
          case 'PageUp':
            handlePreviousPage();
            break;
          case 'ArrowRight':
          case 'PageDown':
            handleNextPage();
            break;
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, numPages, zoom]);

  // Text selection handling
  useEffect(() => {
    if (!enableTextSelection) return;
    
    const handleSelection = () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      
      if (text) {
        setSelectedText(text);
        setShowCopyButton(true);
        
        const range = selection?.getRangeAt(0);
        const rect = range?.getBoundingClientRect();
        if (rect) {
          setCopyButtonPosition({ x: rect.right, y: rect.top - 30 });
        }
        
        if (onTextSelect) {
          onTextSelect(text);
        }
      } else {
        setShowCopyButton(false);
      }
    };
    
    document.addEventListener('mouseup', handleSelection);
    return () => document.removeEventListener('mouseup', handleSelection);
  }, [enableTextSelection, onTextSelect]);

  const handleNextPage = () => {
    if (currentPage < numPages) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      onPageChange?.(newPage);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      onPageChange?.(newPage);
    }
  };

  const handlePageJump = (page: number) => {
    if (page >= 1 && page <= numPages) {
      setCurrentPage(page);
      onPageChange?.(page);
    }
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(zoom + ZOOM_STEP, MAX_ZOOM);
    setZoom(newZoom);
    setZoomMode('custom');
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoom - ZOOM_STEP, MIN_ZOOM);
    setZoom(newZoom);
    setZoomMode('custom');
  };

  const handleZoomSelect = (value: string) => {
    setZoom(parseInt(value));
    setZoomMode('custom');
  };

  const handleFitWidth = () => {
    setZoomMode('fit-width');
    // Calculate zoom to fit width
    if (containerRef.current && canvasRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      const pageWidth = canvasRef.current.width / (zoom / 100);
      setZoom(Math.floor((containerWidth / pageWidth) * 100));
    }
  };

  const handleFitPage = () => {
    setZoomMode('fit-page');
    // Calculate zoom to fit page
    if (containerRef.current && canvasRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;
      const pageWidth = canvasRef.current.width / (zoom / 100);
      const pageHeight = canvasRef.current.height / (zoom / 100);
      const widthRatio = containerWidth / pageWidth;
      const heightRatio = containerHeight / pageHeight;
      setZoom(Math.floor(Math.min(widthRatio, heightRatio) * 100));
    }
  };

  const handleRotateLeft = () => {
    setRotation((rotation - 90) % 360);
  };

  const handleRotateRight = () => {
    setRotation((rotation + 90) % 360);
  };

  const handleSearch = async () => {
    if (!pdf || !searchQuery) return;
    
    const results: Array<{ page: number; matches: number }> = [];
    
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items.map((item: any) => item.str).join(' ');
      
      const matches = (text.match(new RegExp(searchQuery, 'gi')) || []).length;
      if (matches > 0) {
        results.push({ page: i, matches });
      }
      
      page.destroy();
    }
    
    setSearchResults(results);
    setCurrentMatch(0);
    
    if (results.length > 0) {
      handlePageJump(results[0].page);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setCurrentMatch(0);
  };

  const handleNextMatch = () => {
    if (searchResults.length > 0) {
      const nextMatch = (currentMatch + 1) % searchResults.length;
      setCurrentMatch(nextMatch);
      handlePageJump(searchResults[nextMatch].page);
    }
  };

  const handlePreviousMatch = () => {
    if (searchResults.length > 0) {
      const prevMatch = currentMatch === 0 ? searchResults.length - 1 : currentMatch - 1;
      setCurrentMatch(prevMatch);
      handlePageJump(searchResults[prevMatch].page);
    }
  };

  const handleAnnotationClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!annotationMode || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setNewAnnotation({
      page: currentPage,
      x,
      y,
      text: '',
    });
  };

  const handleSaveAnnotation = () => {
    if (newAnnotation && newAnnotation.text && onAnnotate) {
      onAnnotate(newAnnotation as Annotation);
      setNewAnnotation(null);
      setAnnotationMode(false);
    }
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(selectedText);
    setShowCopyButton(false);
  };

  const totalMatches = searchResults.reduce((sum, r) => sum + r.matches, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Loading PDF...</p>
          <div role="progressbar" className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full mx-auto mt-4" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <XMarkIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            aria-label="Retry"
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full" ref={containerRef}>
      {/* Thumbnails Sidebar */}
      {showThumbnails && (
        <nav aria-label="Page thumbnails" className="w-48 bg-gray-100 overflow-y-auto p-2">
          {Array.from({ length: Math.min(numPages, lazyLoadPages ? 20 : numPages) }, (_, i) => i + 1).map(page => (
            <button
              key={page}
              onClick={() => handlePageJump(page)}
              aria-label={`Go to page ${page}`}
              className={`block w-full p-2 mb-2 text-sm rounded ${
                page === currentPage ? 'bg-blue-500 text-white' : 'bg-white hover:bg-gray-200'
              }`}
            >
              Page {page}
            </button>
          ))}
        </nav>
      )}

      {/* Main Viewer */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div role="toolbar" aria-label="PDF controls" className="bg-gray-50 border-b p-2 flex items-center space-x-2">
          {/* Navigation */}
          <button
            onClick={handlePreviousPage}
            disabled={currentPage === 1}
            aria-label="Previous page"
            className="p-2 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          
          <div className="flex items-center space-x-2">
            <input
              type="number"
              value={currentPage}
              onChange={(e) => handlePageJump(parseInt(e.target.value))}
              aria-label="Page number"
              role="spinbutton"
              className="w-16 px-2 py-1 border rounded text-center"
              min={1}
              max={numPages}
            />
            <span>of {numPages}</span>
          </div>
          
          <button
            onClick={handleNextPage}
            disabled={currentPage === numPages}
            aria-label="Next page"
            className="p-2 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>

          <div className="border-l pl-2" />

          {/* Zoom Controls */}
          <button
            onClick={handleZoomOut}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Zoom out"
            className="p-2 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MagnifyingGlassMinusIcon className="h-5 w-5" />
          </button>
          
          <select
            value={zoom}
            onChange={(e) => handleZoomSelect(e.target.value)}
            aria-label="Zoom level"
            role="combobox"
            className="px-2 py-1 border rounded"
          >
            {ZOOM_LEVELS.map(level => (
              <option key={level} value={level}>{level}%</option>
            ))}
          </select>
          
          <span className="text-sm">
            {zoomMode === 'fit-width' ? 'Fit Width' : zoomMode === 'fit-page' ? 'Fit Page' : `${zoom}%`}
          </span>
          
          <button
            onClick={handleZoomIn}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Zoom in"
            className="p-2 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MagnifyingGlassPlusIcon className="h-5 w-5" />
          </button>
          
          <button
            onClick={handleFitWidth}
            aria-label="Fit to width"
            className="p-2 rounded hover:bg-gray-200"
          >
            <ArrowsPointingOutIcon className="h-5 w-5" />
          </button>
          
          <button
            onClick={handleFitPage}
            aria-label="Fit to page"
            className="p-2 rounded hover:bg-gray-200"
          >
            <ArrowsPointingInIcon className="h-5 w-5" />
          </button>

          <div className="border-l pl-2" />

          {/* Rotation */}
          <button
            onClick={handleRotateLeft}
            aria-label="Rotate left"
            className="p-2 rounded hover:bg-gray-200"
          >
            ↺
          </button>
          
          <button
            onClick={handleRotateRight}
            aria-label="Rotate right"
            className="p-2 rounded hover:bg-gray-200"
          >
            ↻
          </button>

          {/* Search */}
          {enableSearch && (
            <>
              <div className="border-l pl-2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search in document"
                aria-label="Search in document"
                role="searchbox"
                className="px-2 py-1 border rounded"
              />
              <button
                onClick={handleSearch}
                aria-label="Search"
                className="p-2 rounded hover:bg-gray-200"
              >
                <MagnifyingGlassIcon className="h-5 w-5" />
              </button>
              {searchResults.length > 0 && (
                <>
                  <span className="text-sm">{totalMatches} matches found</span>
                  <span className="text-sm">Match {currentMatch + 1} of {searchResults.length}</span>
                  <button
                    onClick={handlePreviousMatch}
                    aria-label="Previous match"
                    className="p-1 rounded hover:bg-gray-200"
                  >
                    ←
                  </button>
                  <button
                    onClick={handleNextMatch}
                    aria-label="Next match"
                    className="p-1 rounded hover:bg-gray-200"
                  >
                    →
                  </button>
                  <button
                    onClick={handleClearSearch}
                    aria-label="Clear search"
                    className="p-2 rounded hover:bg-gray-200"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </>
              )}
            </>
          )}

          {/* Annotations */}
          {enableAnnotations && (
            <>
              <div className="border-l pl-2" />
              <button
                onClick={() => setAnnotationMode(!annotationMode)}
                aria-label="Add annotation"
                className={`p-2 rounded hover:bg-gray-200 ${annotationMode ? 'bg-blue-200' : ''}`}
              >
                <PencilSquareIcon className="h-5 w-5" />
              </button>
            </>
          )}

          {/* Actions */}
          <div className="border-l pl-2 ml-auto" />
          {onDownload && (
            <button
              onClick={onDownload}
              aria-label="Download"
              className="p-2 rounded hover:bg-gray-200"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
            </button>
          )}
          {onPrint && (
            <button
              onClick={onPrint}
              aria-label="Print"
              className="p-2 rounded hover:bg-gray-200"
            >
              <PrinterIcon className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* PDF Content */}
        <div 
          role="region" 
          aria-label="PDF viewer"
          className="flex-1 overflow-auto bg-gray-200 p-4"
        >
          <div className="relative inline-block">
            <canvas
              ref={canvasRef}
              onClick={handleAnnotationClick}
              aria-label={`PDF page ${currentPage}`}
              role="img"
              style={{ 
                transform: `rotate(${rotation}deg)`,
                cursor: annotationMode ? 'crosshair' : 'default',
              }}
              className="bg-white shadow-lg highlight"
            />
            
            {/* Text Layer */}
            {enableTextSelection && (
              <div
                ref={textLayerRef}
                className="absolute top-0 left-0"
                style={{ pointerEvents: 'auto' }}
              />
            )}

            {/* Annotations */}
            {annotations
              .filter(a => a.page === currentPage)
              .map((annotation, index) => (
                <div
                  key={annotation.id || index}
                  className="absolute bg-yellow-200 p-2 rounded shadow"
                  style={{ left: annotation.x, top: annotation.y }}
                >
                  <p className="text-xs">{annotation.text}</p>
                  {onDeleteAnnotation && annotation.id && (
                    <button
                      onClick={() => onDeleteAnnotation(annotation.id!)}
                      aria-label="Delete annotation"
                      className="text-red-500 text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}

            {/* New Annotation Input */}
            {newAnnotation && (
              <div
                className="absolute bg-white p-2 rounded shadow-lg"
                style={{ left: newAnnotation.x, top: newAnnotation.y }}
              >
                <textarea
                  value={newAnnotation.text || ''}
                  onChange={(e) => setNewAnnotation({ ...newAnnotation, text: e.target.value })}
                  placeholder="Enter annotation..."
                  aria-label="Annotation text"
                  className="border p-1 text-sm"
                  autoFocus
                />
                <div className="mt-1">
                  <button
                    onClick={handleSaveAnnotation}
                    aria-label="Save annotation"
                    className="text-xs bg-blue-500 text-white px-2 py-1 rounded mr-1"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setNewAnnotation(null)}
                    className="text-xs bg-gray-300 px-2 py-1 rounded"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Copy Button */}
            {showCopyButton && (
              <button
                onClick={handleCopyText}
                aria-label="Copy text"
                className="absolute bg-blue-500 text-white px-2 py-1 rounded text-xs"
                style={{ left: copyButtonPosition.x, top: copyButtonPosition.y }}
              >
                Copy
              </button>
            )}

            {/* Annotation Mode Indicator */}
            {annotationMode && (
              <div className="absolute top-2 right-2 bg-blue-100 text-blue-700 px-2 py-1 rounded text-sm">
                Click to add annotation
              </div>
            )}
          </div>
        </div>

        {/* Status Bar */}
        <div className="bg-gray-50 border-t px-4 py-1 text-sm text-gray-600">
          <span role="status" aria-live="polite">
            Page {currentPage} of {numPages}
          </span>
        </div>
      </div>
    </div>
  );
};