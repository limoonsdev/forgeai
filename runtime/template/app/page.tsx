export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-white">
      <div className="text-center">
        <div className="mx-auto mb-6 size-12 animate-pulse rounded-full bg-gradient-to-br from-orange-500 to-amber-300 blur-[2px]" />
        <h1 className="text-2xl font-semibold tracking-tight">Your app is being forged…</h1>
        <p className="mt-2 text-sm text-white/50">Describe what you want in the chat and watch it come to life.</p>
      </div>
    </main>
  );
}
