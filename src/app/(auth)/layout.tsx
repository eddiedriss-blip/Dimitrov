import { Logo } from "@/components/Logo";

export default function LayoutAuth({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="bg-primaire text-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6 lg:px-8">
          <Logo variante="blanc" />
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center sm:py-16">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
