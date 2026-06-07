export type SandboxPhase = "idle" | "capturing" | "rolling-back" | "pruning";
export type SandboxStatus = "ready" | "busy" | "error";

export interface LifecycleConfig {
  tenantId: string;
  maxSnapshots?: number;
  autoPrune?: boolean;
}

export interface SandboxLifecycle {
  tenantId: string;
  maxSnapshots: number;
  autoPrune: boolean;
  getStatus(): SandboxStatus;
}

export function createSandboxLifecycle(config: LifecycleConfig): SandboxLifecycle {
  let _phase: SandboxPhase = "idle";
  void _phase; // suppress unused warning; phase tracked internally

  return {
    tenantId: config.tenantId,
    maxSnapshots: config.maxSnapshots ?? 10,
    autoPrune: config.autoPrune ?? true,
    getStatus(): SandboxStatus {
      return "ready";
    },
  };
}
