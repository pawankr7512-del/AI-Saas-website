import { chromium } from "playwright-core";
import Browserbase from "@browserbasehq/sdk";
import KeywordTracking from "../models/keywordTracking.js";

const bb = new Browserbase({
  apiKey: process.env.BROWSERBASE_API_KEY,
});

// Search Google for a Keyword and extract ranking website for a target domain
export async function rankTracker(keyword, targetDomain, trackingId) {
  let browser;

  try {
    // 1. Initialize Browserbase Session & connect playwright
    const session = await bb.sessions.create({
      browserSettings: { blockAds: true },
    });

    browser = await chromium.connectOverCDP(session.connectUrl);

    const context = browser.contexts()[0] || await browser.newContext();
    const page = context.pages()[0] || await context.newPage();

    page.setDefaultNavigationTimeout(45000);

    // 2. Initial Google Visit & Consent Handling
    await page.goto("https://www.google.com", {
      waitUntil: "networkidle",
    });

    try {
      const btn = await page.$(
        'button[id="L2AGLb"], form[action*="consent"] button'
      );

      if (btn) {
        await btn.click();
        await page.waitForTimeout(1500);
      }
    } catch {}

    let found = null;
    let allResults = [];

    const cleanTarget = targetDomain.replace("www.", "").toLowerCase();

    // 3. Search Loop: Iterate through up to 5 pages
    for (let gPage = 0; gPage < 5; gPage++) {
      await page.goto(
        `https://www.google.com/search?q=${encodeURIComponent(
          keyword
        )}&start=${gPage * 10}&num=10&hl=en&gl=us`,
        { waitUntil: "networkidle" }
      );

      let pageResults = [];

      for (let retry = 0; retry < 3; retry++) {
        try {
          await page.waitForSelector("h3", { timeout: 8000 });
          await page.waitForTimeout(1500);

          pageResults = await page.evaluate(() =>
            Array.from(document.querySelectorAll("h3"))
              .map((h3) => {
                let a = h3.closest("a");

                if (!a) {
                  let p = h3.parentElement;

                  for (let j = 0; j < 5 && p; j++, p = p.parentElement) {
                    if (p.tagName === "A") {
                      a = p;
                      break;
                    }

                    const sub = p.querySelector("a[href]");
                    if (sub && sub.contains(h3)) {
                      a = sub;
                      break;
                    }
                  }
                }

                if (
                  !a ||
                  !a.href.startsWith("http") ||
                  a.href.includes("google.")
                )
                  return null;

                let s = "";
                let c = a.parentElement;

                for (let j = 0; j < 6 && c; j++, c = c.parentElement) {
                  const txt = c.innerText || "";

                  if (txt.length > h3.innerText.length + 50) {
                    s =
                      (
                        txt
                          .split("\n")
                          .find(
                            (l) =>
                              l.length > 30 &&
                              !l.includes(h3.innerText.substring(0, 20))
                          ) || ""
                      )
                        .trim()
                        .substring(0, 300);

                    if (s) break;
                  }
                }

                return {
                  url: a.href,
                  domain: new URL(a.href).hostname.replace("www.", ""),
                  title: h3.innerText.trim(),
                  snippet: s,
                };
              })
              .filter(Boolean)
          );

          if (pageResults.length > 0) break;
          await page.reload({ waitUntil: "networkidle" });
        } catch {
          await page.reload({ waitUntil: "networkidle" });
        }
      }

      if (!pageResults.length) break;

      for (const r of pageResults) {
        r.position = allResults.length + 1;
        allResults.push(r);

        if (
          !found &&
          (r.domain.toLowerCase().includes(cleanTarget) ||
            cleanTarget.includes(r.domain.toLowerCase()))
        ) {
          found = { ...r, page: gPage + 1 };
        }
      }

      if (found) break;

      await page.waitForTimeout(2000 + Math.random() * 2000);
    }

    await browser.close();

    const competitors = allResults
      .filter(
        (r) =>
          !r.domain.toLowerCase().includes(cleanTarget) &&
          !cleanTarget.includes(r.domain.toLowerCase())
      )
      .slice(0, 10);

    // =========================
    // ✅ ADDED FIX: DB UPDATE (IMPORTANT)
    // =========================
    if (trackingId) {
      await KeywordTracking.findByIdAndUpdate(trackingId, {
        status: found ? "completed" : "failed",
        currentPosition: found?.position || null,
        currentPage: found?.page || null,
        bestPosition: found?.position || null,
        lastChecked: new Date(),
        competitors: competitors || []
      });
    }

    // ✅ SUCCESS RESPONSE
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

    try {
      await browser?.close();
    } catch {}

    // =========================
    // ✅ ADDED FIX: SAFE FAILURE UPDATE
    // =========================
    if (trackingId) {
      await KeywordTracking.findByIdAndUpdate(trackingId, {
        status: "failed",
        lastChecked: new Date()
      });
    }

    return {
      success: false,
      error: error.message,
    };
  }
}