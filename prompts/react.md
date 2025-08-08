# React/TypeScript TDD Best Practices - Legal AI Platform

## Core Principles
You are developing a React 18 frontend with TypeScript for an enterprise legal AI platform. Follow TDD (Test-Driven Development) using the Red-Green-Refactor cycle religiously. Every feature starts with a failing test.

## TDD Cycle: Red-Green-Refactor

### 1. RED Phase - Write a Failing Test First
```typescript
// L ALWAYS START HERE - Write test that fails
describe('ContractUpload', () => {
  it('should validate file type before upload', () => {
    const { getByTestId } = render(<ContractUpload />);
    const file = new File(['content'], 'test.exe', { type: 'application/exe' });
    const input = getByTestId('file-input');
    
    fireEvent.change(input, { target: { files: [file] } });
    
    expect(screen.getByText(/Invalid file type/i)).toBeInTheDocument();
    expect(mockUpload).not.toHaveBeenCalled();
  });
});
```

### 2. GREEN Phase - Write Minimum Code to Pass
```typescript
//  Write ONLY enough code to make test pass
const ContractUpload: React.FC = () => {
  const [error, setError] = useState<string>('');
  
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && !ALLOWED_TYPES.includes(file.type)) {
      setError('Invalid file type');
      return;
    }
    // Minimum implementation
  };
  
  return (
    <div>
      <input data-testid="file-input" type="file" onChange={handleFileChange} />
      {error && <span>{error}</span>}
    </div>
  );
};
```

### 3. REFACTOR Phase - Improve Without Breaking Tests
```typescript
// = Refactor for quality while keeping tests green
const ContractUpload: React.FC<ContractUploadProps> = ({ 
  onUpload, 
  maxSize = 10 * 1024 * 1024,
  allowedTypes = ALLOWED_DOCUMENT_TYPES 
}) => {
  const { error, setError, clearError } = useErrorHandler();
  const { validateFile } = useFileValidation({ maxSize, allowedTypes });
  
  const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const validation = validateFile(file);
    if (!validation.isValid) {
      setError(validation.error);
      return;
    }
    
    clearError();
    onUpload?.(file);
  }, [validateFile, onUpload, setError, clearError]);
  
  return (
    <FileUploadZone
      onFileChange={handleFileChange}
      error={error}
      acceptedTypes={allowedTypes}
      maxSize={maxSize}
    />
  );
};
```

## Component Testing Patterns

### 1. Test Structure Template
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ContractViewer } from './ContractViewer';

// Test utilities
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('ContractViewer', () => {
  // Setup
  let mockFetch: jest.Mock;
  
  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Initialization', () => {
    it('should load contract on mount', async () => {
      // Arrange
      const contractId = 'contract-123';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: contractId, title: 'Test Contract' })
      });
      
      // Act
      render(<ContractViewer contractId={contractId} />, { wrapper: createWrapper() });
      
      // Assert
      await waitFor(() => {
        expect(screen.getByText('Test Contract')).toBeInTheDocument();
      });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(contractId),
        expect.any(Object)
      );
    });
  });
  
  describe('User Interactions', () => {
    it('should highlight text when annotation mode is active', async () => {
      // Test user interactions
    });
  });
  
  describe('Error Handling', () => {
    it('should display error message on load failure', async () => {
      // Test error scenarios
    });
  });
});
```

### 2. Custom Hook Testing
```typescript
import { renderHook, act } from '@testing-library/react';
import { useContractSearch } from './useContractSearch';

describe('useContractSearch', () => {
  it('should debounce search queries', async () => {
    jest.useFakeTimers();
    const mockSearch = jest.fn();
    
    const { result } = renderHook(() => 
      useContractSearch({ onSearch: mockSearch, debounceMs: 500 })
    );
    
    act(() => {
      result.current.setQuery('test');
    });
    
    expect(mockSearch).not.toHaveBeenCalled();
    
    act(() => {
      jest.advanceTimersByTime(500);
    });
    
    expect(mockSearch).toHaveBeenCalledWith('test');
    jest.useRealTimers();
  });
});
```

### 3. Integration Testing
```typescript
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContractDashboard } from './ContractDashboard';
import { server } from '../mocks/server';
import { rest } from 'msw';

