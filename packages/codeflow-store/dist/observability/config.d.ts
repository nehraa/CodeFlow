export interface ObservabilityConfig {
    maxSpans: number;
    maxLogs: number;
}
export declare const loadObservabilityConfig: (projectName: string) => Promise<ObservabilityConfig>;
export declare const saveObservabilityConfig: (projectName: string, config: ObservabilityConfig) => Promise<void>;
//# sourceMappingURL=config.d.ts.map