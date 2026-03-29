import type { Request, Response } from "express";
import { createDeploymentFromRepository } from "@upload/services/deployment-service";
import {
    getDeploymentStatus,
    listDeployments,
} from "@backend-core/deployments";
import { getRedisClient } from "@backend-core/redis-connection";
import { getDeploymentLogs } from "@backend-core/logs";

export async function createDeploymentHandler(req: Request, res: Response) {
    const repoUrl = req.body.repoUrl as string | undefined;
    if (!repoUrl) {
        res.status(400).json({ message: "repoUrl is required" });
        return;
    }
    try {
        const deployment = await createDeploymentFromRepository(
            repoUrl,
            req.user,
        );
        res.json(deployment);
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
