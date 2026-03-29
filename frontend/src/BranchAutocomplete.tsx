import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent,
} from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { parseGitHubRepoUrl } from "@shared/github-repo";
import { API_BASE_URL } from "./types";

function useDebounced<T>(value: T, delayMs: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const id = window.setTimeout(() => setDebounced(value), delayMs);
        return () => window.clearTimeout(id);
    }, [value, delayMs]);
    return debounced;
}

/** Filter by query, then sort: exact (case-insensitive), prefix match, substring match, then name. */
function sortBranchesForQuery(branches: string[], query: string): string[] {
    const q = query.trim().toLowerCase();
    const filtered = q
        ? branches.filter((b) => b.toLowerCase().includes(q))
        : [...branches];

    const rank = (name: string): number => {
        const n = name.toLowerCase();
        if (!q) return 0;
        if (n === q) return 0;
        if (n.startsWith(q)) return 1;
        if (n.includes(q)) return 2;
        return 3;
    };

    filtered.sort((a, b) => {
        const ra = rank(a);
        const rb = rank(b);
        if (ra !== rb) return ra - rb;
        return a.localeCompare(b, undefined, { sensitivity: "base" });
    });
    return filtered;
}

type Props = {
    repoUrl: string;
    value: string;
    onChange: (next: string) => void;
    disabled?: boolean;
};

export default function BranchAutocomplete({
    repoUrl,
    value,
    onChange,
    disabled,
}: Props) {
    const debouncedRepo = useDebounced(repoUrl.trim(), 450);
    const [branches, setBranches] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState("");
    const [open, setOpen] = useState(false);
    const [highlightIdx, setHighlightIdx] = useState(0);
    const rootRef = useRef<HTMLDivElement>(null);
    const listId = useRef(
        `bf-branch-list-${Math.random().toString(36).slice(2, 9)}`,
    ).current;

    const repoParsed = useMemo(
        () => parseGitHubRepoUrl(debouncedRepo),
        [debouncedRepo],
    );

    useEffect(() => {
        if (!repoParsed) {
            setBranches([]);
            setLoadError("");
            setLoading(false);
            return;
        }

        const ac = new AbortController();
        setLoading(true);
        setLoadError("");

        void (async () => {
            try {
                const url = new URL(`${API_BASE_URL}/github/branches`);
                url.searchParams.set("repoUrl", debouncedRepo);
                const res = await fetch(url.toString(), {
                    credentials: "include",
                    signal: ac.signal,
                });
                const data = (await res.json()) as {
                    branches?: string[];
                    message?: string;
                };
                if (!res.ok) {
                    throw new Error(
                        data.message || `Could not load branches (${res.status})`,
                    );
                }
                setBranches(Array.isArray(data.branches) ? data.branches : []);
            } catch (e) {
                if ((e as Error).name === "AbortError") return;
                setBranches([]);
                setLoadError((e as Error).message);
            } finally {
                if (!ac.signal.aborted) setLoading(false);
            }
        })();

        return () => ac.abort();
    }, [debouncedRepo, repoParsed]);

    const sorted = useMemo(
        () => sortBranchesForQuery(branches, value),
        [branches, value],
    );

    useEffect(() => {
        setHighlightIdx((i) =>
            sorted.length === 0 ? 0 : Math.min(i, sorted.length - 1),
        );
    }, [sorted.length]);

    const selectBranch = useCallback(
        (name: string) => {
            onChange(name);
            setOpen(false);
        },
        [onChange],
    );

    const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (disabled) return;
        if (e.key === "Escape") {
            setOpen(false);
            return;
        }
        if (!sorted.length && !loading) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setHighlightIdx((i) =>
                sorted.length === 0 ? 0 : Math.min(sorted.length - 1, i + 1),
            );
            return;
        }
        if (e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
            setHighlightIdx((i) => Math.max(0, i - 1));
            return;
        }
        if (e.key === "Enter" && open && sorted.length > 0) {
            e.preventDefault();
            const pick = sorted[highlightIdx];
            if (pick) selectBranch(pick);
        }
    };

    useEffect(() => {
        const onDocPointer = (ev: MouseEvent) => {
            if (!rootRef.current?.contains(ev.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", onDocPointer);
        return () => document.removeEventListener("mousedown", onDocPointer);
    }, []);

    const showPanel =
        open &&
        (loading ||
            sorted.length > 0 ||
            (branches.length > 0 && !loading && sorted.length === 0));

    return (
        <div ref={rootRef} className="relative w-full">
            <label className="block text-xs font-medium text-slate-500 mb-1">
                Branch (optional)
            </label>
            <div className="relative">
                <input
                    type="text"
                    placeholder={
                        repoParsed
                            ? "Type to filter branches…"
                            : "Enter a GitHub repo URL first"
                    }
                    value={value}
                    onChange={(e) => {
                        onChange(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => {
                        if (branches.length > 0 || loading) setOpen(true);
                    }}
                    onKeyDown={onInputKeyDown}
                    disabled={disabled}
                    role="combobox"
                    aria-expanded={showPanel}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    className="w-full px-3 py-2 pr-9 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-sky-500 disabled:opacity-50"
                />
                {loading ? (
                    <Loader2
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin pointer-events-none"
                        aria-hidden
                    />
                ) : (
                    <ChevronDown
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
                        aria-hidden
                    />
                )}
            </div>

            {loadError && repoParsed && (
                <p className="text-xs text-amber-700 mt-1">{loadError}</p>
            )}

            {showPanel && (
                <ul
                    id={listId}
                    role="listbox"
                    className="absolute z-30 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg py-1 text-left"
                >
                    {loading && (
                        <li className="px-3 py-2 text-sm text-slate-500 flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                            Loading branches…
                        </li>
                    )}
                    {!loading &&
                        sorted.map((name, idx) => (
                            <li
                                key={name}
                                role="option"
                                aria-selected={idx === highlightIdx}
                                className={`px-3 py-2 text-sm cursor-pointer truncate ${
                                    idx === highlightIdx
                                        ? "bg-sky-100 text-sky-900"
                                        : "text-slate-800 hover:bg-slate-50"
                                }`}
                                onMouseEnter={() => setHighlightIdx(idx)}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => selectBranch(name)}
                            >
                                {name}
                            </li>
                        ))}
                    {!loading && sorted.length === 0 && !loadError && (
                        <li className="px-3 py-2 text-sm text-slate-500">
                            No branches match &ldquo;{value.trim() || "…"}&rdquo;
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
}
