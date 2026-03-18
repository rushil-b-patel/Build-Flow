declare global {
    namespace Express {
        interface Request {
            user?: import("@packages/shared/auth").AuthenticatedUser;
            sessionToken?: string;
        }
    }
}

export {};
