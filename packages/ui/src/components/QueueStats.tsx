import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api.js";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card.js";

interface QueueCounts {
  waiting: number;
  active: number;
  failed: number;
  completed: number;
}

interface QueuesResponse {
  queues: Record<string, QueueCounts>;
}

export function QueueStats() {
  const [queues, setQueues] = useState<Record<string, QueueCounts>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const poll = () => {
      apiFetch<QueuesResponse>("/debug/queues")
        .then((data) => {
          if (!cancelled) setQueues(data.queues);
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(e instanceof Error ? e.message : "Unknown error");
        });
    };

    poll();
    const id = setInterval(poll, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (error !== null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Queue Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-500">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const entries = Object.entries(queues);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Queue Stats</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <div className="space-y-3">
            {entries.map(([name, counts]) => (
              <div key={name}>
                <p className="text-xs font-mono text-gray-600 mb-1 truncate">{name}</p>
                <div className="flex gap-3 text-xs">
                  <span className="text-yellow-600">W:{counts.waiting}</span>
                  <span className="text-blue-600">A:{counts.active}</span>
                  <span className="text-red-600">F:{counts.failed}</span>
                  <span className="text-green-600">C:{counts.completed}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
