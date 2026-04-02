import type { Request, Response } from "express";
import { parseGitHubRepoUrl } from "@packages/shared/github-repo";

const GITHUB_ACCEPT = "application/vnd.github+json";

async function fetchAllBranchNames(
    owner: string,
    repo: string,
): Promise<{ ok: true; names: string[] } | { ok: false; status: number; message: string }> {
    const token = process.env.GITHUB_TOKEN?.trim();
    const headers: Record<string, string> = {
        Accept: GITHUB_ACCEPT,
        "User-Agent": "Build-Flow-Upload-Service",
    };
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const names: string[] = [];
    let page = 1;

    for (;;) {
        const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100&page=${page}`;
        const res = await fetch(url, { headers });
        const text = await res.text();
        let data: unknown;
        try {
            data = text ? JSON.parse(text) : [];
        } catch {
            return {
                ok: false,
                status: 502,
                message: "Invalid response from GitHub",
            };
        }

        if (!res.ok) {
            const msg =
                typeof data === "object" &&
                data !== null &&
                "message" in data &&
                typeof (data as { message: unknown }).message === "string"
                    ? (data as { message: string }).message
                    : `GitHub returned ${res.status}`;
            return { ok: false, status: res.status, message: msg };
        }

        if (!Array.isArray(data)) {
            return {
                ok: false,
                status: 502,
                message: "Unexpected GitHub API response",
            };
        }

        for (const row of data) {
            if (
                row &&
                typeof row === "object" &&
                "name" in row &&
                typeof (row as { name: unknown }).name === "string"
            ) {
                names.push((row as { name: string }).name);
            }
        }

        if (data.length < 100) {
            break;
        }
        page += 1;
        if (page > 50) {
            break;
        }
    }

    return { ok: true, names };
}

export async function listGitHubBranchesHandler(req: Request, res: Response) {
    const repoUrl = req.query.repoUrl as string | undefined;
    if (!repoUrl?.trim()) {
        res.status(400).json({ message: "repoUrl query parameter is required" });
        return;
    }

    const parsed = parseGitHubRepoUrl(repoUrl);
    if (!parsed) {
        res.status(400).json({
            message: "Could not parse owner/repo from URL (GitHub only)",
        });
        return;
    }

    try {
        const result = await fetchAllBranchNames(parsed.owner, parsed.repo);
        if (!result.ok) {
            const status =
                result.status === 404
                    ? 404
                    : result.status === 403
                      ? 403
                      : 502;
            res.status(status).json({ message: result.message, branches: [] });
            return;
        }
        res.json({ branches: result.names });
    } catch (error) {
        res.status(502).json({
            message: (error as Error).message || "Failed to reach GitHub",
            branches: [],
        });
    }
}
