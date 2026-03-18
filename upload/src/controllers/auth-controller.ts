import type { Request, Response } from "express";
import { deleteSession, SESSION_COOKIE_NAME } from "@backend-core/sessions";
import {
    completeGitHubSignIn,
    getGitHubAuthUrl,
} from "@upload/services/auth-service";

function getCookieOptions() {
    return {
        httpOnly: true,
        sameSite: "lax" as const,
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 1000 * 60 * 60 * 24 * 7,
    };
}

export function getGitHubAuthUrlHandler(_req: Request, res: Response) {
    res.json({ url: getGitHubAuthUrl() });
}

export async function githubCallbackHandler(req: Request, res: Response) {
    const code = req.query.code as string | undefined;
    if (!code) {
        res.status(400).json({ message: "code is required" });
        return;
    }

    try {
        const { sessionToken, user } = await completeGitHubSignIn(code);
        res.cookie(SESSION_COOKIE_NAME, sessionToken, getCookieOptions());
        res.json({ user });
    } catch (error) {
        res.status(401).json({ message: (error as Error).message });
    }
}

export function authMeHandler(req: Request, res: Response) {
    res.json({ user: req.user });
}

export async function logoutHandler(req: Request, res: Response) {
    try {
        if (req.sessionToken) {
            await deleteSession(req.sessionToken);
        }
        res.clearCookie(SESSION_COOKIE_NAME, getCookieOptions());
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: (error as Error).message });
    }
}
