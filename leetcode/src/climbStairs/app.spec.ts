import { climbStairs } from './app';

describe('climbStairs valid', () => {
  it("climbStairs(0) should throw an error as 'params should be a positive integer'", function() {
    expect(() => climbStairs(0)).toThrowError(new Error('params should be a positive integer'));
  });
  it("climbStairs(1) should return 1", function(){
    expect(climbStairs(1)).toBe(1)
  })
  it("climbStairs(3) should return 3", function(){
    expect(climbStairs(3)).toBe(3)
  })
  it("climbStairs(4) should return 5", function(){
    expect(climbStairs(4)).toBe(5)
  })
});