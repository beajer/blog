/**
 * @param {number} n
 * @return {number}
 * 假设你正在爬楼梯。需要 n 阶你才能到达楼顶。
 * 每次你可以爬 1 或 2 个台阶。你有多少种不同的方法可以爬到楼顶呢？
 */

export let climbStairs = function(n: number): number {
  if (n <= 0) throw new Error('params should be a positive integer');
  let map: Array<number> = [0, 1, 2];
  if (n <= 2) {
    return map[n];
  }
  let i = 3;
  while (i <= n) {
    map[i] = map[i - 1] + map[i - 2];
    i++;
  }
  return map[n];
};
