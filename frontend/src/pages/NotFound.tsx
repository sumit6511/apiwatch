import { Link } from "react-router-dom";
import { Activity } from "lucide-react";

export function NotFound() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-text">
      <Activity size={28} className="text-muted" />
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted">The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn-primary mt-2">
        Back to Overview
      </Link>
    </div>
  );
}
