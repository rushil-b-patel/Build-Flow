export type DeploymentState =
  | 'idle'
  | 'cloning'
  | 'uploading'
  | 'queued'
  | 'building'
  | 'deployed'
  | 'error';

export type StatusPayload = {
  state?: string;
  error?: string;
};

export interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string | null;
}

export const API_BASE_URL = import.meta.env.VITE_BASE_URL;
export const DEPLOY_URL = import.meta.env.VITE_DEPLOY_URL;
export const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID;

export function normalizeState(value: unknown): DeploymentState {
  if (typeof value !== 'string') return 'idle';
  const next = value.toLowerCase();
  if (next === 'uploaded') return 'queued';
  if (
    next === 'cloning' ||
    next === 'uploading' ||
    next === 'queued' ||
    next === 'building' ||
    next === 'deployed' ||
    next === 'error'
  ) {
    return next;
  }
  return 'idle';
}

export function statusLabel(state: DeploymentState) {
  if (state === 'cloning') return 'Cloning repository...';
  if (state === 'uploading') return 'Uploading files...';
  if (state === 'queued') return 'Queued for build...';
  if (state === 'building') return 'Building project...';
  if (state === 'deployed') return 'Deployment complete';
  if (state === 'error') return 'Deployment failed';
  return 'Ready to deploy';
}
