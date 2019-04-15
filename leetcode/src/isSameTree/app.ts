/**
 * Definition for a binary tree node.
 * function TreeNode(val) {
 *     this.val = val;
 *     this.left = this.right = null;
 * }
 */
export interface ITreeNode {
  val: number;
  left: ITreeNode | number | null;
  right: ITreeNode | number | null;
}
/**
 * @param {TreeNode} p
 * @param {TreeNode} q
 * @return {boolean}
 */
export var isSameTree = function(
  p: ITreeNode | number | null,
  q: ITreeNode | number | null
): boolean {
  return (
    typeof p === typeof q &&
    (p === q ||
      (!!p &&
        !!q &&
        ((<ITreeNode>p)['val'] === (<ITreeNode>q)['val'] &&
          isSameTree((<ITreeNode>p)['left'], (<ITreeNode>q)['left']) &&
          isSameTree((<ITreeNode>p)['right'], (<ITreeNode>q)['right']))))
  );
};
