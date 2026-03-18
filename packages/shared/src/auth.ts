export interface GitHubUser {
    login: string;
    id: number;
    avatar_url: string;
    name: string | null;
    html_url: string;
}

export type AuthenticatedUser = GitHubUser;

export interface SessionPayload {
    user: AuthenticatedUser;
}
