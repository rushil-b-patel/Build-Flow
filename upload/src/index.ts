import "dotenv/config";
import cors from "cors";
import express from "express";
import { initDeploymentStore } from "@backend-core/deployments";
import { ensureRedisConnection } from "@backend-core/redis-connection";
import {
    authMeHandler,
    getGitHubAuthUrlHandler,
    githubCallbackHandler,
    logoutHandler,
} from "@upload/controllers/auth-controller";
import { listGitHubBranchesHandler } from "@upload/controllers/github-branches-controller";
import {
    createDeploymentHandler,
    deleteDeploymentHandler,
    getDeploymentLogStreamHandler,
    getDeploymentLogsHandler,
    getDeploymentsHandler,
    getDeploymentStatusHandler,
    redeployDeploymentHandler,
    isDeploymentExistHandler,
} from "@upload/controllers/deployments-controller";
import {
    authMiddleware,
    optionalAuthMiddleware,
} from "@upload/middleware/auth";

const app = express();

app.use(
    cors({
        origin: true,
        credentials: true,
    }),
);
app.use(express.json());

app.get("/auth/github", getGitHubAuthUrlHandler);
app.get("/auth/github/callback", githubCallbackHandler);
app.get("/auth/me", authMiddleware, authMeHandler);
app.post("/auth/logout", authMiddleware, logoutHandler);

app.get("/deployment/exist", authMiddleware, isDeploymentExistHandler);
app.get("/github/branches", optionalAuthMiddleware, listGitHubBranchesHandler);
app.post("/deploy", authMiddleware, createDeploymentHandler);
app.post("/redeploy/:id", authMiddleware, redeployDeploymentHandler);
app.delete("/deployments/:id", authMiddleware, deleteDeploymentHandler);
app.get("/logs", getDeploymentLogsHandler);
app.get("/logs/stream", getDeploymentLogStreamHandler);
app.get("/status", getDeploymentStatusHandler);
app.get("/deployments", authMiddleware, getDeploymentsHandler);

async function start() {
    await Promise.all([initDeploymentStore(), ensureRedisConnection()]);
    app.listen(3000, () => {
        console.log("upload server is live");
    });
}

start().catch((error) => {
    console.error("Failed to start upload server", error);
    process.exit(1);
});
