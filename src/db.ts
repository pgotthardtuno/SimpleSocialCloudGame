// src/db.ts
import sqlite3 from 'sqlite3';

let dbInstance: sqlite3.Database | null = null;

export function initializeDatabase(): Promise<sqlite3.Database> {
    return new Promise((resolve, reject) => {
        if (dbInstance) {
            console.log("Database already initialized.");
            return resolve(dbInstance);
        }

        const dbPath = './database.db';
        console.log(`Attempting to connect to SQLite database at ${dbPath}...`);
        const db = new sqlite3.Database(dbPath, (err) => {
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
                        if (closeErr) console.error('Error closing DB after table creation failure:', closeErr.message);
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
export function getDb(): sqlite3.Database {
    if (!dbInstance) {
        throw new Error("Database has not been initialized. Call initializeDatabase first.");
    }
    return dbInstance;
}

// Function to close the database connection (for graceful shutdown)
export function closeDatabase(): Promise<void> {
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
        } else {
            resolve(); // Already closed or never opened
        }
    });
}