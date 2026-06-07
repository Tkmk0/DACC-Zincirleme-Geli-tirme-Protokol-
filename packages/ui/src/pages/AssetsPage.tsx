import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch, apiPost, apiDelete } from "../lib/api.js";
import { Button } from "../components/ui/button.js";
import { Input } from "../components/ui/input.js";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.js";
import { RiskBadge } from "../components/RiskBadge.js";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table.js";
import { LogOut, Plus, RefreshCw, Trash2 } from "lucide-react";

interface RiskScore {
  level: string;
  score: number;
}

interface Asset {
  id: string;
  url: string;
  status: string;
  createdAt: string;
  riskScore?: RiskScore | null;
}

interface AssetsResponse {
  assets: Asset[];
  total: number;
}

interface ScanResponse {
  auditEventId: string;
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
          <Link to="/assets" className="font-semibold text-blue-600">Assets</Link>
        </nav>
      </div>
      <Button variant="ghost" size="sm" onClick={logout}>
        <LogOut className="h-4 w-4 mr-1" /> Sign out
      </Button>
    </header>
  );
}

export function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [newUrl, setNewUrl] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    apiFetch<AssetsResponse>("/assets?limit=50")
      .then((r) => { setAssets(r.assets); setTotal(r.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setAddError(null);
    try {
      await apiPost("/assets", { url: newUrl });
      setNewUrl("");
      load();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add asset");
    }
  };

  const handleScan = async (id: string) => {
    setScanMsg(null);
    try {
      const r = await apiPost<ScanResponse>(`/assets/${id}/scan`, {});
      setScanMsg(`Scan queued: ${r.auditEventId}`);
      setTimeout(() => setScanMsg(null), 4000);
    } catch (err) {
      setScanMsg(err instanceof Error ? err.message : "Scan failed");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Archive this asset?")) return;
    await apiDelete(`/assets/${id}`);
    load();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Assets ({total})</h1>
          <Button size="sm" variant="outline" onClick={load}>
            <RefreshCw className="h-3 w-3 mr-1" /> Refresh
          </Button>
        </div>

        {/* Add asset */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Add Asset</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleAdd(e)} className="flex gap-2">
              <Input
                placeholder="https://example.com"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                className="flex-1"
              />
              <Button type="submit">
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </form>
            {addError !== null && <p className="text-xs text-red-500 mt-2">{addError}</p>}
          </CardContent>
        </Card>

        {scanMsg !== null && (
          <div className="text-sm bg-blue-50 text-blue-700 px-4 py-2 rounded-md">{scanMsg}</div>
        )}

        {/* Assets table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>URL</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-400">Loading…</TableCell>
                  </TableRow>
                ) : assets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-400">No assets found.</TableCell>
                  </TableRow>
                ) : (
                  assets.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="max-w-xs truncate font-mono text-xs">{a.url}</TableCell>
                      <TableCell>
                        <span className="text-xs text-gray-600">{a.status}</span>
                      </TableCell>
                      <TableCell>
                        {a.riskScore !== undefined && a.riskScore !== null ? (
                          <RiskBadge level={a.riskScore.level} />
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {new Date(a.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handleScan(a.id)}
                          >
                            Scan
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => void handleDelete(a.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
