import KeywordTracking from "../models/keywordTracking.js";
import { rankTracker } from "../services/rankTrackerService.js";


// Add a keyword to track

export const addKeyword  = async (req, res) => {
    try{
        const {keyword, url} = req.body;

        if(!keyword || !url) return res.status(400).json({ success: false, message: "keyword and URL are required" });

        // Extract domain from URL
        let domain;
        try{
            const urlObj = new URL(url.startsWith("http") ? url : `https://${url}`);
            domain = urlObj.hostname.replace("www.", "");
        } catch {
            return res.status(400).json({ success: false, message: "Invalid URL format" });
        }

        // Check if already tracking this keyword + domain
        const existing = await KeywordTracking.findOne({
            userID: req.userID,
            keyword: keyword.toLowerCase().trim(),
            domain
        });

         if(existing){
            return res.status(400).json({success: false, message: "Already tracking this keyword for this domain"});
         }

        // Create tracking entry
        const tracking = await KeywordTracking.create({
            userID: req.userID,
            keyword: keyword.toLowerCase().trim(),
            url: url.startsWith("http") ? url : `https://${url}`,
            domain,
            status: "checking"
        });

        res.status(201).json({ success: true, message: "Keyword tracking started", tracking});
       rankTracker(tracking.keyword, tracking.domain, tracking._id);

    } catch (error){
        console.error("add keyword error:", error.message);

        if(error.code === 11000){
            return res.status(400).json({ success: false, message: "already tracking this keyword"});
        }

        res.status(500).json({ success: false, message: "server error"});
    }
}


// get all tracked keyword for user
export const getKeywords = async (req,res) => {
    try{
        const keywords = await KeywordTracking.find({ userID: req.userID })
            .sort({ createdAt: -1 })
            .select("-rankHistory");

        res.json({ success: true, keywords });

    } catch (error) {
        console.error("get keyword error:", error.message);
        res.status(500).json({ success: false, message: "server error"});
    }
}


// get single keyword with full history
export const getKeyword = async (req,res) => {
    try{
        const tracking = await KeywordTracking.findOne({
            _id: req.params.id,
            userID: req.userID
        });

        if(!tracking){
            return res.status(404).json({
                success: false,
                message: "keyword tracking not found"
            });
        }

        res.json({ success: true, tracking });

    } catch (error) {
        console.error("Get keyword error:", error.message);
        res.status(500).json({ success: false, message: "server error"});
    }

}


// manually refresh a keyword ranking
export const refreshKeyword = async (req ,res) => {
    try{

        const tracking = await KeywordTracking.findOne({
            _id: req.params.id,
            userID: req.userID
        });

        if(!tracking){
            return res.status(404).json({
                success: false,
                message: "keyword tracking not found"
            });
        }

        tracking.status = "checking";

        await tracking.save();

        res.json({ success: true, message: "Rank check started" });

       rankTracker(tracking.keyword, tracking.domain, tracking._id);

    } catch (error) {
        console.error("Refresh keyword error:", error.message);
        res.status(500).json({ success: false, message: "server error"});
    }

}



// Delete Keyword tracking
export const deleteKeyword = async (req, res) => {

    try{

        const tracking = await KeywordTracking.findOneAndDelete({
            _id: req.params.id,
            userID: req.userID
        });

        if(!tracking){
            return res.status(404).json({
                success: false,
                message: "keyword tracking not found"
            });
        }

        res.json({ success: true, message: "keyword tracking deleted" });

    } catch (error) {
        console.error("Delete keyword error:", error.message);
        res.status(500).json({ success: false, message: "Server error"});
    }
}



/// Toggle tracking active/inactive

export const toggleTracking = async (req, res) => {

    try{

        const tracking = await KeywordTracking.findOne({
            _id: req.params.id,
            userID: req.userID
        });

        if(!tracking){
            return res.status(404).json({
                success: false,
                message: "keyword tracking not found"
            });
        }

        tracking.active = !tracking.active;

        await tracking.save();

        res.json({ success: true, tracking });

    } catch (error) {
        console.error("Toggle keyword error:", error.message);
        res.status(500).json({ success: false, message: "Server error"});
    }

}