/**
 * @param {number[]} nums
 * @return {number}
 */
// 利用循环
export var maxSubArrayUseLoop = function(nums: number[]): number {
  // 可能的最大子序列和
  let max: number = Number.NEGATIVE_INFINITY;
  // 当前子序列和
  let res = 0;
  for (let i = 0; i < nums.length; i++) {
    res = Math.max(res, 0);
    res += nums[i];
    max = Math.max(max, res);
  }
  return max;
};

// 利用分治法
export var maxSubArray = function(nums: number[]): number {
  let nagitive: number = Number.NEGATIVE_INFINITY;
  let i = 0;
  let j = nums.length - 1;
  while (i <= j && nums[i] < 0 && nums[j] < 0) {
    nagitive = Math.max(nagitive, nums[i], nums[j]);
    if (nums[i] < 0) i++;
    if (nums[j] < 0) j--;
  }
  if (i > j) return nagitive;
  nums.splice(j + 1, nums.length - j - 1);
  nums.splice(0, i);
  return nums.length < 2
    ? nums[0]
    : Math.max(
        nums.reduce((a, b) => a + b),
        maxSubArray(nums.slice(0, nums.length - 1)),
        maxSubArray(nums.slice(1, nums.length))
      );
};
