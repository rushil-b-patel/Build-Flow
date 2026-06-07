import { promises as fs } from "fs";
import path from "path";
import { listFilesRecursively } from "@backend-core/fs";
import { appendDeploymentLog } from "@backend-core/logs";
import {
    deleteObjectsByPrefix,
    getObjectBytes,
    listObjectKeys,
    putObjectFromFile,
} from "@backend-core/s3";

export async function downloadS3Folder(prefix: string, destinationDir: string) {
    const normalizedPrefix = prefix.endsWith("/") ? prefix : `${prefix}/`;
    const keys = await listObjectKeys(normalizedPrefix);

    await Promise.all(
        keys.map(async (key) => {
            const relativePath = key.slice(normalizedPrefix.length);
            if (!relativePath) {
                return;
            }

            const bytes = await getObjectBytes(key);
            if (!bytes) {
                return;
            }

            const outputPath = path.join(destinationDir, relativePath);
            await fs.mkdir(path.dirname(outputPath), { recursive: true });
            await fs.writeFile(outputPath, bytes);
        }),
    );
}

// Common static build output directories, in priority order.
// - dist:           Vite, Astro, Vue CLI, SvelteKit (static adapter on newer)
// - build:          Create React App, SvelteKit (some adapters)
// - out:            Next.js static export (`output: 'export'`)
// - .output/public: Nuxt 3 static generate
const OUTPUT_DIR_CANDIDATES = ["dist", "build", "out", ".output/public"];

async function hasIndexHtml(dirPath: string): Promise<boolean> {
    try {
        await fs.access(path.join(dirPath, "index.html"));
        return true;
    } catch {
        return false;
    }
}

async function dirExists(dirPath: string): Promise<boolean> {
    try {
        const stat = await fs.stat(dirPath);
        return stat.isDirectory();
    } catch {
        return false;
    }
}

/**
 * Resolves the directory that holds the built static site. Different frameworks
 * emit to different folders, so we probe a list of known candidates and require
 * a root `index.html` so we don't pick an assets-only folder (e.g. `public/`).
 */
async function resolveOutputDir(workspaceDir: string): Promise<string> {
    for (const candidate of OUTPUT_DIR_CANDIDATES) {
        const candidatePath = path.join(workspaceDir, candidate);
        if (await hasIndexHtml(candidatePath)) {
            return candidatePath;
        }
    }

    if (await dirExists(path.join(workspaceDir, ".next"))) {
        throw new Error(
            "Found a Next.js `.next/` build but no static export. This platform serves static files only — set `output: 'export'` in next.config so Next emits a static `out/` directory, then redeploy.",
        );
    }

    throw new Error(
        `Could not find a static build output containing index.html. Looked in: ${OUTPUT_DIR_CANDIDATES.join(
            ", ",
        )}.`,
    );
}

export async function copyFinalDist(id: string, workspaceDir: string) {
    const outputDir = await resolveOutputDir(workspaceDir);
    await appendDeploymentLog(
        id,
        `Detected build output: ${path.relative(workspaceDir, outputDir)}/`,
    );

    await deleteObjectsByPrefix(`dist/${id}/`);

    const files = await listFilesRecursively(outputDir);

    await Promise.all(
        files.map((filePath) => {
            const relativePath = path
                .relative(outputDir, filePath)
                .replace(/\\/g, "/");
            return putObjectFromFile(
                path.posix.join("dist", id, relativePath),
                filePath,
            );
        }),
    );
}
