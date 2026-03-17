import { Request, Response, NextFunction } from "express";
import { loadEnv } from "@shared/env";

loadEnv();

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string | null;
  html_url: string;
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!data.access_token) {
    throw new Error(data.error || "Failed to exchange code for token");
  }
  return data.access_token;
}

export async function getGitHubUser(accessToken: string): Promise<GitHubUser> {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
    },
  });

  if (!res.ok) {
    throw new Error("Invalid or expired GitHub token");
  }
  return (await res.json()) as GitHubUser;
}

// Simple in-memory token-to-user cache for the session
const tokenCache = new Map<string, { user: GitHubUser; expiry: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function resolveGitHubUser(token: string) {
  const cached = tokenCache.get(token);
  if (cached && cached.expiry > Date.now()) {
    return cached.user;
  }

  const user = await getGitHubUser(token);
  tokenCache.set(token, { user, expiry: Date.now() + CACHE_TTL });
  return user;
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ message: "Authorization required" });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const user = await resolveGitHubUser(token);
    (req as any).githubUser = user;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function getOptionalUser(
  req: Request
): GitHubUser | undefined {
  return (req as any).githubUser;
}

export async function optionalAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.slice(7);

  try {
    const user = await resolveGitHubUser(token);
    (req as any).githubUser = user;
  } catch(error) {
    console.error(error);
    // Silently ignore, user stays unauthenticated
  }
  next();
}

export { GITHUB_CLIENT_ID };
