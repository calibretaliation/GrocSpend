import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "./Button";
import { Input } from "./Input";

export const AuthScreen: React.FC = () => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const toggleMode = () => {
    setMode((prev) => (prev === "login" ? "register" : "login"));
    setError(null);
    setPassword("");
    setConfirmPassword("");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedUsername = username.trim();

    if (!trimmedUsername) {
      setError("Username is required.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      if (mode === "login") {
        await login(trimmedUsername, password);
      } else {
        await register(trimmedUsername, password);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : null;
      setError(message || "Unable to authenticate. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-8">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
            Smart Spend Tracker
          </p>
          <h1 className="mt-4 text-2xl font-bold text-slate-800">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {mode === "login"
              ? "Sign in to access your synced receipts and stats."
              : "Register to keep your receipts backed up in the cloud."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <Input
            label="Username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Enter your username"
            disabled={submitting}
          />
          <Input
            label="Password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            disabled={submitting}
          />
          {mode === "register" && (
            <Input
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Re-enter your password"
              disabled={submitting}
            />
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <Button type="submit" fullWidth disabled={submitting} className="flex items-center justify-center gap-2">
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                {mode === "login" ? "Signing in..." : "Creating account..."}
              </>
            ) : mode === "login" ? (
              "Sign in"
            ) : (
              "Create account"
            )}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          {mode === "login" ? "Don't have an account yet?" : "Already registered?"}{" "}
          <button
            type="button"
            onClick={toggleMode}
            className="font-medium text-primary hover:underline"
            disabled={submitting}
          >
            {mode === "login" ? "Create one" : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
};
