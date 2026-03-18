import type { Request, Response } from "express";
import { createDeploymentFromRepository } from "@upload/services/deployment-service";
import {
    getDeploymentStatus,
    listDeployments,
} from "@backend-core/deployments";
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
