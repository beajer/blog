import { isSymmetric1, isSymmetric2 } from './app';
describe('isSymmetric', () => {
  it('[1,2,2,3,4,4,3] should return true', () => {
    let root = {
      val: 1,
      left: {
        val: 2,
        left: {
          val: 3
        },
        right: {
          val: 4
        }
      },
      right: {
        val: 2,
        left: {
          val: 4
        },
        right: {
          val: 3
        }
      }
    };
    expect(isSymmetric1(root)).toBe(true);
    expect(isSymmetric2(root)).toBe(true);
  });
  it('[1,2,2,null,3,null,3] should return false', () => {
    let root = {
      val: 1,
      left: {
        val: 2,
        left: null,
        right: {
          val: 3
        }
      },
      right: {
        val: 2,
        left: null,
        right: {
          val: 3
        }
      }
    };
    expect(isSymmetric1(root)).toBe(false);
    expect(isSymmetric2(root)).toBe(false);
  });
});
