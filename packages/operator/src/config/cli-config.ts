import Conf from "conf";

interface DaccConfigSchema {
  apiKey: string;
  endpoint: string;
  tenantId: string;
}

const store = new Conf<DaccConfigSchema>({
  projectName: "dacc",
  defaults: {
    apiKey: "",
    endpoint: "http://localhost:3001",
    tenantId: "",
  },
});

export class CliConfig {
  get(key: keyof DaccConfigSchema): string | undefined {
    const val = store.get(key);
    return val !== "" ? val : undefined;
  }

  set(key: keyof DaccConfigSchema, value: string): void {
    store.set(key, value);
  }

  clear(): void {
    store.clear();
  }

  getAll(): Record<string, string | undefined> {
    return {
      apiKey: store.get("apiKey") || undefined,
      endpoint: store.get("endpoint") || undefined,
      tenantId: store.get("tenantId") || undefined,
    };
  }

  getEndpoint(): string {
    return store.get("endpoint") || "http://localhost:3001";
  }

  getApiKey(): string | undefined {
    const k = store.get("apiKey");
    return k !== "" ? k : undefined;
  }

  getTenantId(): string | undefined {
    const t = store.get("tenantId");
    return t !== "" ? t : undefined;
  }
}

export const cliConfig = new CliConfig();
