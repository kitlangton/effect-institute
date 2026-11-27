import {
	ArrowSquareOutIcon,
	BookOpenIcon,
	CalendarBlankIcon,
	GithubLogoIcon,
	HouseIcon,
	SparkleIcon,
	StarIcon,
	WrenchIcon,
} from "@phosphor-icons/react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { Fragment, type ReactNode } from "react"
import { NAV_BAR_HEIGHT } from "@/components/chapters/constants"
import { FooterEffectLink } from "@/components/chapters/FooterEffectLink"
import { FooterLinks } from "@/components/FooterLinks"
import { useHotkeys } from "@/hooks/useHotkeys"
import changelogData from "../../content/changelog"

export const Route = createFileRoute("/changelog")({
	component: ChangelogPage,
})

/** Simple markdown parser for links, bold, and code */
function parseMarkdown(text: string): ReactNode[] {
	const parts: ReactNode[] = []
	// Match: [text](url), **bold**, `code`
	const regex = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g
	let lastIndex = 0
	let match: RegExpExecArray | null
	let key = 0

	while ((match = regex.exec(text)) !== null) {
		// Add text before match
		if (match.index > lastIndex) {
			parts.push(<Fragment key={key++}>{text.slice(lastIndex, match.index)}</Fragment>)
		}

		if (match[1] && match[2]) {
			// Link: [text](url)
			const isExternal = match[2].startsWith("http")
			const isChapterLink = match[2].startsWith("/chapters/")
			if (isExternal) {
				parts.push(
					<a
						key={key++}
						href={match[2]}
						target="_blank"
						rel="noopener noreferrer"
						className="text-white/90 underline underline-offset-2 hover:text-white"
					>
						{match[1]}
					</a>,
				)
			} else if (isChapterLink) {
				parts.push(
					<Link
						key={key++}
						to={match[2]}
						className="inline-flex items-center gap-1 text-white/90 hover:text-white bg-white/5 hover:bg-white/10 px-1.5 py-0.5 -my-0.5 text-xs font-medium"
					>
						{match[1]}
						<ArrowSquareOutIcon size={12} weight="bold" className="text-white/40" />
					</Link>,
				)
			} else {
				parts.push(
					<Link key={key++} to={match[2]} className="text-white/90 underline underline-offset-2 hover:text-white">
						{match[1]}
					</Link>,
				)
			}
		} else if (match[3]) {
			// Bold: **text**
			parts.push(
				<strong key={key++} className="text-white/90 font-medium">
					{match[3]}
				</strong>,
			)
		} else if (match[4]) {
			// Code: `text`
			parts.push(
				<code key={key++} className="text-white/80 bg-white/10 px-1 py-0.5 text-xs">
					{match[4]}
				</code>,
			)
		}

		lastIndex = match.index + match[0].length
	}

	// Add remaining text
	if (lastIndex < text.length) {
		parts.push(<Fragment key={key++}>{text.slice(lastIndex)}</Fragment>)
	}

	return parts.length > 0 ? parts : [text]
}

const typeIcons: Record<string, { icon: typeof WrenchIcon; className: string }> = {
	fix: { icon: WrenchIcon, className: "text-orange-400/60" },
	improvement: { icon: SparkleIcon, className: "text-amber-400/60" },
	feature: { icon: StarIcon, className: "text-emerald-400/60" },
	content: { icon: BookOpenIcon, className: "text-purple-400/60" },
}

function formatRelativeDate(dateStr: string): string {
	// Parse as local date (not UTC) by adding time component
	const [year, month, day] = dateStr.split("-").map(Number)
	const date = new Date(year, month - 1, day)

	const now = new Date()
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
	const diffMs = today.getTime() - date.getTime()
	const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

	if (diffDays === 0) return "Today"
	if (diffDays === 1) return "Yesterday"
	if (diffDays < 7) return `${diffDays} days ago`

	// Check if same year
	const sameYear = date.getFullYear() === now.getFullYear()

	if (sameYear) {
		// "January 3"
		return date.toLocaleDateString("en-US", { month: "long", day: "numeric" })
	}

	// Different year: "January 3, 2024"
	return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}

