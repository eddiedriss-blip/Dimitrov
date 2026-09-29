export default function LayoutAuth({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col bg-stone-50">
      <header className="bg-anthracite text-white">
        <div className="mx-auto flex h-12 max-w-6xl items-center px-4 text-sm font-semibold tracking-wide sm:px-6 lg:px-8">
          Secteur 1 <span className="ml-2 font-normal text-stone-400">· Gestion des logements vacants</span>
        </div>
        <div aria-hidden="true" className="h-1 bg-gradient-to-r from-primaire via-flamme to-soleil" />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center sm:py-16">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
