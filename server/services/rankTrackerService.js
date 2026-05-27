import KeywordTracking from "../models/keywordTracking.js";

const SERPAPI_KEY = process.env.SERPAPI_KEY;

export async function rankTracker(keyword, targetDomain, trackingId) {
  try {
    const cleanTarget = targetDomain.replace("www.", "").toLowerCase();
    let found = null;
    let allResults = [];

    // SerpAPI se 5 pages tak check karo (10 results per page)
    for (let page = 0; page < 5; page++) {
      const params = new URLSearchParams({
        engine: "google",
        q: keyword,
        start: String(page * 10),
        num: "10",
        hl: "en",
        gl: "us",
        api_key: SERPAPI_KEY,
      });

      const response = await fetch(
        `https://serpapi.com/search?${params.toString()}`
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || `SerpAPI error: ${response.status}`);
      }

      const data = await response.json();
      const organicResults = data.organic_results || [];

      if (organicResults.length === 0) break;

      for (const result of organicResults) {
        const resultDomain = new URL(result.link).hostname
          .replace("www.", "")
          .toLowerCase();

        const position = allResults.length + 1;

        allResults.push({
          position,
          url: result.link,
          domain: resultDomain,
          title: result.title || "",
          snippet: result.snippet || "",
        });

        // Target domain match check
        if (
          !found &&
          (resultDomain.includes(cleanTarget) ||
            cleanTarget.includes(resultDomain))
        ) {
          found = {
            position,
            page: page + 1,
            url: result.link,
            domain: resultDomain,
            title: result.title || "",
            snippet: result.snippet || "",
          };
        }
      }

      // Mil gaya toh aage mat jao — API credits bachao
      if (found) break;
    }

    // Top 10 competitors (target domain ko exclude karo)
    const competitors = allResults
      .filter(
        (r) =>
          !r.domain.includes(cleanTarget) && !cleanTarget.includes(r.domain)
      )
      .slice(0, 10);

    // DB update
    if (trackingId) {
      const existing = await KeywordTracking.findById(trackingId);
      const prevBest = existing?.bestPosition || null;

      // Best position update karo
      let newBest = prevBest;
      if (found?.position) {
        newBest =
          prevBest === null
            ? found.position
            : Math.min(prevBest, found.position);
      }

      // Position change calculate karo
      const prevPosition = existing?.currentPosition || null;
      const positionChange =
        prevPosition && found?.position
          ? prevPosition - found.position // positive = improved
          : 0;

      await KeywordTracking.findByIdAndUpdate(trackingId, {
        status: found ? "completed" : "not_ranked",
        currentPosition: found?.position || null,
        currentPage: found?.page || null,
        bestPosition: newBest,
        positionChange,
        lastChecked: new Date(),
        competitors,
      });
    }

    return {
      success: true,
      data: {
        keyword,
        targetDomain,
        position: found?.position || null,
        page: found?.page || null,
        title: found?.title || "",
        snippet: found?.snippet || "",
        competitors,
        totalResultsScanned: allResults.length,
      },
    };
  } catch (error) {
    console.error("Rank check error:", error.message);

    if (trackingId) {
      await KeywordTracking.findByIdAndUpdate(trackingId, {
        status: "failed",
        lastChecked: new Date(),
      });
    }

    return {
      success: false,
      error: error.message,
    };
  }
}