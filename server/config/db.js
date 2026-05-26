import mongoose from "mongoose";

// Support multiple env var names and make connection safe for serverless
const connectDB = async () => {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

    if (!uri) {
        console.warn("MONGODB_URI not set — skipping MongoDB connection. Set MONGODB_URI in environment.");
        return;
    }

    try {
        // Avoid multiple connections in serverless environments
        if (mongoose.connection.readyState === 1) {
            console.log("MongoDB already connected");
            return;
        }

        mongoose.connection.on("connected", () => console.log("MongoDB connected"));
        mongoose.connection.on("error", (err) => console.error("MongoDB connection error:", err.message));

        await mongoose.connect(uri, {
            // recommended options
            // useNewUrlParser and useUnifiedTopology are default in mongoose v6+
        });
    } catch (error) {
        console.error("Failed to connect to MongoDB:", error?.message || error);
        // Do not throw — allow the server to start and handle DB absence gracefully
    }
};

export default connectDB;