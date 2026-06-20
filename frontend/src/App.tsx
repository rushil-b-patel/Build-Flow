import { Route, Routes } from "react-router-dom";
import AuthCallback from "./AuthCallback";
import "./App.css";
import Dashboard from "./Dashboard";
import HomePage from "./HomePage";
import Navbar from "./Navbar";

function App() {
    return (
        <div className="min-h-screen">
            <Navbar />
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
            </Routes>
        </div>
    );
}

export default App;
