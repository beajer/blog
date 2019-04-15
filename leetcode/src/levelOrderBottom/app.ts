export interface ITreeNode {
  val: number | null;
  left: ITreeNode | null;
  right: ITreeNode | null;
}
/** 给定一个二叉树，返回其节点值自底向上的层次遍历。 （即按从叶子节点所在层到根节点所在的层，逐层从左向右遍历）  */
export var levelOrderBottom = function(root: ITreeNode): number[][] {
  let resp: number[][] = [];
  let queue: ITreeNode[] = [root];
  let nextQueue: ITreeNode[] = [];
  let res: number[] = [];
  while (queue.length || nextQueue.length) {
    if (!queue.length) {
      resp.unshift(res);
      res = [];
      queue = nextQueue;
      nextQueue = [];
    }
    let node = queue.shift();
    if (node) {
      if (node.val !== null) res.push(node.val);
      if (node.left) nextQueue.push(node.left);
      if (node.right) nextQueue.push(node.right);
    }
  }
  if (res.length) {
    resp.unshift(res);
  }
  return resp;
};
