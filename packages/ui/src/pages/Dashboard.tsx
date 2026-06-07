import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api.js";
import { useWebSocket } from "../lib/ws.js";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.js";
import { QueueStats } from "../components/QueueStats.js";
import { RiskBadge } from "../components/RiskBadge.js";
import { Button } from "../components/ui/button.js";
import { LogOut } from "lucide-react";

interface TenantStats {
  assetCount: number;
  auditCount: number;
  activeRiskScores: number;
}

interface Asset {
  id: string;
  url: string;
  status: string;
  riskScore?: { level: string } | null;
}

interface AssetsResponse {
  assets: Asset[];
}

function NavBar() {
  const navigate = useNavigate();
  const logout = () => {
    localStorage.removeItem("dacc_token");
    void navigate("/login");
  };
  return (
    <header className="border-b bg-white px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <span className="font-bold text-blue-700 text-lg">DACC</span>
        <nav className="flex gap-4 text-sm">
          <Link to="/dashboard" className="text-gray-700 hover:text-blue-600">Dashboard</Link>
          <Link to="/assets" className="text-gray-700 hover:text-blue-600">Assets</Link>
        </nav>
      </div>
      <Button variant="ghost" size="sm" onClick={logout}>
        <LogOut className="h-4 w-4 mr-1" /> Sign out
      </Button>
    </header>
  );
}

export function Dashboard() {
  const [stats, setStats] = useState<TenantStats | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const { messages, connected } = useWebSocket("/ws/live");

  useEffect(() => {
    void apiFetch<TenantStats>("/tenants/me/stats").then(setStats).catch(console.error);
    void apiFetch<AssetsResponse>("/assets?limit=5").then((r) => setAssets(r.assets)).catch(console.error);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <span className={`text-xs px-2 py-1 rounded-full ${connected ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
            {connected ? "Live" : "Offline"}
          </span>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm text-gray-500">Assets</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats?.assetCount ?? "—"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm text-gray-500">Total Audits</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats?.auditCount ?? "—"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm text-gray-500">Active Risk Scores</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats?.activeRiskScores ?? "—"}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent assets */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="font-semibold">Recent Assets</h2>
            {assets.length === 0 ? (
              <p className="text-sm text-gray-400">No assets yet. <Link to="/assets" className="text-blue-600 hover:underline">Add one.</Link></p>
            ) : (
              <div className="space-y-2">
                {assets.map((a) => (
                  <Card key={a.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{a.url}</p>
                      <p className="text-xs text-gray-400">{a.status}</p>
                    </div>
                    {a.riskScore !== undefined && a.riskScore !== null && (
                      <RiskBadge level={a.riskScore.level} />
                    )}
                  </Card>
                ))}
                <Link to="/assets" className="text-sm text-blue-600 hover:underline block">
                  View all →
                </Link>
              </div>
            )}
          </div>

          {/* Side panel */}
          <div className="space-y-4">
            <QueueStats />

            {/* Live event feed */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Live Events</CardTitle>
              </CardHeader>
              <CardContent>
                {messages.length === 0 ? (
                  <p className="text-xs text-gray-400">Waiting for events…</p>
                ) : (
                  <ul className="space-y-1 max-h-48 overflow-y-auto">
                    {[...messages].reverse().slice(0, 10).map((m, i) => (
                      <li key={i} className="text-xs text-gray-600 border-b pb-1">
                        <span className="font-medium">{m.eventType}</span>
                        <span className="text-gray-400 ml-1">{new Date(m.occurredAt).toLocaleTimeString()}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
