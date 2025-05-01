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
// src/server/index.ts
require("dotenv/config");
// --- CHANGE: Import http instead of https ---
const http_1 = __importDefault(require("http"));
// --- REMOVE: fs and path for certs (if not needed elsewhere) ---
// import fs from 'fs';
// import path from 'path';
// -------------------------------------------
const server_1 = require("./server");
const websocket_1 = require("./websocket");
const db_1 = require("./db");
const os_1 = __importDefault(require("os")); // Import os directly
function startServer() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Starting application...");
        try {
            console.log("Initializing database...");
            yield (0, db_1.initializeDatabase)();
            console.log("Database initialized successfully.");
            // --- REMOVE: SSL Certificate Loading ---
            /*
            const certFileName = process.env.SSL_CERT_FILE || 'localhost+3.pem';
            const keyFileName = process.env.SSL_KEY_FILE || 'localhost+3-key.pem';
            const certPath = path.resolve(__dirname, '..', '..', certFileName);
            const keyPath = path.resolve(__dirname, '..', '..', keyFileName);
            let credentials;
            try {
                console.log(`Attempting to load SSL key from: ${keyPath}`);
                console.log(`Attempting to load SSL certificate from: ${certPath}`);
                credentials = {
                    key: fs.readFileSync(keyPath),
                    cert: fs.readFileSync(certPath)
                };
                console.log(`SSL certificates ('${keyFileName}', '${certFileName}') loaded successfully.`);
            } catch (err) {
                console.error("---------------------------------------------------------");
                console.error("ERROR: Could not load SSL certificates.");
                if (err instanceof Error) {
                    console.error(`Reason: ${err.message}`);
                } else {
                    console.error(err);
                }
                console.error("---------------------------------------------------------");
                console.error(`Expected key path: ${keyPath}`);
                console.error(`Expected cert path: ${certPath}`);
                console.error("Ensure the files exist at these locations (project root) and the server has read permissions.");
                process.exit(1);
            }
            */
            // ------------------------------------
            const app = (0, server_1.createExpressApp)();
            // --- CHANGE: Create HTTP server ---
            // Pass only the app, no credentials
            const server = http_1.default.createServer(app);
            // ----------------------------------
            const wss = (0, websocket_1.setupWebSocket)(server); // Pass the HTTP server
            server.listen({ port: server_1.PORT, host: '0.0.0.0' }, () => {
                // --- CHANGE: Update console logs for HTTP ---
                console.log(`🚀 Server listening on port ${server_1.PORT}`);
                console.log(`   - Local:            http://localhost:${server_1.PORT}`);
                const networkInterfaces = os_1.default.networkInterfaces();
                let localIp = '<YOUR_LOCAL_IP_ADDRESS>';
                for (const name of Object.keys(networkInterfaces)) {
                    for (const net of networkInterfaces[name]) {
                        if (net.family === 'IPv4' && !net.internal) {
                            localIp = net.address;
                            break;
                        }
                    }
                    if (localIp !== '<YOUR_LOCAL_IP_ADDRESS>')
                        break;
                }
                console.log(`   - On Your Network:  http://${localIp}:${server_1.PORT} (IP may vary)`);
                // ------------------------------------------
            });
            // --- Graceful Shutdown Handling (Adjust server variable name if needed) ---
            const signals = ['SIGINT', 'SIGTERM'];
            signals.forEach(signal => {
                process.on(signal, () => __awaiter(this, void 0, void 0, function* () {
                    console.log(`\n👋 Received ${signal}, shutting down gracefully...`);
                    try {
                        yield (0, websocket_1.closeWebSocketServer)();
                        console.log("   - WebSocket server closed.");
                        // --- CHANGE: Close HTTP server ---
                        yield new Promise((resolve, reject) => {
                            server.close((err) => {
                                if (err) {
                                    console.error("   - Error closing HTTP server:", err);
                                    return reject(err);
                                }
                                console.log('   - HTTP server closed.');
                                resolve();
                            });
                        });
                        // ---------------------------------
                        yield (0, db_1.closeDatabase)();
                        console.log("   - Database connection closed.");
                        console.log("   - Shutdown complete.");
                        process.exit(0);
                    }
                    catch (err) {
                        console.error("   - Error during shutdown:", err);
                        process.exit(1);
                    }
                }));
            });
        }
        catch (startupError) {
            console.error("💥 Failed during server startup:", startupError);
            process.exit(1);
        }
    });
}
startServer();
