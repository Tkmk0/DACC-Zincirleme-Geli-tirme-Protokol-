const COLORS: Record<string, string> = {
  NONE: "bg-gray-100 text-gray-600",
  LOW: "bg-green-100 text-green-700",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-700",
};

export function RiskBadge({ level }: { level: string }) {
  const cls = COLORS[level] ?? COLORS["NONE"]!;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {level}
    </span>
  );
}
