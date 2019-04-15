import { TreeNode, sortedArrayToBST } from './app';

describe('sortedArrayToBST', () => {
  it('[-10, -3, 0, 5, 9] should return [0,-10,5,null,-3,null,9]', () => {
    let nums = [-10, -3, 0, 5, 9];
    let res: TreeNode = {
      val: 0,
      left: {
        val: -10,
        left: null,
        right: {
          val: -3,
          left: null,
          right: null
        }
      },
      right: {
        val: 5,
        left: null,
        right: {
          val: 9,
          left: null,
          right: null
        }
      }
    };
    expect(sortedArrayToBST(nums)).toEqual(res);
  });
  it('[] should return []', () => {
    expect(sortedArrayToBST([])).toBe(null);
  });
});
