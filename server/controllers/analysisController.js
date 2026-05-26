import Analysis from "../models/Analysis.js";
import { analyzeSeoData } from "../services/geminiService.js";
import { scrapeURL} from "../services/scraperService.js";    


// Analyze a URL
export const analyzeURL = async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ success: false, message: "URL is required" });

        // Validate URL format
        let validUrl;
        try {
            validUrl = new URL(url.startsWith("http") ? url : `http://${url}`);
        } catch (error) {
            return res.status(400).json({ success: false, message: "Invalid URL format" });
        }


        // Create analysis record with pending status
        const analysis = await Analysis.create({userId: req.userID, url: validUrl.href, status: "processing" });

        // Analysis will be completed before returning so results persist in serverless environments

        // Run scraping and analysis synchronously
        try {
            console.log("[ANALYSIS] Starting analysis for:", validUrl.href);

            // Step 1: Scrape the URL with BrowserBase
            console.log("[ANALYSIS] Step 1: Scraping URL...");
            const scrapeResult = await scrapeURL(validUrl.href);
            
            if (!scrapeResult.success) {
                console.error("[ANALYSIS] Scraping failed:", scrapeResult.error);
                analysis.status = "failed";
                analysis.issues = [{
                    severity: "high",
                    category: "scraping",
                    message: "Failed to scrape website",
                    recommendation: scrapeResult.error || "Unknown scraping error"
                }];
                await analysis.save();
                return res.json({ success: true, message: "Analysis started", analysisId: analysis._id });
            }
            console.log("[ANALYSIS] Scraping completed successfully");

            // Step 2: Analyze with Gemini AI
            console.log("[ANALYSIS] Step 2: Running AI analysis...");
            const aiResult = await analyzeSeoData(scrapeResult.data);

            if (!aiResult.success) {
                console.error("[ANALYSIS] AI analysis failed:", aiResult.error);
                analysis.status = "failed";
                analysis.issues = [{
                    severity: "high",
                    category: "ai",
                    message: "AI analysis failed",
                    recommendation: aiResult.error || "Unknown AI error"
                }];
                // Still save scraped data even if AI fails
                analysis.metaData = scrapeResult.data.metaData || {};
                analysis.headings = scrapeResult.data.headings || {};
                analysis.links = scrapeResult.data.links || {};
                analysis.images = scrapeResult.data.images || {};
                analysis.loadTime = scrapeResult.data.loadTime || 0;
                analysis.pageSize = scrapeResult.data.pageSize || 0;
                analysis.wordCount = scrapeResult.data.wordCount || 0;
                await analysis.save();
                return res.json({ success: true, message: "Analysis started", analysisId: analysis._id });
            }
            console.log("[ANALYSIS] AI analysis completed successfully");

            // Step 3: Save results (with sanitization)
            console.log("[ANALYSIS] Step 3: Sanitizing and saving results...");

            const aiData = aiResult.data || {};

            const toNumber = (v, def = 0) => {
                if (typeof v === 'number' && !isNaN(v)) return v;
                const n = Number(v);
                return isNaN(n) ? def : n;
            };

            // Normalize categories
            const categories = aiData.categories || {};
            analysis.overallScore = toNumber(aiData.overallScore, 0);
            analysis.categories = {
                seo: toNumber(categories.seo, 0),
                performance: toNumber(categories.performance, 0),
                accessibility: toNumber(categories.accessibility, 0),
                bestPractices: toNumber(categories.bestPractices, 0),
            };

            // Preserve scraped metadata and augment with AI results
            analysis.metaData = scrapeResult.data.metaData || {};
            analysis.headings = scrapeResult.data.headings || {};
            analysis.links = scrapeResult.data.links || {};
            analysis.images = scrapeResult.data.images || {};

            // Keywords normalization
            if (Array.isArray(aiData.keywords)) {
                analysis.keywords = aiData.keywords.map((k) => ({
                    word: k?.word ? String(k.word) : "",
                    count: toNumber(k?.count, 0),
                    density: toNumber(k?.density, 0),
                }));
            } else {
                analysis.keywords = [];
            }

            // Issues normalization — ensure required fields and valid severity
            if (Array.isArray(aiData.issues)) {
                analysis.issues = aiData.issues.map((it) => {
                    const sev = (it?.severity || "low").toString().toLowerCase();
                    const severity = ["low", "medium", "high"].includes(sev) ? sev : "low";
                    return {
                        severity,
                        category: it?.category ? String(it.category) : "general",
                        message: it?.message ? String(it.message) : "No message provided",
                        recommendation: it?.recommendation ? String(it.recommendation) : "No recommendation provided",
                    };
                });
            } else {
                analysis.issues = [];
            }

            analysis.loadTime = scrapeResult.data.loadTime || 0;
            analysis.pageSize = scrapeResult.data.pageSize || 0;
            analysis.wordCount = scrapeResult.data.wordCount || 0;
            analysis.status = "completed";

            try {
                await analysis.save();
                console.log("[ANALYSIS] Analysis completed and saved for:", validUrl.href);
                return res.json({ success: true, message: "Analysis started", analysisId: analysis._id });
            } catch (saveErr) {
                console.error("[ANALYSIS] Failed to save analysis:", saveErr.message);
                // Attempt to mark as failed with the save error
                try {
                    analysis.status = "failed";
                    analysis.issues = [{
                        severity: "high",
                        category: "system",
                        message: "Failed to save analysis results",
                        recommendation: saveErr.message || "Check server logs",
                    }];
                    await analysis.save();
                } catch (finalErr) {
                    console.error("[ANALYSIS] Failed to update analysis to failed state:", finalErr.message);
                }
                return res.json({ success: true, message: "Analysis started", analysisId: analysis._id });
            }







            } catch (bgError) {
                console.error("[ANALYSIS] Background analysis error:", bgError.message);
                console.error("[ANALYSIS] Full error:", bgError);
                try {
                    analysis.status = "failed";
                    analysis.issues = [{
                        severity: "high",
                        category: "system",
                        message: "Analysis failed due to system error",
                        recommendation: bgError.message || "Unknown error"
                    }];
                    await analysis.save();
                } catch (saveError) {
                    console.error("[ANALYSIS] Failed to update analysis status:", saveError.message);
                }
                return res.json({ success: true, message: "Analysis started", analysisId: analysis._id });
            }


    }catch (error) {
         console.error("Analyze URL errorr:", error.message);
        if(!res.headersSent) {
            res.status(500).json({ success: false, message: "Server error" });
        }

    }

}

