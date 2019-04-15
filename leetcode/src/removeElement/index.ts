export var removeElement = function(nums: number[], val: number): number {
  let pointer = 0;
  let next = 0;
  while (next < nums.length) {
    if (nums[next] !== val) {
      nums[pointer] = nums[next];
      pointer++;
    }
    next++;
  }
  return pointer;
};
