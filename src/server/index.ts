// src/server/index.ts
import 'dotenv/config';
// import https from 'https'; // REMOVE
import http from 'http'; // ADD
// import fs from 'fs'; // REMOVE
// import path from 'path'; // REMOVE (if only used for cert paths)
import { createExpressApp, PORT } from './server';
import { setupWebSocket, closeWebSocketServer } from './websocket';
import { initializeDatabase, closeDatabase } from './db';
import os from 'os';

async function startServer() {
    console.log("Starting application...");

    try {
        console.log("Initializing database...");
        await initializeDatabase();
        console.log("Database initialized successfully.");

        // --- REMOVE Self-Signed SSL Certificate Loading ---
        /*
        // ... (Commented out SSL certificate loading code) ...
        */
        // ------------------------------------

        const app = createExpressApp();

        // --- Create HTTP server --- CHANGE HERE
        // const server = https.createServer(credentials, app); // REMOVE
        const server = http.createServer(app); // ADD - Correctly using HTTP
        // ----------------------------------

        const wss = setupWebSocket(server); // Pass the HTTP server

        server.listen({ port: PORT, host: '0.0.0.0' }, () => { // Listen on all interfaces
            // console.log(`🚀 Server listening securely on port ${PORT} using self-signed certs`); // REMOVE
            console.log(`🚀 Server listening on HTTP port ${PORT}`); // ADD - Correct log message
            console.log(`   - Local (for Nginx proxy): http://localhost:${PORT}`); // CHANGE TO HTTP
            // Log network interfaces (optional but helpful)
            const interfaces = os.networkInterfaces();
            Object.keys(interfaces).forEach(ifaceName => {
                interfaces[ifaceName]?.forEach(iface => {
                    if (iface.family === 'IPv4' && !iface.internal) {
                        console.log(`   - Network: http://${iface.address}:${PORT}`);
                    }
                });
            });
        });

        // --- Graceful Shutdown Handling ---
        const signals = { 'SIGINT': 2, 'SIGTERM': 15 };
        let shuttingDown = false;

        Object.keys(signals).forEach((signal) => {
            process.on(signal, async () => {
                if (shuttingDown) return;
                shuttingDown = true;
                console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

                // 1. Close WebSocket Server
                console.log("Closing WebSocket server...");
                await closeWebSocketServer(); // Assuming closeWebSocketServer returns a Promise or handles async ops

                // 2. Close HTTP Server
                console.log("Closing HTTP server...");
                server.close(async (err) => {
                    if (err) {
                        console.error("Error closing HTTP server:", err);
                    } else {
                        console.log("HTTP server closed.");
                    }

                    // 3. Close Database Connection
                    console.log("Closing database connection...");
                    try {
                        await closeDatabase();
                        console.log("Database connection closed.");
                    } catch (dbErr) {
                        console.error("Error closing database:", dbErr);
                    }

                    // 4. Exit Process
                    console.log("Shutdown complete. Exiting.");
                    process.exit(err ? 1 : 0); // Exit with error code if server closing failed
                });

                // Force exit after a timeout (e.g., 10 seconds) if shutdown hangs
                setTimeout(() => {
                    console.error("Graceful shutdown timed out. Forcing exit.");
                    process.exit(1);
                }, 10000).unref(); // unref() allows the program to exit if shutdown finishes quickly
            });
        });
        // ---------------------------------

    } catch (startupError) {
        console.error("💥 Failed during server startup:", startupError);
        process.exit(1);
    }
}

startServer();