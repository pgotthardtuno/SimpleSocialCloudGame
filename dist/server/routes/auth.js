"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/auth.ts
const express_1 = __importDefault(require("express"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("../db"); // Ensure this path is correct based on your structure
const router = express_1.default.Router();
const saltRounds = 10; // Consider making this configurable
const jwtSecret = process.env.JWT_SECRET; // Loaded via dotenv in index.ts or config.ts
// --- JWT Secret Check (Essential Startup Check) ---
// This check should ideally happen once at application startup (e.g., in config.ts or index.ts)
// but keeping it here ensures this module won't run without it.
if (!jwtSecret) {
    console.error("FATAL ERROR: JWT_SECRET is not defined in environment variables.");
    // Throwing an error here is better than process.exit if this module is imported early
    throw new Error("FATAL ERROR: JWT_SECRET is not defined.");
    // process.exit(1); // Or keep process.exit if this is acceptable during import
}
// --- Promise-based Database Helpers ---
// Custom error class for database issues
class DatabaseQueryError extends Error {
    constructor(message) {
        super(message);
        this.name = "DatabaseQueryError";
    }
}
// Utility to promisify db.get
function dbGet(sql, params) {
    return new Promise((resolve, reject) => {
        // Get the DB instance each time, ensures it's initialized
        const db = (0, db_1.getDb)();
        db.get(sql, params, (err, row) => {
            if (err) {
                console.error("Database GET error:", err.message, "SQL:", sql, "Params:", params);
                reject(new DatabaseQueryError(`Database query failed: ${err.message}`));
            }
            else {
                resolve(row);
            }
        });
    });
}
// Utility to promisify db.run
function dbRun(sql, params) {
    return new Promise((resolve, reject) => {
        // Get the DB instance each time
        const db = (0, db_1.getDb)();
        // Use function() to access SQLite's 'this' context for lastID/changes
        db.run(sql, params, function (err) {
            if (err) {
                console.error("Database RUN error:", err.message, "SQL:", sql, "Params:", params);
                reject(new DatabaseQueryError(`Database execution failed: ${err.message}`));
            }
            else {
                // 'this' refers to the statement object from sqlite3
                resolve({ lastID: this.lastID, changes: this.changes });
            }
        });
    });
}
// --- Registration Route ---
router.post('/register', (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password, color } = req.body;
    // Basic Input Validation
    if (!username || !password || !color) {
        res.status(400).json({ message: 'Username, password, and color are required.' });
        return; // Stop execution
    }
    if (typeof username !== 'string' || typeof password !== 'string' || typeof color !== 'string') {
        res.status(400).json({ message: 'Invalid input types.' });
        return;
    }
    // Consider adding length checks for username/password
    const validColors = ["red", "orange", "yellow", "green", "blue", "indigo", "violet"];
    const lowerCaseColor = color.toLowerCase();
    if (!validColors.includes(lowerCaseColor)) {
        res.status(400).json({ message: `Invalid color selected. Choose from: ${validColors.join(', ')}` });
        return;
    }
    try {
        // 1. Check if username already exists (Case-Insensitive)
        const checkUserSql = `SELECT id FROM users WHERE username = ? COLLATE NOCASE`;
        const existingUser = yield dbGet(checkUserSql, [username]);
        if (existingUser) {
            res.status(409).json({ message: 'Username already exists.' });
            return;
        }
        // 2. Hash the password
        const hashedPassword = yield bcrypt_1.default.hash(password, saltRounds);
        // 3. Insert new user
        const insertSql = `INSERT INTO users (username, password, color) VALUES (?, ?, ?)`;
        const result = yield dbRun(insertSql, [username, hashedPassword, lowerCaseColor]); // Store lowercase color
        console.log(`User ${username} registered with ID: ${result.lastID}`);
        res.status(201).json({ message: 'User registered successfully!' });
    }
    catch (error) {
        // 4. Pass errors to the central error handler
        console.error("Error during registration:", error);
        next(error); // Forward the error
    }
}));
// --- Login Route ---
router.post('/login', (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password } = req.body;
    // Basic Input Validation
    if (!username || !password) {
        res.status(400).json({ message: 'Username and password are required.' });
        return;
    }
    if (typeof username !== 'string' || typeof password !== 'string') {
        res.status(400).json({ message: 'Invalid input types.' });
        return;
    }
    try {
        // 1. Find user by username (Case-Insensitive)
        const sql = `SELECT id, username, password, color FROM users WHERE username = ? COLLATE NOCASE`;
        const user = yield dbGet(sql, [username]);
        // 2. Check if user exists and password hash was retrieved
        if (!user || !user.password) {
            // Use a generic message to avoid revealing if username exists
            res.status(401).json({ message: 'Invalid username or password.' });
            return;
        }
        // 3. Compare submitted password with stored hash
        const match = yield bcrypt_1.default.compare(password, user.password);
        if (!match) {
            // Same generic message
            res.status(401).json({ message: 'Invalid username or password.' });
            return;
        }
        // 4. Passwords match - Generate JWT
        const payload = {
            userId: user.id,
            username: user.username,
            color: user.color // Use the color retrieved from DB
        };
        // JWT Secret existence is checked at startup, but re-assert for type safety if needed
        // (The initial check should prevent this from ever being null/undefined here)
        // if (!jwtSecret) {
        //     throw new Error("Authentication configuration error during token signing.");
        // }
        const token = jsonwebtoken_1.default.sign(payload, jwtSecret, // Use non-null assertion '!' as we check/throw at the top
        { expiresIn: '12h' } // Token expires in 1 hour - consider making this configurable
        );
        console.log(`User ${user.username} logged in.`); // Log the correct username casing from DB
        // 5. Send response with token and user info (excluding password)
        res.status(200).json({
            message: 'Login successful!',
            token: token,
            user: {
                id: user.id,
                username: user.username,
                color: user.color
            }
        });
    }
    catch (error) {
        // 6. Pass errors to the central error handler
        console.error("Error during login:", error);
        next(error); // Forward the error
    }
}));
exports.default = router;
