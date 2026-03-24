"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";

export function AuthForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignUp) {
        const result = await authClient.signUp.email({ email, password, name });
        if (result.error) {
          setError(result.error.message ?? "Sign up failed");
          return;
        }
      } else {
        const result = await authClient.signIn.email({ email, password });
        if (result.error) {
          setError(result.error.message ?? "Sign in failed");
          return;
        }
      }

      router.replace(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-6"
      onSubmit={handleSubmit}
    >
      <h2 className="text-xl font-semibold">{isSignUp ? "Sign up" : "Sign in"}</h2>
      {isSignUp ? (
        <input
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm placeholder:text-white/40"
          onChange={(event) => setName(event.target.value)}
          placeholder="Name"
          value={name}
        />
      ) : null}
      <input
        className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm placeholder:text-white/40"
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email"
        type="email"
        value={email}
      />
      <input
        className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm placeholder:text-white/40"
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Password"
        type="password"
        value={password}
      />
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <button
        className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
        disabled={loading}
        type="submit"
      >
        {loading ? "Loading..." : isSignUp ? "Sign up" : "Sign in"}
      </button>
      <button
        className="text-sm text-white/50 transition hover:text-white/80"
        onClick={() => {
          setIsSignUp(!isSignUp);
          setError("");
        }}
        type="button"
      >
        {isSignUp ? "Already have an account? Sign in" : "No account? Sign up"}
      </button>
    </form>
  );
}
