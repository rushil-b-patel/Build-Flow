import axios, { isAxiosError } from "axios";
import { useEffect, useRef, useState } from "react";
import {
    AlertTriangle,
    ArrowRight,
    CheckCircle2,
    Github,
    Loader2,
    TerminalSquare,
    UploadCloud,
} from "lucide-react";
import {
    API_BASE_URL,
    DEPLOY_URL,
    normalizeState,
    statusLabel,
    type DeploymentStatusPayload,
    type UiDeploymentState,
} from "./types";
import BranchAutocomplete from "./BranchAutocomplete";

const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
});

export default function HomePage() {
    const [repoUrl, setRepoUrl] = useState("");
    const [branch, setBranch] = useState("");
    const [commitSha, setCommitSha] = useState("");
    const [slug, setSlug] = useState("");
    const [resolvedSlug, setResolvedSlug] = useState<string | null>(null);
    const [uploadId, setUploadId] = useState<string | null>(null);
    const [status, setStatus] = useState<UiDeploymentState>("idle");
    const [logs, setLogs] = useState<string[]>([]);
    const [errorMsg, setErrorMsg] = useState("");
    const eventSourceRef = useRef<EventSource | null>(null);
    const logsBoxRef = useRef<HTMLDivElement | null>(null);

    const stopStreaming = () => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
    };

    const startLogStream = (id: string) => {
        stopStreaming();
        const es = new EventSource(`${API_BASE_URL}/logs/stream?id=${id}`);
        eventSourceRef.current = es;

        es.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.log) {
                    setLogs((prev) => [...prev, data.log]);
                }
                if (data.status) {
                    const currentStatus = normalizeState(data.status);
                    setStatus(currentStatus);
                    if (currentStatus === "deployed" || currentStatus === "error") {
                        stopStreaming();
                    }
                }
            } catch (err) {
                console.error("Failed to parse SSE message", err);
            }
        };

        es.onerror = (err) => {
            console.error("SSE error", err);
        };
    };

    const checkInitialStatus = async (id: string) => {
        try {
            const statusRes = await api.get<{ status: DeploymentStatusPayload }>("/status", {
                params: { id },
            });
            const statusPayload = statusRes.data.status;
            if (statusPayload) {
                setStatus(normalizeState(statusPayload.state));
                if (statusPayload.error) {
                    setErrorMsg(statusPayload.error);
                }
            }
        } catch (err) {
            console.error("Failed to fetch initial status", err);
        }
    };

    useEffect(() => {
        return () => stopStreaming();
    }, []);

    /** Postgres is the source of truth; poll while the deploy worker may be catching up (SSE alone can miss status if Redis was out of sync). */
    useEffect(() => {
        if (!uploadId) return;
        const busy =
            status === "cloning" ||
            status === "uploading" ||
            status === "queued" ||
            status === "building";
        if (!busy) return;

        const id = uploadId;
        const interval = setInterval(() => {
            void (async () => {
                try {
                    const statusRes = await api.get<{
                        status: DeploymentStatusPayload;
                    }>("/status", { params: { id } });
                    const payload = statusRes.data.status;
                    if (payload?.state) {
                        const next = normalizeState(payload.state);
                        setStatus(next);
                        if (payload.error) {
                            setErrorMsg(payload.error);
                        }
                        if (next === "deployed" || next === "error") {
                            stopStreaming();
                        }
                    }
                } catch {
                    /* ignore transient /status errors while polling */
                }
            })();
        }, 2000);

        return () => clearInterval(interval);
    }, [uploadId, status]);

    useEffect(() => {
        if (logsBoxRef.current) {
            logsBoxRef.current.scrollTop = logsBoxRef.current.scrollHeight;
        }
    }, [logs]);

    const handleDeploy = async () => {
        const trimmedRepo = repoUrl.trim();
        if (!trimmedRepo) return;

        setStatus("cloning");
        setLogs([]);
        setErrorMsg("");
        setResolvedSlug(null);
        stopStreaming();

        try {
            const body: Record<string, string> = { repoUrl: trimmedRepo };
            if (branch.trim()) body.branch = branch.trim();
            if (commitSha.trim()) body.commitSha = commitSha.trim();
            if (slug.trim()) body.slug = slug.trim();

            const response = await api.post<{ id: string; slug?: string | null }>(
                "/deploy",
                body,
            );
            const { id, slug: returnedSlug } = response.data;
            setUploadId(id);
            setResolvedSlug(returnedSlug ?? null);
            await checkInitialStatus(id);
            startLogStream(id);
        } catch (err) {
            setStatus("error");
            if (
                isAxiosError(err) &&
                err.response?.data &&
                typeof err.response.data === "object" &&
                "message" in err.response.data &&
                typeof (err.response.data as { message: unknown }).message ===
                    "string"
            ) {
                setErrorMsg((err.response.data as { message: string }).message);
            } else {
                setErrorMsg(
                    "Failed to upload repository. Please check the URL and try again.",
                );
            }
            console.error(err);
        }
    };

    const isWorking =
        status === "cloning" ||
        status === "uploading" ||
        status === "queued" ||
        status === "building";
    const siteHost = resolvedSlug || uploadId || "";
    const projectUrl = uploadId
        ? `http://${siteHost}.${DEPLOY_URL}/index.html`
        : "";

    return (
        <div className="w-full max-w-6xl mx-auto p-6 md:p-10 text-center">
            <h1 className="text-5xl font-bold mb-2">Build Flow</h1>
            <p className="text-slate-600 mb-8">
                Ship frontend projects from a GitHub URL.
            </p>

            <div className="w-full max-w-5xl mx-auto p-8 md:p-10 rounded-3xl shadow-xl border border-slate-200 bg-white/95 backdrop-blur">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative w-full">
                        <Github
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                            size={20}
                        />
                        <input
                            type="text"
                            placeholder="https://github.com/username/repo"
                            value={repoUrl}
                            onChange={(e) => setRepoUrl(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:border-sky-500 transition-colors disabled:opacity-50"
                            disabled={isWorking}
                        />
                    </div>

                    <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                        <BranchAutocomplete
                            repoUrl={repoUrl}
                            value={branch}
                            onChange={setBranch}
                            disabled={isWorking}
                        />
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">
                                Commit SHA (optional)
                            </label>
                            <input
                                type="text"
                                placeholder="abc123…"
                                value={commitSha}
                                onChange={(e) => setCommitSha(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-sky-500 disabled:opacity-50"
                                disabled={isWorking}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">
                                Site slug (optional)
                            </label>
                            <input
                                type="text"
                                placeholder="my-portfolio"
                                value={slug}
                                onChange={(e) => setSlug(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-sky-500 disabled:opacity-50"
                                disabled={isWorking}
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleDeploy}
                        disabled={!repoUrl || isWorking}
                        className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl bg-black hover:bg-white border hover:text-black active:translate-y-px transition-all disabled:cursor-not-allowed font-medium text-white shadow-sm"
                    >
                        {isWorking ? (
                            <>Deploying...</>
                        ) : (
                            <>
                                <UploadCloud size={20} /> Deploy Now
                            </>
                        )}
                    </button>
                </div>

                {status !== "idle" && (
                    <div className="mt-8 text-left border-t border-slate-200 pt-6">
                        <div className="flex items-center justify-center gap-2 font-medium">
                            <span>{statusLabel(status)}</span>
                            {isWorking && (
                                <Loader2 className="animate-spin text-sky-600" />
                            )}
                            {status === "deployed" && (
                                <CheckCircle2 className="text-emerald-600" />
                            )}
                            {status === "error" && (
                                <AlertTriangle className="text-rose-600" />
                            )}
                        </div>

                        <div className="mt-5 rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950 shadow-2xl shadow-slate-900/50 ring-1 ring-slate-800/50">
                            <div className="terminal-header px-4 py-2.5 bg-slate-900/90 border-b border-slate-700/80 flex items-center gap-3">
                                <div className="flex gap-1.5">
                                    <span className="w-3 h-3 rounded-full bg-red-500/90 shadow-sm" />
                                    <span className="w-3 h-3 rounded-full bg-amber-400/90 shadow-sm" />
                                    <span className="w-3 h-3 rounded-full bg-emerald-500/90 shadow-sm" />
                                </div>
                                <div className="flex items-center gap-2 text-slate-200">
                                    <TerminalSquare
                                        size={14}
                                        className="text-slate-500"
                                    />
                                    <span className="font-medium text-xs tracking-wider text-slate-400">
                                        Build Logs
                                    </span>
                                </div>
                                <span
                                    className={`ml-auto text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${status === "deployed" ? "bg-emerald-500/20 text-emerald-400" : status === "error" ? "bg-red-500/20 text-red-400" : isWorking ? "bg-amber-500/20 text-amber-400 animate-pulse" : "bg-slate-600/30 text-slate-500"}`}
                                >
                                    {status}
                                </span>
                            </div>

                            <div
                                ref={logsBoxRef}
                                className="terminal-content max-h-80 overflow-y-auto px-5 py-4 font-mono text-sm space-y-1 text-slate-300"
                            >
                                {logs.length === 0 && isWorking && (
                                    <p className="text-slate-500 flex items-center gap-3">
                                        <span className="text-emerald-500/80">
                                            »
                                        </span>
                                        <span>Waiting for build...</span>
                                        <span className="terminal-cursor inline-block w-2 h-4 bg-emerald-400/80 ml-0.5" />
                                    </p>
                                )}
                                {logs.length === 0 && status === "error" && (
                                    <p className="text-rose-400/90 flex items-center gap-3">
                                        <span className="text-rose-500/80">
                                            »
                                        </span>
                                        <span>
                                            Stopped — no build logs were received.
                                            See the message below.
                                        </span>
                                    </p>
                                )}
                                {logs.length === 0 &&
                                    status === "deployed" && (
                                        <p className="text-slate-500 flex items-center gap-3">
                                            <span className="text-emerald-500/80">
                                                »
                                            </span>
                                            <span>
                                                Deployment finished (no log lines
                                                in this view).
                                            </span>
                                        </p>
                                    )}
                                {logs.map((line, idx) => (
                                    <p
                                        key={`${idx}-${line.slice(0, 16)}`}
                                        className="whitespace-pre-wrap wrap-break-words leading-relaxed flex"
                                    >
                                        <span className="text-slate-600 select-none mr-3 shrink-0">
                                            {String(idx + 1).padStart(3, "0")}
                                        </span>
                                        <span className="text-slate-300">
                                            {line}
                                        </span>
                                    </p>
                                ))}
                            </div>
                        </div>

                        {status === "error" && (
                            <p className="text-rose-600 text-sm mt-4 wrap-break-words">
                                {errorMsg ||
                                    "Deployment failed. Check logs for details."}
                            </p>
                        )}

                        {status === "deployed" && uploadId && (
                            <div className="mt-6 p-4 bg-sky-50 rounded-xl border border-sky-200 text-sky-800 break-all">
                                <p className="m-0 text-sm mb-2 text-sky-700">
                                    Project URL:
                                </p>
                                <div className="flex items-center justify-between gap-4">
                                    <a
                                        href={projectUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-bold hover:underline text-sky-700"
                                    >
                                        {projectUrl}
                                    </a>
                                    <a
                                        href={projectUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sky-700 hover:text-sky-900"
                                    >
                                        <ArrowRight size={18} />
                                    </a>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
