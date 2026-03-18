import { useEffect, useState } from "react";
import { Route, Routes, useNavigate } from "react-router-dom";
import { AUTH_STATE_CHANGED_EVENT, notifyAuthStateChanged } from "./auth";
import AuthCallback from "./AuthCallback";
import "./App.css";
import Dashboard from "./Dashboard";
import HomePage from "./HomePage";
import Navbar from "./Navbar";
import { API_BASE_URL, type GitHubUser } from "./types";

function App() {
    const navigate = useNavigate();
    const [user, setUser] = useState<GitHubUser | null>(null);

    useEffect(() => {
        const syncUser = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/auth/me`, {
                    credentials: "include",
                });

                if (!response.ok) {
                    setUser(null);
                    return;
                }

                const data = (await response.json()) as { user: GitHubUser };
                setUser(data.user);
            } catch {
                setUser(null);
            }
        };

        const handleAuthChange = () => {
            void syncUser();
        };

        void syncUser();
        window.addEventListener(AUTH_STATE_CHANGED_EVENT, handleAuthChange);

        return () => {
            window.removeEventListener(
                AUTH_STATE_CHANGED_EVENT,
                handleAuthChange,
            );
        };
    }, []);

    const handleLogout = async () => {
        try {
            await fetch(`${API_BASE_URL}/auth/logout`, {
                method: "POST",
                credentials: "include",
            });
        } finally {
            notifyAuthStateChanged();
            navigate("/");
        }
    };

    return (
        <div className="min-h-screen">
            <Navbar user={user} onLogout={handleLogout} />
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
            </Routes>
        </div>
    );
}

export default App;
