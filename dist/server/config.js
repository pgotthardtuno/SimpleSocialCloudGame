"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/config.ts
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config(); // Load .env file
const port = process.env.PORT || 3000;
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
    console.error("FATAL ERROR: JWT_SECRET is not defined in environment variables.");
    process.exit(1);
}
exports.default = {
    port,
    jwtSecret,
};
