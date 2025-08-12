import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { HolographicVisualizationService } from '../holographic-visualization.service';
import {
  Hologram,
  HologramType,
  HologramData,
  VisualizationSettings,
  AnimationSettings,
  LightingSettings,
  ContractVisualization,
  ContractSection3D,
  ContractRelationship3D,
  Annotation3D,
  VisualizationMetrics,
  LegalTimeline3D,
  TimelineEvent3D,
  TimelineVisualization,
  TimelineNavigation,
  EvidenceReconstruction,
  Evidence3DObject,
  EvidenceEnvironment,
  SimulationSettings,
  ObjectTimelineEvent,
  Transform3D,
  Vector3D,
  Quaternion
} from '../../types/revolutionary-features.types';

// Mock fetch globally
global.fetch = vi.fn();
const mockFetch = fetch as Mock;

// Mock Three.js (would be used in real implementation)
const mockThreeJS = {
  Scene: vi.fn(),
  WebGLRenderer: vi.fn(),
  PerspectiveCamera: vi.fn(),
  Object3D: vi.fn(),
  Geometry: vi.fn(),
  Material: vi.fn(),
  Mesh: vi.fn(),
};

global.THREE = mockThreeJS as any;

describe('HolographicVisualizationService', () => {
  let service: HolographicVisualizationService;
  const mockBaseUrl = 'https://api.example.com';
  const mockAuthToken = 'mock-token';

  beforeEach(() => {
    service = new HolographicVisualizationService(mockBaseUrl, mockAuthToken);
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Helper function to create mock transform
  const createMockTransform = (): Transform3D => ({
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 }
  });

  // Helper function to create mock hologram
  const createMockHologram = (): Hologram => ({
    id: 'hologram-1',
    name: 'Contract Visualization',
    type: 'contract',
    data: {
      source: 'contract-123',
      format: 'json',
      content: { sections: [] },
      metadata: { complexity: 'medium' }
    },
    visualization: {
      renderMode: 'solid',
      color: '#4A90E2',
      opacity: 0.8,
      animation: {
        type: 'rotate',
        speed: 1,
        loop: true,
        autoPlay: true
      },
      lighting: {
        ambient: 0.4,
        directional: 0.8,
        shadows: true,
        reflections: false
      }
    },
    transform: createMockTransform(),
    isVisible: true,
    createdAt: new Date()
  });

  describe('Hologram Management', () => {
    it('should create a hologram', async () => {
      const hologramData = {
        name: 'Contract Analysis',
        type: 'contract' as HologramType,
        data: {
          source: 'contract-456',
          format: 'json' as const,
          content: { sections: [{ id: 1, title: 'Terms' }] },
          metadata: { version: '1.0' }
        },
        visualization: {
          renderMode: 'solid' as const,
          color: '#4A90E2',
          opacity: 0.9,
          animation: {
            type: 'pulse' as const,
            speed: 2,
            loop: true,
            autoPlay: true
          },
          lighting: {
            ambient: 0.5,
            directional: 0.7,
            shadows: true,
            reflections: true
          }
        },
        transform: createMockTransform()
      };

      const mockResponse = createMockHologram();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockResponse })
      });

      const result = await service.createHologram(hologramData);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/holographic/holograms`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${mockAuthToken}`
          }),
          body: JSON.stringify(hologramData)
        })
      );
    });

    it('should get hologram by id', async () => {
      const hologramId = 'hologram-1';
      const mockResponse = createMockHologram();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockResponse })
      });

      const result = await service.getHologram(hologramId);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/holographic/holograms/${hologramId}`,
        expect.any(Object)
      );
    });

    it('should update hologram', async () => {
      const hologramId = 'hologram-1';
      const updates = {
        visualization: {
          color: '#FF5722',
          opacity: 0.6
        }
      };

      const mockResponse = { ...createMockHologram(), ...updates };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockResponse })
      });

      const result = await service.updateHologram(hologramId, updates);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/holographic/holograms/${hologramId}`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(updates)
        })
      );
    });

    it('should delete hologram', async () => {
      const hologramId = 'hologram-1';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.deleteHologram(hologramId);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/holographic/holograms/${hologramId}`,
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    });

    it('should list holograms with filters', async () => {
      const filters = { type: 'contract', isVisible: true };
      const mockHolograms = [createMockHologram()];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockHolograms,
          pagination: { page: 1, limit: 10, total: 1, pages: 1 }
        })
      });

      const result = await service.listHolograms(filters);

      expect(result.data).toEqual(mockHolograms);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/holographic/holograms?type=contract&isVisible=true`,
        expect.any(Object)
      );
    });

    it('should show hologram', async () => {
      const hologramId = 'hologram-1';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.showHologram(hologramId);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/holographic/holograms/${hologramId}/show`,
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    it('should hide hologram', async () => {
      const hologramId = 'hologram-1';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.hideHologram(hologramId);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/holographic/holograms/${hologramId}/hide`,
        expect.objectContaining({
          method: 'POST'
        })
      );
    });
  });

  describe('Contract Visualization', () => {
    it('should create contract visualization', async () => {
      const contractId = 'contract-123';
      const visualizationData = {
        layout: '3d-network',
        colorScheme: 'risk-based',
        showRelationships: true,
        highlightCriticalSections: true
      };

      const mockVisualization: ContractVisualization = {
        contractId: contractId,
        hologramId: 'hologram-contract-1',
        sections: [
          {
            id: 'section-1',
            title: 'Payment Terms',
            content: 'Payment due within 30 days',
            position: { x: 0, y: 0, z: 0 },
            size: { x: 1, y: 0.5, z: 0.1 },
            importance: 0.9,
            riskLevel: 'high',
            color: '#FF5722'
          }
        ],
        relationships: [
          {
            id: 'rel-1',
            fromSectionId: 'section-1',
            toSectionId: 'section-2',
            type: 'depends',
            strength: 0.8,
            visualization: 'curve'
          }
        ],
        annotations: [],
        metrics: {
          complexity: 0.7,
          renderTime: 150,
          polygonCount: 2500,
          memoryUsage: 512,
          performance: 'good'
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockVisualization })
      });

      const result = await service.createContractVisualization(contractId, visualizationData);

      expect(result).toEqual(mockVisualization);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/holographic/contracts/${contractId}/visualize`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(visualizationData)
        })
      );
    });

    it('should update contract section', async () => {
      const contractId = 'contract-123';
      const sectionId = 'section-1';
      const updates = {
        riskLevel: 'critical' as const,
        color: '#F44336'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.updateContractSection(contractId, sectionId, updates);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/holographic/contracts/${contractId}/sections/${sectionId}`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(updates)
        })
      );
    });

    it('should add contract annotation', async () => {
      const contractId = 'contract-123';
      const annotationData = {
        sectionId: 'section-1',
        type: 'warning' as const,
        content: 'High risk clause detected',
        author: 'AI Analysis',
        position: { x: 0.5, y: 0.8, z: 0.1 }
      };

      const mockAnnotation: Annotation3D = {
        id: 'annotation-1',
        ...annotationData,
        createdAt: new Date()
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockAnnotation })
      });

      const result = await service.addContractAnnotation(contractId, annotationData);

      expect(result).toEqual(mockAnnotation);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/holographic/contracts/${contractId}/annotations`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(annotationData)
        })
      );
    });

    it('should highlight contract risks', async () => {
      const contractId = 'contract-123';
      const riskLevels = ['high', 'critical'];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.highlightContractRisks(contractId, riskLevels);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/holographic/contracts/${contractId}/highlight-risks`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ riskLevels })
        })
      );
    });

    it('should animate contract flow', async () => {
      const contractId = 'contract-123';
      const animationData = {
        type: 'execution-flow',
        speed: 1.5,
        highlightPath: true
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.animateContractFlow(contractId, animationData);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/holographic/contracts/${contractId}/animate`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(animationData)
        })
      );
    });
  });

  describe('Legal Timeline Visualization', () => {
    it('should create legal timeline', async () => {
      const caseId = 'case-123';
      const timelineData = {
        layout: 'spiral',
        scale: 'month',
        style: 'modern',
        showDocuments: true,
        showParticipants: true
      };

      const mockTimeline: LegalTimeline3D = {
        id: 'timeline-1',
        caseId: caseId,
        events: [
          {
            id: 'event-1',
            date: new Date('2024-01-15'),
            title: 'Contract Signed',
            description: 'Initial contract agreement signed by all parties',
            type: 'milestone',
            importance: 0.9,
            position: { x: 0, y: 0, z: 0 },
            documents: ['doc-1', 'doc-2'],
            participants: ['party-1', 'party-2']
          }
        ],
        visualization: {
          layout: 'spiral',
          scale: 'month',
          style: 'modern',
          colors: {
            filing: '#2196F3',
            hearing: '#FF9800',
            decision: '#4CAF50',
            deadline: '#F44336',
            milestone: '#9C27B0'
          }
        },
        navigation: {
          currentPosition: new Date('2024-01-15'),
          viewRange: {
            start: new Date('2024-01-01'),
            end: new Date('2024-12-31')
          },
          zoomLevel: 1,
          autoPlay: false,
          playbackSpeed: 1
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockTimeline })
      });

      const result = await service.createLegalTimeline(caseId, timelineData);

      expect(result).toEqual(mockTimeline);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/holographic/cases/${caseId}/timeline`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(timelineData)
        })
      );
    });

    it('should add timeline event', async () => {
      const timelineId = 'timeline-1';
      const eventData = {
        date: new Date('2024-02-15'),
        title: 'Court Hearing',
        description: 'Preliminary hearing scheduled',
        type: 'hearing' as const,
        importance: 0.8,
        documents: ['hearing-doc-1'],
        participants: ['judge', 'plaintiff', 'defendant']
      };

      const mockEvent: TimelineEvent3D = {
        id: 'event-2',
        ...eventData,
        position: { x: 1, y: 0.5, z: 0 }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockEvent })
      });

      const result = await service.addTimelineEvent(timelineId, eventData);

      expect(result).toEqual(mockEvent);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/holographic/timeline/${timelineId}/events`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            ...eventData,
            date: eventData.date.toISOString()
          })
        })
      );
    });

    it('should navigate timeline', async () => {
      const timelineId = 'timeline-1';
      const navigationData = {
        targetDate: new Date('2024-06-15'),
        zoomLevel: 2,
        animationDuration: 1000
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.navigateTimeline(timelineId, navigationData);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/holographic/timeline/${timelineId}/navigate`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            ...navigationData,
            targetDate: navigationData.targetDate.toISOString()
          })
        })
      );
    });

    it('should filter timeline events', async () => {
      const timelineId = 'timeline-1';
      const filters = {
        eventTypes: ['hearing', 'decision'],
        dateRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-06-30')
        },
        participants: ['judge']
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.filterTimelineEvents(timelineId, filters);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/holographic/timeline/${timelineId}/filter`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            ...filters,
            dateRange: {
              start: filters.dateRange.start.toISOString(),
              end: filters.dateRange.end.toISOString()
            }
          })
        })
      );
    });

    it('should play timeline animation', async () => {
      const timelineId = 'timeline-1';
      const playbackSettings = {
        speed: 2,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        loop: false
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.playTimelineAnimation(timelineId, playbackSettings);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/holographic/timeline/${timelineId}/play`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            ...playbackSettings,
            startDate: playbackSettings.startDate.toISOString(),
            endDate: playbackSettings.endDate.toISOString()
          })
        })
      );
    });
  });

  describe('Evidence Reconstruction', () => {
    it('should create evidence reconstruction', async () => {
      const caseId = 'case-123';
      const reconstructionData = {
        scenario: 'Traffic Accident Recreation',
        timeOfIncident: new Date('2024-01-15T14:30:00Z'),
        location: 'Main St & 5th Ave',
        weatherConditions: 'clear',
        lightingConditions: 'daylight'
      };

      const mockReconstruction: EvidenceReconstruction = {
        id: 'evidence-recon-1',
        caseId: caseId,
        scenario: reconstructionData.scenario,
        objects: [
          {
            id: 'vehicle-1',
            name: 'Blue Sedan',
            type: 'vehicle',
            model: 'sedan-model-1',
            transform: createMockTransform(),
            properties: { speed: 35, direction: 'north' },
            timeline: [
              {
                timestamp: new Date('2024-01-15T14:29:50Z'),
                action: 'approaching_intersection',
                transform: createMockTransform(),
                properties: { speed: 35 }
              }
            ]
          }
        ],
        environment: {
          name: 'Urban Intersection',
          type: 'outdoor',
          lighting: 'day',
          weather: 'clear',
          model: 'intersection-model-1'
        },
        simulation: {
          physics: true,
          realTime: false,
          accuracy: 'high',
          recordingEnabled: true,
          playbackSpeed: 1
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockReconstruction })
      });

      const result = await service.createEvidenceReconstruction(caseId, reconstructionData);

      expect(result).toEqual(mockReconstruction);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/holographic/cases/${caseId}/evidence/reconstruction`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            ...reconstructionData,
            timeOfIncident: reconstructionData.timeOfIncident.toISOString()
          })
        })
      );
    });

    it('should add evidence object', async () => {
      const reconstructionId = 'evidence-recon-1';
      const objectData = {
        name: 'Red Truck',
        type: 'vehicle' as const,
        model: 'truck-model-1',
        initialTransform: createMockTransform(),
        properties: { speed: 25, direction: 'east' }
      };

      const mockObject: Evidence3DObject = {
        id: 'object-2',
        ...objectData,
        transform: objectData.initialTransform,
        timeline: []
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockObject })
      });

      const result = await service.addEvidenceObject(reconstructionId, objectData);

      expect(result).toEqual(mockObject);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/holographic/evidence/${reconstructionId}/objects`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(objectData)
        })
      );
    });

    it('should simulate evidence scenario', async () => {
      const reconstructionId = 'evidence-recon-1';
      const simulationSettings = {
        timeStep: 0.1,
        duration: 10,
        accuracy: 'forensic' as const,
        recordFrames: true
      };

      const mockResult = {
        simulationId: 'sim-1',
        status: 'completed',
        duration: 10,
        frameCount: 100,
        accuracy: 'forensic',
        results: {
          impactPoint: { x: 5.2, y: 0, z: 8.7 },
          impactForce: 15000,
          vehicleTrajectories: []
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockResult })
      });

      const result = await service.simulateEvidenceScenario(reconstructionId, simulationSettings);

      expect(result).toEqual(mockResult);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/holographic/evidence/${reconstructionId}/simulate`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(simulationSettings)
        })
      );
    });

    it('should analyze impact patterns', async () => {
      const reconstructionId = 'evidence-recon-1';
      const analysisData = {
        includePhysics: true,
        considerWeather: true,
        calculateTrajectories: true
      };

      const mockAnalysis = {
        impactAnalysis: {
          primaryImpact: { x: 5.2, y: 0, z: 8.7 },
          secondaryImpacts: [],
          forceDistribution: [],
          damagePattern: 'frontal-left'
        },
        trajectoryAnalysis: {
          preImpactPaths: [],
          postImpactPaths: [],
          criticalPoints: []
        },
        timeline: {
          events: [],
          keyMoments: []
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockAnalysis })
      });

      const result = await service.analyzeImpactPatterns(reconstructionId, analysisData);

      expect(result).toEqual(mockAnalysis);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/holographic/evidence/${reconstructionId}/analyze`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(analysisData)
        })
      );
    });

    it('should generate expert report', async () => {
      const reconstructionId = 'evidence-recon-1';
      const reportSettings = {
        includeVisuals: true,
        includeTimeline: true,
        includeAnalysis: true,
        format: 'pdf',
        expertName: 'Dr. John Smith'
      };

      const mockReport = {
        reportId: 'report-1',
        url: 'https://storage.example.com/reports/evidence-report-1.pdf',
        generatedAt: new Date(),
        format: 'pdf',
        size: 2048000
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockReport })
      });

      const result = await service.generateExpertReport(reconstructionId, reportSettings);

      expect(result).toEqual(mockReport);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/holographic/evidence/${reconstructionId}/report`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(reportSettings)
        })
      );
    });
  });

  describe('Data Hologram Generation', () => {
    it('should create data hologram from dataset', async () => {
      const datasetId = 'dataset-123';
      const hologramConfig = {
        visualizationType: '3d-scatter',
        dimensions: ['x', 'y', 'risk_score'],
        colorMapping: 'risk_level',
        sizeMapping: 'contract_value',
        clustering: true
      };

      const mockDataHologram = {
        id: 'data-hologram-1',
        datasetId: datasetId,
        pointCount: 1500,
        dimensions: 3,
        boundingBox: {
          min: { x: -10, y: -5, z: 0 },
          max: { x: 10, y: 15, z: 1 }
        },
        clusters: [
          { id: 'cluster-1', center: { x: 2, y: 8, z: 0.7 }, size: 450 },
          { id: 'cluster-2', center: { x: -3, y: 3, z: 0.3 }, size: 680 }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockDataHologram })
      });

      const result = await service.createDataHologram(datasetId, hologramConfig);

      expect(result).toEqual(mockDataHologram);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/holographic/data/${datasetId}/hologram`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(hologramConfig)
        })
      );
    });

    it('should query holographic data', async () => {
      const hologramId = 'data-hologram-1';
      const queryData = {
        spatialQuery: {
          type: 'sphere',
          center: { x: 0, y: 5, z: 0.5 },
          radius: 3
        },
        filters: {
          risk_level: ['high', 'critical'],
          contract_value: { min: 100000, max: 1000000 }
        }
      };

      const mockQueryResult = {
        matches: [
          { id: 'point-1', position: { x: 1, y: 4, z: 0.6 }, data: { risk_level: 'high' } },
          { id: 'point-2', position: { x: -1, y: 6, z: 0.8 }, data: { risk_level: 'critical' } }
        ],
        count: 2,
        totalInRange: 2
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockQueryResult })
      });

      const result = await service.queryHolographicData(hologramId, queryData);

      expect(result).toEqual(mockQueryResult);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/holographic/holograms/${hologramId}/query`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(queryData)
        })
      );
    });

    it('should create interactive data exploration', async () => {
      const hologramId = 'data-hologram-1';
      const explorationConfig = {
        enableSelection: true,
        enableFiltering: true,
        enableDrillDown: true,
        toolsPanel: true,
        collaborativeMode: false
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.createInteractiveExploration(hologramId, explorationConfig);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/holographic/holograms/${hologramId}/exploration`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(explorationConfig)
        })
      );
    });
  });

  describe('AR Document Overlay', () => {
    it('should create AR document overlay', async () => {
      const documentId = 'doc-123';
      const overlayData = {
        documentPosition: { x: 0, y: 1.5, z: -1 },
        annotations: [
          {
            position: { x: 0.3, y: 0.8, z: 0 },
            content: 'Important clause',
            type: 'highlight'
          }
        ],
        interactionMode: 'touch',
        trackingMarker: 'qr-code'
      };

      const mockOverlay = {
        id: 'ar-overlay-1',
        documentId: documentId,
        isActive: true,
        trackingQuality: 'excellent',
        anchors: [
          { id: 'anchor-1', position: { x: 0, y: 1.5, z: -1 }, confidence: 0.95 }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockOverlay })
      });

      const result = await service.createARDocumentOverlay(documentId, overlayData);

      expect(result).toEqual(mockOverlay);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/holographic/documents/${documentId}/ar-overlay`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(overlayData)
        })
      );
    });

    it('should update AR overlay tracking', async () => {
      const overlayId = 'ar-overlay-1';
      const trackingData = {
        markerPosition: { x: 0.1, y: 1.4, z: -0.9 },
        markerRotation: { x: 0, y: 0.1, z: 0, w: 0.995 },
        confidence: 0.87,
        isVisible: true
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.updateARTracking(overlayId, trackingData);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/holographic/ar-overlays/${overlayId}/tracking`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(trackingData)
        })
      );
    });

    it('should add AR annotation', async () => {
      const overlayId = 'ar-overlay-1';
      const annotationData = {
        worldPosition: { x: 0.3, y: 1.8, z: -0.8 },
        content: 'Review required',
        type: 'comment',
        author: 'user-1',
        attachToDocument: true
      };

      const mockAnnotation = {
        id: 'ar-annotation-1',
        ...annotationData,
        createdAt: new Date()
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockAnnotation })
      });

      const result = await service.addARAnnotation(overlayId, annotationData);

      expect(result).toEqual(mockAnnotation);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/holographic/ar-overlays/${overlayId}/annotations`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(annotationData)
        })
      );
    });
  });

  describe('Performance and Optimization', () => {
    it('should get visualization metrics', async () => {
      const hologramId = 'hologram-1';
      const mockMetrics: VisualizationMetrics = {
        complexity: 0.75,
        renderTime: 16.7,
        polygonCount: 15000,
        memoryUsage: 1024,
        performance: 'good'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockMetrics })
      });

      const result = await service.getVisualizationMetrics(hologramId);

      expect(result).toEqual(mockMetrics);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/holographic/holograms/${hologramId}/metrics`,
        expect.any(Object)
      );
    });

    it('should optimize visualization performance', async () => {
      const hologramId = 'hologram-1';
      const optimizations = {
        reduceLOD: true,
        enableCulling: true,
        compressTextures: true,
        simplifyGeometry: false,
        targetFrameRate: 60
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.optimizeVisualization(hologramId, optimizations);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/holographic/holograms/${hologramId}/optimize`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(optimizations)
        })
      );
    });

    it('should adjust quality settings', async () => {
      const qualityLevel = 'medium';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.adjustQualitySettings(qualityLevel);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/holographic/settings/quality`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ quality: qualityLevel })
        })
      );
    });

    it('should enable streaming mode', async () => {
      const streamingConfig = {
        chunkSize: 1024,
        bufferSize: 3,
        adaptiveQuality: true,
        bandwidth: 'auto'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.enableStreamingMode(streamingConfig);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/holographic/streaming/enable`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(streamingConfig)
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          success: false,
          error: 'Hologram not found'
        })
      });

      await expect(service.getHologram('invalid-id')).rejects.toThrow('Hologram not found');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(service.listHolograms()).rejects.toThrow('Network error');
    });

    it('should handle invalid visualization data', async () => {
      const invalidData = {
        name: '',
        type: 'invalid' as HologramType,
        data: null,
        visualization: null,
        transform: null
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          error: 'Invalid hologram data'
        })
      });

      await expect(service.createHologram(invalidData as any)).rejects.toThrow('Invalid hologram data');
    });
  });

  describe('Mixed Reality Workflows', () => {
    it('should create mixed reality workspace', async () => {
      const workspaceData = {
        name: 'Legal Case Review',
        mode: 'mixed-reality',
        documents: ['doc-1', 'doc-2'],
        holograms: ['hologram-1'],
        participants: ['user-1', 'user-2'],
        tools: ['annotation', 'measurement', 'collaboration']
      };

      const mockWorkspace = {
        id: 'mr-workspace-1',
        ...workspaceData,
        isActive: true,
        createdAt: new Date()
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockWorkspace })
      });

      const result = await service.createMixedRealityWorkspace(workspaceData);

      expect(result).toEqual(mockWorkspace);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/holographic/mixed-reality/workspace`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(workspaceData)
        })
      );
    });

    it('should synchronize holographic content', async () => {
      const workspaceId = 'mr-workspace-1';
      const syncData = {
        holograms: ['hologram-1', 'hologram-2'],
        participants: ['user-1', 'user-2'],
        syncMode: 'real-time',
        conflictResolution: 'last-writer-wins'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.synchronizeHolographicContent(workspaceId, syncData);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/holographic/mixed-reality/workspace/${workspaceId}/sync`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(syncData)
        })
      );
    });

    it('should enable collaborative editing', async () => {
      const hologramId = 'hologram-1';
      const collaborationSettings = {
        maxParticipants: 5,
        permissions: {
          edit: ['user-1', 'user-2'],
          view: ['user-3', 'user-4'],
          comment: ['user-1', 'user-2', 'user-3']
        },
        realTimeUpdates: true,
        conflictResolution: 'manual'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.enableCollaborativeEditing(hologramId, collaborationSettings);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/holographic/holograms/${hologramId}/collaboration`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(collaborationSettings)
        })
      );
    });
  });
});