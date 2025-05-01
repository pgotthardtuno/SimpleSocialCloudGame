// src/server/index.ts
import 'dotenv/config';
// --- CHANGE: Import http instead of https ---
import http from 'http';
// --- REMOVE: fs and path for certs (if not needed elsewhere) ---
// import fs from 'fs';
// import path from 'path';
// -------------------------------------------
import { createExpressApp, PORT } from './server';
import { setupWebSocket, closeWebSocketServer } from './websocket';
import { initializeDatabase, closeDatabase } from './db';
import os from 'os'; // Import os directly

async function startServer() {
    console.log("Starting application...");

    try {
        console.log("Initializing database...");
        await initializeDatabase();
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

        const app = createExpressApp();

        // --- CHANGE: Create HTTP server ---
        // Pass only the app, no credentials
        const server = http.createServer(app);
        // ----------------------------------

        const wss = setupWebSocket(server); // Pass the HTTP server

        server.listen({ port: PORT, host: '0.0.0.0' }, () => {
            // --- CHANGE: Update console logs for HTTP ---
            console.log(`🚀 Server listening on port ${PORT}`);
            console.log(`   - Local:            http://localhost:${PORT}`);
            const networkInterfaces = os.networkInterfaces();
            let localIp = '<YOUR_LOCAL_IP_ADDRESS>';
            for (const name of Object.keys(networkInterfaces)) {
                for (const net of networkInterfaces[name]!) {
                    if (net.family === 'IPv4' && !net.internal) {
                        localIp = net.address;
                        break;
                    }
                }
                if (localIp !== '<YOUR_LOCAL_IP_ADDRESS>') break;
            }
            console.log(`   - On Your Network:  http://${localIp}:${PORT} (IP may vary)`);
            // ------------------------------------------
        });

        // --- Graceful Shutdown Handling (Adjust server variable name if needed) ---
        const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
        signals.forEach(signal => {
            process.on(signal, async () => {
                console.log(`\n👋 Received ${signal}, shutting down gracefully...`);
                try {
                    await closeWebSocketServer();
                    console.log("   - WebSocket server closed.");

                    // --- CHANGE: Close HTTP server ---
                    await new Promise<void>((resolve, reject) => {
                        server.close((err) => { // Use the http server variable
                            if (err) {
                                console.error("   - Error closing HTTP server:", err);
                                return reject(err);
                            }
                            console.log('   - HTTP server closed.');
                            resolve();
                        });
                    });
                    // ---------------------------------

                    await closeDatabase();
                    console.log("   - Database connection closed.");

                    console.log("   - Shutdown complete.");
                    process.exit(0);

                } catch (err) {
                    console.error("   - Error during shutdown:", err);
                    process.exit(1);
                }
            });
        });

    } catch (startupError) {
        console.error("💥 Failed during server startup:", startupError);
        process.exit(1);
    }
}

startServer();