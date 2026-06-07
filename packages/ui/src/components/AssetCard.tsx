import { Card, CardContent, CardHeader, CardTitle } from "./ui/card.js";
import { Button } from "./ui/button.js";
import { RiskBadge } from "./RiskBadge.js";
import { ExternalLink } from "lucide-react";

interface AssetCardProps {
  id: string;
  url: string;
  status: string;
  riskLevel?: string;
  lastScannedAt?: string | null;
  onScan?: (id: string) => void;
}

export function AssetCard({ id, url, status, riskLevel, lastScannedAt, onScan }: AssetCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline truncate max-w-xs flex items-center gap-1"
          >
            {url}
            <ExternalLink className="h-3 w-3 flex-shrink-0" />
          </a>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-gray-500">Status: <strong>{status}</strong></span>
          {riskLevel !== undefined && <RiskBadge level={riskLevel} />}
        </div>
        {lastScannedAt !== undefined && lastScannedAt !== null && (
          <p className="text-xs text-gray-400">
            Last scan: {new Date(lastScannedAt).toLocaleString()}
          </p>
        )}
        {onScan !== undefined && (
          <Button size="sm" variant="outline" onClick={() => onScan(id)}>
            Scan Now
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
