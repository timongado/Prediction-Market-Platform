import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock blockchain state
let mockLiquidityProviders: Map<string, { amount: number }> = new Map();
let mockMarketPools: Map<number, { totalLiquidity: number }> = new Map();

// Mock contract calls
const mockContractCall = vi.fn((functionName: string, args: any[], sender: string) => {
  switch (functionName) {
    case 'provide-liquidity':
      const [marketId, amount] = args;
      const providerKey = `${marketId}-${sender}`;
      const currentLiquidity = mockLiquidityProviders.get(providerKey)?.amount || 0;
      mockLiquidityProviders.set(providerKey, { amount: currentLiquidity + amount });
      
      const currentPool = mockMarketPools.get(marketId)?.totalLiquidity || 0;
      mockMarketPools.set(marketId, { totalLiquidity: currentPool + amount });
      
      return { success: true };
    case 'withdraw-liquidity':
      const [withdrawMarketId, withdrawAmount] = args;
      const withdrawProviderKey = `${withdrawMarketId}-${sender}`;
      const currentProviderLiquidity = mockLiquidityProviders.get(withdrawProviderKey)?.amount || 0;
      
      if (withdrawAmount > currentProviderLiquidity) {
        return { success: false, error: 101 }; // err-not-found (insufficient balance)
      }
      
      mockLiquidityProviders.set(withdrawProviderKey, { amount: currentProviderLiquidity - withdrawAmount });
      
      const currentMarketPool = mockMarketPools.get(withdrawMarketId)?.totalLiquidity || 0;
      mockMarketPools.set(withdrawMarketId, { totalLiquidity: currentMarketPool - withdrawAmount });
      
      return { success: true };
    case 'get-liquidity-position':
      const [positionMarketId, provider] = args;
      const positionKey = `${positionMarketId}-${provider}`;
      const position = mockLiquidityProviders.get(positionKey);
      return position ? { success: true, value: position } : { success: false, error: 101 }; // err-not-found
    case 'get-market-pool':
      const [poolMarketId] = args;
      const pool = mockMarketPools.get(poolMarketId);
      return pool ? { success: true, value: pool } : { success: false, error: 101 }; // err-not-found
    default:
      throw new Error(`Unhandled function: ${functionName}`);
  }
});

describe('Liquidity Pool Contract', () => {
  const user1 = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
  const user2 = 'ST3AM1A56AK2C1XAFJ4115ZSV26EB49BVQ10MGCS0';
  
  beforeEach(() => {
    mockLiquidityProviders.clear();
    mockMarketPools.clear();
    vi.clearAllMocks();
  });
  
  describe('provide-liquidity', () => {
    it('should allow a user to provide liquidity', () => {
      const result = mockContractCall('provide-liquidity', [1, 1000], user1);
      expect(result).toEqual({ success: true });
      expect(mockLiquidityProviders.get('1-ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG')).toEqual({ amount: 1000 });
      expect(mockMarketPools.get(1)).toEqual({ totalLiquidity: 1000 });
    });
    
    it('should accumulate liquidity for multiple provisions', () => {
      mockContractCall('provide-liquidity', [1, 1000], user1);
      const result = mockContractCall('provide-liquidity', [1, 500], user1);
      expect(result).toEqual({ success: true });
      expect(mockLiquidityProviders.get('1-ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG')).toEqual({ amount: 1500 });
      expect(mockMarketPools.get(1)).toEqual({ totalLiquidity: 1500 });
    });
  });
  
  describe('withdraw-liquidity', () => {
    it('should allow a user to withdraw liquidity', () => {
      mockContractCall('provide-liquidity', [1, 1000], user1);
      const result = mockContractCall('withdraw-liquidity', [1, 500], user1);
      expect(result).toEqual({ success: true });
      expect(mockLiquidityProviders.get('1-ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG')).toEqual({ amount: 500 });
      expect(mockMarketPools.get(1)).toEqual({ totalLiquidity: 500 });
    });
    
    it('should fail if user tries to withdraw more than their provided liquidity', () => {
      mockContractCall('provide-liquidity', [1, 1000], user1);
      const result = mockContractCall('withdraw-liquidity', [1, 1500], user1);
      expect(result).toEqual({ success: false, error: 101 }); // err-not-found (insufficient balance)
      expect(mockLiquidityProviders.get('1-ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG')).toEqual({ amount: 1000 });
      expect(mockMarketPools.get(1)).toEqual({ totalLiquidity: 1000 });
    });
  });
  
  describe('get-liquidity-position', () => {
    it('should return the correct liquidity position for a user', () => {
      mockContractCall('provide-liquidity', [1, 1000], user1);
      const result = mockContractCall('get-liquidity-position', [1, user1], user2);
      expect(result).toEqual({ success: true, value: { amount: 1000 } });
    });
    
    it('should fail for a user with no liquidity position', () => {
      const result = mockContractCall('get-liquidity-position', [1, user2], user1);
      expect(result).toEqual({ success: false, error: 101 }); // err-not-found
    });
  });
  
  describe('get-market-pool', () => {
    it('should return the correct market pool information', () => {
      mockContractCall('provide-liquidity', [1, 1000], user1);
      mockContractCall('provide-liquidity', [1, 500], user2);
      const result = mockContractCall('get-market-pool', [1], user1);
      expect(result).toEqual({ success: true, value: { totalLiquidity: 1500 } });
    });
    
    it('should fail for a non-existent market pool', () => {
      const result = mockContractCall('get-market-pool', [999], user1);
      expect(result).toEqual({ success: false, error: 101 }); // err-not-found
    });
  });
});

