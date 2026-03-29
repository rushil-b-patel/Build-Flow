import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    AlertTriangle,
    ArrowUpRight,
    CheckCircle2,
    Clock,
    GitBranch,
    Loader2,
    RefreshCw,
    Rocket,
    XCircle,
} from "lucide-react";
import { notifyAuthStateChanged } from "./auth";
import { API_BASE_URL, DEPLOY_URL, type DeploymentState } from "./types";

interface Deployment {
    id: string;
    repo_url: string;
    status: DeploymentState;
    error: string | null;
    created_at: string;
    updated_at: string;
    github_user: string | null;
    git_branch: string | null;
    commit_sha: string | null;
    slug: string | null;
}

function relativeTime(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = now - then;
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
}

function statusConfig(status: DeploymentState) {
    switch (status) {
        case "deployed":
            return {
                icon: CheckCircle2,
                label: "Deployed",
                color: "text-emerald-500",
                bg: "bg-emerald-500/10",
                border: "border-emerald-500/20",
            };
        case "error":
            return {
                icon: XCircle,
                label: "Failed",
                color: "text-rose-500",
                bg: "bg-rose-500/10",
                border: "border-rose-500/20",
            };
        case "building":
            return {
                icon: Loader2,
                label: "Building",
                color: "text-amber-500",
                bg: "bg-amber-500/10",
                border: "border-amber-500/20",
                spin: true,
            };
        case "queued":
            return {
                icon: Clock,
                label: "Queued",
                color: "text-sky-500",
                bg: "bg-sky-500/10",
                border: "border-sky-500/20",
            };
        case "cloning":
            return {
                icon: GitBranch,
                label: "Cloning",
                color: "text-violet-500",
                bg: "bg-violet-500/10",
                border: "border-violet-500/20",
                spin: true,
            };
        case "uploading":
            return {
                icon: Loader2,
                label: "Uploading",
                color: "text-blue-500",
                bg: "bg-blue-500/10",
                border: "border-blue-500/20",
                spin: true,
            };
    }
}

function siteHost(d: Deployment): string {
    return d.slug || d.id;
}

