import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { AUTH_STATE_CHANGED_EVENT } from "./auth";
import { API_BASE_URL, GITHUB_CLIENT_ID, type GitHubUser } from "./types";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
    user: GitHubUser | null;
    status: AuthStatus;
    refresh: () => Promise<void>;
    login: () => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<GitHubUser | null>(null);
    const [status, setStatus] = useState<AuthStatus>("loading");

    const refresh = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/auth/me`, {
                credentials: "include",
            });
            if (!res.ok) {
                setUser(null);
                setStatus("unauthenticated");
                return;
            }
            const data = (await res.json()) as { user: GitHubUser };
            setUser(data.user);
            setStatus("authenticated");
        } catch {
            setUser(null);
            setStatus("unauthenticated");
        }
    }, []);

    const login = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/auth/github`);
            const data = (await res.json()) as { url: string };
            window.location.href = data.url;
        } catch {
            window.location.href = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=read:user`;
        }
    }, []);

    const logout = useCallback(async () => {
        try {
            await fetch(`${API_BASE_URL}/auth/logout`, {
                method: "POST",
                credentials: "include",
            });
        } finally {
            setUser(null);
            setStatus("unauthenticated");
        }
    }, []);

    useEffect(() => {
        void refresh();
        const handleAuthChange = () => void refresh();
        window.addEventListener(AUTH_STATE_CHANGED_EVENT, handleAuthChange);
        return () =>
            window.removeEventListener(
                AUTH_STATE_CHANGED_EVENT,
                handleAuthChange,
            );
    }, [refresh]);

    const value = useMemo(
        () => ({ user, status, refresh, login, logout }),
        [user, status, refresh, login, logout],
    );

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return ctx;
}
