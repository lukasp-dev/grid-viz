/**
 * API Client
 * Functions to fetch data from the backend API
 */

import type {
  NetworkTopology,
  OptimizationResult,
  OptimizeRequest,
  ConstraintsResponse,
  HealthResponse,
} from './types';

// Get API URL from environment variable or use default
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Generic fetch wrapper with error handling
 */
async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `API Error: ${response.status} ${response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error(`API request failed: ${endpoint}`, error);
    throw error;
  }
}

/**
 * Health check
 */
export async function getHealth(): Promise<HealthResponse> {
  return fetchAPI<HealthResponse>('/api/health');
}

/**
 * Get network topology
 * Returns nodes and edges for React Flow visualization
 */
export async function getTopology(): Promise<NetworkTopology> {
  return fetchAPI<NetworkTopology>('/api/topology');
}

/**
 * Run OPF optimization
 */
export async function runOptimization(
  request: OptimizeRequest
): Promise<OptimizationResult> {
  return fetchAPI<OptimizationResult>('/api/optimize', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Get available constraints
 */
export async function getConstraints(): Promise<ConstraintsResponse> {
  return fetchAPI<ConstraintsResponse>('/api/constraints');
}

/**
 * Test connection to backend
 */
export async function testConnection(): Promise<boolean> {
  try {
    const health = await getHealth();
    return health.status === 'healthy';
  } catch {
    return false;
  }
}

