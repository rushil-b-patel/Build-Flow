import { createHash } from "crypto";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import {
    objectExists,
    getObjectBytes,
    putObjectFromBuffer,
} from "@backend-core/s3";
import { appendDeploymentLog } from "@backend-core/logs";

const CACHE_PREFIX = "cache/nm-";

async function hashLockFiles(workspaceDir: string): Promise<string | null> {
    const hash = createHash("sha256");
    let found = false;

    for (const name of ["package-lock.json", "package.json"]) {
        const filePath = path.join(workspaceDir, name);
        try {
            const content = await fs.readFile(filePath);
            hash.update(name);
            hash.update(content);
            found = true;
        } catch {
            // file doesn't exist, skip
        }
    }

    return found ? hash.digest("hex") : null;
}

function cacheKey(hash: string): string {
    return `${CACHE_PREFIX}${hash}.tar.gz`;
}

function runTar(args: string[], cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn("tar", args, { cwd, stdio: "pipe" });
        child.on("error", reject);
        child.on("close", (code) => {
            if (code !== 0) {
                reject(new Error(`tar exited with code ${code}`));
                return;
            }
            resolve();
        });
    });
}

export async function restoreCache(
    id: string,
    workspaceDir: string,
): Promise<string | null> {
    const hash = await hashLockFiles(workspaceDir);
    if (!hash) return null;

    const key = cacheKey(hash);
    const exists = await objectExists(key);
    if (!exists) {
        await appendDeploymentLog(id, `Cache miss (${hash.slice(0, 12)})`);
        return hash;
    }

    await appendDeploymentLog(id, `Cache hit (${hash.slice(0, 12)}), restoring node_modules`);

    const tarball = await getObjectBytes(key);
    if (!tarball) return hash;

    const tarPath = path.join(workspaceDir, ".nm-cache.tar.gz");
    await fs.writeFile(tarPath, tarball);
    await runTar(["xzf", ".nm-cache.tar.gz"], workspaceDir);
    await fs.rm(tarPath, { force: true });

    await appendDeploymentLog(id, "Cache restored");
    return hash;
}

export async function saveCache(
    id: string,
    workspaceDir: string,
    hash: string,
): Promise<void> {
    const nodeModules = path.join(workspaceDir, "node_modules");
    try {
        await fs.access(nodeModules);
    } catch {
        return;
    }

    const key = cacheKey(hash);
    const exists = await objectExists(key);
    if (exists) return;

    await appendDeploymentLog(id, "Saving node_modules to cache");

    const tarPath = path.join(workspaceDir, ".nm-cache.tar.gz");
    await runTar(["czf", ".nm-cache.tar.gz", "node_modules"], workspaceDir);

    const tarball = await fs.readFile(tarPath);
    await putObjectFromBuffer(key, tarball);
    await fs.rm(tarPath, { force: true });

    await appendDeploymentLog(id, `Cache saved (${hash.slice(0, 12)})`);
}
