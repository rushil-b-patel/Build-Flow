import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Github, History, LogOut, Rocket } from "lucide-react";
import { API_BASE_URL, GITHUB_CLIENT_ID } from "./types";
import type { GitHubUser } from "./types";

interface NavbarProps {
    user: GitHubUser | null;
    onLogout: () => void | Promise<void>;
}

export default function Navbar({ user, onLogout }: NavbarProps) {
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);

    const handleLogin = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/auth/github`);
            const data = await res.json();
            window.location.href = data.url;
        } catch {
            // If the server returns a well-formed URL in the JSON it still works;
            // fallback to a direct URL construction
            window.location.href = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=read:user`;
        }
    };

    return (
        <nav className="w-full max-w-6xl mx-auto px-6 md:px-10 py-4 flex items-center justify-between gap-4">
            <Link
                to="/"
                className="text-xl font-bold tracking-tight text-slate-900 hover:text-slate-700 transition-colors flex items-center gap-2"
            >
                <Rocket size={22} className="text-sky-600" />
                Build Flow
            </Link>

            <div className="hidden sm:flex items-center gap-2">
                <Link
                    to="/"
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        location.pathname === "/"
                            ? "bg-slate-900 text-white shadow-sm"
                            : "text-slate-600 hover:bg-slate-100"
                    }`}
                >
                    Deploy
                </Link>
                <Link
                    to="/dashboard"
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 ${
                        location.pathname === "/dashboard"
                            ? "bg-slate-900 text-white shadow-sm"
                            : "text-slate-600 hover:bg-slate-100"
                    }`}
                >
                    <History size={14} /> History
                </Link>

                {user ? (
                    <div className="flex items-center gap-3 ml-3 pl-3 border-l border-slate-200">
                        <img
                            src={user.avatar_url}
                            alt={user.login}
                            className="w-8 h-8 rounded-full ring-2 ring-slate-200"
                        />
                        <span className="text-sm font-medium text-slate-700 hidden md:block">
                            {user.name || user.login}
                        </span>
                        <button
                            onClick={onLogout}
                            className="text-slate-400 hover:text-slate-600 transition-colors"
                            title="Sign out"
                        >
                            <LogOut size={16} />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={handleLogin}
                        className="ml-3 pl-3 border-l border-slate-200 flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                    >
                        <Github size={16} /> Sign in
                    </button>
                )}
            </div>

            <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="sm:hidden flex flex-col gap-1 p-2"
                aria-label="Toggle menu"
            >
                <span
                    className={`block w-5 h-0.5 bg-slate-600 transition-all ${menuOpen ? "rotate-45 translate-y-1.5" : ""}`}
                />
                <span
                    className={`block w-5 h-0.5 bg-slate-600 transition-all ${menuOpen ? "opacity-0" : ""}`}
                />
                <span
                    className={`block w-5 h-0.5 bg-slate-600 transition-all ${menuOpen ? "-rotate-45 -translate-y-1.5" : ""}`}
                />
            </button>

            {menuOpen && (
                <div className="sm:hidden fixed inset-0 top-[60px] bg-white/95 backdrop-blur z-50 p-6 space-y-3 animate-fade-in">
                    <Link
                        to="/"
                        onClick={() => setMenuOpen(false)}
                        className={`block w-full px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                            location.pathname === "/"
                                ? "bg-slate-900 text-white"
                                : "text-slate-600 hover:bg-slate-100"
                        }`}
                    >
                        Deploy
                    </Link>
                    <Link
                        to="/dashboard"
                        onClick={() => setMenuOpen(false)}
                        className={`w-full px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                            location.pathname === "/dashboard"
                                ? "bg-slate-900 text-white"
                                : "text-slate-600 hover:bg-slate-100"
                        }`}
                    >
                        <History size={14} /> History
                    </Link>
                    <div className="border-t border-slate-200 pt-3">
                        {user ? (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <img
                                        src={user.avatar_url}
                                        alt={user.login}
                                        className="w-8 h-8 rounded-full ring-2 ring-slate-200"
                                    />
                                    <span className="text-sm font-medium text-slate-700">
                                        {user.name || user.login}
                                    </span>
                                </div>
                                <button
                                    onClick={() => {
                                        onLogout();
                                        setMenuOpen(false);
                                    }}
                                    className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
                                >
                                    <LogOut size={14} /> Sign out
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => {
                                    handleLogin();
                                    setMenuOpen(false);
                                }}
                                className="flex items-center gap-2 text-sm font-medium text-slate-600"
                            >
                                <Github size={16} /> Sign in with GitHub
                            </button>
                        )}
                    </div>
                </div>
            )}
        </nav>
    );
}
