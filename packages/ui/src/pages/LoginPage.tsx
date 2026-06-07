import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost } from "../lib/api.js";
import { DEMO_KEY } from "../lib/mock-data.js";
import { Button } from "../components/ui/button.js";
import { Input } from "../components/ui/input.js";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.js";

interface LoginResponse {
  token: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const enterDemo = () => {
    localStorage.setItem("dacc_demo", "1");
    localStorage.setItem("dacc_token", "demo");
    void navigate("/dashboard");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (apiKey === DEMO_KEY) {
        enterDemo();
        return;
      }
      const { token } = await apiPost<LoginResponse>("/auth/login", { apiKey });
      localStorage.removeItem("dacc_demo");
      localStorage.setItem("dacc_token", token);
      void navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">DACC Console</CardTitle>
          <p className="text-sm text-gray-500 mt-1">Sign in with your API key</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="apiKey" className="text-sm font-medium">
                API Key
              </label>
              <Input
                id="apiKey"
                type="password"
                placeholder="dacc_live_..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                required
              />
            </div>

            {error !== null && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign In"}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-400">or</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={enterDemo}
            >
              Try Demo
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
