import { maxDepth } from './app';

describe('maxDepth', () => {
  it('[3, 9, 20, null, null, 15, 7] should return 3', () => {
    let root = {
      val: 3,
      left: {
        val: 9
      },
      right: {
        val: 20,
        left: {
          val: 15
        },
        right: {
          val: 7
        }
      }
    };
    expect(maxDepth(root)).toBe(3);
  });
  it('[1, 2, 3] should return 2', () => {
    let root = {
      val: 1,
      left: {
        val: 2
      },
      right: {
        val: 3
      }
    };
    expect(maxDepth(root)).toBe(2);
  });
});
