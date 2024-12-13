import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock blockchain state
let mockMarkets: Map<number, any> = new Map();
let mockMarketPositions: Map<string, any> = new Map();
let mockMarketNonce = 0;

// Mock contract calls
const mockContractCall = vi.fn((functionName: string, args: any[], sender: string) => {
  switch (functionName) {
    case 'create-market':
      const [description, options, resolutionTime] = args;
      const marketId = ++mockMarketNonce;
      mockMarkets.set(marketId, {
        creator: sender,
        description,
        options,
        resolutionTime,
        resolved: false,
        winningOption: null,
        totalLiquidity: 0
      });
      return { success: true, value: marketId };
    case 'place-bet':
      const [betMarketId, option, amount] = args;
      const market = mockMarkets.get(betMarketId);
      if (!market || market.resolved) {
        return { success: false, error: 104 }; // err-market-closed
      }
      const betPositionKey = `${betMarketId}-${sender}`;
      const currentPosition = mockMarketPositions.get(betPositionKey) || { positions: [0, 0, 0, 0, 0] };
      currentPosition.positions[option] += amount;
      mockMarketPositions.set(betPositionKey, currentPosition);
      market.totalLiquidity += amount;
      return { success: true };
    case 'resolve-market':
      const [resolveMarketId, winningOption] = args;
      const resolveMarket = mockMarkets.get(resolveMarketId);
      if (!resolveMarket || resolveMarket.resolved) {
        return { success: false, error: 104 }; // err-market-closed
      }
      resolveMarket.resolved = true;
      resolveMarket.winningOption = winningOption;
      return { success: true };
    case 'claim-winnings':
      const [claimMarketId] = args;
      const claimMarket = mockMarkets.get(claimMarketId);
      if (!claimMarket || !claimMarket.resolved) {
        return { success: false, error: 105 }; // err-market-not-resolved
      }
      const claimPositionKey = `${claimMarketId}-${sender}`;
      mockMarketPositions.delete(claimPositionKey);
      return { success: true };
    case 'get-market':
      const [getMarketId] = args;
      const getMarket = mockMarkets.get(getMarketId);
      return getMarket ? { success: true, value: getMarket } : { success: false, error: 101 }; // err-not-found
    case 'get-user-positions':
      const [positionMarketId, user] = args;
      const positionKey = `${positionMarketId}-${user}`;
      const positions = mockMarketPositions.get(positionKey);
      return positions ? { success: true, value: positions } : { success: false, error: 101 }; // err-not-found
    default:
      throw new Error(`Unhandled function: ${functionName}`);
  }
});

describe('Prediction Market Contract', () => {
  const contractOwner = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
  const user1 = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
  const user2 = 'ST3AM1A56AK2C1XAFJ4115ZSV26EB49BVQ10MGCS0';
  
  beforeEach(() => {
    mockMarkets.clear();
    mockMarketPositions.clear();
    mockMarketNonce = 0;
    vi.clearAllMocks();
  });
  
  describe('create-market', () => {
    it('should create a new market', () => {
      const result = mockContractCall('create-market', ['Test Market', ['Yes', 'No'], 100], user1);
      expect(result).toEqual({ success: true, value: 1 });
      expect(mockMarkets.get(1)).toBeDefined();
    });
  });
  
  describe('place-bet', () => {
    it('should place a bet on an open market', () => {
      mockContractCall('create-market', ['Test Market', ['Yes', 'No'], 100], user1);
      const result = mockContractCall('place-bet', [1, 0, 100], user2);
      expect(result).toEqual({ success: true });
      expect(mockMarketPositions.get('1-ST3AM1A56AK2C1XAFJ4115ZSV26EB49BVQ10MGCS0')).toEqual({ positions: [100, 0, 0, 0, 0] });
    });
    
    it('should fail to place a bet on a closed market', () => {
      mockContractCall('create-market', ['Test Market', ['Yes', 'No'], 100], user1);
      mockContractCall('resolve-market', [1, 0], contractOwner);
      const result = mockContractCall('place-bet', [1, 0, 100], user2);
      expect(result).toEqual({ success: false, error: 104 }); // err-market-closed
    });
  });
  
  describe('resolve-market', () => {
    it('should resolve an open market', () => {
      mockContractCall('create-market', ['Test Market', ['Yes', 'No'], 100], user1);
      const result = mockContractCall('resolve-market', [1, 0], contractOwner);
      expect(result).toEqual({ success: true });
      expect(mockMarkets.get(1)?.resolved).toBe(true);
    });
    
    it('should fail to resolve an already resolved market', () => {
      mockContractCall('create-market', ['Test Market', ['Yes', 'No'], 100], user1);
      mockContractCall('resolve-market', [1, 0], contractOwner);
      const result = mockContractCall('resolve-market', [1, 1], contractOwner);
      expect(result).toEqual({ success: false, error: 104 }); // err-market-closed
    });
  });
  
  describe('claim-winnings', () => {
    it('should allow claiming winnings from a resolved market', () => {
      mockContractCall('create-market', ['Test Market', ['Yes', 'No'], 100], user1);
      mockContractCall('place-bet', [1, 0, 100], user2);
      mockContractCall('resolve-market', [1, 0], contractOwner);
      const result = mockContractCall('claim-winnings', [1], user2);
      expect(result).toEqual({ success: true });
      expect(mockMarketPositions.get('1-ST3AM1A56AK2C1XAFJ4115ZSV26EB49BVQ10MGCS0')).toBeUndefined();
    });
    
    it('should fail to claim winnings from an unresolved market', () => {
      mockContractCall('create-market', ['Test Market', ['Yes', 'No'], 100], user1);
      mockContractCall('place-bet', [1, 0, 100], user2);
      const result = mockContractCall('claim-winnings', [1], user2);
      expect(result).toEqual({ success: false, error: 105 }); // err-market-not-resolved
    });
  });
  
  describe('get-market', () => {
    it('should return market data for an existing market', () => {
      mockContractCall('create-market', ['Test Market', ['Yes', 'No'], 100], user1);
      const result = mockContractCall('get-market', [1], user2);
      expect(result.success).toBe(true);
      expect(result.value).toBeDefined();
    });
    
    it('should fail for a non-existent market', () => {
      const result = mockContractCall('get-market', [999], user2);
      expect(result).toEqual({ success: false, error: 101 }); // err-not-found
    });
  });
  
  describe('get-user-positions', () => {
    it('should return user positions for an existing bet', () => {
      mockContractCall('create-market', ['Test Market', ['Yes', 'No'], 100], user1);
      mockContractCall('place-bet', [1, 0, 100], user2);
      const result = mockContractCall('get-user-positions', [1, user2], user2);
      expect(result).toEqual({ success: true, value: { positions: [100, 0, 0, 0, 0] } });
    });
    
    it('should fail for a user with no positions', () => {
      mockContractCall('create-market', ['Test Market', ['Yes', 'No'], 100], user1);
      const result = mockContractCall('get-user-positions', [1, user2], user2);
      expect(result).toEqual({ success: false, error: 101 }); // err-not-found
    });
  });
});

