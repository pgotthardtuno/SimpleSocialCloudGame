// src/config.ts
import dotenv from 'dotenv';
dotenv.config(); // Load .env file

const port = process.env.PORT || 3000;
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
    console.error("FATAL ERROR: JWT_SECRET is not defined in environment variables.");
    process.exit(1);
}

export default {
    port,
    jwtSecret,
};