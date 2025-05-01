"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PORT = void 0;
exports.createExpressApp = createExpressApp;
// src/server/server.ts
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const helmet_1 = __importDefault(require("helmet"));
const auth_1 = __importDefault(require("./routes/auth"));
const authMiddleware_1 = require("./middleware/authMiddleware");
const portFromEnv = process.env.PORT ? parseInt(process.env.PORT, 10) : undefined;
exports.PORT = (portFromEnv !== undefined && !isNaN(portFromEnv)) ? portFromEnv : 3000;
function createExpressApp() {
    const app = (0, express_1.default)();
    const SERVER_LOCAL_IP = process.env.LOCAL_IP || '192.168.0.37'; // Keep this for potential local IP access
    console.log("Configuring Express app...");
    // --- Adjust Helmet for HTTP ---
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: {
            directives: Object.assign(Object.assign({}, helmet_1.default.contentSecurityPolicy.getDefaultDirectives()), { 
                // --- CHANGE: form-action for HTTP ---
                "form-action": [
                    "'self'", // Allow forms to submit to the same origin
                    `http://${SERVER_LOCAL_IP}:${exports.PORT}` // Use http://
                ], 
                // --- CHANGE: connect-src for WS (WebSockets) ---
                "connect-src": [
                    "'self'",
                    `ws://localhost:${exports.PORT}`, // Use ws:// for localhost
                    `ws://${SERVER_LOCAL_IP}:${exports.PORT}`, // Use ws:// for specific IP
                ], "script-src": ["'self'", "https://unpkg.com", "'unsafe-inline'"], "style-src": ["'self'", "'unsafe-inline'"], "img-src": ["'self'", "data:"] }),
        },
        // --- REMOVE or DISABLE HSTS ---
        hsts: false, // Disable HSTS as it's HTTPS-only
        // -----------------------------
    }));
    // -----------------------------
    app.use(express_1.default.json());
    app.use(express_1.default.urlencoded({ extended: true }));
    console.log("Setting up API routes...");
    app.get('/api/ping', (req, res) => {
        res.json({ message: 'pong' });
    });
    app.use('/api/auth', auth_1.default);
    app.get('/api/game/data', authMiddleware_1.protect, (req, res) => {
        var _a, _b, _c, _d;
        res.json({
            message: `Protected data for ${(_b = (_a = req.user) === null || _a === void 0 ? void 0 : _a.username) !== null && _b !== void 0 ? _b : 'Unknown User'}!`,
            color: (_d = (_c = req.user) === null || _c === void 0 ? void 0 : _c.color) !== null && _d !== void 0 ? _d : '#ffffff'
        });
    });
    console.log("Setting up static file serving...");
    const publicPath = path_1.default.join(__dirname, '../../public');
    console.log(`Serving static files from: ${publicPath}`);
    app.use(express_1.default.static(publicPath));
    app.get('/', (req, res) => {
        res.sendFile(path_1.default.join(publicPath, 'index.html'));
    });
    console.log("Setting up final error handler...");
    app.use((err, req, res, next) => {
        console.error("Unhandled Error:", err.stack || err);
        let statusCode = 500;
        if (typeof err.status === 'number') {
            statusCode = err.status;
        }
        else if (typeof err.statusCode === 'number') {
            statusCode = err.statusCode;
        }
        let message = 'An internal server error occurred.';
        if (process.env.NODE_ENV !== 'production' || statusCode < 500) {
            message = err.message || message;
        }
        if (!res.headersSent) {
            res.status(statusCode).json({ message: message });
        }
        else {
            next(err);
        }
    });
    console.log("Express app configuration complete.");
    return app;
}
