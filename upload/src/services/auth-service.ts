import { createSession } from "@backend-core/sessions";
import type { GitHubUser } from "@packages/shared/auth";

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

function requireGitHubClientId() {
    if (!GITHUB_CLIENT_ID) {
        throw new Error("GITHUB_CLIENT_ID is required");
    }
    return GITHUB_CLIENT_ID;
}

function requireGitHubClientSecret() {
    if (!GITHUB_CLIENT_SECRET) {
        throw new Error("GITHUB_CLIENT_SECRET is required");
    }
    return GITHUB_CLIENT_SECRET;
}

export function getGitHubAuthUrl() {
    return `https://github.com/login/oauth/authorize?client_id=${requireGitHubClientId()}&scope=read:user`;
}

async function exchangeCodeForToken(code: string): Promise<string> {
    const response = await fetch(
        "https://github.com/login/oauth/access_token",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({
                client_id: requireGitHubClientId(),
                client_secret: requireGitHubClientSecret(),
                code,
            }),
        },
    );
    const data = (await response.json()) as {
        access_token?: string;
        error?: string;
    };
    if (!data.access_token) {
        throw new Error(data.error || "Failed to exchange code for token");
    }
    return data.access_token;
}

async function getGitHubUser(accessToken: string): Promise<GitHubUser> {
    const response = await fetch("https://api.github.com/user", {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github+json",
        },
    });
    if (!response.ok) {
        throw new Error("Invalid or expired GitHub token");
    }
    return (await response.json()) as GitHubUser;
}

export async function completeGitHubSignIn(code: string) {
    const accessToken = await exchangeCodeForToken(code);
    const user = await getGitHubUser(accessToken);
    const sessionToken = await createSession({ user });
    return { sessionToken, user };
}
