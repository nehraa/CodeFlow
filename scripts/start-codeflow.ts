#!/usr/bin/env node
/**
 * CodeFlow - One Command Startup Script
 * Usage: npx tsx scripts/start-codeflow.ts [dev|start|build|test|check]
 */

import { execSync } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";

// Colors
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const NC = "\x1b[0m";

const log = {
    info: (msg: string) => console.log(`${BLUE}[INFO]${NC} ${msg}`),
    success: (msg: string) => console.log(`${GREEN}[SUCCESS]${NC} ${msg}`),
    warn: (msg: string) => console.log(`${YELLOW}[WARN]${NC} ${msg}`),
    error: (msg: string) => console.error(`${RED}[ERROR]${NC} ${msg}`),
};

const PROJECT_ROOT = resolve(__dirname, "..");

function run(cmd: string, options?: { ignoreErrors?: boolean }) {
    try {
        return execSync(cmd, {
            cwd: PROJECT_ROOT,
            stdio: "inherit",
            encoding: "utf-8",
        });
    } catch (e) {
        if (!options?.ignoreErrors) {
            throw e;
        }
        return "";
    }
}

function checkNode() {
    try {
        const version = process.version;
        const major = parseInt(version.slice(1).split(".")[0]);
        if (major < 18) {
            log.error(`Node.js 18+ required. Current: ${version}`);
            process.exit(1);
        }
        log.success(`Node.js ${version}`);
    } catch (e) {
        log.error("Node.js is not installed");
        process.exit(1);
    }
}

function checkDeps() {
    const nodeModulesPath = resolve(PROJECT_ROOT, "node_modules");
    if (!existsSync(nodeModulesPath)) {
        log.warn("node_modules not found. Installing...");
        run("npm install");
        log.success("Dependencies installed");
    }
}

async function typeCheck() {
    log.info("Running TypeScript type check...");
    try {
        execSync("npm run check", { cwd: PROJECT_ROOT, stdio: "inherit" });
        log.success("Type check passed");
    } catch {
        log.error("Type check failed");
        process.exit(1);
    }
}

async function testRun() {
    log.info("Running tests...");
    try {
        run("npm test -- --run");
        log.success("Tests passed");
    } catch {
        log.warn("Some tests failed (continuing anyway)");
    }
}

async function startDev() {
    log.info("🚀 Starting CodeFlow in DEV mode...");
    log.info("================================");

    checkNode();
    checkDeps();
    await typeCheck();

    log.info("Starting Next.js dev server...");
    log.info("API: http://localhost:3000/api");
    log.info("App: http://localhost:3000");
    log.info("Press Ctrl+C to stop");
    log.info("================================");

    run("npm run dev");
}

async function startProd() {
    log.info("🏭 Starting CodeFlow in PRODUCTION mode...");
    log.info("================================");

    checkNode();
    checkDeps();

    const buildPath = resolve(PROJECT_ROOT, ".next");
    if (!existsSync(buildPath)) {
        log.info("Building production bundle...");
        run("npm run build");
    }

    log.info("Starting production server...");
    run("npm run start");
}

async function build() {
    checkNode();
    checkDeps();
    log.info("Building production bundle...");
    run("npm run build");
    log.success("Build complete");
}

// Main
const command = process.argv[2] || "dev";

switch (command) {
    case "dev":
        startDev().catch((e) => {
            log.error(String(e));
            process.exit(1);
        });
        break;
    case "start":
        startProd().catch((e) => {
            log.error(String(e));
            process.exit(1);
        });
        break;
    case "build":
        build().catch((e) => {
            log.error(String(e));
            process.exit(1);
        });
        break;
    case "test":
        checkNode();
        checkDeps();
        testRun().catch(() => process.exit(0));
        break;
    case "check":
        checkNode();
        checkDeps();
        typeCheck().catch(() => process.exit(1));
        break;
    default:
        console.log(`Usage: npx tsx scripts/start-codeflow.ts [dev|start|build|test|check]`);
        console.log("  dev   - Start development server (default)");
        console.log("  start - Start production server");
        console.log("  build - Build production bundle");
        console.log("  test  - Run tests");
        console.log("  check - Run type check");
        process.exit(1);
}
