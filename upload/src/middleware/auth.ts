import type { NextFunction, Request, Response } from "express";
import { getSession, SESSION_COOKIE_NAME } from "@backend-core/sessions";

function getCookieValue(req: Request, name: string): string | undefined {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) {
        return undefined;
    }
    for (const entry of cookieHeader.split(";")) {
        const [rawName, ...rawValue] = entry.trim().split("=");
        if (rawName === name) {
            return decodeURIComponent(rawValue.join("="));
        }
    }
    return undefined;
}

async function hydrateRequestUser(req: Request) {
    const sessionToken = getCookieValue(req, SESSION_COOKIE_NAME);
    if (!sessionToken) {
        return;
    }
    const session = await getSession(sessionToken);
    if (!session) {
        return;
    }
    req.sessionToken = sessionToken;
    req.user = session.user;
}

export async function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        await hydrateRequestUser(req);
        if (!req.user) {
            res.status(401).json({ message: "Authorization required" });
            return;
        }
        next();
    } catch (error) {
        next(error);
    }
}

export async function optionalAuthMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
) {
    try {
        await hydrateRequestUser(req);
        next();
    } catch (error) {
        next(error);
    }
}
