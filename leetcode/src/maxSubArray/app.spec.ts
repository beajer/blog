import { maxSubArray } from './app';

describe('app', function() {
  it('[-2,1,-3,4,-1,2,1,-5,4] should return 6', function() {
    expect(maxSubArray([-2, 1, -3, 4, -1, 2, 1, -5, 4])).toBe(6);
  });
  it('[-1] should return -1', function() {
    expect(maxSubArray([-1])).toBe(-1);
  });
  it('[-2, -1] should return -1', function() {
    expect(maxSubArray([-2, -1])).toBe(-1);
  });
  it('[-2, -3, -1] should return -1', function() {
    expect(maxSubArray([-2, -3, -1])).toBe(-1);
  });
  it('[-2, 0, -1] should return 0', function() {
    expect(maxSubArray([-2, 0, -1])).toBe(0);
  });
});
