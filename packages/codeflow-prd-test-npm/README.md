# codeflow-prd-test-npm

Placeholder package. Intentionally ships no runtime code.

This package is reserved for **downstream test consumers** who need a
stable, empty npm-installable target inside the CodeFlow monorepo so
they can verify install / resolution / workspace behavior without
pulling in real CodeFlow packages.

The `index.js` file exists only to satisfy the `main: "index.js"`
field in `package.json`. It exports an empty object and has no
runtime behavior.

This is **not** a published package. The `codeflow-prd-test-npm`
namespace on npm is intentionally unused; downstream test fixtures
that want to install it should use a local `file:` or workspace
dependency.
