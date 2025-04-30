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
const https_1 = __importDefault(require("https"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const server_1 = require("./server"); // Assuming server.ts exports PORT
const websocket_1 = require("./websocket");
const db_1 = require("./db");
function startServer() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Starting application...");
        try { // Wrap startup in a try block
            // --- Initialize Database FIRST ---
            console.log("Initializing database...");
            yield (0, db_1.initializeDatabase)(); // Await the database initialization
            console.log("Database initialized successfully.");
            // --- Load SSL Certificates ---
            const certFileName = process.env.SSL_CERT_FILE || 'localhost+3.pem';
            const keyFileName = process.env.SSL_KEY_FILE || 'localhost+3-key.pem';
            // Corrected path: Go up TWO levels from dist/server to reach the project root
            const certPath = path_1.default.resolve(__dirname, '..', '..', certFileName);
            const keyPath = path_1.default.resolve(__dirname, '..', '..', keyFileName);
            let credentials;
            try {
                console.log(`Attempting to load SSL key from: ${keyPath}`); // Log path
                console.log(`Attempting to load SSL certificate from: ${certPath}`); // Log path
                credentials = {
                    key: fs_1.default.readFileSync(keyPath),
                    cert: fs_1.default.readFileSync(certPath)
                };
                console.log(`SSL certificates ('${keyFileName}', '${certFileName}') loaded successfully.`);
            }
            catch (err) {
                console.error("---------------------------------------------------------");
                console.error("ERROR: Could not load SSL certificates.");
                // Log the specific error message from fs.readFileSync
                if (err instanceof Error) {
                    console.error(`Reason: ${err.message}`); // More specific error
                }
                else {
                    console.error(err);
                }
                console.error("---------------------------------------------------------");
                console.error(`Expected key path: ${keyPath}`); // Log expected paths
                console.error(`Expected cert path: ${certPath}`);
                console.error("Ensure the files exist at these locations (project root) and the server has read permissions.");
                process.exit(1); // Exit if certificates fail
            }
            // --------------------------
            // 1. Create the Express App
            const app = (0, server_1.createExpressApp)();
            // 2. Create the HTTPS Server
            const server = https_1.default.createServer(credentials, app);
            // 3. Setup the WebSocket Server, passing the HTTPS server instance
            const wss = (0, websocket_1.setupWebSocket)(server);
            // 4. Start listening ONLY AFTER database is ready
            server.listen({ port: server_1.PORT, host: '0.0.0.0' }, () => {
                console.log(`🚀 Server listening securely on port ${server_1.PORT}`);
                console.log(`   - Local:            https://localhost:${server_1.PORT}`);
                // Dynamically get local IP or provide clearer instruction
                const networkInterfaces = require('os').networkInterfaces();
                let localIp = '<YOUR_LOCAL_IP_ADDRESS>'; // Default placeholder
                // Simple attempt to find a non-internal IPv4 address
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
                console.log(`   - On Your Network:  https://${localIp}:${server_1.PORT} (IP may vary)`);
                console.log("   (You'll likely need to accept browser security warnings for self-signed certs)");
            });
            // --- Graceful Shutdown Handling ---
            const signals = ['SIGINT', 'SIGTERM'];
            signals.forEach(signal => {
                process.on(signal, () => __awaiter(this, void 0, void 0, function* () {
                    console.log(`\n👋 Received ${signal}, shutting down gracefully...`);
                    try {
                        // Close WebSocket connections first
                        yield (0, websocket_1.closeWebSocketServer)();
                        console.log("   - WebSocket server closed.");
                        // Then close the HTTPS server
                        yield new Promise((resolve, reject) => {
                            server.close((err) => {
                                if (err) {
                                    console.error("   - Error closing HTTPS server:", err);
                                    return reject(err);
                                }
                                console.log('   - HTTPS server closed.');
                                resolve();
                            });
                        });
                        // Close Database Connection
                        yield (0, db_1.closeDatabase)(); // Close DB connection on shutdown
                        console.log("   - Database connection closed.");
                        console.log("   - Shutdown complete.");
                        process.exit(0); // Exit cleanly
                    }
                    catch (err) {
                        console.error("   - Error during shutdown:", err);
                        process.exit(1); // Exit with error code if shutdown fails
                    }
                }));
            });
        }
        catch (startupError) { // Catch errors during database initialization or other early steps
            console.error("💥 Failed during server startup:", startupError);
            process.exit(1); // Exit if startup fails
        }
    });
}
// --- Run the server ---
startServer(); // Removed the extra .catch here as the try/catch inside handles it
