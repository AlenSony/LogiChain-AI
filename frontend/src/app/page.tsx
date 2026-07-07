import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-emerald-100">
      {/* Dynamic Header */}
      <header className="flex items-center justify-between px-8 py-6 max-w-6xl w-full mx-auto bg-transparent">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight text-slate-900">
            LogiChain <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 ml-0.5"></span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            Login
          </Link>
          <Link
            href="/login"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-emerald-600/10 hover:bg-emerald-700 transition-all"
          >
            Sign Up
          </Link>
        </div>
      </header>

      {/* Hero Core Content */}
      <main className="flex flex-1 flex-col items-center justify-center max-w-4xl mx-auto text-center px-6 py-20">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold uppercase tracking-wider mb-8 animate-fade-in">
          System Core Online • Powered by LangGraph
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 max-w-3xl leading-[1.15]">
          Autonomous Multi-Agent <br />
          <span className="text-emerald-600">Logistics Swarm Engine</span>
        </h1>

        <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-500">
          Treating multi-hub global logistics as a dynamic graph optimization problem. 
          Real-time AI pathfinding, automated load shifting, and immutable tracking tokens.
        </p>

        {/* Call to Actions Framework */}
        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
          <Link
            className="flex h-12 w-full sm:w-48 items-center justify-center rounded-lg bg-slate-900 text-white font-medium shadow-lg shadow-slate-900/10 hover:bg-slate-800 transition-all active:scale-[0.98]"
            href="/login"
          >
            Get Started
          </Link>
        </div>
      </main>
      {/* Footer Utility */}
      <footer className="py-6 text-center text-xs text-slate-400 border-t border-slate-100">
        &copy; 2026 LogiChain AI Core Systems. All privileges restricted.
      </footer>
    </div>
  );
}