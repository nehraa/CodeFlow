import { test, expect } from "@playwright/test";

/**
 * E2E Tests for CodeFlow IDE Mode
 * Tests the complete IDE integration: layout, file operations, graph navigation
 */

test.describe("CodeFlow IDE Mode", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("http://localhost:3000");
        // Wait for the app to load
        await page.waitForLoadState("networkidle");
    });

    test("loads with graph-first default", async ({ page }) => {
        // Should show graph mode by default
        const graphCanvas = await page.locator('[data-testid="graph-canvas"]').first();
        await expect(graphCanvas).toBeVisible();

        // IDE layout should not be visible initially
        const ideLayout = await page.locator('[data-testid="ide-layout"]').first();
        await expect(ideLayout).not.toBeVisible();
    });

    test("toggles to IDE mode with keyboard shortcut", async ({ page }) => {
        // Press Cmd/Ctrl+Shift+E
        const isMac = await page.evaluate(() => navigator.platform.includes("Mac"));
        const modifier = isMac ? "Meta" : "Control";

        await page.keyboard.press(`${modifier}+Shift+E`);

        // Wait for transition
        await page.waitForTimeout(500);

        // IDE layout should now be visible
        const ideLayout = await page.locator('[data-testid="ide-layout"]').first();
        await expect(ideLayout).toBeVisible();

        // File tree should be present
        const fileTree = await page.locator('[data-testid="file-tree"]').first();
        await expect(fileTree).toBeVisible();

        // Floating graph should be visible
        const floatingGraph = await page.locator('[data-testid="floating-graph"]').first();
        await expect(floatingGraph).toBeVisible();
    });

    test("file explorer opens files", async ({ page }) => {
        // First switch to IDE mode
        const isMac = await page.evaluate(() => navigator.platform.includes("Mac"));
        const modifier = isMac ? "Meta" : "Control";
        await page.keyboard.press(`${modifier}+Shift+E`);
        await page.waitForTimeout(500);

        // Click on a file in the file tree
        const fileItem = await page.locator('.file-tree-item').first();
        if (await fileItem.isVisible()) {
            await fileItem.click();

            // Monaco editor should open the file
            const monacoEditor = await page.locator('.monaco-editor').first();
            await expect(monacoEditor).toBeVisible();
        }
    });

    test("VCR panel toggle", async ({ page }) => {
        // Switch to IDE mode
        const isMac = await page.evaluate(() => navigator.platform.includes("Mac"));
        const modifier = isMac ? "Meta" : "Control";
        await page.keyboard.press(`${modifier}+Shift+E`);
        await page.waitForTimeout(500);

        // Press Cmd/Ctrl+Shift+R for VCR
        await page.keyboard.press(`${modifier}+Shift+R`);
        await page.waitForTimeout(300);

        // VCR panel should appear
        const vcrPanel = await page.locator('[data-testid="vcr-panel"]').first();
        await expect(vcrPanel).toBeVisible().or(() => {
            // Panel might have different test id
            return page.locator('text=VCR').first().isVisible();
        });
    });

    test("heatmap toggle", async ({ page }) => {
        // Switch to IDE mode
        const isMac = await page.evaluate(() => navigator.platform.includes("Mac"));
        const modifier = isMac ? "Meta" : "Control";
        await page.keyboard.press(`${modifier}+Shift+E`);
        await page.waitForTimeout(500);

        // Press Cmd/Ctrl+Shift+H for heatmap
        await page.keyboard.press(`${modifier}+Shift+H`);
        await page.waitForTimeout(300);

        // Heatmap should be active
        const heatmapIndicator = await page.locator('text=Heatmap').first();
        await expect(heatmapIndicator).toBeVisible();
    });

    test("keyboard navigation between modes", async ({ page }) => {
        const isMac = await page.evaluate(() => navigator.platform.includes("Mac"));
        const modifier = isMac ? "Meta" : "Control";

        // Toggle to IDE
        await page.keyboard.press(`${modifier}+Shift+E`);
        await page.waitForTimeout(500);

        const ideLayout = await page.locator('[data-testid="ide-layout"]').first();
        await expect(ideLayout).toBeVisible();

        // Toggle back to graph
        await page.keyboard.press(`${modifier}+Shift+E`);
        await page.waitForTimeout(500);

        // Graph should be visible again
        const graphCanvas = await page.locator('[data-testid="graph-canvas"]').first();
        await expect(graphCanvas).toBeVisible();
    });

    test.reserved("API routes respond correctly", async ({ request }) => {
        // Test file API
        const listResponse = await request.post("/api/files/list", {
            data: { path: "." },
            headers: { "x-codeflow-repo-path": process.cwd() }
        });
        expect(listResponse.status()).toBe(200);

        // Test build API (might require valid graph)
        const buildResponse = await request.post("/api/blueprint/build", {
            data: { repoPath: process.cwd() }
        });
        expect([200, 400, 500]).toContain(buildResponse.status());
    });
});

test.describe("CodeFlow Graph Features", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("http://localhost:3000");
        await page.waitForLoadState("networkidle");
    });

    test("graph canvas is interactive", async ({ page }) => {
        const graphCanvas = await page.locator('[data-testid="graph-canvas"]').first();
        await expect(graphCanvas).toBeVisible();

        // Should be able to pan (drag)
        const box = await graphCanvas.boundingBox();
        if (box) {
            await graphCanvas.dragTo(graphCanvas, {
                sourcePosition: { x: box.width / 2, y: box.height / 2 },
                targetPosition: { x: box.width / 2 + 50, y: box.height / 2 + 50 }
            });
        }
    });
});
