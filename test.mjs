// node test.mjs
import assert from 'node:assert/strict';
import { parseCSV } from './bar.js';

assert.deepEqual(parseCSV('a,b,c\n1,2,3\n'), [['a', 'b', 'c'], ['1', '2', '3']]);
assert.deepEqual(parseCSV('x,"Chicken, rice",y'), [['x', 'Chicken, rice', 'y']]);
assert.deepEqual(parseCSV('"say ""hi"""'), [['say "hi"']]);
assert.deepEqual(parseCSV('"line1\nline2",b'), [['line1\nline2', 'b']]);
assert.deepEqual(parseCSV('a,b,\n'), [['a', 'b', '']]);
assert.deepEqual(parseCSV('a,b\r\n1,2\r\n'), [['a', 'b'], ['1', '2']]);
assert.deepEqual(parseCSV('"a\r\nb",c\r\n'), [['a\r\nb', 'c']]);
assert.deepEqual(parseCSV(''), []);
console.log('ok');
