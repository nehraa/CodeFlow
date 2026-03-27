"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[CodeFlow] Route render failed", error);
  }, [error]);

  return (
    <div className="app-state-shell">
      <section className="app-state-card">
        <p className="brand-eyebrow">CodeFlow Recovery</p>
        <h1>Workbench failed to render.</h1>
        <p>
          The current route hit an unexpected error. Reset the route state first. If it keeps
          failing, reload the page and inspect the console or server logs with the digest below.
        </p>
        {error.digest ? <p>Error digest: {error.digest}</p> : null}
        <div className="app-state-actions">
          <button onClick={reset} type="button">
            Retry route
          </button>
          <button onClick={() => window.location.reload()} type="button">
            Reload app
          </button>
        </div>
      </section>
    </div>
  );
}
