import "dotenv/config";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { dequeueBuild } from "@backend-core/build-queue";
import {
    initDeploymentStore,
    updateDeploymentState,
} from "@backend-core/deployments";
import { ensureRedisConnection } from "@backend-core/redis-connection";
import { copyFinalDist, downloadS3Folder } from "./aws";
import { buildProject } from "./build";
import { appendDeploymentLog } from "@backend-core/logs";

function getWorkspaceRoot() {
    return (
        process.env.DEPLOY_WORK_ROOT ||
        path.join(os.tmpdir(), "build-flow-deploy")
    );
}

async function cleanupStaleWorkspaces() {
    await fs.rm(getWorkspaceRoot(), { recursive: true, force: true });
}

async function processDeployment(id: string) {
    const workspaceDir = path.join(getWorkspaceRoot(), id);

    await fs.rm(workspaceDir, { recursive: true, force: true });
    await fs.mkdir(workspaceDir, { recursive: true });

    try {
        await appendDeploymentLog(id, "Build picked up by worker");
        await downloadS3Folder(`output/${id}`, workspaceDir);
        await buildProject(id, workspaceDir);
        await copyFinalDist(id, workspaceDir);
        await updateDeploymentState(id, "deployed");
        await appendDeploymentLog(id, "Deployment completed successfully");
    } catch (error) {
        const message = (error as Error).message;
        await updateDeploymentState(id, "error", message);
        await appendDeploymentLog(id, `Deployment failed: ${message}`);
    } finally {
        await fs.rm(workspaceDir, { recursive: true, force: true });
    }
}

async function main() {
    await Promise.all([ensureRedisConnection(), initDeploymentStore()]);
    await cleanupStaleWorkspaces();
    console.log("Deploy worker ready — blocking on Redis list build-queue");

    while (true) {
        const id = await dequeueBuild();
        if (!id) {
            continue;
        }

        await processDeployment(id);
    }
}

main().catch((error) => {
    console.error("Deploy worker failed to start", error);
    process.exit(1);
});
