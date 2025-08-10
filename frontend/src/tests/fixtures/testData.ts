/**
 * Test Data Fixtures for E2E and Integration Tests
 * Provides consistent test data across all tests
 */

export interface TestUser {
  id: string;
  email: string;
  name: string;
  role: string;
  tenant_id: string;
  department?: string;
  permissions: string[];
}

export interface TestContract {
  id: string;
  title: string;
  contract_number: string;
  contract_type: string;
  parties: string[];
  start_date: string;
  end_date: string;
  value: number;
  status: string;
  department?: string;
  owner_id: string;
  tenant_id: string;
}

export interface TestTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  variables: Record<string, any>;
  clauses: string[];
  version: string;
  is_active: boolean;
}

// User factory
export function createTestUser(overrides: Partial<TestUser> = {}): TestUser {
  const id = overrides.id || `user-${Date.now()}`;
  return {
    id,
    email: `user-${id}@test.com`,
    name: 'Test User',
    role: 'contract_manager',
    tenant_id: 'tenant-test',
    department: 'Legal',
    permissions: [
      'contracts.read',
      'contracts.write',
      'contracts.delete',
      'templates.read',
      'templates.write',
      'analytics.view'
    ],
    ...overrides
  };
}

// Contract factory
export function createTestContract(overrides: Partial<TestContract> = {}): TestContract {
  const id = overrides.id || `contract-${Date.now()}`;
  return {
    id,
    title: 'Test Service Agreement',
    contract_number: `CON-2024-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
    contract_type: 'service_agreement',
    parties: ['Acme Corporation', 'Legal AI Inc'],
    start_date: '2024-01-01',
    end_date: '2024-12-31',
    value: 100000,
    status: 'active',
    department: 'Procurement',
    owner_id: 'user-123',
    tenant_id: 'tenant-test',
    ...overrides
  };
}

// Template factory
export function createTestTemplate(overrides: Partial<TestTemplate> = {}): TestTemplate {
  const id = overrides.id || `template-${Date.now()}`;
  return {
    id,
    name: 'Standard Service Agreement',
    category: 'service_agreements',
    description: 'Template for standard service agreements',
    variables: {
      party_a: '',
      party_b: '',
      service_description: '',
      payment_terms: '',
      duration: '',
      governing_law: 'California'
    },
    clauses: [
      'Scope of Services',
      'Payment Terms',
      'Confidentiality',
      'Intellectual Property',
      'Termination',
      'Limitation of Liability',
      'Governing Law'
    ],
    version: '1.0.0',
    is_active: true,
    ...overrides
  };
}

// Batch creation helpers
export function createTestUsers(count: number, overrides: Partial<TestUser> = {}): TestUser[] {
  return Array.from({ length: count }, (_, i) => 
    createTestUser({
      ...overrides,
      id: `user-${i}`,
      email: `user${i}@test.com`,
      name: `Test User ${i}`
    })
  );
}

export function createTestContracts(count: number, overrides: Partial<TestContract> = {}): TestContract[] {
  const statuses = ['draft', 'pending_review', 'active', 'expired'];
  const types = ['service_agreement', 'nda', 'purchase_order', 'license'];
  
  return Array.from({ length: count }, (_, i) => 
    createTestContract({
      ...overrides,
      id: `contract-${i}`,
      title: `Test Contract ${i}`,
      status: statuses[i % statuses.length],
      contract_type: types[i % types.length],
      value: Math.floor(Math.random() * 500000) + 10000
    })
  );
}

// Mock file data
export function createMockPDF(filename: string = 'test.pdf', size: number = 1024): File {
  const content = new Array(size).fill('A').join('');
  return new File([content], filename, { type: 'application/pdf' });
}

export function createMockDOCX(filename: string = 'test.docx', size: number = 1024): File {
  const content = new Array(size).fill('B').join('');
  return new File([content], filename, { 
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
  });
}

// Test contract content
export const SAMPLE_CONTRACT_TEXT = `
SERVICE AGREEMENT

This Service Agreement ("Agreement") is entered into as of January 1, 2024 ("Effective Date"), 
by and between Acme Corporation, a Delaware corporation ("Client"), and Legal AI Inc., 
a California corporation ("Service Provider").

1. SCOPE OF SERVICES
Service Provider agrees to provide the following services to Client:
- Contract management platform implementation
- AI-powered document analysis
- Training and support

2. PAYMENT TERMS
Client agrees to pay Service Provider a monthly fee of $10,000 for the services described herein.
Payment is due within 30 days of invoice receipt.

3. TERM AND TERMINATION
This Agreement shall commence on the Effective Date and continue for a period of one (1) year,
unless terminated earlier in accordance with this section.

4. CONFIDENTIALITY
Both parties agree to maintain the confidentiality of all proprietary information shared
during the course of this Agreement.

5. GOVERNING LAW
This Agreement shall be governed by the laws of the State of California.
`;

// Mock API responses
export const MOCK_API_RESPONSES = {
  loginSuccess: {
    access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock',
    token_type: 'bearer',
    expires_in: 3600,
    refresh_token: 'refresh-token-mock'
  },
  
  contractUploadSuccess: {
    id: 'contract-123',
    message: 'Contract uploaded successfully',
    status: 'processing',
    estimated_time: 30
  },
  
  extractionResult: {
    entities: {
      parties: ['Acme Corporation', 'Legal AI Inc'],
      dates: {
        effective_date: '2024-01-01',
        termination_date: '2024-12-31'
      },
      monetary_values: [
        { amount: 10000, currency: 'USD', frequency: 'monthly' }
      ],
      clauses: [
        { type: 'payment_terms', text: 'Payment is due within 30 days' },
        { type: 'confidentiality', text: 'Both parties agree to maintain confidentiality' }
      ]
    },
    confidence: 0.92,
    processing_time: 2.5
  },
  
  riskAnalysis: {
    overall_risk: 'medium',
    risk_score: 0.45,
    risk_factors: [
      { factor: 'Missing liability cap', severity: 'high', score: 0.8 },
      { factor: 'Broad termination clause', severity: 'medium', score: 0.5 },
      { factor: 'No dispute resolution', severity: 'low', score: 0.3 }
    ],
    recommendations: [
      'Add liability limitation clause',
      'Clarify termination conditions',
      'Include arbitration clause'
    ]
  }
};

// Validation helpers
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidContractNumber(number: string): boolean {
  const contractNumberRegex = /^CON-\d{4}-\d{3}$/;
  return contractNumberRegex.test(number);
}

export function isValidDate(date: string): boolean {
  const parsed = new Date(date);
  return !isNaN(parsed.getTime());
}

// Multi-tenant test data
export const TENANT_TEST_DATA = {
  tenantA: {
    id: 'tenant-a',
    name: 'Acme Corporation',
    subdomain: 'acme',
    users: createTestUsers(3, { tenant_id: 'tenant-a' }),
    contracts: createTestContracts(5, { tenant_id: 'tenant-a' })
  },
  tenantB: {
    id: 'tenant-b',
    name: 'TechCorp Solutions',
    subdomain: 'techcorp',
    users: createTestUsers(3, { tenant_id: 'tenant-b' }),
    contracts: createTestContracts(5, { tenant_id: 'tenant-b' })
  }
};

// Performance test data
export function generateLargeDataset() {
  return {
    users: createTestUsers(100),
    contracts: createTestContracts(1000),
    templates: Array.from({ length: 50 }, (_, i) => 
      createTestTemplate({ id: `template-${i}`, name: `Template ${i}` })
    )
  };
}

// Date helpers for testing
export const TEST_DATES = {
  today: new Date().toISOString().split('T')[0],
  yesterday: new Date(Date.now() - 86400000).toISOString().split('T')[0],
  tomorrow: new Date(Date.now() + 86400000).toISOString().split('T')[0],
  nextWeek: new Date(Date.now() + 604800000).toISOString().split('T')[0],
  nextMonth: new Date(Date.now() + 2592000000).toISOString().split('T')[0],
  nextYear: new Date(Date.now() + 31536000000).toISOString().split('T')[0]
};