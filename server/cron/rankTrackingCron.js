import cron from "node-cron";
import KeywordTracking from "../models/keywordTracking.js";
import { rankTracker } from "../services/rankTrackerService.js";

export function startRankTrackingCron() {
    cron.schedule("0 6 * * *", async () => {
        console.log("Starting daily rank tracking job...");
        try {
            const activeTrackings = await KeywordTracking.find({ active: true });
            for (const tracking of activeTrackings) {
             tracking.status = "checking";
                await tracking.save()

                const result = await rankTracker(tracking.keyword, tracking.domain, tracking._id)
                // Delay between checks to avoid rate limiting
                await new Promise((r)=>setTimeout(r, 10000 + Math.random() * 50000));
            }

        } catch (error) {
            console.error("[CRON] Rank tracking cron error:", error.message);        
        }

    })
    console.log("Rank tracking cron job scheduled")
}