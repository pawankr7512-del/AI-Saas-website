import mongoose, { Schema } from "mongoose";

const rankEntrySchema = new mongoose.Schema({
    date: { type: Date, required: true }, // FIX: data → date
    position: { type: Number, default: null },
    page: { type: Number, default: null },
    title: { type: String, default: "" },
    snippet: { type: String, default: "" },
}, { _id: false });


const competitorSchema = new mongoose.Schema({
    position: { type: Number, required: true },
    url: { type: String, required: true },
    domain: { type: String, required: true },
    title: { type: String, default: "" },
    snippet: { type: String, default: "" }, // FIX: defaultL → default
}, { _id: false });


const keywordTrackerSchema = new mongoose.Schema({
    userID: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // FIX: added

    keyword: { type: String, required: true, trim: true, lowercase: true },
    url: { type: String, required: true, trim: true },
    domain: { type: String, required: true },

    currentPosition: { type: Number, default: null },
    currentPage: { type: Number, default: null },
    bestPosition: { type: Number, default: null },
    positionChange: { type: Number, default: 0 },

    rankHistory: [rankEntrySchema],
    competitors: [competitorSchema],

    active: { type: Boolean, default: true },

   status: {
  type: String,
  enum: ["pending", "checking", "completed", "failed"],
  default: "pending"
},
}, { timestamps: true });

keywordTrackerSchema.index(
    { userID: 1, keyword: 1, domain: 1 },
    { unique: true }
);

const keywordTracking = mongoose.model("keywordTracking", keywordTrackerSchema);

export default keywordTracking;