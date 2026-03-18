import crypto from "crypto";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import {
    createDeployment,
    getDeploymentStatus,
    listDeployments,
    updateDeploymentState,
} from "@backend-core/deployments";
import { appendDeploymentLog, getDeploymentLogs } from "@backend-core/logs";
import type { AuthenticatedUser } from "@packages/shared/auth";
import { uploadSourceDirectory } from "@upload/infrastructure/source-storage";
import { enqueueBuild } from "@backend-core/build-queue";
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

export async function createDeploymentFromRepository(
    repoUrl: string,
    user?: AuthenticatedUser,
) {
    const deploymentId = createDeploymentId();
    const workspaceDir = getUploadWorkspace(deploymentId);

    await fs.rm(path.dirname(workspaceDir), { recursive: true, force: true });
    await fs.mkdir(path.dirname(workspaceDir), { recursive: true });

    try {
        await createDeployment(deploymentId, repoUrl, user?.login);
        await appendDeploymentLog(deploymentId, "Cloning repository");
        await simpleGit().clone(repoUrl, workspaceDir);

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

        return { id: deploymentId };
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
