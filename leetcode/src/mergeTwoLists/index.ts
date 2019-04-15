export type ListNode = {
  val: number;
  next: ListNode;
} | null;

export var mergeTwoLists = function(l1: ListNode, l2: ListNode): ListNode {
  if (!l1 || !l2) return l1 || l2;
  let min: ListNode = l1.val <= l2.val ? l1 : l2;
  let max: ListNode = l1.val > l2.val ? l1 : l2;
  let p1: ListNode = min;
  let p2 = p1.next;
  let temp: ListNode;
  if (!p2) {
    p1.next = max;
    return p1;
  }
  while (p2 && max) {
    if (max.val > p2.val) {
      p1 = p2;
      p2 = p2.next;
    } else {
      temp = max;
      max = max.next;
      temp.next = p2;
      p1 = p1.next = temp;
    }
  }
  if (p1 && max) {
    p1.next = max;
  }
  return min;
};
