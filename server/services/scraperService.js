import * as cheerio from "cheerio";

export async function scrapeURL(url) {
    try {
        console.log("[SCRAPER] Starting scrape for:", url);

        const startTime = Date.now();

        // Simple fetch — no browser needed
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
            },
            signal: AbortSignal.timeout(20000), // 20 second timeout
        });

        const loadTime = Date.now() - startTime;
        const statusCode = response.status;

        if (!response.ok && statusCode !== 200) {
            return { success: false, error: `HTTP ${statusCode}` };
        }

        const html = await response.text();
        const pageSize = html.length;

        console.log("[SCRAPER] Page fetched, parsing...");

        // Parse HTML with cheerio
        const $ = cheerio.load(html);

        // Helper: get meta content
        const getMeta = (name) =>
            $(`meta[name="${name}"]`).attr("content") ||
            $(`meta[property="${name}"]`).attr("content") ||
            "";

        // Meta data
        const metaData = {
            title: $("title").first().text().trim() || "",
            description: getMeta("description"),
            canonical: $('link[rel="canonical"]').attr("href") || "",
            robots: getMeta("robots"),
            ogTitle: getMeta("og:title"),
            ogDescription: getMeta("og:description"),
            ogImage: getMeta("og:image"),
            twitterCard: getMeta("twitter:card"),
            viewport: getMeta("viewport"),
            charset: $("meta[charset]").attr("charset") || "",
        };

        // Headings
        const h1Elements = $("h1");
        const h1Texts = [];
        h1Elements.each((_, el) => {
            const text = $(el).text().trim();
            if (text) h1Texts.push(text);
        });

        const headings = {
            h1: $("h1").length,
            h2: $("h2").length,
            h3: $("h3").length,
            h4: $("h4").length,
            h5: $("h5").length,
            h6: $("h6").length,
            h1Texts,
        };

        // Links
        let internalLinks = 0;
        let externalLinks = 0;
        let totalLinks = 0;

        const urlHost = new URL(url).hostname;

        $("a[href]").each((_, el) => {
            const href = $(el).attr("href") || "";
            if (href.startsWith("mailto:") || href.startsWith("tel:") || href === "#") return;
            totalLinks++;
            try {
                const absolute = href.startsWith("http") ? href : new URL(href, url).href;
                const linkHost = new URL(absolute).hostname;
                if (linkHost === urlHost) internalLinks++;
                else externalLinks++;
            } catch {
                internalLinks++; // relative links = internal
            }
        });

        // Images
        const allImages = $("img");
        let missingAlt = 0;
        allImages.each((_, el) => {
            const alt = $(el).attr("alt");
            if (!alt || alt.trim() === "") missingAlt++;
        });

        const totalImages = allImages.length;

        // Body text + word count
        // Remove scripts/styles before extracting text
        $("script, style, noscript").remove();
        const bodyText = $("body").text().replace(/\s+/g, " ").trim();
        const wordCount = bodyText.split(" ").filter((w) => w.length > 0).length;

        console.log("[SCRAPER] Scrape completed successfully");

        return {
            success: true,
            data: {
                metaData,
                headings,
                links: {
                    internal: internalLinks,
                    external: externalLinks,
                    broken: 0,
                    total: totalLinks,
                },
                images: {
                    total: totalImages,
                    missingAlt,
                    withAlt: totalImages - missingAlt,
                },
                wordCount,
                pageSize,
                bodyText: bodyText.substring(0, 3000),
                loadTime,
                statusCode,
                url,
            },
        };

    } catch (error) {
        console.error("[SCRAPER] Scrape failed:", error.message);
        return {
            success: false,
            error: error.message,
        };
    }
}