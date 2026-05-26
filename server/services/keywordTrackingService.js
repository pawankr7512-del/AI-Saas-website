import { rankTracker } from "./rankTrackerService.js";

export async function keywordTracking(tracking) {
  try {
    let result;

    // Try up to 2 times
    for (let attempt = 1; attempt <= 2; attempt++) {
      result = await rankTracker(
        tracking.keyword,
        tracking.domain
      );

      // FIXED: success spelling
      if (result.success && result.data.totalResultsScanned > 0) {
        break;
      }

      if (attempt < 2) {
        await new Promise((r) =>
          setTimeout(r, result.success ? 3000 : 5000)
        );
      }
    }

    // FIXED: success spelling
    if (result.success) {
      const prev = tracking.currentPosition;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Update tracking data
      tracking.currentPosition = result.data.position;
      tracking.currentPage = result.data.page;

      // FIXED: competitors typo
      tracking.competitors = result.data.competitors || [];

      // FIXED: last checked date
      tracking.lastChecked = new Date();

      tracking.status = "completed";

      // Position change
      tracking.positionChange =
        prev && result.data.position
          ? prev - result.data.position
          : 0;

      // Best position update
      if (
        result.data.position &&
        (!tracking.bestPosition ||
          result.data.position < tracking.bestPosition)
      ) {
        tracking.bestPosition = result.data.position;
      }

      // History entry
      const historyEntry = {
        date: today,
        position: result.data.position,
        page: result.data.page,
        title: result.data.title,
        snippet: result.data.snippet,
      };

      // FIXED: rankHistory spelling + toDateString
      const idx = tracking.rankHistory.findIndex(
        (h) =>
          new Date(h.date).toDateString() ===
          today.toDateString()
      );

      // FIXED: variable names
      if (idx >= 0) {
        tracking.rankHistory[idx] = historyEntry;
      } else {
        tracking.rankHistory.push(historyEntry);
      }
    } else {
      tracking.status = "failed";
    }

    await tracking.save();

    return result;
  } catch (error) {
    console.error("Rank update error:", error.message);

    tracking.status = "failed";

    await tracking.save().catch(() => {});

    // FIXED: success spelling
    return {
      success: false,
      error: error.message,
    };
  }
}