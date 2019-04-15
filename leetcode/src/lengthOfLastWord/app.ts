export var lengthOfLastWord = function(s: string): number {
  let len = s.length;
  let startflag = false,
    j = 0;
  for (let i = len - 1; i >= 0; i--) {
    let char = s.charCodeAt(i);
    if (char >= 65 && char <= 122) {
      if (!startflag) startflag = true;
      j++;
    } else {
      if (startflag) {
        return j;
      }
    }
  }
  return j;
};
