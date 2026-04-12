import type { Request, Response } from "express";
import {
    createDeploymentFromRepository,
    redeployExistingDeployment,
    SlugTakenError,
} from "@upload/services/deployment-service";
import {
    deleteDeployment,
    getDeploymentById,
    getDeploymentStatus,
    listDeployments,
} from "@backend-core/deployments";
import { getRedisClient } from "@backend-core/redis-connection";
import { getDeploymentLogs, clearDeploymentLogs } from "@backend-core/logs";
import { deleteObjectsByPrefix } from "@backend-core/s3";
import {
    getSlugForDeploymentId,
    releaseSlugReservation,
} from "@backend-core/slugs";

export async function createDeploymentHandler(req: Request, res: Response) {
    const rawRepo = req.body?.repoUrl;
    const repoUrl = typeof rawRepo === "string" ? rawRepo.trim() : "";
    if (!repoUrl) {
        res.status(400).json({
            message:
                'repoUrl is required (send a JSON body with { "repoUrl": "https://github.com/owner/repo" })',
        });
        return;
    }
    const branch =
        typeof req.body.branch === "string" ? req.body.branch : undefined;
    const commitSha =
        typeof req.body.commitSha === "string" ? req.body.commitSha : undefined;
    const slug = typeof req.body.slug === "string" ? req.body.slug : undefined;
    try {
        const deployment = await createDeploymentFromRepository(
            repoUrl,
            req.user,
            { branch, commitSha, slug },
        );
        res.json(deployment);
    } catch (error) {
        if (error instanceof SlugTakenError) {
            res.status(409).json({ message: error.message });
            return;
        }
        const msg = (error as Error).message;
        if (msg.startsWith("Invalid slug")) {
            res.status(400).json({ message: msg });
            return;
        }
        res.status(500).json({ message: msg });
    }
}

export async function redeployDeploymentHandler(req: Request, res: Response) {
    const id = req.params.id;
    if (!id) {
        res.status(400).json({ message: "id is required" });
        return;
    }
    if (!req.user) {
        res.status(401).json({ message: "Sign in to redeploy" });
        return;
    }
    try {
        const deployment = await redeployExistingDeployment(id, req.user);
        res.json(deployment);
    } catch (error) {
        const msg = (error as Error).message;
        if (msg === "NOT_FOUND") {
            res.status(404).json({ message: "Deployment not found" });
            return;
        }
        if (msg === "FORBIDDEN") {
            res.status(403).json({
                message: "Not allowed to redeploy this project",
            });
            return;
        }
        res.status(500).json({ message: msg });
    }
}

export async function deleteDeploymentHandler(req: Request, res: Response) {
    const id = req.params.id;
    if (!id) {
        res.status(400).json({ message: "id is required" });
        return;
    }
    if (!req.user) {
        res.status(401).json({ message: "Sign in to delete a deployment" });
        return;
    }

    try {
        const record = await getDeploymentById(id);
        if (!record) {
            res.status(404).json({ message: "Deployment not found" });
            return;
        }
        if (
            record.github_user !== null &&
            record.github_user !== req.user.login
        ) {
            res.status(403).json({
                message: "Not allowed to delete this deployment",
            });
            return;
        }

        // Release slug reservation
        const slug = await getSlugForDeploymentId(id);
        if (slug) {
            await releaseSlugReservation(slug, id);
        }

        // Delete S3 objects (source upload + built dist)
        await Promise.all([
            deleteObjectsByPrefix(`output/${id}/`),
            deleteObjectsByPrefix(`dist/${id}/`),
        ]);

        // Clear Redis keys (logs + status)
        await clearDeploymentLogs(id);
        const redis = getRedisClient();
        await redis.del(`status:${id}`);

        // Delete Postgres row
        await deleteDeployment(id);

        res.json({ message: "Deployment deleted" });
    } catch (error) {
        res.status(500).json({ message: (error as Error).message });
    }
}

export async function getDeploymentLogStreamHandler(
    req: Request,
    res: Response,
) {
    const id = req.query.id as string | undefined;
    if (!id) {
        res.status(400).json({ message: "id is required" });
        return;
    }

    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
    });
    res.flushHeaders();

    const redis = getRedisClient();
    let cursor = 0;
    let done = false;
    let lastState: string | null = null;

    const sendLogs = async () => {
        if (done) return;
        try {
            const logs = await redis.lRange(`logs:${id}`, cursor, -1);
            if (logs.length > 0) {
                for (const line of logs) {
                    res.write(`data: ${JSON.stringify({ log: line })}\n\n`);
                }
                cursor += logs.length;
            }

            const state = await redis.hGet(`status:${id}`, "state");
            if (state && state !== lastState) {
                lastState = state;
                res.write(`data: ${JSON.stringify({ status: state })}\n\n`);
            }
            if (state === "deployed" || state === "error") {
                done = true;
                res.end();
            }
        } catch (error) {
            console.error("SSE stream error:", error);
            done = true;
            res.end();
        }
    };

    req.on("close", () => {
        done = true;
    });

    void sendLogs();
    const interval = setInterval(() => {
        if (done) {
            clearInterval(interval);
        } else {
            void sendLogs();
        }
    }, 500);
}

export async function getDeploymentLogsHandler(req: Request, res: Response) {
    const id = req.query.id as string | undefined;
    if (!id) {
        res.status(400).json({ message: "id is required" });
        return;
    }
    try {
        const logs = await getDeploymentLogs(id);
        res.json({ logs });
    } catch (error) {
        res.status(500).json({ message: (error as Error).message });
    }
}

export async function getDeploymentStatusHandler(req: Request, res: Response) {
    const id = req.query.id as string | undefined;
    if (!id) {
        res.status(400).json({ message: "id is required" });
        return;
    }
    try {
        const status = await getDeploymentStatus(id);
        res.json({ status });
    } catch (error) {
        res.status(500).json({ message: (error as Error).message });
    }
}

export async function getDeploymentsHandler(req: Request, res: Response) {
    try {
        const deployments = await listDeployments(req.user?.login);
        res.json({ deployments });
    } catch (error) {
        res.status(500).json({ message: (error as Error).message });
    }
}
