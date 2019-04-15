/** 给定两个二进制字符串，返回他们的和（用二进制表示）*/
export let addBinary = function(a: string, b: String): string {
  let sum: string = '';
  let la = a.length - 1,
    lb = b.length - 1;
  let carry = 0;
  while (la >= 0 || lb >= 0) {
    let _c = carry;
    _c = _c + +a.charAt(la) + +b.charAt(lb);
    sum = (_c % 2) + sum;
    carry = Math.floor(_c / 2);
    la--;
    lb--;
  }
  if (carry) {
    sum = '1' + sum;
  }
  return sum;
};
