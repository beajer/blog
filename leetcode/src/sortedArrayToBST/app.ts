export interface TreeNode {
  val: number | null;
  left: TreeNode | null;
  right: TreeNode | null;
}

/**
 * 将一个按照升序排列的有序数组，转换为一棵高度平衡二叉搜索树。
 *
 * 本题中，一个高度平衡二叉树是指一个二叉树每个节点 的左右两个子树的高度差的绝对值不超过 1。
 * function TreeNode(val) {
 *     this.val = val;
 *     this.left = this.right = null;
 * }
 * @param {number[]} nums
 * @return {TreeNode}
 */
export let sortedArrayToBST = function(nums: number[]): TreeNode | null {
  let root: TreeNode | null = null;
  if (nums.length) {
    root = {
      val: null,
      left: null,
      right: null
    };
    let mid = Math.floor((nums.length - 1) / 2);
    root.val = nums[mid];
    if (mid > 0) {
      root.left = sortedArrayToBST(nums.slice(0, mid));
    }
    if (mid < nums.length - 1) {
      root.right = sortedArrayToBST(nums.slice(mid + 1));
    }
  }
  return root;
};
