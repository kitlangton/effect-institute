import { createRouter, type ErrorComponentProps, Link } from "@tanstack/react-router"

// Import the generated route tree
import { routeTree } from "./routeTree.gen"

function DefaultErrorComponent({ error, reset }: ErrorComponentProps) {
	const message = error instanceof Error ? error.message : "An unexpected error occurred."

	return (
		<div className="min-h-dvh bg-black text-[var(--color-text)] flex items-center justify-center p-6">
			<div className="max-w-md w-full border border-[var(--border-subtle)] bg-white/[0.02]">
				<div className="px-5 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
					<span className="text-xs uppercase tracking-[0.3em] text-red-400/80">Error</span>
					<span className="text-xs text-white/30">Something went wrong</span>
				</div>
				<div className="p-5 space-y-4">
					<p className="text-sm text-white/70 leading-relaxed break-words">{message}</p>
					<div className="flex items-center gap-3">
						<button
							type="button"
							onClick={reset}
							className="inline-flex items-center gap-2 px-3 py-1.5 text-xs uppercase tracking-wide bg-white text-black font-medium hover:bg-white/90"
						>
							Try again
						</button>
						<Link
							to="/"
							className="inline-flex items-center gap-2 px-3 py-1.5 text-xs uppercase tracking-wide border border-[var(--border-subtle)] text-white/70 hover:text-white hover:bg-white/5 hover:border-white/20"
						>
							Back to home
						</Link>
					</div>
				</div>
			</div>
		</div>
	)
}

export function DefaultNotFoundComponent() {
	return (
		<div className="min-h-dvh bg-black text-[var(--color-text)] flex items-center justify-center p-6">
			<div className="max-w-md w-full border border-[var(--border-subtle)] bg-white/[0.02]">
				<div className="px-5 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
					<span className="text-xs uppercase tracking-[0.3em] text-white/40">404</span>
					<span className="text-xs text-white/30">Not Found</span>
				</div>
				<div className="p-5 space-y-4">
					<p className="text-sm text-white/70 leading-relaxed">
						The page you requested doesn&apos;t exist or has been moved.
					</p>
					<Link
						to="/"
						className="inline-flex items-center gap-2 px-3 py-1.5 text-xs uppercase tracking-wide border border-[var(--border-subtle)] text-white/70 hover:text-white hover:bg-white/5 hover:border-white/20"
					>
						Back to home
					</Link>
				</div>
			</div>
		</div>
	)
}

// Create a new router instance
export const getRouter = () => {
	const router = createRouter({
		routeTree,
		scrollRestoration: true,
		defaultPreloadStaleTime: 0,
		defaultErrorComponent: DefaultErrorComponent,
		defaultNotFoundComponent: DefaultNotFoundComponent,
	})

	return router
}
