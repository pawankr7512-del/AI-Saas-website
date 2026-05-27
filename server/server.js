import express from "express";
import cors from "cors";
import "dotenv/config";
import connectDB from "./config/db.js";
import authRouter from "./routes/authRoutes.js";
import rankRouter from "./routes/rankRoutes.js";
import analysisRouter from "./routes/analysisRoutes.js";
import { startRankTrackingCron } from "./cron/rankTrackingCron.js";
 
connectDB();
 
const app = express();
 
app.use(cors({
  origin: function(origin, callback) {
    // Allow all vercel.app domains + localhost
    if (!origin || origin.includes('vercel.app') || origin.includes('localhost')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
 
app.use(express.json());
 
app.get("/", (req, res) => res.send("Server is running"));
app.use("/api/auth", authRouter);
app.use("/api/rank", rankRouter);
app.use("/api/analysis", analysisRouter);
 
// START CRON JOBS
startRankTrackingCron();
 
const PORT = process.env.PORT || 5000;
 
app.listen(PORT, () =>
    console.log(`Server running on port ${PORT}`)
);