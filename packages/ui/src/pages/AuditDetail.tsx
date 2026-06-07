import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api.js";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.js";
import { Progress } from "../components/ui/progress.js";
import { Badge } from "../components/ui/badge.js";
import { Button } from "../components/ui/button.js";
import { LogOut, ArrowLeft } from "lucide-react";

interface CheckResult {
  checkName: string;
  passed: boolean;
  severity: string;
  score: number;
  details: string;
  issues?: string[];
  warnings?: string[];
}

interface Recommendation {
  checkName: string;
  priority: string;
  message: string;
}

interface AuditReport {
  score: number;
  riskScore: number;
  grade: string;
  checkResults: CheckResult[];
  recommendations: Recommendation[];
  summary: string;
  generatedAt: string;
}

const GRADE_COLORS: Record<string, string> = {
  A: "text-green-700 bg-green-100",
  B: "text-blue-700 bg-blue-100",
  C: "text-yellow-700 bg-yellow-100",
  D: "text-orange-700 bg-orange-100",
  F: "text-red-700 bg-red-100",
};

const PRIORITY_VARIANT: Record<string, "destructive" | "warning" | "secondary"> = {
  high: "destructive",
  medium: "warning",
  low: "secondary",
};

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

export function AuditDetail() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<AuditReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id === undefined) return;
    apiFetch<{ report: AuditReport }>(`/audits/${id}/report`)
      .then((r) => setReport(r.report))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [id]);

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/assets">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Audit Report</h1>
        </div>

        {error !== null && (
          <Card>
            <CardContent className="py-6">
              <p className="text-red-500 text-sm">{error}</p>
            </CardContent>
          </Card>
        )}

        {report === null && error === null && (
          <p className="text-sm text-gray-400">Loading…</p>
        )}

        {report !== null && (
          <>
            {/* Summary */}
            <Card>
              <CardContent className="p-6 flex items-center gap-8">
                <div className="text-center">
                  <span className={`text-5xl font-bold px-4 py-2 rounded-xl ${GRADE_COLORS[report.grade] ?? ""}`}>
                    {report.grade}
                  </span>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">SEO Score</span>
                    <span className="font-semibold">{report.score}/100</span>
                  </div>
                  <Progress value={report.score} />
                  <p className="text-xs text-gray-500 mt-2">{report.summary}</p>
                </div>
              </CardContent>
            </Card>

            {/* Recommendations */}
            {report.recommendations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recommendations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {report.recommendations.map((r, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Badge variant={PRIORITY_VARIANT[r.priority] ?? "secondary"} className="flex-shrink-0 mt-0.5">
                        {r.priority}
                      </Badge>
                      <div>
                        <p className="text-xs font-mono text-gray-500">{r.checkName}</p>
                        <p className="text-sm">{r.message}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Check results */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Check Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {report.checkResults.map((c) => (
                  <div key={c.checkName} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full flex-shrink-0 ${c.passed ? "bg-green-500" : "bg-red-500"}`} />
                        <span className="text-sm font-medium capitalize">{c.checkName.replace(/-/g, " ")}</span>
                      </div>
                      <span className="text-sm text-gray-500">{c.score}/100</span>
                    </div>
                    <Progress value={c.score} className={c.score >= 70 ? "[&>div]:bg-green-500" : c.score >= 40 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-red-500"} />
                    <p className="text-xs text-gray-500">{c.details}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
