export default function AppLoading() {
  return (
    <div className="app-state-shell" aria-live="polite" aria-busy="true">
      <section className="app-state-card">
        <div aria-hidden="true" className="app-state-spinner" />
        <p className="brand-eyebrow">CodeFlow Loading</p>
        <h1>Preparing the workbench.</h1>
        <p>Booting the graph canvas, panel state, and route payload for the current workspace.</p>
      </section>
    </div>
  );
}
