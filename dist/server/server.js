"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PORT = void 0;
exports.createExpressApp = createExpressApp;
// src/server.ts
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
// No need to import http or https here, that's handled in index.ts
const helmet_1 = __importDefault(require("helmet")); // <-- Import helmet
// Import routes and middleware
const auth_1 = __importDefault(require("./routes/auth"));
const authMiddleware_1 = require("./middleware/authMiddleware");
// --- Define PORT (Exported for use in index.ts) ---
// Ensure PORT is treated as a number
const portFromEnv = process.env.PORT ? parseInt(process.env.PORT, 10) : undefined;
// Validate the parsed number, default to 3000 if invalid or not provided
exports.PORT = (portFromEnv !== undefined && !isNaN(portFromEnv)) ? portFromEnv : 3000;
function createExpressApp() {
    const app = (0, express_1.default)();
    // --- Define your server's actual local IP ---
    // Use environment variable or fallback (ensure fallback is correct for your network)
    // This is used in CSP rules below.
    const SERVER_LOCAL_IP = process.env.LOCAL_IP || '192.168.0.37'; // <-- UPDATE FALLBACK IF NEEDED
    console.log("Configuring Express app...");
    // --- Express Middleware ---
    // Configure Helmet specifically for HTTPS and local development needs
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: {
            directives: Object.assign(Object.assign({}, helmet_1.default.contentSecurityPolicy.getDefaultDirectives()), { 
                // --- Update form-action for HTTPS ---
                "form-action": [
                    "'self'", // Allow forms to submit to the same origin
                    `https://${SERVER_LOCAL_IP}:${exports.PORT}` // <-- Use https:// with specific IP:PORT
                ], 
                // --- Update connect-src for WSS (Secure WebSockets) ---
                "connect-src": [
                    "'self'", // Allow connections to the same origin
                    `wss://localhost:${exports.PORT}`, // <-- Use wss:// for localhost
                    `wss://${SERVER_LOCAL_IP}:${exports.PORT}`, // <-- Use wss:// for specific IP
                ], 
                // Allow loading scripts from self and unpkg (for Three.js modules)
                "script-src": ["'self'", "https://unpkg.com", "'unsafe-inline'"], 
                // Allow loading styles from self and inline styles (check if 'unsafe-inline' is truly needed)
                "style-src": ["'self'", "'unsafe-inline'"], 
                // Allow images from self and data URIs (for canvas textures etc.)
                "img-src": ["'self'", "data:"], 
                // --- IMPORTANT: Add upgrade-insecure-requests for HTTPS ---
                // Tells browsers to try and upgrade any insecure (HTTP) requests for resources
                // on this domain to HTTPS automatically.
                "upgrade-insecure-requests": [] }),
        },
        // --- HSTS (HTTP Strict Transport Security) ---
        // Tells browsers that support it to *only* communicate with your site using HTTPS
        // for the specified 'maxAge'. Enable cautiously during local dev if you might switch
        // back to HTTP frequently, but definitely enable for production.
        // The default maxAge is 180 days if you just use `helmet.hsts()`.
        hsts: {
            maxAge: 31536000, // 1 year in seconds (a common production value)
            includeSubDomains: true, // Apply HSTS to subdomains as well
            preload: false // Optional: Set to true if you plan to submit your domain to HSTS preload lists
        }
        // If you want to disable HSTS during local dev (e.g., if switching often):
        // hsts: false,
    }));
    app.use(express_1.default.json()); // For parsing application/json
    app.use(express_1.default.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded
    // --- Express API Routes ---
    console.log("Setting up API routes...");
    app.get('/api/ping', (req, res) => {
        res.json({ message: 'pong' });
    });
    app.use('/api/auth', auth_1.default);
    app.get('/api/game/data', authMiddleware_1.protect, (req, res) => {
        var _a, _b, _c, _d;
        // Added nullish coalescing for safety, though 'protect' should ensure req.user exists
        res.json({
            message: `Protected data for ${(_b = (_a = req.user) === null || _a === void 0 ? void 0 : _a.username) !== null && _b !== void 0 ? _b : 'Unknown User'}!`,
            color: (_d = (_c = req.user) === null || _c === void 0 ? void 0 : _c.color) !== null && _d !== void 0 ? _d : '#ffffff' // Provide a default color
        });
    });
    // --- Express Static File Serving ---
    console.log("Setting up static file serving...");
    const publicPath = path_1.default.join(__dirname, '../../public');
    console.log(`Serving static files from: ${publicPath}`);
    // express.static handles serving files like game.html, index.html, game.js, game.css etc.
    app.use(express_1.default.static(publicPath));
    // Explicitly serve index.html for the root path '/'
    // This ensures '/' goes to the login page even if other files exist at the root
    app.get('/', (req, res) => {
        res.sendFile(path_1.default.join(publicPath, 'index.html'));
    });
    // --- Express Error Handling (Keep this last) ---
    console.log("Setting up final error handler...");
    app.use((err, req, res, next) => {
        console.error("Unhandled Error:", err.stack || err);
        // Determine status code
        let statusCode = 500; // Default to internal server error
        // Check for status properties commonly added by error handling middleware or custom errors
        if (typeof err.status === 'number') {
            statusCode = err.status;
        }
        else if (typeof err.statusCode === 'number') {
            statusCode = err.statusCode;
        }
        // Determine message - hide details in production for non-client errors (5xx)
        let message = 'An internal server error occurred.';
        if (process.env.NODE_ENV !== 'production' || statusCode < 500) {
            // Show more details in dev or for client-side errors (4xx)
            message = err.message || message;
        }
        // Ensure response is sent only once
        if (!res.headersSent) {
            res.status(statusCode).json({ message: message });
        }
        else {
            // If headers were already sent, delegate to the default Express error handler
            // This is important for streaming responses or other cases where part of the response was sent
            next(err);
        }
    });
    console.log("Express app configuration complete.");
    return app;
}
// Note: The createHttpServer function is removed as it's no longer needed
// when using https directly in index.ts. If you were planning complex
// HTTP->HTTPS redirection logic, you might keep it, but for simply
// running HTTPS, it's not required here.
