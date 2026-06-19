import { describe, it, expect } from 'vitest';
import {
  applyFilters,
  type OverviewFilters,
} from '@/hooks/intelligence/useConnectionsOverviewFilters';
import type { OverviewRow } from '@/hooks/intelligence/useConnectionsOverview';

describe('useConnectionsOverviewFilters regression tests', () => {
  const mockRows: OverviewRow[] = [
    {
      key: '1',
      id: '1',
      type: 'supabase',
      name: 'DB 1',
      env_key: 'promobrind',
      status: 'active',
      last_test_at: new Date().toISOString(),
      last_test_ok: true,
      last_test_message: 'OK',
      last_latency_ms: 50,
      auto_test_enabled: true,
    },
    {
      key: '2',
      id: '2',
      type: 'bitrix24',
      name: 'CRM',
      env_key: 'crm',
      status: 'error',
      last_test_at: new Date().toISOString(),
      last_test_ok: false,
      last_test_message: 'Fail',
      last_latency_ms: null,
      auto_test_enabled: true,
    },
  ];

  const defaultFilters: OverviewFilters = {
    types: [],
    status: 'all',
    window: 'any',
    onlyConsecutiveFailures: false,
  };

  it('should return all rows when filters are empty', () => {
    const result = applyFilters(mockRows, defaultFilters);
    expect(result).toHaveLength(2);
  });

  it('should filter by type', () => {
    const filters: OverviewFilters = { ...defaultFilters, types: ['supabase'] };
    const result = applyFilters(mockRows, filters);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('supabase');
  });

  it('should filter by status OK', () => {
    const filters: OverviewFilters = { ...defaultFilters, status: 'ok' };
    const result = applyFilters(mockRows, filters);
    expect(result).toHaveLength(1);
    expect(result[0].last_test_ok).toBe(true);
  });

  it('should filter by status FAIL', () => {
    const filters: OverviewFilters = { ...defaultFilters, status: 'fail' };
    const result = applyFilters(mockRows, filters);
    expect(result).toHaveLength(1);
    expect(result[0].last_test_ok).toBe(false);
  });

  it('should filter by window', () => {
    const oldDate = new Date();
    oldDate.setHours(oldDate.getHours() - 2); // 2 hours ago

    const rowWithOldDate: OverviewRow = {
      ...mockRows[0],
      last_test_at: oldDate.toISOString(),
    };

    const filters: OverviewFilters = { ...defaultFilters, window: '1h' };
    const result = applyFilters([rowWithOldDate], filters);
    expect(result).toHaveLength(0);

    const recentFilters: OverviewFilters = { ...defaultFilters, window: '24h' };
    const recentResult = applyFilters([rowWithOldDate], recentFilters);
    expect(recentResult).toHaveLength(1);
  });
});
