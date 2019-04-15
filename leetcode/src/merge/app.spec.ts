import { merge } from './app';

describe('merge validate', () => {
  it('merge([1,2,3], 3, [2,5,6], 3]) should return [1,2,2,3,5,6]', () => {
    expect(merge([1, 2, 3], 3, [2, 5, 6], 3)).toEqual([1, 2, 2, 3, 5, 6]);
  });
  it('merge([], 0, [1], 1]) should return [1]', () => {
    expect(merge([], 0, [1], 1)).toEqual([1]);
  });
  it('merge([2], 1, [1], 1]) should return [1]', () => {
    expect(merge([2], 1, [1], 1)).toEqual([1, 2]);
  });
});
