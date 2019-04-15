/**
 * Definition for a binary tree node.
 * function TreeNode(val) {
 *     this.val = val;
 *     this.left = this.right = null;
 * }
 */
export interface ITreeNode {
  val: number;
  left?: ITreeNode | null;
  right?: ITreeNode | null;
}

let isSameTree = function(p?: ITreeNode | null, q?: ITreeNode | null): boolean {
  return (
    p === q ||
    (!!p &&
      !!q &&
      ((<ITreeNode>p)['val'] === (<ITreeNode>q)['val'] &&
        isSameTree((<ITreeNode>p)['left'], (<ITreeNode>q)['right']) &&
        isSameTree((<ITreeNode>p)['right'], (<ITreeNode>q)['left'])))
  );
};

/** 递归法  */
export var isSymmetric1 = function(root: ITreeNode): boolean {
  return !root || isSameTree(root.left, root.right);
};

/** todo: 迭代法  */
export var isSymmetric2 = function(root: ITreeNode): boolean {
  let queue: Array<ITreeNode | null> = [];
  queue.push(root);
  queue.push(root);
  while (queue.length) {
    let t1 = queue.pop();
    let t2 = queue.pop();
    if (!t1 && !t2) continue;
    // 这里t1和t2必定是个对象
    if (t1 === null || t2 === null) return false;
    if (t1.val !== t2.val) return false;
    queue.push(t1.left);
    queue.push(t2.right);
    queue.push(t1.right);
    queue.push(t2.left);
  }
  return true;
};
