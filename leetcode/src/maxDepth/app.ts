/**
 * Definition for a binary tree node.
 * function TreeNode(val) {
 *     this.val = val;
 *     this.left = this.right = null;
 * }
 * 给定一个二叉树，找出其最大深度。
 * 二叉树的深度为根节点到最远叶子节点的最长路径上的节点数。
 */
export interface ITreeNode {
  val: number;
  left?: ITreeNode | null;
  right?: ITreeNode | null;
}

/**
 * @param {TreeNode} root
 * @return {number}
 */
export var maxDepth = function(root?: ITreeNode | null): number {
  if(!root){
    return 0
  }else {
    let left = maxDepth(root.left)
    let right = maxDepth(root.right)
    return Math.max(left, right) + 1
  }
};
