import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { TemplateGallery } from '../TemplateGallery';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  status: 'draft' | 'review' | 'approved' | 'deprecated';
  usageCount: number;
  rating: number;
  ratingCount: number;
  tags: string[];
  preview?: string;
  variables: Array<{
    name: string;
    type: string;
    required: boolean;
    description?: string;
  }>;
  permissions: {
    canEdit: boolean;
    canDelete: boolean;
    canClone: boolean;
    canUse: boolean;
  };
}

interface TemplateGalleryProps {
  templates: Template[];
  isLoading?: boolean;
  currentUser: {
    id: string;
    name: string;
    role: string;
    permissions: string[];
  };
  onCreateTemplate?: () => void;
  onEditTemplate?: (templateId: string) => void;
  onDeleteTemplate?: (templateId: string) => void;
  onCloneTemplate?: (templateId: string) => void;
  onUseTemplate?: (templateId: string) => void;
  onPreviewTemplate?: (templateId: string) => void;
  onRateTemplate?: (templateId: string, rating: number) => void;
  onBookmarkTemplate?: (templateId: string, bookmarked: boolean) => void;
}

// Mock API
vi.mock('../../../services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('TemplateGallery', () => {
  let queryClient: QueryClient;
  const mockOnCreateTemplate = vi.fn();
  const mockOnEditTemplate = vi.fn();
  const mockOnDeleteTemplate = vi.fn();
  const mockOnCloneTemplate = vi.fn();
  const mockOnUseTemplate = vi.fn();
  const mockOnPreviewTemplate = vi.fn();
  const mockOnRateTemplate = vi.fn();
  const mockOnBookmarkTemplate = vi.fn();

  const templates: Template[] = [
    {
      id: 't1',
      name: 'Software License Agreement',
      description: 'Standard software licensing template for SaaS products',
      category: 'Technology',
      version: '2.1',
      createdAt: '2024-01-10T10:00:00Z',
      updatedAt: '2024-01-15T14:30:00Z',
      createdBy: 'John Doe',
      status: 'approved',
      usageCount: 245,
      rating: 4.8,
      ratingCount: 32,
      tags: ['software', 'saas', 'licensing'],
      preview: 'This Software License Agreement governs the use of...',
      variables: [
        { name: 'company_name', type: 'text', required: true, description: 'Client company name' },
        { name: 'license_type', type: 'select', required: true, description: 'Type of license' },
      ],
      permissions: {
        canEdit: true,
        canDelete: false,
        canClone: true,
        canUse: true,
      },
    },
    {
      id: 't2',
      name: 'Employment Agreement',
      description: 'Comprehensive employment contract template',
      category: 'HR',
      version: '1.5',
      createdAt: '2024-01-05T08:00:00Z',
      updatedAt: '2024-01-12T16:45:00Z',
      createdBy: 'Jane Smith',
      status: 'approved',
      usageCount: 189,
      rating: 4.6,
      ratingCount: 28,
      tags: ['employment', 'hr', 'contract'],
      preview: 'This Employment Agreement is entered into between...',
      variables: [
        { name: 'employee_name', type: 'text', required: true },
        { name: 'position', type: 'text', required: true },
        { name: 'start_date', type: 'date', required: true },
        { name: 'salary', type: 'currency', required: true },
      ],
      permissions: {
        canEdit: false,
        canDelete: false,
        canClone: true,
        canUse: true,
      },
    },
    {
      id: 't3',
      name: 'Non-Disclosure Agreement',
      description: 'Standard NDA template for confidential information',
      category: 'Legal',
      version: '3.0',
      createdAt: '2024-01-08T12:00:00Z',
      updatedAt: '2024-01-18T09:15:00Z',
      createdBy: 'Bob Johnson',
      status: 'review',
      usageCount: 67,
      rating: 4.2,
      ratingCount: 15,
      tags: ['nda', 'confidentiality', 'legal'],
      preview: 'This Non-Disclosure Agreement is made between...',
      variables: [
        { name: 'disclosing_party', type: 'text', required: true },
        { name: 'receiving_party', type: 'text', required: true },
        { name: 'duration', type: 'number', required: true },
      ],
      permissions: {
        canEdit: true,
        canDelete: true,
        canClone: true,
        canUse: false, // Not approved yet
      },
    },
  ];

  const currentUser = {
    id: 'user1',
    name: 'John Doe',
    role: 'legal',
    permissions: ['create_templates', 'edit_templates', 'delete_templates', 'use_templates'],
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    const defaultProps = {
      templates,
      currentUser,
      onCreateTemplate: mockOnCreateTemplate,
      onEditTemplate: mockOnEditTemplate,
      onDeleteTemplate: mockOnDeleteTemplate,
      onCloneTemplate: mockOnCloneTemplate,
      onUseTemplate: mockOnUseTemplate,
      onPreviewTemplate: mockOnPreviewTemplate,
      onRateTemplate: mockOnRateTemplate,
      onBookmarkTemplate: mockOnBookmarkTemplate,
      ...props,
    };

    return render(
      <QueryClientProvider client={queryClient}>
        <TemplateGallery {...defaultProps} />
      </QueryClientProvider>
    );
  };

  describe('Rendering', () => {
    it('should render template gallery with all templates', () => {
      renderComponent();
      
      expect(screen.getByText('Template Gallery')).toBeInTheDocument();
      expect(screen.getByText('Software License Agreement')).toBeInTheDocument();
      expect(screen.getByText('Employment Agreement')).toBeInTheDocument();
      expect(screen.getByText('Non-Disclosure Agreement')).toBeInTheDocument();
    });

    it('should display template statistics', () => {
      renderComponent();
      
      expect(screen.getByText('3 templates found')).toBeInTheDocument();
      expect(screen.getByText(/245.*uses/i)).toBeInTheDocument();
      expect(screen.getByText(/4\.8.*rating/i)).toBeInTheDocument();
    });

    it('should show loading state', () => {
      renderComponent({ isLoading: true });
      
      expect(screen.getByText(/loading templates/i)).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should display empty state when no templates', () => {
      renderComponent({ templates: [] });
      
      expect(screen.getByText(/no templates found/i)).toBeInTheDocument();
      expect(screen.getByText(/create your first template/i)).toBeInTheDocument();
    });

    it('should show template categories', () => {
      renderComponent();
      
      expect(screen.getByText('Technology')).toBeInTheDocument();
      expect(screen.getByText('HR')).toBeInTheDocument();
      expect(screen.getByText('Legal')).toBeInTheDocument();
    });

    it('should display template status badges', () => {
      renderComponent();
      
      expect(screen.getAllByText(/approved/i)).toHaveLength(2);
      expect(screen.getByText(/review/i)).toBeInTheDocument();
    });
  });

  describe('Template Cards', () => {
    it('should display template information', () => {
      renderComponent();
      
      const templateCard = screen.getByTestId('template-t1');
      expect(templateCard).toHaveTextContent('Software License Agreement');
      expect(templateCard).toHaveTextContent('Standard software licensing template');
      expect(templateCard).toHaveTextContent('v2.1');
      expect(templateCard).toHaveTextContent('245 uses');
      expect(templateCard).toHaveTextContent('4.8');
    });

    it('should show template tags', () => {
      renderComponent();
      
      const templateCard = screen.getByTestId('template-t1');
      expect(templateCard).toHaveTextContent('software');
      expect(templateCard).toHaveTextContent('saas');
      expect(templateCard).toHaveTextContent('licensing');
    });

    it('should display author and dates', () => {
      renderComponent();
      
      const templateCard = screen.getByTestId('template-t1');
      expect(templateCard).toHaveTextContent('John Doe');
      expect(templateCard).toHaveTextContent('Jan 10, 2024');
    });

    it('should show variable count', () => {
      renderComponent();
      
      const templateCard = screen.getByTestId('template-t1');
      expect(templateCard).toHaveTextContent('2 variables');
    });

    it('should display ratings with stars', () => {
      renderComponent();
      
      const ratingDisplay = screen.getByTestId('rating-t1');
      expect(ratingDisplay).toHaveTextContent('4.8');
      expect(ratingDisplay).toHaveTextContent('32 reviews');
    });
  });

  describe('Search and Filtering', () => {
    it('should filter templates by search query', async () => {
      renderComponent();
      
      const searchInput = screen.getByRole('searchbox', { name: /search templates/i });
      await userEvent.type(searchInput, 'employment');
      
      expect(screen.getByText('Employment Agreement')).toBeInTheDocument();
      expect(screen.queryByText('Software License Agreement')).not.toBeInTheDocument();
    });

    it('should filter by category', async () => {
      renderComponent();
      
      const categoryFilter = screen.getByRole('combobox', { name: /filter by category/i });
      await userEvent.selectOptions(categoryFilter, 'Technology');
      
      expect(screen.getByText('Software License Agreement')).toBeInTheDocument();
      expect(screen.queryByText('Employment Agreement')).not.toBeInTheDocument();
    });

    it('should filter by status', async () => {
      renderComponent();
      
      const statusFilter = screen.getByRole('combobox', { name: /filter by status/i });
      await userEvent.selectOptions(statusFilter, 'review');
      
      expect(screen.getByText('Non-Disclosure Agreement')).toBeInTheDocument();
      expect(screen.queryByText('Software License Agreement')).not.toBeInTheDocument();
    });

    it('should filter by tags', async () => {
      renderComponent();
      
      const tagFilter = screen.getByTestId('tag-filter');
      const hrTag = tagFilter.querySelector('[data-tag="hr"]');
      await userEvent.click(hrTag!);
      
      expect(screen.getByText('Employment Agreement')).toBeInTheDocument();
      expect(screen.queryByText('Software License Agreement')).not.toBeInTheDocument();
    });

    it('should show only favorites when filter is active', async () => {
      const templatesWithFavorites = templates.map((t, i) => ({
        ...t,
        isFavorite: i === 0,
      }));
      
      renderComponent({ templates: templatesWithFavorites });
      
      const favoritesToggle = screen.getByRole('button', { name: /show favorites only/i });
      await userEvent.click(favoritesToggle);
      
      expect(screen.getByText('Software License Agreement')).toBeInTheDocument();
      expect(screen.queryByText('Employment Agreement')).not.toBeInTheDocument();
    });

    it('should clear all filters', async () => {
      renderComponent();
      
      const categoryFilter = screen.getByRole('combobox', { name: /filter by category/i });
      await userEvent.selectOptions(categoryFilter, 'Technology');
      
      const clearButton = screen.getByRole('button', { name: /clear filters/i });
      await userEvent.click(clearButton);
      
      expect(screen.getByText('Software License Agreement')).toBeInTheDocument();
      expect(screen.getByText('Employment Agreement')).toBeInTheDocument();
    });
  });

  describe('Sorting', () => {
    it('should sort templates by name', async () => {
      renderComponent();
      
      const sortSelect = screen.getByRole('combobox', { name: /sort by/i });
      await userEvent.selectOptions(sortSelect, 'name');
      
      const templateCards = screen.getAllByTestId(/^template-/);
      expect(templateCards[0]).toHaveTextContent('Employment Agreement');
      expect(templateCards[1]).toHaveTextContent('Non-Disclosure Agreement');
    });

    it('should sort by usage count', async () => {
      renderComponent();
      
      const sortSelect = screen.getByRole('combobox', { name: /sort by/i });
      await userEvent.selectOptions(sortSelect, 'usage');
      
      const templateCards = screen.getAllByTestId(/^template-/);
      expect(templateCards[0]).toHaveTextContent('Software License Agreement'); // 245 uses
    });

    it('should sort by rating', async () => {
      renderComponent();
      
      const sortSelect = screen.getByRole('combobox', { name: /sort by/i });
      await userEvent.selectOptions(sortSelect, 'rating');
      
      const templateCards = screen.getAllByTestId(/^template-/);
      expect(templateCards[0]).toHaveTextContent('Software License Agreement'); // 4.8 rating
    });

    it('should sort by date created', async () => {
      renderComponent();
      
      const sortSelect = screen.getByRole('combobox', { name: /sort by/i });
      await userEvent.selectOptions(sortSelect, 'created');
      
      const templateCards = screen.getAllByTestId(/^template-/);
      expect(templateCards[0]).toHaveTextContent('Software License Agreement'); // Newest
    });

    it('should toggle sort direction', async () => {
      renderComponent();
      
      const sortDirectionButton = screen.getByRole('button', { name: /sort direction/i });
      await userEvent.click(sortDirectionButton);
      
      expect(sortDirectionButton).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('Template Actions', () => {
    it('should preview template', async () => {
      renderComponent();
      
      const previewButton = screen.getByRole('button', { name: /preview.*software/i });
      await userEvent.click(previewButton);
      
      expect(mockOnPreviewTemplate).toHaveBeenCalledWith('t1');
    });

    it('should use template', async () => {
      renderComponent();
      
      const useButton = screen.getByRole('button', { name: /use.*software/i });
      await userEvent.click(useButton);
      
      expect(mockOnUseTemplate).toHaveBeenCalledWith('t1');
    });

    it('should clone template', async () => {
      renderComponent();
      
      const actionsButton = screen.getAllByRole('button', { name: /template actions/i })[0];
      await userEvent.click(actionsButton);
      
      const cloneButton = screen.getByRole('menuitem', { name: /clone template/i });
      await userEvent.click(cloneButton);
      
      expect(mockOnCloneTemplate).toHaveBeenCalledWith('t1');
    });

    it('should edit template when permitted', async () => {
      renderComponent();
      
      const actionsButton = screen.getAllByRole('button', { name: /template actions/i })[0];
      await userEvent.click(actionsButton);
      
      const editButton = screen.getByRole('menuitem', { name: /edit template/i });
      await userEvent.click(editButton);
      
      expect(mockOnEditTemplate).toHaveBeenCalledWith('t1');
    });

    it('should delete template with confirmation', async () => {
      renderComponent();
      
      const actionsButton = screen.getAllByRole('button', { name: /template actions/i })[2]; // NDA template
      await userEvent.click(actionsButton);
      
      const deleteButton = screen.getByRole('menuitem', { name: /delete template/i });
      await userEvent.click(deleteButton);
      
      const confirmButton = screen.getByRole('button', { name: /confirm delete/i });
      await userEvent.click(confirmButton);
      
      expect(mockOnDeleteTemplate).toHaveBeenCalledWith('t3');
    });

    it('should hide actions based on permissions', () => {
      const limitedUser = {
        ...currentUser,
        permissions: ['use_templates'], // No edit/delete permissions
      };
      
      renderComponent({ currentUser: limitedUser });
      
      const actionsButton = screen.getAllByRole('button', { name: /template actions/i })[0];
      fireEvent.click(actionsButton);
      
      expect(screen.queryByRole('menuitem', { name: /edit template/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: /delete template/i })).not.toBeInTheDocument();
    });

    it('should disable use button for non-approved templates', () => {
      renderComponent();
      
      const reviewTemplate = screen.getByTestId('template-t3');
      const useButton = reviewTemplate.querySelector('[data-action="use"]');
      
      expect(useButton).toBeDisabled();
      expect(useButton).toHaveAttribute('title', expect.stringContaining('not approved'));
    });
  });

  describe('Rating System', () => {
    it('should allow rating a template', async () => {
      renderComponent();
      
      const ratingStars = screen.getByTestId('rating-input-t1');
      const fourthStar = ratingStars.querySelector('[data-star="4"]');
      await userEvent.click(fourthStar!);
      
      expect(mockOnRateTemplate).toHaveBeenCalledWith('t1', 4);
    });

    it('should show current user rating', () => {
      const templatesWithUserRating = templates.map(t => ({
        ...t,
        userRating: t.id === 't1' ? 5 : undefined,
      }));
      
      renderComponent({ templates: templatesWithUserRating });
      
      const ratingStars = screen.getByTestId('rating-input-t1');
      const filledStars = ratingStars.querySelectorAll('.text-yellow-400');
      expect(filledStars).toHaveLength(5);
    });

    it('should display rating statistics', () => {
      renderComponent();
      
      const ratingDisplay = screen.getByTestId('rating-t1');
      expect(ratingDisplay).toHaveTextContent('4.8 (32 reviews)');
    });
  });

  describe('Bookmarking', () => {
    it('should bookmark a template', async () => {
      renderComponent();
      
      const bookmarkButton = screen.getByRole('button', { name: /bookmark.*software/i });
      await userEvent.click(bookmarkButton);
      
      expect(mockOnBookmarkTemplate).toHaveBeenCalledWith('t1', true);
    });

    it('should unbookmark a template', async () => {
      const templatesWithBookmarks = templates.map(t => ({
        ...t,
        isBookmarked: t.id === 't1',
      }));
      
      renderComponent({ templates: templatesWithBookmarks });
      
      const bookmarkButton = screen.getByRole('button', { name: /unbookmark.*software/i });
      await userEvent.click(bookmarkButton);
      
      expect(mockOnBookmarkTemplate).toHaveBeenCalledWith('t1', false);
    });

    it('should show bookmark status', () => {
      const templatesWithBookmarks = templates.map(t => ({
        ...t,
        isBookmarked: t.id === 't1',
      }));
      
      renderComponent({ templates: templatesWithBookmarks });
      
      const bookmarkButton = screen.getByRole('button', { name: /unbookmark.*software/i });
      expect(bookmarkButton).toHaveClass('bookmarked');
    });
  });

  describe('View Modes', () => {
    it('should switch to list view', async () => {
      renderComponent();
      
      const listViewButton = screen.getByRole('button', { name: /list view/i });
      await userEvent.click(listViewButton);
      
      const templatesContainer = screen.getByTestId('templates-container');
      expect(templatesContainer).toHaveClass('list-view');
    });

    it('should switch to grid view', async () => {
      renderComponent();
      
      const gridViewButton = screen.getByRole('button', { name: /grid view/i });
      await userEvent.click(gridViewButton);
      
      const templatesContainer = screen.getByTestId('templates-container');
      expect(templatesContainer).toHaveClass('grid-view');
    });

    it('should adjust card size', async () => {
      renderComponent();
      
      const cardSizeSelect = screen.getByRole('combobox', { name: /card size/i });
      await userEvent.selectOptions(cardSizeSelect, 'large');
      
      const templateCard = screen.getByTestId('template-t1');
      expect(templateCard).toHaveClass('large');
    });
  });

  describe('Template Creation', () => {
    it('should create new template', async () => {
      renderComponent();
      
      const createButton = screen.getByRole('button', { name: /create template/i });
      await userEvent.click(createButton);
      
      expect(mockOnCreateTemplate).toHaveBeenCalled();
    });

    it('should hide create button without permission', () => {
      const limitedUser = {
        ...currentUser,
        permissions: ['use_templates'],
      };
      
      renderComponent({ currentUser: limitedUser });
      
      expect(screen.queryByRole('button', { name: /create template/i })).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderComponent();
      
      expect(screen.getByRole('region', { name: /template gallery/i })).toBeInTheDocument();
      expect(screen.getByRole('searchbox', { name: /search templates/i })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: /template filters/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      renderComponent();
      
      const firstTemplate = screen.getByTestId('template-t1');
      firstTemplate.focus();
      
      fireEvent.keyDown(firstTemplate, { key: 'ArrowDown' });
      const secondTemplate = screen.getByTestId('template-t2');
      expect(secondTemplate).toHaveFocus();
    });

    it('should announce template count changes', async () => {
      renderComponent();
      
      const searchInput = screen.getByRole('searchbox', { name: /search templates/i });
      await userEvent.type(searchInput, 'employment');
      
      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toHaveTextContent('1 template found');
    });

    it('should provide template descriptions for screen readers', () => {
      renderComponent();
      
      const templateCard = screen.getByTestId('template-t1');
      expect(templateCard).toHaveAttribute('aria-describedby', expect.stringContaining('description'));
    });
  });

  describe('Error Handling', () => {
    it('should display error message for failed actions', async () => {
      mockOnUseTemplate.mockRejectedValue(new Error('Template not available'));
      
      renderComponent();
      
      const useButton = screen.getByRole('button', { name: /use.*software/i });
      await userEvent.click(useButton);
      
      await waitFor(() => {
        expect(screen.getByText(/failed to use template/i)).toBeInTheDocument();
      });
    });

    it('should handle missing template data gracefully', () => {
      const incompleteTemplates = [{
        id: 't1',
        name: 'Incomplete Template',
        // Missing required fields
      }];
      
      renderComponent({ templates: incompleteTemplates });
      
      expect(screen.getByText('Incomplete Template')).toBeInTheDocument();
      expect(screen.getByText(/unknown category/i)).toBeInTheDocument();
    });

    it('should retry failed template loading', async () => {
      renderComponent({ isLoading: false, templates: [] });
      
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await userEvent.click(retryButton);
      
      expect(screen.getByText(/loading templates/i)).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should handle large numbers of templates efficiently', () => {
      const manyTemplates = Array.from({ length: 1000 }, (_, i) => ({
        ...templates[0],
        id: `template-${i}`,
        name: `Template ${i}`,
      }));
      
      renderComponent({ templates: manyTemplates });
      
      expect(screen.getByText(/1000 templates found/i)).toBeInTheDocument();
    });

    it('should virtualize template list for performance', () => {
      const manyTemplates = Array.from({ length: 1000 }, (_, i) => ({
        ...templates[0],
        id: `template-${i}`,
        name: `Template ${i}`,
      }));
      
      renderComponent({ templates: manyTemplates });
      
      // Should only render visible templates
      const renderedTemplates = document.querySelectorAll('[data-testid^="template-"]');
      expect(renderedTemplates.length).toBeLessThan(50);
    });
  });
});