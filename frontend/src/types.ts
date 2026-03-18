import {
    isDeploymentState,
    type DeploymentState,
    type DeploymentStatusPayload,
} from "@shared/deployment";
import type { GitHubUser } from "@shared/auth";

export type { DeploymentState, DeploymentStatusPayload, GitHubUser };

export type UiDeploymentState = DeploymentState | "idle";

export const API_BASE_URL = import.meta.env.VITE_BASE_URL;
export const DEPLOY_URL = import.meta.env.VITE_DEPLOY_URL;
export const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID;

export function normalizeState(value: unknown): UiDeploymentState {
    return isDeploymentState(value) ? value : "idle";
}

export function statusLabel(state: UiDeploymentState) {
    if (state === "cloning") return "Cloning repository...";
    if (state === "uploading") return "Uploading files...";
    if (state === "queued") return "Queued for build...";
    if (state === "building") return "Building project...";
    if (state === "deployed") return "Deployment complete";
    if (state === "error") return "Deployment failed";
    return "Ready to deploy";
}
