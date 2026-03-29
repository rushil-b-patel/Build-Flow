/** Extract owner/repo from common GitHub remote URL shapes. */
export function parseGitHubRepoUrl(input: string): {
    owner: string;
    repo: string;
} | null {
    const s = input.trim();
    if (!s) {
        return null;
    }

    const ssh = /^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/i.exec(s);
    if (ssh) {
        const owner = ssh[1];
        let repo = ssh[2].replace(/\.git$/i, "");
        return { owner, repo };
    }

    try {
        const href = /^https?:\/\//i.test(s) ? s : `https://${s}`;
        const u = new URL(href);
        const host = u.hostname.replace(/^www\./i, "");
        if (!/^github\.com$/i.test(host)) {
            return null;
        }
        const parts = u.pathname.split("/").filter(Boolean);
        if (parts.length < 2) {
            return null;
        }
        const owner = parts[0];
        let repo = parts[1];
        if (repo.toLowerCase().endsWith(".git")) {
            repo = repo.slice(0, -4);
        }
        return { owner, repo };
    } catch {
        return null;
    }
}
