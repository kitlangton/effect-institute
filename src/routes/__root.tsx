import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router"
import { useAudioUnlock } from "@/hooks/useAudioUnlock"
import { DefaultNotFoundComponent } from "../router"

import "../styles.css"

const criticalCss = `html,body{background:#000;margin:0;color:#f1efe8}`

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				name: "theme-color",
				content: "#000000",
			},
			{
				title: "effect.institute",
			},
			{
				name: "description",
				content: "Strange, semi-interactive lessons for learning Effect.",
			},
			{
				property: "og:title",
				content: "effect.institute",
			},
			{
				property: "og:description",
				content: "Strange, semi-interactive lessons for learning Effect.",
			},
			{
				property: "og:url",
				content: "https://www.effect.institute",
			},
			{
				property: "og:site_name",
				content: "effect.institute",
			},
			{
				property: "og:locale",
				content: "en_US",
			},
			{
				property: "og:image",
				content: "https://www.effect.institute/og/home.png",
			},
			{
				property: "og:image:width",
				content: "1200",
			},
			{
				property: "og:image:height",
				content: "630",
			},
			{
				property: "og:image:alt",
				content: "effect.institute - Interactive Effect Lessons",
			},
			{
				property: "og:image:type",
				content: "image/png",
			},
			{
				property: "og:type",
				content: "website",
			},
			{
				name: "twitter:card",
				content: "summary_large_image",
			},
			{
				name: "twitter:site",
				content: "@kitlangton",
			},
			{
				name: "twitter:title",
				content: "effect.institute",
			},
			{
				name: "twitter:description",
				content: "Strange, semi-interactive lessons for learning Effect.",
			},
			{
				name: "twitter:image",
				content: "https://www.effect.institute/og/home.png",
			},
			{
				name: "twitter:url",
				content: "https://www.effect.institute",
			},
		],
		links: [
			{
				rel: "icon",
				href: "/favicon.ico",
				sizes: "any",
			},
			{
				rel: "icon",
				type: "image/png",
				sizes: "32x32",
				href: "/favicon-32x32.png",
			},
			{
				rel: "icon",
				type: "image/png",
				sizes: "16x16",
				href: "/favicon-16x16.png",
			},
			{
				rel: "apple-touch-icon",
				sizes: "180x180",
				href: "/apple-touch-icon.png",
			},
			{
				rel: "manifest",
				href: "/site.webmanifest",
			},
			{
				rel: "preload",
				as: "font",
				type: "font/woff2",
				href: "/fonts/CommitMono-Variable.woff2",
				crossOrigin: "anonymous",
			},
		],
	}),

	shellComponent: RootDocument,
	notFoundComponent: DefaultNotFoundComponent,
})

function RootDocument({ children }: { children: React.ReactNode }) {
	useAudioUnlock()

	return (
		<html lang="en" style={{ backgroundColor: "#000000" }} suppressHydrationWarning>
			<head>
				<style dangerouslySetInnerHTML={{ __html: criticalCss }} suppressHydrationWarning />
				<HeadContent />
			</head>
			<body style={{ backgroundColor: "#000000", color: "#f1efe8" }} suppressHydrationWarning>
				{children}
				<Scripts />
			</body>
		</html>
	)
}
