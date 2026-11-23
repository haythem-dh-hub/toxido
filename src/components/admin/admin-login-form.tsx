"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function AdminLoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.get("email"), password: data.get("password") }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) { setError(result.error ?? "Sign-in failed."); return; }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Sign-in is temporarily unavailable.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 grid gap-5">
      <label className="text-xs uppercase tracking-wider text-silver-bright">Email
        <input name="email" type="email" autoComplete="username" required maxLength={254} className="mt-2 min-h-12 w-full border border-smoke bg-ink px-4 text-sm normal-case tracking-normal text-ivory" />
      </label>
      <label className="text-xs uppercase tracking-wider text-silver-bright">Password
        <input name="password" type="password" autoComplete="current-password" required maxLength={1024} className="mt-2 min-h-12 w-full border border-smoke bg-ink px-4 text-sm normal-case tracking-normal text-ivory" />
      </label>
      {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
      <button type="submit" disabled={busy} className="min-h-12 border border-gold bg-gold px-5 text-xs font-bold uppercase tracking-[0.16em] text-ink transition-colors hover:bg-ivory disabled:opacity-60">{busy ? "Verifying…" : "Sign in"}</button>
    </form>
  );
}
