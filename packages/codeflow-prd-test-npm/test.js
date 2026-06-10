// Minimal smoke test for the placeholder package.
//
// Verifies the `main: "index.js"` entry point resolves and the
// module loads without error. There is intentionally no runtime
// behavior to test — this exists so `npm test` (and CI) can
// confirm the package is installable and importable.

'use strict';

const assert = require('node:assert/strict');
const placeholder = require('./index.js');

assert.equal(typeof placeholder, 'object', 'placeholder should export an object');
assert.notEqual(placeholder, null, 'placeholder should not be null');

console.log('codeflow-prd-test-npm: smoke test passed');