function repoName(url: string): string {
    try {
        const u = new URL(url);
        const parts = u.pathname
            .replace(/^\//, "")
            .replace(/\.git$/, "")
            .split("/");
        return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : parts[0] || url;
    } catch {
        return url;
    }
}

export default function Dashboard() {
    const [deployments, setDeployments] = useState<Deployment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [redeployingId, setRedeployingId] = useState<string | null>(null);
    const [redeployError, setRedeployError] = useState("");

    useEffect(() => {
        void fetchDeployments();
    }, []);

    const fetchDeployments = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/deployments`, {
                credentials: "include",
            });

            if (!res.ok) {
                if (res.status === 401) {
                    notifyAuthStateChanged();
                    setError("Please sign in to view your deployments");
                } else {
                    throw new Error("Failed to fetch deployments");
                }
                setLoading(false);
                return;
            }

            const data = (await res.json()) as { deployments: Deployment[] };
            setDeployments(data.deployments);
        } catch (err) {
            setError((err as Error).message);
        }

        setLoading(false);
    };

    const handleRedeploy = async (deploymentId: string) => {
        setRedeployError("");
        setRedeployingId(deploymentId);
        try {
            const res = await fetch(
                `${API_BASE_URL}/redeploy/${deploymentId}`,
                {
                    method: "POST",
                    credentials: "include",
                },
            );
            if (res.status === 401) {
                notifyAuthStateChanged();
                setRedeployError("Please sign in to redeploy");
                return;
            }
            if (!res.ok) {
                const data = (await res.json().catch(() => ({}))) as {
                    message?: string;
                };
                throw new Error(data.message || "Redeploy failed");
            }
            await fetchDeployments();
        } catch (err) {
            setRedeployError((err as Error).message);
        } finally {
            setRedeployingId(null);
        }
    };

    if (loading) {
        return (
            <div className="w-full max-w-6xl mx-auto p-6 md:p-10">
                <h2 className="text-3xl font-bold mb-8">Deployment History</h2>
                <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                        <div
                            key={i}
                            className="rounded-2xl border border-slate-200 bg-white/80 p-5 animate-pulse"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-20 h-6 bg-slate-200 rounded-lg" />
                                <div className="w-48 h-5 bg-slate-200 rounded-lg" />
                                <div className="ml-auto w-24 h-5 bg-slate-200 rounded-lg" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full max-w-6xl mx-auto p-6 md:p-10">
                <h2 className="text-3xl font-bold mb-8">Deployment History</h2>
                <div className="rounded-2xl border border-slate-200 bg-white/95 backdrop-blur shadow-xl p-8 text-center">
                    <AlertTriangle
                        className="text-amber-500 mx-auto mb-3"
                        size={28}
                    />
                    <p className="text-slate-600 mb-4">{error}</p>
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black text-white hover:bg-white hover:text-black border transition-all font-medium text-sm"
                    >
                        Back to Home
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-6xl mx-auto p-6 md:p-10">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
                <h2 className="text-3xl font-bold">Deployment History</h2>
                <Link
                    to="/"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black text-white hover:bg-white hover:text-black border transition-all font-medium text-sm"
                >
                    <Rocket size={16} /> New Deploy
                </Link>
            </div>
            {redeployError && (
                <p className="text-sm text-rose-600 mb-6">{redeployError}</p>
            )}

            {deployments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-12 text-center">
                    <Rocket className="mx-auto text-slate-300 mb-4" size={40} />
                    <p className="text-slate-500 font-medium mb-1">
                        No deployments yet
                    </p>
                    <p className="text-slate-400 text-sm">
                        Deploy your first project to see it here.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {deployments.map((deployment) => {
                        const cfg = statusConfig(deployment.status);
                        const Icon = cfg.icon;
                        const host = siteHost(deployment);
                        const projectUrl = `http://${host}.${DEPLOY_URL}/index.html`;
                        const isRedeploying = redeployingId === deployment.id;

                        return (
                            <div
                                key={deployment.id}
                                className="group rounded-2xl border border-slate-200 bg-white/95 backdrop-blur shadow-sm hover:shadow-md transition-all p-4 sm:p-5"
                            >
                                <div className="flex flex-col gap-3 sm:hidden">
                                    <div className="flex items-center justify-between">
                                        <span
                                            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg ${cfg.bg} ${cfg.color} ${cfg.border} border`}
                                        >
                                            <Icon
                                                size={13}
                                                className={
                                                    cfg.spin
                                                        ? "animate-spin"
                                                        : ""
                                                }
                                            />
                                            {cfg.label}
                                        </span>
                                        <span className="text-xs text-slate-400">
                                            {relativeTime(
                                                deployment.created_at,
                                            )}
                                        </span>
                                    </div>
                                    <a
                                        href={deployment.repo_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm font-medium text-slate-800 hover:text-sky-600 transition-colors truncate"
                                    >
                                        {repoName(deployment.repo_url)}
                                    </a>
                                    {deployment.status === "deployed" && (
                                        <a
                                            href={projectUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700 font-medium truncate"
                                        >
                                            {projectUrl}{" "}
                                            <ArrowUpRight size={12} />
                                        </a>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            void handleRedeploy(deployment.id)
                                        }
                                        disabled={
                                            isRedeploying ||
                                            deployment.status === "cloning" ||
                                            deployment.status === "uploading" ||
                                            deployment.status === "queued" ||
                                            deployment.status === "building"
                                        }
                                        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        {isRedeploying ? (
                                            <Loader2
                                                size={14}
                                                className="animate-spin"
                                            />
                                        ) : (
                                            <RefreshCw size={14} />
                                        )}
                                        Redeploy
                                    </button>
                                    {deployment.error && (
                                        <p className="text-xs text-rose-500 truncate">
                                            {deployment.error}
                                        </p>
                                    )}
                                </div>

                                <div className="hidden sm:flex items-center gap-4">
                                    <span
                                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg ${cfg.bg} ${cfg.color} ${cfg.border} border shrink-0 min-w-[90px] justify-center`}
                                    >
                                        <Icon
                                            size={13}
                                            className={
                                                cfg.spin ? "animate-spin" : ""
                                            }
                                        />
                                        {cfg.label}
                                    </span>
                                    <a
                                        href={deployment.repo_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm font-medium text-slate-800 hover:text-sky-600 transition-colors truncate min-w-0"
                                    >
                                        {repoName(deployment.repo_url)}
                                    </a>
                                    <div className="ml-auto flex items-center gap-4 shrink-0">
                                        {deployment.status === "deployed" && (
                                            <a
                                                href={projectUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                Visit <ArrowUpRight size={12} />
                                            </a>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() =>
                                                void handleRedeploy(
                                                    deployment.id,
                                                )
                                            }
                                            disabled={
                                                isRedeploying ||
                                                deployment.status ===
                                                    "cloning" ||
                                                deployment.status ===
                                                    "uploading" ||
                                                deployment.status ===
                                                    "queued" ||
                                                deployment.status === "building"
                                            }
                                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            {isRedeploying ? (
                                                <Loader2
                                                    size={14}
                                                    className="animate-spin"
                                                />
                                            ) : (
                                                <RefreshCw size={14} />
                                            )}
                                            Redeploy
                                        </button>
                                        {deployment.error && (
                                            <span
                                                className="text-xs text-rose-500 truncate max-w-[160px]"
                                                title={deployment.error}
                                            >
                                                {deployment.error}
                                            </span>
                                        )}
                                        <span className="text-xs text-slate-400 min-w-[60px] text-right">
                                            {relativeTime(
                                                deployment.created_at,
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
