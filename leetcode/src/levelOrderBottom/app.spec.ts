import { levelOrderBottom, ITreeNode } from './app';

describe('levelOrderBottom', () => {
  it('[3,9,20,null,null,15,7] should return [[15,7],[9,20],[3]]', () => {
    let root: ITreeNode = {
      val: 3,
      left: {
        val: 9,
        left: null,
        right: null
      },
      right: {
        val: 20,
        left: {
          val: 15,
          left: null,
          right: null
        },
        right: {
          val: 7,
          left: null,
          right: null
        }
      }
    };
    expect(levelOrderBottom(root)).toEqual([[15, 7], [9, 20], [3]]);
  });
  it('[] should return []', () => {
    let root: ITreeNode = {
      val: null,
      left: null,
      right: null
    };
    expect(levelOrderBottom(root)).toEqual([]);
  });
  it('[0] should return [[0]]', () => {
    let root: ITreeNode = {
      val: 0,
      left: null,
      right: null
    };
    expect(levelOrderBottom(root)).toEqual([[0]]);
  });
});
