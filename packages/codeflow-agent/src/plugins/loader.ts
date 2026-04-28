import { pluginRegistry, type PluginEntry } from './registry.js';

export interface PluginLoadResult {
  id: string;
  success: boolean;
  error?: string;
}

export async function loadPlugin(pluginId: string): Promise<PluginLoadResult> {
  const plugin = pluginRegistry.get(pluginId);
  if (!plugin) {
    return { id: pluginId, success: false, error: `Plugin ${pluginId} not found` };
  }

  // In a real implementation, this would load the plugin's code and initialize it
  return { id: pluginId, success: true };
}

export async function loadPlugins(pluginIds: string[]): Promise<PluginLoadResult[]> {
  return Promise.all(pluginIds.map(id => loadPlugin(id)));
}

export function getPluginCapabilities(pluginId: string): string[] {
  return pluginRegistry.getCapabilities(pluginId);
}
