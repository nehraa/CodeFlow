// codeflow-prd-test-npm
//
// Placeholder package. Intentionally ships no runtime code.
// Reserved for downstream test consumers who need a stable, empty
// npm-installable target in the monorepo so they can verify
// install / resolution / workspace behavior without pulling in
// real CodeFlow packages.
//
// This file exists solely to satisfy the `main: "index.js"` field
// declared in package.json. It exports nothing useful.

module.exports = {};
