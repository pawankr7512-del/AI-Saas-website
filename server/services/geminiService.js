import { GoogleGenAI, Type } from "@google/genai";

if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set. Gemini AI will not run.");
}

// Initialize the Google GenAI client with explicit config
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

 const seoAnalysisSchema = {
    type: Type.OBJECT,
    properties: {
        overallScore: { type: Type.INTEGER },
        categories: {
            type: Type.OBJECT,
            properties: {
                seo: { type: Type.INTEGER },
                performance: { type: Type.INTEGER },
                accessibility: { type: Type.INTEGER },
                bestPractices: { type: Type.INTEGER },
            },
            required: ["seo", "performance", "accessibility", "bestPractices"],
        },
        keywords: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    word: { type: Type.STRING },
                    count: { type: Type.INTEGER },
                    density: { type: Type.NUMBER },
                },
                required: ["word", "count", "density"],
            },
        },
        issues: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    severity: {
                        type: Type.STRING,
                        format: "enum",
                        enum: ["low", "medium", "high"],
                    },

                    category: { type: Type.STRING },
                    message: { type: Type.STRING },
                    recommendation: { type: Type.STRING },
                },
                required: ["severity", "category", "message", "recommendation"],
            },
        },
    },
    required: ["overallScore", "categories", "keywords", "issues"],
};

 export async function analyzeSeoData(scrapedData) {
    try {
        console.log("[GEMINI] Starting SEO analysis for:", scrapedData.url);
        
        const prompt = `You are an expert SEO analyst. Analyze the following website data and provide a comprehensive SEO audit.

Website URL: ${scrapedData.url}
Load Time: ${scrapedData.loadTime}ms
Status Code: ${scrapedData.statusCode}
Page Size: ${Math.round(scrapedData.pageSize / 1024)}KB
Word Count: ${scrapedData.wordCount}

META DATA:
- Title: "${scrapedData.metaData.title}" (${scrapedData.metaData.title.length} chars)
- Description: "${scrapedData.metaData.description}" (${scrapedData.metaData.description.length} chars)
- Canonical: "${scrapedData.metaData.canonical}"
- Robots: "${scrapedData.metaData.robots}"
- OG Title: "${scrapedData.metaData.ogTitle}"
- OG Description: "${scrapedData.metaData.ogDescription}"
- OG Image: "${scrapedData.metaData.ogImage}"
- Twitter Card: "${scrapedData.metaData.twitterCard}"
- Viewport: "${scrapedData.metaData.viewport}"
- Charset: "${scrapedData.metaData.charset}"

HEADINGS:
- H1: ${scrapedData.headings.h1} (texts: ${JSON.stringify(scrapedData.headings.h1Texts)})
- H2: ${scrapedData.headings.h2}
- H3: ${scrapedData.headings.h3}
- H4: ${scrapedData.headings.h4}
- H5: ${scrapedData.headings.h5}
- H6: ${scrapedData.headings.h6}

LINKS:
- Internal: ${scrapedData.links.internal}
- External: ${scrapedData.links.external}
- Total: ${scrapedData.links.total}

IMAGES:
- Total: ${scrapedData.images.total}
- Missing Alt Text: ${scrapedData.images.missingAlt}
- With Alt Text: ${scrapedData.images.withAlt}

PAGE CONTENT (first 3000 chars):
${scrapedData.bodyText}

Scoring guidelines:
- Title: 50-60 chars optimal, must exist
- Description: 150-160 chars optimal, must exist
- H1: exactly 1 is ideal
- Images: all should have alt text
- Load time: <3s good, <5s ok, >5s poor
- Page size: <3MB good
- Must have viewport meta, charset, canonical
- OG tags and Twitter cards are important
- Internal linking is good for SEO
- Word count: >300 words for content pages
- Check heading hierarchy

Severity levels must be exactly one of: "high", "medium", or "low".
Provide 5-15 issues sorted by severity (high first). Be specific and actionable with recommendations.
Extract top 10 keywords by frequency from the page content.`;


        // Use Gemini 2.5 as requested
        const modelName = "gemini-2.5";

        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: seoAnalysisSchema,
            },
        });

        console.log("[GEMINI] Response received, parsing...");

        // Flexible parsing: try common response shapes
        let analysis = null;

        try {
            if (response && typeof response.text === "string") {
                analysis = JSON.parse(response.text);
            } else if (
                response &&
                response.output &&
                Array.isArray(response.output) &&
                response.output[0] &&
                response.output[0].content
            ) {
                // Look for a text/json content piece
                const content = response.output[0].content;
                // content may be an array of parts
                for (const part of content) {
                    if (part && (part.type === "application/json" || part.mediaType === "application/json") && part.text) {
                        analysis = JSON.parse(part.text);
                        break;
                    }

                    if (part && part.text) {
                        try {
                            // attempt to parse any textual part as JSON
                            analysis = JSON.parse(part.text);
                            break;
                        } catch {}
                    }
                }
            }
        } catch (parseErr) {
            console.error("[GEMINI] Failed to parse AI response JSON:", parseErr.message);
        }

        if (analysis) {
            console.log("[GEMINI] Analysis completed successfully");

            return {
                success: true,
                data: analysis,
            };
        }

        // If we reach here, parsing failed — fall back to local heuristic analyzer
        console.warn("[GEMINI] Response could not be parsed as JSON, using fallback analyzer.");
        const fallback = buildFallbackAnalysis(scrapedData);
        return { success: true, data: fallback };

    } catch (error) {
        console.error("[GEMINI] Analysis error:", error?.message || error);
        console.error("[GEMINI] Full error:", error);

        // On error, attempt to return a fallback analysis so the controller can save results
        try {
            const fallback = buildFallbackAnalysis(scrapedData);
            return { success: true, data: fallback };
        } catch (fbErr) {
            console.error("[GEMINI] Fallback analyzer failed:", fbErr?.message || fbErr);
            return { success: false, error: error?.message || String(error) };
        }
    }

}