describe('Contract Dashboard Integration', () => {
  it('should filter contracts by status', async () => {
    const user = userEvent.setup();
    
    // Override MSW handler for this test
    server.use(
      rest.get('/api/v1/contracts', (req, res, ctx) => {
        const status = req.url.searchParams.get('status');
        const contracts = status === 'active' 
          ? [{ id: '1', title: 'Active Contract', status: 'active' }]
          : [];
        return res(ctx.json({ contracts }));
      })
    );
    
    render(<ContractDashboard />);
    
    // Wait for initial load
    await screen.findByText(/All Contracts/i);
    
    // Apply filter
    const filterButton = screen.getByRole('button', { name: /filter/i });
    await user.click(filterButton);
    
    const activeCheckbox = screen.getByRole('checkbox', { name: /active/i });
    await user.click(activeCheckbox);
    
    // Verify filtered results
    await waitFor(() => {
      expect(screen.getByText('Active Contract')).toBeInTheDocument();
      expect(screen.queryByText('Draft Contract')).not.toBeInTheDocument();
    });
  });
});
```

## State Management Testing

### 1. Zustand Store Testing
```typescript
import { act, renderHook } from '@testing-library/react';
import { useContractStore } from './contractStore';

describe('Contract Store', () => {
  beforeEach(() => {
    useContractStore.setState({ contracts: [], loading: false, error: null });
  });
  
  it('should add contract to store', () => {
    const { result } = renderHook(() => useContractStore());
    
    act(() => {
      result.current.addContract({
        id: '1',
        title: 'New Contract',
        status: 'draft'
      });
    });
    
    expect(result.current.contracts).toHaveLength(1);
    expect(result.current.contracts[0].title).toBe('New Contract');
  });
  
  it('should handle async operations', async () => {
    const { result } = renderHook(() => useContractStore());
    
    const promise = act(async () => {
      await result.current.fetchContracts();
    });
    
    // Check loading state immediately
    expect(result.current.loading).toBe(true);
    
    await promise;
    
    // Check final state
    expect(result.current.loading).toBe(false);
    expect(result.current.contracts).toHaveLength(2);
  });
});
```

### 2. React Query Testing
```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useContract } from './useContract';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useContract Hook', () => {
  it('should fetch contract data', async () => {
    const { result } = renderHook(
      () => useContract('contract-123'),
      { wrapper: createWrapper() }
    );
    
    expect(result.current.isLoading).toBe(true);
    
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    
    expect(result.current.data).toEqual({
      id: 'contract-123',
      title: 'Test Contract'
    });
  });
  
  it('should handle mutations', async () => {
    const { result } = renderHook(
      () => useContractMutation(),
      { wrapper: createWrapper() }
    );
    
    act(() => {
      result.current.mutate({
        title: 'Updated Contract'
      });
    });
    
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });
});
```

## Form Testing Patterns

### 1. React Hook Form with Zod
```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContractForm } from './ContractForm';

describe('ContractForm', () => {
  it('should validate required fields', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    
    render(<ContractForm onSubmit={onSubmit} />);
    
    // Try to submit empty form
    const submitButton = screen.getByRole('button', { name: /submit/i });
    await user.click(submitButton);
    
    // Check validation messages
    expect(await screen.findByText(/Title is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Party name is required/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
  
  it('should validate business rules', async () => {
    const user = userEvent.setup();
    
    render(<ContractForm />);
    
    // Enter invalid date range
    const startDate = screen.getByLabelText(/start date/i);
    const endDate = screen.getByLabelText(/end date/i);
    
    await user.type(startDate, '2024-12-31');
    await user.type(endDate, '2024-01-01');
    
    await user.click(screen.getByRole('button', { name: /submit/i }));
    
    expect(await screen.findByText(/End date must be after start date/i)).toBeInTheDocument();
  });
  
  it('should submit valid form data', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    
    render(<ContractForm onSubmit={onSubmit} />);
    
    // Fill form
    await user.type(screen.getByLabelText(/title/i), 'Service Agreement');
    await user.type(screen.getByLabelText(/party name/i), 'Acme Corp');
    await user.type(screen.getByLabelText(/value/i), '100000');
    
    // Submit
    await user.click(screen.getByRole('button', { name: /submit/i }));
    
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        title: 'Service Agreement',
        partyName: 'Acme Corp',
        value: 100000
      });
    });
  });
});
```

## Performance Testing

### 1. Component Performance
```typescript
import { render } from '@testing-library/react';
import { measurePerformance } from '../utils/performance';
import { LargeContractList } from './LargeContractList';

