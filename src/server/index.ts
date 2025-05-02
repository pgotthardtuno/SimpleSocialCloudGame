// src/server/index.ts
import 'dotenv/config';
import https from 'https'; // Ensure https is imported
import fs from 'fs';
import path from 'path';
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

        // --- Load Self-Signed SSL Certificates ---
        // Use the same paths as configured in Nginx
        const keyPath = '/etc/ssl/private/nginx-selfsigned.key'; // Or your chosen path
        const certPath = '/etc/ssl/certs/nginx-selfsigned.crt'; // Or your chosen path

        let credentials;
        try {
            console.log(`Attempting to load SSL key from: ${keyPath}`);
            console.log(`Attempting to load SSL certificate from: ${certPath}`);
            credentials = {
                key: fs.readFileSync(keyPath),
                cert: fs.readFileSync(certPath)
            };
            console.log(`Self-signed SSL certificates loaded successfully.`);
        } catch (err) {
            console.error("---------------------------------------------------------");
            console.error("ERROR: Could not load SSL certificates for Node.js server.");
            // ... (keep existing error logging) ...
            process.exit(1);
        }
        // ------------------------------------

        const app = createExpressApp();

        // --- Create HTTPS server ---
        const server = https.createServer(credentials, app);
        // ----------------------------------

        const wss = setupWebSocket(server); // Pass the HTTPS server

        server.listen({ port: PORT, host: '0.0.0.0' }, () => { // Listen on all interfaces
            console.log(`🚀 Server listening securely on port ${PORT} using self-signed certs`);
            console.log(`   - Local (for Nginx proxy): https://localhost:${PORT}`);
            // ... (rest of the IP logging) ...
        });

        // --- Graceful Shutdown Handling (remains the same) ---
        // ...

    } catch (startupError) {
        console.error("💥 Failed during server startup:", startupError);
        process.exit(1);
    }
}

startServer();