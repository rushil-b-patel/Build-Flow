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

const blpopTimeoutSec = Math.max(
    1,
    parseInt(process.env.WORKER_BRPOP_TIMEOUT_SEC || "5", 10) || 5,
);
const concurrency = Math.max(
    1,
    parseInt(process.env.WORKER_CONCURRENCY || "1", 10) || 1,
);

let shuttingDown = false;

function installShutdownSignals() {
    const onStop = () => {
        if (!shuttingDown) {
            console.log("Shutdown signal received; draining workers…");
        }
        shuttingDown = true;
    };
    process.on("SIGINT", onStop);
    process.on("SIGTERM", onStop);
}

async function workerLoop(workerId: number) {
    console.log(`Deploy worker ${workerId} started`);
    while (!shuttingDown) {
        const id = await dequeueBuild(blpopTimeoutSec);
        if (id) {
            await processDeployment(id);
            continue;
        }
    }
    console.log(`Deploy worker ${workerId} stopped`);
}

async function main() {
    installShutdownSignals();
    await Promise.all([ensureRedisConnection(), initDeploymentStore()]);
    await cleanupStaleWorkspaces();
    console.log(
        `Deploy worker ready — ${concurrency} worker(s), BRPOP timeout ${blpopTimeoutSec}s`,
    );

    const workers = Array.from({ length: concurrency }, (_, i) =>
        workerLoop(i),
    );
    await Promise.all(workers);
    console.log("Deploy worker process exiting");
}

main().catch((error) => {
    console.error("Deploy worker failed to start", error);
    process.exit(1);
});
