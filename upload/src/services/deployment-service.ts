import crypto from "crypto";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import {
    createDeployment,
    getDeploymentById,
    updateDeploymentState,
} from "@backend-core/deployments";
import { appendDeploymentLog, clearDeploymentLogs } from "@backend-core/logs";
import type { AuthenticatedUser } from "@packages/shared/auth";
import { uploadSourceDirectory } from "@upload/infrastructure/source-storage";
import { enqueueBuild } from "@backend-core/build-queue";
import {
    isValidSlug,
    normalizeSlug,
    releaseSlugReservation,
    tryReserveSlug,
} from "@backend-core/slugs";
import simpleGit from "simple-git";

function createDeploymentId() {
    return crypto.randomBytes(8).toString("hex");
}

function getUploadWorkspace(deploymentId: string) {
    const workRoot =
        process.env.UPLOAD_WORK_ROOT ||
        path.join(os.tmpdir(), "build-flow-upload");
    return path.join(workRoot, deploymentId, "source");
}

export class SlugTakenError extends Error {
    constructor() {
        super("That subdomain slug is already taken");
        this.name = "SlugTakenError";
    }
}

async function cloneRepository(
    repoUrl: string,
    workspaceDir: string,
    options: { branch?: string | null; commitSha?: string | null },
) {
    const args: string[] = [];
    const branch = options.branch?.trim();
    if (branch) {
        args.push("--branch", branch, "--single-branch");
    }
    await simpleGit().clone(repoUrl, workspaceDir, args);
    const commitSha = options.commitSha?.trim();
    if (commitSha) {
        await simpleGit(workspaceDir).checkout(commitSha);
    }
}

export interface CreateDeployOptions {
    branch?: string | null;
    commitSha?: string | null;
    slug?: string | null;
}

export async function createDeploymentFromRepository(
    repoUrl: string,
    user?: AuthenticatedUser,
    opts: CreateDeployOptions = {},
) {
    const deploymentId = createDeploymentId();
    const workspaceDir = getUploadWorkspace(deploymentId);
    const gitBranch = opts.branch?.trim() || null;
    const commitSha = opts.commitSha?.trim() || null;

    let slugNorm: string | null = null;
    if (opts.slug !== null && String(opts.slug).trim() !== "") {
        slugNorm = normalizeSlug(String(opts.slug));
        if (!isValidSlug(slugNorm)) {
            throw new Error(
                "Invalid slug: 2–63 characters, letters, numbers, and hyphens only (no underscores). Example: my-portfolio",
            );
        }
        const reserved = await tryReserveSlug(slugNorm, deploymentId);
        if (!reserved) {
            throw new SlugTakenError();
        }
    }

    await fs.rm(path.dirname(workspaceDir), { recursive: true, force: true });
    await fs.mkdir(path.dirname(workspaceDir), { recursive: true });

    let persistedInDb = false;
    try {
        await createDeployment(
            deploymentId,
            repoUrl,
            user?.login,
            gitBranch,
            commitSha,
        );
        persistedInDb = true;
        await appendDeploymentLog(deploymentId, "Cloning repository");
        await cloneRepository(repoUrl, workspaceDir, {
            branch: gitBranch,
            commitSha,
        });

        await updateDeploymentState(deploymentId, "uploading");
        await appendDeploymentLog(
            deploymentId,
            "Repository cloned. Uploading files to object storage",
        );
        await uploadSourceDirectory(deploymentId, workspaceDir);

        await updateDeploymentState(deploymentId, "queued");
        await appendDeploymentLog(
            deploymentId,
            "Upload complete. Added to build queue",
        );
        await enqueueBuild(deploymentId);

        return { id: deploymentId, slug: slugNorm };
    } catch (error) {
        if (slugNorm && !persistedInDb) {
            await releaseSlugReservation(slugNorm, deploymentId);
        }
        const message = (error as Error).message;
        if (persistedInDb) {
            await updateDeploymentState(deploymentId, "error", message);
            await appendDeploymentLog(deploymentId, `Error: ${message}`);
        }
        throw error;
    } finally {
        await fs.rm(path.dirname(workspaceDir), {
            recursive: true,
            force: true,
        });
    }
}

export async function redeployExistingDeployment(
    deploymentId: string,
    user: AuthenticatedUser,
) {
    const record = await getDeploymentById(deploymentId);
    if (!record) {
        throw new Error("NOT_FOUND");
    }
    if (record.github_user !== null && record.github_user !== user.login) {
        throw new Error("FORBIDDEN");
    }

    const workspaceDir = getUploadWorkspace(deploymentId);

    await fs.rm(path.dirname(workspaceDir), { recursive: true, force: true });
    await fs.mkdir(path.dirname(workspaceDir), { recursive: true });

    await clearDeploymentLogs(deploymentId);
    await updateDeploymentState(deploymentId, "cloning");
    await appendDeploymentLog(deploymentId, "Redeploy: cloning repository");

    try {
        await cloneRepository(record.repo_url, workspaceDir, {
            branch: record.git_branch,
            commitSha: record.commit_sha,
        });

        await updateDeploymentState(deploymentId, "uploading");
        await appendDeploymentLog(
            deploymentId,
            "Repository cloned. Uploading files to object storage",
        );
        await uploadSourceDirectory(deploymentId, workspaceDir);

        await updateDeploymentState(deploymentId, "queued");
        await appendDeploymentLog(
            deploymentId,
            "Upload complete. Added to build queue",
        );
        await enqueueBuild(deploymentId);

        return { id: deploymentId, slug: record.slug };
    } catch (error) {
        const message = (error as Error).message;
        await updateDeploymentState(deploymentId, "error", message);
        await appendDeploymentLog(deploymentId, `Error: ${message}`);
        throw error;
    } finally {
        await fs.rm(path.dirname(workspaceDir), {
            recursive: true,
            force: true,
        });
    }
}
