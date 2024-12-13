import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock blockchain state
let mockOracleData: Map<number, { dataSource: string; result: number | null }> = new Map();

// Mock contract calls
const mockContractCall = vi.fn((functionName: string, args: any[], sender: string) => {
  switch (functionName) {
    case 'set-data-source':
      const [marketId, dataSource] = args;
      mockOracleData.set(marketId, { dataSource, result: null });
      return { success: true };
    case 'submit-result':
      const [resultMarketId, result] = args;
      const existingData = mockOracleData.get(resultMarketId);
      if (existingData) {
        mockOracleData.set(resultMarketId, { ...existingData, result });
        return { success: true };
      }
      return { success: false, error: 101 }; // err-not-found
    case 'get-oracle-data':
      const [getMarketId] = args;
      const data = mockOracleData.get(getMarketId);
      return data ? { success: true, value: data } : { success: false, error: 101 }; // err-not-found
    default:
      throw new Error(`Unhandled function: ${functionName}`);
  }
});

describe('Oracle Contract', () => {
  const contractOwner = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
  const user = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
  
  beforeEach(() => {
    mockOracleData.clear();
    vi.clearAllMocks();
  });
  
  describe('set-data-source', () => {
    it('should set data source when called by contract owner', () => {
      const result = mockContractCall('set-data-source', [1, 'https://api.example.com'], contractOwner);
      expect(result).toEqual({ success: true });
      expect(mockOracleData.get(1)).toEqual({ dataSource: 'https://api.example.com', result: null });
    });
  });
  
  describe('submit-result', () => {
    it('should submit result when called by contract owner', () => {
      mockContractCall('set-data-source', [1, 'https://api.example.com'], contractOwner);
      const result = mockContractCall('submit-result', [1, 42], contractOwner);
      expect(result).toEqual({ success: true });
      expect(mockOracleData.get(1)).toEqual({ dataSource: 'https://api.example.com', result: 42 });
    });
    
    it('should fail for non-existent market', () => {
      const result = mockContractCall('submit-result', [999, 42], contractOwner);
      expect(result).toEqual({ success: false, error: 101 }); // err-not-found
    });
  });
  
  describe('get-oracle-data', () => {
    it('should return oracle data for existing market', () => {
      mockContractCall('set-data-source', [1, 'https://api.example.com'], contractOwner);
      mockContractCall('submit-result', [1, 42], contractOwner);
      const result = mockContractCall('get-oracle-data', [1], user);
      expect(result).toEqual({ success: true, value: { dataSource: 'https://api.example.com', result: 42 } });
    });
    
    it('should fail for non-existent market', () => {
      const result = mockContractCall('get-oracle-data', [999], user);
      expect(result).toEqual({ success: false, error: 101 }); // err-not-found
    });
  });
});
