import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { notifyAuthStateChanged } from "./auth";
import { API_BASE_URL } from "./types";

export default function AuthCallback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [error, setError] = useState("");

    useEffect(() => {
        const code = searchParams.get("code");
        if (!code) {
            setError("No authorization code received");
            return;
        }

        (async () => {
            try {
                debugger;
                const response = await fetch(
                    `${API_BASE_URL}/auth/github/callback?code=${code}`,
                    {
                        credentials: "include",
                    },
                );

                const data = (await response.json()) as { message?: string };
                if (!response.ok) {
                    throw new Error(data.message || "Authentication failed");
                }

                notifyAuthStateChanged();
                navigate("/dashboard", { replace: true });
            } catch (err) {
                setError((err as Error).message);
            }
        })();
    }, [navigate, searchParams]);

    if (error) {
        return (
            <div className="w-full max-w-md mx-auto p-10 text-center">
                <div className="rounded-2xl border border-red-200 bg-red-50 p-8">
                    <p className="text-red-700 font-medium mb-4">
                        Authentication failed
                    </p>
                    <p className="text-red-600 text-sm mb-6">{error}</p>
                    <button
                        onClick={() => navigate("/", { replace: true })}
                        className="px-6 py-2 rounded-xl bg-black text-white hover:bg-white hover:text-black border transition-all font-medium text-sm"
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-md mx-auto p-10 text-center">
            <div className="rounded-2xl border border-slate-200 bg-white/95 backdrop-blur p-8 shadow-xl">
                <Loader2
                    className="animate-spin text-slate-400 mx-auto mb-4"
                    size={32}
                />
                <p className="text-slate-600 font-medium">
                    Signing in with GitHub...
                </p>
            </div>
        </div>
    );
}
