import { Badge } from "./ui/badge.js";

interface AuditEntry {
  id: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  assetId: string;
}

const STATUS_VARIANT: Record<string, "default" | "success" | "destructive" | "secondary" | "warning" | "outline"> = {
  COMPLETED: "success",
  FAILED: "destructive",
  RUNNING: "default",
  QUEUED: "secondary",
};

export function AuditTimeline({ audits }: { audits: AuditEntry[] }) {
  if (audits.length === 0) {
    return <p className="text-sm text-gray-500 py-4">No audits yet.</p>;
  }

  return (
    <ol className="relative border-l border-gray-200 ml-3 space-y-6">
      {audits.map((audit) => (
        <li key={audit.id} className="ml-6">
          <span className="absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 ring-4 ring-white" />
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={STATUS_VARIANT[audit.status] ?? "outline"}>
              {audit.status}
            </Badge>
            <time className="text-xs text-gray-500">
              {audit.startedAt ? new Date(audit.startedAt).toLocaleString() : "—"}
            </time>
          </div>
          <p className="text-xs text-gray-400 font-mono truncate">{audit.id}</p>
        </li>
      ))}
    </ol>
  );
}
