export const deploymentStates = [
    "cloning",
    "uploading",
    "queued",
    "building",
    "deployed",
    "error",
] as const;

export type DeploymentState = (typeof deploymentStates)[number];

export interface DeploymentStatusPayload {
    state?: DeploymentState;
    error?: string | null;
}

export function isDeploymentState(value: unknown): value is DeploymentState {
    return (
        typeof value === "string" &&
        (deploymentStates as readonly string[]).includes(value)
    );
}
