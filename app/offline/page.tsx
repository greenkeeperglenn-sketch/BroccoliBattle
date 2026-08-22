export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="text-6xl" aria-hidden="true">📡</div>
      <h1 className="font-display text-2xl">Battle HQ is unreachable</h1>
      <p className="text-sm font-bold text-ink-soft">
        No connection right now. Anything you logged is safe on this phone and
        will sync the moment you&apos;re back online.
      </p>
    </main>
  );
}
