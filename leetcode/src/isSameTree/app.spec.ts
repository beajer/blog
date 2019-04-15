import { isSameTree } from './app';
describe('isSameTree', () => {
  it('[1,2,3], [1,2,3] should return true', () => {
    let p = {
      val: 1,
      left: 2,
      right: 3
    };
    let q = {
      val: 1,
      left: 2,
      right: 3
    };
    expect(isSameTree(p, q)).toBe(true);
  });
  it('[1,2], [1,null,2] should return false', () => {
    let p = {
      val: 1,
      left: 2,
      right: null
    };
    let q = {
      val: 1,
      left: null,
      right: 2
    };
    expect(isSameTree(p, q)).toBe(false);
  });
});
