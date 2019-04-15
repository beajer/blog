import { mergeTwoLists, ListNode } from './';

describe('mergeTwoLists', function() {
  it('valid 1', function() {
    let l1: ListNode = {
      val: 1,
      next: {
        val: 2,
        next: {
          val: 4,
          next: null
        }
      }
    };
    let l2: ListNode = {
      val: 1,
      next: {
        val: 3,
        next: {
          val: 4,
          next: null
        }
      }
    };
    let l3: ListNode = {
      val: 1,
      next: {
        val: 1,
        next: {
          val: 2,
          next: {
            val: 3,
            next: {
              val: 4,
              next: {
                val: 4,
                next: null
              }
            }
          }
        }
      }
    };
    expect(mergeTwoLists(l1, l2)).toEqual(l3);
  });
});
