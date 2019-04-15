import { TreeNode, isBalanced } from './app';

describe('isBalanced 给定一个二叉树，判断它是否是高度平衡的二叉树。', () => {
  it('[3,9,20,null,null,15,7] should return true', () => {
    let root: TreeNode = {
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
    expect(isBalanced(root)).toBe(true);
  });
  it('[1,2,2,3,3,null,null,4,4] should return false', () => {
    let root: TreeNode = {
      val: 1,
      left: {
        val: 2,
        left: {
          val: 3,
          left: {
            val: 4,
            left: null,
            right: null
          },
          right: {
            val: 4,
            left: null,
            right: null
          }
        },
        right: {
          val: 3,
          left: null,
          right: null
        }
      },
      right: {
        val: 2,
        left: null,
        right: null
      }
    };
    expect(isBalanced(root)).toBe(false);
  });
});
