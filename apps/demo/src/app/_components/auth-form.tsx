"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

function createRandomCredentials() {
  const id = crypto.randomUUID().slice(0, 8);
  const email = `test-${Date.now()}-${id}@example.com`;
  const password = `PayKit-test-${crypto.randomUUID()}`;

  return { email, password };
}

function formatCredentials(credentials: { email: string; password: string }) {
  return `Email: ${credentials.email}\nPassword: ${credentials.password}`;
}

async function copyCredentials(credentials: { email: string; password: string }) {
  const text = formatCredentials(credentials);

  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();

  try {
    if (!document.execCommand("copy")) {
      throw new Error("Clipboard copy failed");
    }
  } finally {
    textarea.remove();
  }
}

export function AuthForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [randomAccountLoading, setRandomAccountLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignUp) {
        const result = await authClient.signUp.email({
          email,
          password,
          name: "Demo User",
        });
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

  async function handleRandomAccount() {
    setError("");
    setRandomAccountLoading(true);

    const credentials = createRandomCredentials();
    let credentialsCopied = false;

    try {
      setEmail(credentials.email);
      setPassword(credentials.password);

      try {
        await copyCredentials(credentials);
        credentialsCopied = true;
      } catch {
        credentialsCopied = false;
      }

      const result = await authClient.signUp.email({
        email: credentials.email,
        password: credentials.password,
        name: "Demo User",
      });

      if (result.error) {
        const message = result.error.message ?? "Random account sign up failed";
        setError(message);
        toast.error(message, {
          description: credentialsCopied
            ? "Generated credentials were copied, but the account was not created."
            : undefined,
        });
        return;
      }

      if (credentialsCopied) {
        toast.success("Signed up with a random test account", {
          description: "Credentials copied to clipboard.",
        });
      } else {
        toast.warning("Signed up with a random test account", {
          description: `Clipboard copy failed. ${formatCredentials(credentials)}`,
        });
      }

      router.replace(redirectTo);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      toast.error(message);
    } finally {
      setRandomAccountLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isSignUp ? "Sign up" : "Sign in"}</CardTitle>
        <CardDescription>
          {isSignUp ? "Create an account to get started" : "Enter your credentials to continue"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              type="email"
              value={email}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              type="password"
              value={password}
            />
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <Button disabled={loading || randomAccountLoading} type="submit">
            {loading ? "Loading..." : isSignUp ? "Sign up" : "Sign in"}
          </Button>
          <Button
            disabled={loading || randomAccountLoading}
            onClick={handleRandomAccount}
            type="button"
            variant="secondary"
          >
            {randomAccountLoading ? "Creating account..." : "Sign up with random account"}
          </Button>
          <Button
            className="text-muted-foreground"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
            }}
            type="button"
            variant="link"
          >
            {isSignUp ? "Already have an account? Sign in" : "No account? Sign up"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
