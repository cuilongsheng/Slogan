export function BootstrapView() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6 text-foreground">
      <section className="w-full max-w-xl rounded-3xl border border-border bg-panel p-10 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
          Engineering bootstrap
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Slogan Admin is ready</h1>
        <p className="mt-4 max-w-prose leading-7 text-muted">
          This screen verifies routing, styling, build, runtime, and browser tests. It is not a
          product dashboard.
        </p>
      </section>
    </main>
  );
}
