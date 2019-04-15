import { lengthOfLastWord } from './app';

describe('app', function() {
  it('a should return 1', function() {
    expect(lengthOfLastWord('a')).toBe(1);
  });
  it('a_ should return 1', function() {
    expect(lengthOfLastWord('a ')).toBe(1);
  });
  it('hello world   should return 5', function() {
    expect(lengthOfLastWord('hello world ')).toBe(5);
  });
});
