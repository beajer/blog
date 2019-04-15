import { addBinary } from './app';

describe('addBinary', function() {
  it(`addBinary('11', '1') should return 100`, function() {
    expect(addBinary('11', '1')).toBe('100');
  });
  it(`addBinary('1010', '1011') should return 10101`, function() {
    expect(addBinary('1010', '1011')).toBe('10101');
  });
});
