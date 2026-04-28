export interface PluginLoadResult {
    id: string;
    success: boolean;
    error?: string;
}
export declare function loadPlugin(pluginId: string): Promise<PluginLoadResult>;
export declare function loadPlugins(pluginIds: string[]): Promise<PluginLoadResult[]>;
export declare function getPluginCapabilities(pluginId: string): string[];
//# sourceMappingURL=loader.d.ts.map