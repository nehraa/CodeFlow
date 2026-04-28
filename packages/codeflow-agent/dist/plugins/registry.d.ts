export interface PluginEntry {
    id: string;
    name: string;
    version: string;
    description: string;
    capabilities: string[];
    config?: Record<string, unknown>;
}
export declare const BUILTIN_PLUGINS: PluginEntry[];
export declare class PluginRegistry {
    private plugins;
    constructor(initialPlugins?: PluginEntry[]);
    register(plugin: PluginEntry): void;
    get(id: string): PluginEntry | undefined;
    list(): PluginEntry[];
    findByCapability(capability: string): PluginEntry[];
    getCapabilities(pluginId: string): string[];
}
export declare const pluginRegistry: PluginRegistry;
//# sourceMappingURL=registry.d.ts.map