function ChangelogPage() {
	const navigate = useNavigate()
	useHotkeys({
		context: "changelog",
		handlers: {
			"nav.goHome": () => {
				navigate({ to: "/" })
				return true
			},
		},
	})

	return (
		<div className="min-h-dvh bg-black overflow-y-auto flex justify-center">
			<div className="max-w-2xl w-full sm:border-x border-[var(--border-subtle)] sm:mx-8 flex flex-col min-h-dvh">
				{/* Nav bar */}
				<div
					className="flex-none flex items-center justify-between border-b border-[var(--border-subtle)]"
					style={{ height: NAV_BAR_HEIGHT }}
				>
					<Link
						to="/"
						className="flex items-center px-4 h-full text-white/30 hover:text-white/60 hover:bg-white/5 cursor-default"
					>
						<HouseIcon size={16} weight="fill" />
					</Link>
					<h1 className="text-xs uppercase tracking-[0.3em] text-white/40">Changelog</h1>
					<a
						href="https://github.com/kitlangton/effect-institute"
						target="_blank"
						rel="noopener noreferrer"
						aria-label="GitHub repository"
						className="flex items-center px-4 h-full border-l border-[var(--border-subtle)] text-white/30 hover:text-white/60 hover:bg-white/5"
					>
						<GithubLogoIcon size={16} weight="fill" />
					</a>
				</div>

				{/* Header */}
				<div
					className="px-5 flex items-center border-b border-[var(--border-subtle)]"
					style={{ height: NAV_BAR_HEIGHT }}
				>
					<h2 className="text-xs uppercase tracking-[0.2em] text-white/40">Updates</h2>
				</div>

				{/* Content */}
				<div className="flex-1">
					{changelogData.releases.length === 0 ? (
						<div className="p-5 text-white/40 text-sm">No changes yet.</div>
					) : (
						changelogData.releases.map((release) => (
							<div key={release.date}>
								{/* Day separator with diagonal stripes */}
								<div
									className="border-b border-[var(--border-subtle)]"
									style={{
										height: NAV_BAR_HEIGHT / 2,
										backgroundImage:
											"repeating-linear-gradient(45deg, transparent, transparent 12px, rgba(255,255,255,0.08) 12px, rgba(255,255,255,0.08) 13px)",
									}}
								/>

								{/* Date header */}
								<div
									className="px-5 flex items-center gap-2 border-b border-[var(--border-subtle)] bg-white/[0.04]"
									style={{ height: NAV_BAR_HEIGHT }}
								>
									<CalendarBlankIcon size={14} weight="fill" className="text-white/30" />
									<span className="text-xs uppercase tracking-[0.15em] text-white/50">
										{formatRelativeDate(release.date)}
									</span>
								</div>

								{/* Changes */}
								{release.changes.map((change, changeIdx) => {
									const typeConfig = typeIcons[change.type] ?? { icon: SparkleIcon, className: "text-white/30" }
									const Icon = typeConfig.icon
									return (
										<div
											key={changeIdx}
											className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-baseline gap-3"
										>
											<Icon
												size={14}
												weight="fill"
												className={`${typeConfig.className} flex-none relative top-[1px]`}
											/>
											<span className="text-sm text-white/70 leading-relaxed">
												{parseMarkdown(change.text)}
												{change.ref && <span className="ml-2 text-xs text-white/30">— via feedback</span>}
											</span>
										</div>
									)
								})}
							</div>
						))
					)}
				</div>

				{/* Footer */}
				<div
					className="flex-none bg-black border-t border-[var(--border-subtle)] flex items-center justify-between mt-auto"
					style={{ height: NAV_BAR_HEIGHT }}
				>
					<FooterEffectLink />
					<div className="flex items-center h-full">
						<FooterLinks />
					</div>
				</div>
			</div>
		</div>
	)
}