// Get analysis by ID
export const getAnalysis = async (req, res) => {
    try {
        const analysis = await Analysis.findOne({ _id: req.params.id, userId: req.userID });
        if (!analysis) return res.status(404).json({ success: false, message: "Analysis not found" });

        res.json({ success: true, data: analysis });

    }catch (error) {
        console.error("Get analysis error:", error.message);
        res.status(500).json({ success: false, message: "Server error" });

    }

}

// Get all analyses for user
export const getAnalyses = async (req, res) => {
    try {

       const page = parseInt(req.query.page) || 1;
         const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const analyses = await Analysis.find({ userId: req.userID }).sort({ createdAt: -1 }).skip(skip).limit(limit).select("-issues -keywords");
        const total = await Analysis.countDocuments({ userId: req.userID });

        res.json({ success: true, analyses, total, page, pages: Math.ceil(total / limit) });

    }catch (error) {
        console.error("Get analysis error:", error.message);
        res.status(500).json({ success: false, message: "Server error" });

    }

}



export const deleteAnalysis = async (req, res) => {
    try {
        const analysis = await Analysis.findOneAndDelete({ _id: req.params.id, userId: req.userID });
        if (!analysis) {
            return res.status(404).json({ success: false, message: "Analysis not found" });
        }
        res.json({ success: true, message: "Analysis deleted" });
      
    }catch (error) {
        console.error("Delete analysis error:", error.message);
        res.status(500).json({ success: false, message: "Server error" });

    }

}