describe('Performance', () => {
  it('should render large lists efficiently', () => {
    const contracts = Array.from({ length: 1000 }, (_, i) => ({
      id: `contract-${i}`,
      title: `Contract ${i}`,
      status: 'active'
    }));
    
    const { duration, rerendersCount } = measurePerformance(() => {
      render(<LargeContractList contracts={contracts} />);
    });
    
    expect(duration).toBeLessThan(100); // ms
    expect(rerendersCount).toBeLessThan(3);
  });
  
  it('should virtualize long lists', () => {
    const { container } = render(
      <LargeContractList contracts={generateContracts(10000)} />
    );
    
    // Only visible items should be in DOM
    const renderedItems = container.querySelectorAll('[data-testid="contract-item"]');
    expect(renderedItems.length).toBeLessThan(50); // Virtualized
  });
});
```

## Accessibility Testing

### 1. A11y Standards
```typescript
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ContractViewer } from './ContractViewer';

expect.extend(toHaveNoViolations);

describe('Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(
      <ContractViewer contractId="test-123" />
    );
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
  
  it('should support keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<ContractViewer contractId="test-123" />);
    
    // Tab through interactive elements
    await user.tab();
    expect(screen.getByRole('button', { name: /edit/i })).toHaveFocus();
    
    await user.tab();
    expect(screen.getByRole('button', { name: /download/i })).toHaveFocus();
    
    // Activate with keyboard
    await user.keyboard('{Enter}');
    expect(mockDownload).toHaveBeenCalled();
  });
  
  it('should have proper ARIA labels', () => {
    render(<ContractUpload />);
    
    expect(screen.getByRole('button', { name: /upload contract/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/drag files here/i)).toBeInTheDocument();
  });
});
```

## Testing Best Practices

### 1. Test Organization
```typescript
// Group related tests logically
describe('ContractNegotiation', () => {
  describe('Initialization', () => {
    it('should load negotiation history');
    it('should identify all parties');
  });
  
  describe('Redlining', () => {
    it('should track changes');
    it('should attribute changes to users');
  });
  
  describe('Comments', () => {
    it('should thread comments');
    it('should notify mentioned users');
  });
  
  describe('Version Control', () => {
    it('should create new versions');
    it('should compare versions');
  });
});
```

### 2. Test Data Factories
```typescript
// factories/contract.factory.ts
import { Factory } from 'fishery';
import { faker } from '@faker-js/faker';
import { Contract } from '../types';

export const contractFactory = Factory.define<Contract>(() => ({
  id: faker.string.uuid(),
  title: faker.company.catchPhrase(),
  parties: [
    {
      name: faker.company.name(),
      role: 'vendor',
      signatureStatus: 'pending'
    }
  ],
  value: faker.number.int({ min: 10000, max: 1000000 }),
  startDate: faker.date.future(),
  status: faker.helpers.arrayElement(['draft', 'negotiation', 'active', 'expired']),
  createdAt: faker.date.past(),
  createdBy: faker.person.fullName()
}));

// Usage in tests
const contracts = contractFactory.buildList(5);
const activeContract = contractFactory.build({ status: 'active' });
```

### 3. Mock Service Worker (MSW)
```typescript
// mocks/handlers.ts
import { rest } from 'msw';

