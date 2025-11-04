/**
 * React Query Hooks
 * Custom hooks for fetching and managing API data
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getHealth,
  getTopology,
  runOptimization,
  getConstraints,
  testConnection,
} from './client';
import type { OptimizeRequest } from './types';

/**
 * Hook to check backend health
 */
export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

/**
 * Hook to test backend connection
 */
export function useConnection() {
  return useQuery({
    queryKey: ['connection'],
    queryFn: testConnection,
    retry: 3,
    retryDelay: 1000,
  });
}

/**
 * Hook to fetch network topology
 */
export function useTopology() {
  return useQuery({
    queryKey: ['topology'],
    queryFn: getTopology,
    staleTime: Infinity, // Topology doesn't change
  });
}

/**
 * Hook to fetch available constraints
 */
export function useConstraints() {
  return useQuery({
    queryKey: ['constraints'],
    queryFn: getConstraints,
    staleTime: Infinity, // Constraints don't change
  });
}

/**
 * Hook to run optimization
 */
export function useOptimization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: OptimizeRequest) => {
      console.log('🔵 Sending optimization request to backend:', request);
      return runOptimization(request);
    },
    onSuccess: (data) => {
      console.log('✅ Optimization result received:', data);
      // Invalidate related queries if needed
      queryClient.invalidateQueries({ queryKey: ['optimization-result'] });
    },
    onError: (error) => {
      console.error('❌ Optimization failed:', error);
    },
  });
}

