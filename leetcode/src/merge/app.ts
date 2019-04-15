/**
 * @param {number[]} nums1
 * @param {number} m
 * @param {number[]} nums2
 * @param {number} n
 * @return {void} Do not return anything, modify nums1 in-place instead.
 */

export let merge = function(
  nums1: number[],
  m: number,
  nums2: number[],
  n: number
): number[] {
  let i = m - 1;
  while (n > 0) {
    if (i < 0) {
      n--;
      nums1[n] = nums2[n];
    } else if (nums2[n - 1] > nums1[i]) {
      nums1[i + n] = nums2[n - 1];
      n--;
    } else {
      nums1[i + n] = nums1[i];
      nums1[i] = 0;
      i--;
    }
  }
  return nums1;
};
