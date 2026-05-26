import User from "../models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";


// Generate JWT Token
const generateToken = (id) => {
    return jwt.sign(
        { id },
        process.env.JWT_SECRET,
        { expiresIn: "30d" }
    );
};



// Register User
export const register = async (req, res) => {

    try {

        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "User already exists"
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(
            password,
            await bcrypt.genSalt(10)
        );

        // Create User
        const user = await User.create({
            name,
            email,
            password: hashedPassword
        });

        // Generate token
        const token = generateToken(user._id);

        // Send response
        res.status(201).json({
            success: true,
            token,
            user
        });

    } catch (error) {

    console.log(error);

    res.status(500).json({
        success: false,
        message: error.message
    });
}
};




// Login User
export const login = async (req, res) => {

    try {

        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        // Find user
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Invalid Credentials"
            });
        }

        // Check password
        const isMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: "Invalid Credentials"
            });
        }

        // Generate token
        const token = generateToken(user._id);

        // Send response
        res.status(200).json({
            success: true,
            token,
            user
        });

    } catch (error) {

        console.error("Login error:", error.message);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};




// Get Current User
export const getUser = async (req, res) => {

    try {

        const user = await User
            .findById(req.userID)
            .select("-password");

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "User not found"
            });
        }

        res.json({
            success: true,
            user
        });

    } catch (error) {

        console.error("Get user error:", error.message);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};