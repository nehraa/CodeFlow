import { pluginRegistry } from './registry.js';
export async function loadPlugin(pluginId) {
    const plugin = pluginRegistry.get(pluginId);
    if (!plugin) {
        return { id: pluginId, success: false, error: `Plugin ${pluginId} not found` };
    }
    // In a real implementation, this would load the plugin's code and initialize it
    return { id: pluginId, success: true };
}
export async function loadPlugins(pluginIds) {
    return Promise.all(pluginIds.map(id => loadPlugin(id)));
}
export function getPluginCapabilities(pluginId) {
    return pluginRegistry.getCapabilities(pluginId);
}
