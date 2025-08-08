import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { PDFViewer } from '../PDFViewer';

interface PDFDocument {
  numPages: number;
  getPage: (pageNum: number) => Promise<PDFPage>;
  destroy: () => void;
}

interface PDFPage {
  pageNumber: number;
  viewport: { width: number; height: number };
  render: (context: any) => { promise: Promise<void> };
  getTextContent: () => Promise<{ items: Array<{ str: string }> }>;
  destroy: () => void;
}

// Mock PDF.js
vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn(),
  GlobalWorkerOptions: {
    workerSrc: '',
  },
}));

describe('PDFViewer', () => {
  const mockOnPageChange = vi.fn();
  const mockOnTextSelect = vi.fn();
  const mockOnAnnotate = vi.fn();
  const mockOnDownload = vi.fn();
  const mockOnPrint = vi.fn();

  const mockPDFPage: PDFPage = {
    pageNumber: 1,
    viewport: { width: 595, height: 842 },
    render: vi.fn(() => ({ promise: Promise.resolve() })),
    getTextContent: vi.fn(() => 
      Promise.resolve({ 
        items: [
          { str: 'This is page content' },
          { str: 'More content here' },
        ],
      })
    ),
    destroy: vi.fn(),
  };

  const mockPDFDocument: PDFDocument = {
    numPages: 5,
    getPage: vi.fn(() => Promise.resolve(mockPDFPage)),
    destroy: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default PDF.js mock
    const pdfjs = require('pdfjs-dist');
    pdfjs.getDocument.mockReturnValue({
      promise: Promise.resolve(mockPDFDocument),
    });
  });

  const renderComponent = (props = {}) => {
    const defaultProps = {
      fileUrl: 'https://example.com/document.pdf',
      onPageChange: mockOnPageChange,
      ...props,
    };

    return render(<PDFViewer {...defaultProps} />);
  };

  describe('Rendering', () => {
    it('should render loading state initially', () => {
      renderComponent();
      
      expect(screen.getByText(/loading pdf/i)).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should render PDF viewer after loading', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByRole('region', { name: /pdf viewer/i })).toBeInTheDocument();
        expect(screen.getByText(/page 1 of 5/i)).toBeInTheDocument();
      });
    });

    it('should display error state on load failure', async () => {
      const pdfjs = require('pdfjs-dist');
      pdfjs.getDocument.mockReturnValue({
        promise: Promise.reject(new Error('Failed to load PDF')),
      });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/failed to load pdf/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('should render toolbar with controls', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /previous page/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /next page/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /zoom in/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /zoom out/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /fit to width/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /fit to page/i })).toBeInTheDocument();
      });
    });

    it('should render page thumbnails when enabled', async () => {
      renderComponent({ showThumbnails: true });
      
      await waitFor(() => {
        expect(screen.getByRole('navigation', { name: /page thumbnails/i })).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: /go to page/i })).toHaveLength(5);
      });
    });

    it('should render search bar when enabled', async () => {
      renderComponent({ enableSearch: true });
      
      await waitFor(() => {
        expect(screen.getByRole('searchbox', { name: /search in document/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate to next page', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/page 1 of 5/i)).toBeInTheDocument();
      });
      
      const nextButton = screen.getByRole('button', { name: /next page/i });
      await userEvent.click(nextButton);
      
      expect(mockOnPageChange).toHaveBeenCalledWith(2);
      expect(screen.getByText(/page 2 of 5/i)).toBeInTheDocument();
    });

    it('should navigate to previous page', async () => {
      renderComponent({ initialPage: 3 });
      
      await waitFor(() => {
        expect(screen.getByText(/page 3 of 5/i)).toBeInTheDocument();
      });
      
      const prevButton = screen.getByRole('button', { name: /previous page/i });
      await userEvent.click(prevButton);
      
      expect(mockOnPageChange).toHaveBeenCalledWith(2);
      expect(screen.getByText(/page 2 of 5/i)).toBeInTheDocument();
    });

    it('should jump to specific page', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByRole('spinbutton', { name: /page number/i })).toBeInTheDocument();
      });
      
      const pageInput = screen.getByRole('spinbutton', { name: /page number/i });
      await userEvent.clear(pageInput);
      await userEvent.type(pageInput, '4');
      await userEvent.keyboard('{Enter}');
      
      expect(mockOnPageChange).toHaveBeenCalledWith(4);
      expect(screen.getByText(/page 4 of 5/i)).toBeInTheDocument();
    });

    it('should navigate via thumbnails', async () => {
      renderComponent({ showThumbnails: true });
      
      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /go to page/i })).toHaveLength(5);
      });
      
      const thumbnail3 = screen.getByRole('button', { name: /go to page 3/i });
      await userEvent.click(thumbnail3);
      
      expect(mockOnPageChange).toHaveBeenCalledWith(3);
      expect(screen.getByText(/page 3 of 5/i)).toBeInTheDocument();
    });

    it('should disable previous button on first page', async () => {
      renderComponent();
      
      await waitFor(() => {
        const prevButton = screen.getByRole('button', { name: /previous page/i });
        expect(prevButton).toBeDisabled();
      });
    });

    it('should disable next button on last page', async () => {
      renderComponent({ initialPage: 5 });
      
      await waitFor(() => {
        const nextButton = screen.getByRole('button', { name: /next page/i });
        expect(nextButton).toBeDisabled();
      });
    });
  });

  describe('Zoom Controls', () => {
    it('should zoom in', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('100%')).toBeInTheDocument();
      });
      
      const zoomInButton = screen.getByRole('button', { name: /zoom in/i });
      await userEvent.click(zoomInButton);
      
      expect(screen.getByText('125%')).toBeInTheDocument();
    });

    it('should zoom out', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('100%')).toBeInTheDocument();
      });
      
      const zoomOutButton = screen.getByRole('button', { name: /zoom out/i });
      await userEvent.click(zoomOutButton);
      
      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('should fit to width', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /fit to width/i })).toBeInTheDocument();
      });
      
      const fitWidthButton = screen.getByRole('button', { name: /fit to width/i });
      await userEvent.click(fitWidthButton);
      
      expect(screen.getByText(/fit width/i)).toBeInTheDocument();
    });

    it('should fit to page', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /fit to page/i })).toBeInTheDocument();
      });
      
      const fitPageButton = screen.getByRole('button', { name: /fit to page/i });
      await userEvent.click(fitPageButton);
      
      expect(screen.getByText(/fit page/i)).toBeInTheDocument();
    });

    it('should select custom zoom level', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: /zoom level/i })).toBeInTheDocument();
      });
      
      const zoomSelect = screen.getByRole('combobox', { name: /zoom level/i });
      await userEvent.selectOptions(zoomSelect, '150');
      
      expect(screen.getByText('150%')).toBeInTheDocument();
    });

    it('should limit zoom range', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('100%')).toBeInTheDocument();
      });
      
      const zoomOutButton = screen.getByRole('button', { name: /zoom out/i });
      
      // Zoom out to minimum
      for (let i = 0; i < 10; i++) {
        await userEvent.click(zoomOutButton);
      }
      
      expect(screen.getByText('25%')).toBeInTheDocument();
      expect(zoomOutButton).toBeDisabled();
    });
  });

  describe('Text Selection', () => {
    it('should allow text selection', async () => {
      renderComponent({ enableTextSelection: true, onTextSelect: mockOnTextSelect });
      
      await waitFor(() => {
        expect(screen.getByText(/this is page content/i)).toBeInTheDocument();
      });
      
      const textElement = screen.getByText(/this is page content/i);
      
      // Simulate text selection
      fireEvent.mouseDown(textElement);
      fireEvent.mouseMove(textElement);
      fireEvent.mouseUp(textElement);
      
      await waitFor(() => {
        expect(mockOnTextSelect).toHaveBeenCalled();
      });
    });

    it('should show copy button on text selection', async () => {
      renderComponent({ enableTextSelection: true });
      
      await waitFor(() => {
        expect(screen.getByText(/this is page content/i)).toBeInTheDocument();
      });
      
      // Simulate text selection
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(screen.getByText(/this is page content/i));
      selection?.removeAllRanges();
      selection?.addRange(range);
      
      fireEvent.mouseUp(document);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /copy text/i })).toBeInTheDocument();
      });
    });
  });

  describe('Search', () => {
    it('should search for text in document', async () => {
      renderComponent({ enableSearch: true });
      
      await waitFor(() => {
        expect(screen.getByRole('searchbox')).toBeInTheDocument();
      });
      
      const searchInput = screen.getByRole('searchbox');
      await userEvent.type(searchInput, 'content');
      
      const searchButton = screen.getByRole('button', { name: /search/i });
      await userEvent.click(searchButton);
      
      await waitFor(() => {
        expect(screen.getByText(/2 matches found/i)).toBeInTheDocument();
      });
    });

    it('should navigate through search results', async () => {
      renderComponent({ enableSearch: true });
      
      await waitFor(() => {
        expect(screen.getByRole('searchbox')).toBeInTheDocument();
      });
      
      const searchInput = screen.getByRole('searchbox');
      await userEvent.type(searchInput, 'content');
      await userEvent.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(screen.getByText(/match 1 of 2/i)).toBeInTheDocument();
      });
      
      const nextMatch = screen.getByRole('button', { name: /next match/i });
      await userEvent.click(nextMatch);
      
      expect(screen.getByText(/match 2 of 2/i)).toBeInTheDocument();
    });

    it('should highlight search results', async () => {
      renderComponent({ enableSearch: true });
      
      await waitFor(() => {
        expect(screen.getByRole('searchbox')).toBeInTheDocument();
      });
      
      const searchInput = screen.getByRole('searchbox');
      await userEvent.type(searchInput, 'content');
      await userEvent.keyboard('{Enter}');
      
      await waitFor(() => {
        const highlights = document.querySelectorAll('.highlight');
        expect(highlights).toHaveLength(2);
      });
    });

    it('should clear search', async () => {
      renderComponent({ enableSearch: true });
      
      await waitFor(() => {
        expect(screen.getByRole('searchbox')).toBeInTheDocument();
      });
      
      const searchInput = screen.getByRole('searchbox');
      await userEvent.type(searchInput, 'content');
      await userEvent.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(screen.getByText(/2 matches found/i)).toBeInTheDocument();
      });
      
      const clearButton = screen.getByRole('button', { name: /clear search/i });
      await userEvent.click(clearButton);
      
      expect(screen.queryByText(/matches found/i)).not.toBeInTheDocument();
      expect(searchInput).toHaveValue('');
    });
  });

  describe('Annotations', () => {
    it('should enable annotation mode', async () => {
      renderComponent({ enableAnnotations: true, onAnnotate: mockOnAnnotate });
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add annotation/i })).toBeInTheDocument();
      });
      
      const annotateButton = screen.getByRole('button', { name: /add annotation/i });
      await userEvent.click(annotateButton);
      
      expect(screen.getByText(/click to add annotation/i)).toBeInTheDocument();
    });

    it('should add annotation on click', async () => {
      renderComponent({ enableAnnotations: true, onAnnotate: mockOnAnnotate });
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add annotation/i })).toBeInTheDocument();
      });
      
      const annotateButton = screen.getByRole('button', { name: /add annotation/i });
      await userEvent.click(annotateButton);
      
      const canvas = screen.getByRole('img', { name: /pdf page/i });
      fireEvent.click(canvas, { clientX: 100, clientY: 100 });
      
      expect(screen.getByRole('textbox', { name: /annotation text/i })).toBeInTheDocument();
    });

    it('should save annotation', async () => {
      renderComponent({ enableAnnotations: true, onAnnotate: mockOnAnnotate });
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add annotation/i })).toBeInTheDocument();
      });
      
      const annotateButton = screen.getByRole('button', { name: /add annotation/i });
      await userEvent.click(annotateButton);
      
      const canvas = screen.getByRole('img', { name: /pdf page/i });
      fireEvent.click(canvas, { clientX: 100, clientY: 100 });
      
      const annotationInput = screen.getByRole('textbox', { name: /annotation text/i });
      await userEvent.type(annotationInput, 'Important note');
      
      const saveButton = screen.getByRole('button', { name: /save annotation/i });
      await userEvent.click(saveButton);
      
      expect(mockOnAnnotate).toHaveBeenCalledWith({
        page: 1,
        x: 100,
        y: 100,
        text: 'Important note',
      });
    });

    it('should display existing annotations', async () => {
      const annotations = [
        { page: 1, x: 100, y: 100, text: 'Note 1' },
        { page: 1, x: 200, y: 200, text: 'Note 2' },
      ];
      
      renderComponent({ 
        enableAnnotations: true,
        annotations,
      });
      
      await waitFor(() => {
        expect(screen.getByText('Note 1')).toBeInTheDocument();
        expect(screen.getByText('Note 2')).toBeInTheDocument();
      });
    });

    it('should delete annotation', async () => {
      const annotations = [
        { id: '1', page: 1, x: 100, y: 100, text: 'Note 1' },
      ];
      
      const mockOnDeleteAnnotation = vi.fn();
      
      renderComponent({ 
        enableAnnotations: true,
        annotations,
        onDeleteAnnotation: mockOnDeleteAnnotation,
      });
      
      await waitFor(() => {
        expect(screen.getByText('Note 1')).toBeInTheDocument();
      });
      
      const deleteButton = screen.getByRole('button', { name: /delete annotation/i });
      await userEvent.click(deleteButton);
      
      expect(mockOnDeleteAnnotation).toHaveBeenCalledWith('1');
    });
  });

  describe('Export Actions', () => {
    it('should download PDF', async () => {
      renderComponent({ onDownload: mockOnDownload });
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
      });
      
      const downloadButton = screen.getByRole('button', { name: /download/i });
      await userEvent.click(downloadButton);
      
      expect(mockOnDownload).toHaveBeenCalled();
    });

    it('should print PDF', async () => {
      renderComponent({ onPrint: mockOnPrint });
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /print/i })).toBeInTheDocument();
      });
      
      const printButton = screen.getByRole('button', { name: /print/i });
      await userEvent.click(printButton);
      
      expect(mockOnPrint).toHaveBeenCalled();
    });

    it('should rotate pages', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /rotate left/i })).toBeInTheDocument();
      });
      
      const rotateLeftButton = screen.getByRole('button', { name: /rotate left/i });
      await userEvent.click(rotateLeftButton);
      
      const canvas = screen.getByRole('img', { name: /pdf page/i });
      expect(canvas).toHaveStyle({ transform: 'rotate(-90deg)' });
      
      const rotateRightButton = screen.getByRole('button', { name: /rotate right/i });
      await userEvent.click(rotateRightButton);
      await userEvent.click(rotateRightButton);
      
      expect(canvas).toHaveStyle({ transform: 'rotate(90deg)' });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByRole('region', { name: /pdf viewer/i })).toBeInTheDocument();
        expect(screen.getByRole('toolbar', { name: /pdf controls/i })).toBeInTheDocument();
        expect(screen.getByRole('img', { name: /pdf page 1/i })).toBeInTheDocument();
      });
    });

    it('should support keyboard navigation', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/page 1 of 5/i)).toBeInTheDocument();
      });
      
      // Arrow keys for navigation
      fireEvent.keyDown(document, { key: 'ArrowRight' });
      expect(mockOnPageChange).toHaveBeenCalledWith(2);
      
      fireEvent.keyDown(document, { key: 'ArrowLeft' });
      expect(mockOnPageChange).toHaveBeenCalledWith(1);
      
      // Page Up/Down
      fireEvent.keyDown(document, { key: 'PageDown' });
      expect(mockOnPageChange).toHaveBeenCalledWith(2);
      
      fireEvent.keyDown(document, { key: 'PageUp' });
      expect(mockOnPageChange).toHaveBeenCalledWith(1);
    });

    it('should support keyboard shortcuts for zoom', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('100%')).toBeInTheDocument();
      });
      
      // Ctrl/Cmd + Plus for zoom in
      fireEvent.keyDown(document, { key: '+', ctrlKey: true });
      expect(screen.getByText('125%')).toBeInTheDocument();
      
      // Ctrl/Cmd + Minus for zoom out  
      fireEvent.keyDown(document, { key: '-', ctrlKey: true });
      expect(screen.getByText('100%')).toBeInTheDocument();
      
      // Ctrl/Cmd + 0 for reset zoom
      fireEvent.keyDown(document, { key: '0', ctrlKey: true });
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('should announce page changes to screen readers', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/page 1 of 5/i)).toBeInTheDocument();
      });
      
      const nextButton = screen.getByRole('button', { name: /next page/i });
      await userEvent.click(nextButton);
      
      const announcement = screen.getByRole('status');
      expect(announcement).toHaveTextContent('Page 2 of 5');
    });
  });

  describe('Performance', () => {
    it('should lazy load pages', async () => {
      renderComponent({ lazyLoadPages: true });
      
      await waitFor(() => {
        expect(mockPDFDocument.getPage).toHaveBeenCalledTimes(1);
        expect(mockPDFDocument.getPage).toHaveBeenCalledWith(1);
      });
      
      const nextButton = screen.getByRole('button', { name: /next page/i });
      await userEvent.click(nextButton);
      
      expect(mockPDFDocument.getPage).toHaveBeenCalledTimes(2);
      expect(mockPDFDocument.getPage).toHaveBeenCalledWith(2);
    });

    it('should cache rendered pages', async () => {
      renderComponent({ cachePages: true });
      
      await waitFor(() => {
        expect(mockPDFDocument.getPage).toHaveBeenCalledTimes(1);
      });
      
      const nextButton = screen.getByRole('button', { name: /next page/i });
      const prevButton = screen.getByRole('button', { name: /previous page/i });
      
      await userEvent.click(nextButton);
      await userEvent.click(prevButton);
      
      // Should not call getPage again for page 1
      expect(mockPDFDocument.getPage).toHaveBeenCalledTimes(2);
    });

    it('should handle large PDFs efficiently', async () => {
      const largePDFDocument = {
        ...mockPDFDocument,
        numPages: 1000,
      };
      
      const pdfjs = require('pdfjs-dist');
      pdfjs.getDocument.mockReturnValue({
        promise: Promise.resolve(largePDFDocument),
      });
      
      renderComponent({ showThumbnails: true });
      
      await waitFor(() => {
        // Should only render visible thumbnails
        const thumbnails = screen.getAllByRole('button', { name: /go to page/i });
        expect(thumbnails.length).toBeLessThan(1000);
      });
    });
  });
});