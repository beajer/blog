import { removeElement } from '.';

describe('removeElement', function() {
  it('[0,1,2,2,3,0,4,2] removeElement val(2) should return 5', function() {
    let nums = [0, 1, 2, 2, 3, 0, 4, 2];
    let val = 2;
    expect(removeElement(nums, val)).toBe(5);
  });
  it('[2] removeElement 3 should return 1', function() {
    let nums = [2]
    let val = 3
    expect(removeElement(nums, val)).toBe(1)
  });
});
