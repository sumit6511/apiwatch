import { Link } from "react-router-dom";
import { Activity } from "lucide-react";

export function NotFound() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-center text-text">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface2 text-muted">
        <Activity size={28} />
      </div>
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted">The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn-primary mt-2">
        Back to Overview
      </Link>
    </div>
  );
}
