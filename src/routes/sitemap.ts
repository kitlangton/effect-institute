import { createFileRoute } from "@tanstack/react-router"
import { fetchCourseManifest } from "@/lib/content/delivery"

const BASE_URL = "https://www.effect.institute"

export const Route = createFileRoute("/sitemap")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				// Static pages
				const staticPages = [{ loc: "/", priority: "1.0", changefreq: "weekly" }]

				// Load chapter manifest to get dynamic pages
				const chapterPages: Array<{ loc: string; priority: string; changefreq: string }> = []

				try {
					const manifest = await fetchCourseManifest({ origin: new URL(request.url).origin })

					for (const chapter of manifest.chapters) {
						// Skip draft and coming soon chapters
						if (chapter.draft || chapter.comingSoon) continue

						chapterPages.push({
							loc: `/chapters/${chapter.id}`,
							priority: "0.8",
							changefreq: "weekly",
						})
					}
				} catch (e) {
					console.error("Failed to load chapter manifest for sitemap:", e)
				}

				const allPages = [...staticPages, ...chapterPages]
				const lastmod = new Date().toISOString().split("T")[0]

				const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages
	.map(
		(page) => `  <url>
    <loc>${BASE_URL}${page.loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`,
	)
	.join("\n")}
</urlset>`

				return new Response(xml, {
					status: 200,
					headers: {
						"Content-Type": "application/xml",
						"Cache-Control": "public, max-age=3600",
					},
				})
			},
		},
	},
})
