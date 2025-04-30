"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDatabase = initializeDatabase;
exports.getDb = getDb;
exports.closeDatabase = closeDatabase;
// src/db.ts
const sqlite3_1 = __importDefault(require("sqlite3"));
let dbInstance = null;
function initializeDatabase() {
    return new Promise((resolve, reject) => {
        if (dbInstance) {
            console.log("Database already initialized.");
            return resolve(dbInstance);
        }
        const dbPath = './database.db';
        console.log(`Attempting to connect to SQLite database at ${dbPath}...`);
        const db = new sqlite3_1.default.Database(dbPath, (err) => {
            if (err) {
                console.error('Error opening database', err.message);
                return reject(err);
            }
            console.log(`Connected to the SQLite database at ${dbPath}.`);
            db.run(`CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT UNIQUE NOT NULL COLLATE NOCASE,
                        password TEXT NOT NULL,
                        color TEXT NOT NULL
                    )`, (tableErr) => {
                if (tableErr) {
                    console.error('Error creating users table', tableErr.message);
                    db.close((closeErr) => {
                        if (closeErr)
                            console.error('Error closing DB after table creation failure:', closeErr.message);
                    });
                    return reject(tableErr);
                }
                console.log('Users table ready.');
                dbInstance = db; // Store the instance
                resolve(db);
            });
        });
    });
}
// Function to get the initialized DB instance
// Ensures initializeDatabase is called first elsewhere
function getDb() {
    if (!dbInstance) {
        throw new Error("Database has not been initialized. Call initializeDatabase first.");
    }
    return dbInstance;
}
// Function to close the database connection (for graceful shutdown)
function closeDatabase() {
    return new Promise((resolve, reject) => {
        const db = getDb(); // Get the instance
        if (db) {
            db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err.message);
                    return reject(err);
                }
                console.log('Database connection closed.');
                dbInstance = null; // Clear the instance
                resolve();
            });
        }
        else {
            resolve(); // Already closed or never opened
        }
    });
}