// Simple heuristic analyzer used as a fallback when Gemini is unavailable or response parsing fails
function buildFallbackAnalysis(scrapedData) {
    const { metaData = {}, headings = {}, images = {}, links = {}, bodyText = "", loadTime = 0, pageSize = 0, wordCount = 0 } = scrapedData || {};

    // basic scoring
    let score = 50;
    if (metaData.title && metaData.title.length >= 30 && metaData.title.length <= 70) score += 10;
    if (metaData.description && metaData.description.length >= 100 && metaData.description.length <= 180) score += 10;
    if ((headings.h1 || 0) === 1) score += 5;
    if ((images.missingAlt || 0) === 0) score += 5;
    if (loadTime < 3000) score += 10;
    score = Math.max(0, Math.min(100, score));

    // simple keyword extraction (frequency)
    const wordCounts = {};
    const words = (bodyText || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
    for (const w of words) {
        if (w.length <= 3) continue;
        wordCounts[w] = (wordCounts[w] || 0) + 1;
    }
    const sorted = Object.entries(wordCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const totalWords = words.length || 1;
    const keywords = sorted.map(([word, count]) => ({ word, count, density: Number(((count / totalWords) * 100).toFixed(2)) }));

    // issues heuristics
    const issues = [];
    if (!metaData.title) issues.push({ severity: "high", category: "meta", message: "Missing title tag", recommendation: "Add a descriptive title tag (50-60 chars)." });
    if (!metaData.description) issues.push({ severity: "high", category: "meta", message: "Missing meta description", recommendation: "Add a meta description (150-160 chars)." });
    if ((headings.h1 || 0) !== 1) issues.push({ severity: "medium", category: "headings", message: `Found ${headings.h1 || 0} H1 tags`, recommendation: "Ensure exactly one H1 per page." });
    if ((images.missingAlt || 0) > 0) issues.push({ severity: "medium", category: "images", message: `${images.missingAlt} images missing alt text`, recommendation: "Add descriptive alt attributes to images." });
    if (!metaData.viewport) issues.push({ severity: "high", category: "meta", message: "Missing viewport meta", recommendation: "Add a responsive viewport meta tag." });

    return {
        overallScore: score,
        categories: { seo: Math.round(score * 0.9), performance: Math.round(score * 0.8), accessibility: Math.round(score * 0.7), bestPractices: Math.round(score * 0.75) },
        keywords,
        issues,
    };
}
