import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distBin = join(__dirname, "../dist/bin");

// Ensure the bin directory exists (tsc doesn't create nested dirs by default)
await mkdir(distBin, { recursive: true });
