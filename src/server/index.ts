// src/server/index.ts
import 'dotenv/config';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { createExpressApp, PORT } from './server'; // Assuming server.ts exports PORT
import { setupWebSocket, closeWebSocketServer } from './websocket';
import { initializeDatabase, closeDatabase } from './db';

async function startServer() {
    console.log("Starting application...");

    try { // Wrap startup in a try block
        // --- Initialize Database FIRST ---
        console.log("Initializing database...");
        await initializeDatabase(); // Await the database initialization
        console.log("Database initialized successfully.");

        // --- Load SSL Certificates ---
        const certFileName = process.env.SSL_CERT_FILE || 'localhost+3.pem';
        const keyFileName = process.env.SSL_KEY_FILE || 'localhost+3-key.pem';

        // Corrected path: Go up TWO levels from dist/server to reach the project root
        const certPath = path.resolve(__dirname, '..', '..', certFileName);
        const keyPath = path.resolve(__dirname, '..', '..', keyFileName);

        let credentials;
        try {
            console.log(`Attempting to load SSL key from: ${keyPath}`); // Log path
            console.log(`Attempting to load SSL certificate from: ${certPath}`); // Log path

            credentials = {
                key: fs.readFileSync(keyPath),
                cert: fs.readFileSync(certPath)
            };
            console.log(`SSL certificates ('${keyFileName}', '${certFileName}') loaded successfully.`);
        } catch (err) {
            console.error("---------------------------------------------------------");
            console.error("ERROR: Could not load SSL certificates.");
            // Log the specific error message from fs.readFileSync
            if (err instanceof Error) {
                console.error(`Reason: ${err.message}`); // More specific error
            } else {
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
        const app = createExpressApp();

        // 2. Create the HTTPS Server
        const server = https.createServer(credentials, app);

        // 3. Setup the WebSocket Server, passing the HTTPS server instance
        const wss = setupWebSocket(server);

        // 4. Start listening ONLY AFTER database is ready
        server.listen({ port: PORT, host: '0.0.0.0' }, () => { // Listen on all interfaces
            console.log(`🚀 Server listening securely on port ${PORT}`);
            console.log(`   - Local:            https://localhost:${PORT}`);
            // Dynamically get local IP or provide clearer instruction
            const networkInterfaces = require('os').networkInterfaces();
            let localIp = '<YOUR_LOCAL_IP_ADDRESS>'; // Default placeholder
            // Simple attempt to find a non-internal IPv4 address
            for (const name of Object.keys(networkInterfaces)) {
                for (const net of networkInterfaces[name]!) {
                    if (net.family === 'IPv4' && !net.internal) {
                        localIp = net.address;
                        break;
                    }
                }
                if (localIp !== '<YOUR_LOCAL_IP_ADDRESS>') break;
            }
            console.log(`   - On Your Network:  https://${localIp}:${PORT} (IP may vary)`);
            console.log("   (You'll likely need to accept browser security warnings for self-signed certs)");
        });

        // --- Graceful Shutdown Handling ---
        const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
        signals.forEach(signal => {
            process.on(signal, async () => {
                console.log(`\n👋 Received ${signal}, shutting down gracefully...`);
                try {
                    // Close WebSocket connections first
                    await closeWebSocketServer();
                    console.log("   - WebSocket server closed.");

                    // Then close the HTTPS server
                    await new Promise<void>((resolve, reject) => { // Wrap server.close in a promise
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
                    await closeDatabase(); // Close DB connection on shutdown
                    console.log("   - Database connection closed.");

                    console.log("   - Shutdown complete.");
                    process.exit(0); // Exit cleanly

                } catch (err) {
                    console.error("   - Error during shutdown:", err);
                    process.exit(1); // Exit with error code if shutdown fails
                }
            });
        });

    } catch (startupError) { // Catch errors during database initialization or other early steps
        console.error("💥 Failed during server startup:", startupError);
        process.exit(1); // Exit if startup fails
    }
}

// --- Run the server ---
startServer(); // Removed the extra .catch here as the try/catch inside handles it