export const handlers = [
  rest.get('/api/v1/contracts/:id', (req, res, ctx) => {
    const { id } = req.params;
    return res(
      ctx.json({
        id,
        title: 'Test Contract',
        content: 'Contract content here'
      })
    );
  }),
  
  rest.post('/api/v1/contracts', async (req, res, ctx) => {
    const body = await req.json();
    return res(
      ctx.status(201),
      ctx.json({
        id: 'new-contract-id',
        ...body
      })
    );
  }),
  
  rest.post('/api/v1/contracts/:id/analyze', (req, res, ctx) => {
    return res(
      ctx.json({
        risks: ['Term ambiguity in clause 3.2'],
        obligations: ['Monthly payment due on 1st'],
        entities: ['Acme Corp', 'Legal AI Inc']
      })
    );
  })
];
```

## Component-Specific Testing

### 1. File Upload Component
```typescript
describe('FileUpload', () => {
  it('should handle drag and drop', async () => {
    const onUpload = jest.fn();
    render(<FileUpload onUpload={onUpload} />);
    
    const dropzone = screen.getByTestId('dropzone');
    const file = new File(['contract'], 'contract.pdf', { type: 'application/pdf' });
    
    fireEvent.dragEnter(dropzone);
    expect(dropzone).toHaveClass('drag-active');
    
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [file],
        items: [{ kind: 'file', getAsFile: () => file }]
      }
    });
    
    await waitFor(() => {
      expect(onUpload).toHaveBeenCalledWith(file);
    });
  });
  
  it('should show upload progress', async () => {
    const { rerender } = render(<FileUpload />);
    
    const file = new File(['x'.repeat(1024 * 1024)], 'large.pdf');
    
    // Trigger upload
    fireEvent.change(screen.getByLabelText(/upload/i), {
      target: { files: [file] }
    });
    
    // Check progress bar appears
    expect(await screen.findByRole('progressbar')).toBeInTheDocument();
    
    // Simulate progress updates
    act(() => {
      mockUploadProgress.emit('progress', { percent: 50 });
    });
    
    expect(screen.getByText(/50%/)).toBeInTheDocument();
  });
});
```

### 2. Graph Visualization Component
```typescript
describe('ContractGraph', () => {
  it('should render contract relationships', async () => {
    const graphData = {
      nodes: [
        { id: '1', label: 'Master Agreement' },
        { id: '2', label: 'Amendment 1' },
        { id: '3', label: 'Amendment 2' }
      ],
      edges: [
        { source: '1', target: '2', label: 'amends' },
        { source: '1', target: '3', label: 'amends' }
      ]
    };
    
    render(<ContractGraph data={graphData} />);
    
    // Wait for graph to render
    await waitFor(() => {
      expect(screen.getByTestId('graph-container')).toBeInTheDocument();
    });
    
    // Check nodes are rendered
    expect(screen.getByText('Master Agreement')).toBeInTheDocument();
    expect(screen.getByText('Amendment 1')).toBeInTheDocument();
    
    // Test interaction
    const node = screen.getByText('Master Agreement').closest('[data-testid="graph-node"]');
    fireEvent.click(node!);
    
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Contract Details/i)).toBeInTheDocument();
  });
});
```

## Error Boundary Testing
```typescript
describe('Error Boundaries', () => {
  it('should catch and display errors gracefully', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };
    
    const spy = jest.spyOn(console, 'error').mockImplementation();
    
    render(
      <ErrorBoundary fallback={<div>Something went wrong</div>}>
        <ThrowError />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    
    spy.mockRestore();
  });
  
  it('should log errors to monitoring service', () => {
    const mockLogError = jest.fn();
    
    render(
      <ErrorBoundary onError={mockLogError}>
        <ThrowError />
      </ErrorBoundary>
    );
    
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Test error',
        componentStack: expect.any(String)
      })
    );
  });
});
```

## Testing Checklist

### Before Every Component
- [ ] Write failing test first (RED)
- [ ] Implement minimum code to pass (GREEN)
- [ ] Refactor for quality (REFACTOR)
- [ ] Test accessibility
- [ ] Test error states
- [ ] Test loading states
- [ ] Test user interactions
- [ ] Test edge cases

### Coverage Requirements
- [ ] Minimum 80% code coverage
- [ ] 100% coverage for critical paths
- [ ] 100% coverage for utility functions
- [ ] Integration tests for user workflows
- [ ] E2E tests for critical user journeys

### Performance Checks
- [ ] Initial render < 100ms
- [ ] Re-render < 50ms
- [ ] Bundle size impact < 50KB
- [ ] No memory leaks
- [ ] Efficient list rendering

## Common Pitfalls to Avoid

1. **Never test implementation details** - Test behavior, not how it's implemented
2. **Avoid testing third-party libraries** - Mock them instead
3. **Don't couple tests** - Each test should be independent
4. **Avoid hard-coded waits** - Use waitFor instead of setTimeout
5. **Don't ignore console errors** - They indicate problems
6. **Never skip the RED phase** - Always see the test fail first
7. **Avoid large test files** - Split into logical groups
8. **Don't test styles directly** - Test visual regression separately

## CI/CD Integration
```yaml
# Run tests in CI
test:
  script:
    - npm run test:unit -- --coverage
    - npm run test:integration
    - npm run test:a11y
  coverage: '/Lines\s*:\s*([0-9.]+)%/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
```

Remember: Every line of production code should exist because a test required it. No exceptions.