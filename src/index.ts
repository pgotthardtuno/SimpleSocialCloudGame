// src/index.ts
import config from './config'; // Import config first
import { initializeDatabase, closeDatabase } from './db';
import { createExpressApp, createHttpServer } from './server';
import { setupWebSocket, closeWebSocketServer } from './websocket'; // Import setup and close functions

async function startServer() {
    console.log("Starting server initialization...");
    try {
        // 1. Initialize Database
        await initializeDatabase(); // Wait for DB connection

        // 2. Create Express App
        const app = createExpressApp();

        // 3. Create HTTP Server
        const server = createHttpServer(app);

        // 4. Setup WebSocket Server (attaches to HTTP server)
        setupWebSocket(server); // No need to store wss here if closeWebSocketServer gets it internally

        // 5. Start Listening
        server.listen(config.port, () => {
            console.log(`HTTP Server running at http://localhost:${config.port}`);
            console.log(`WebSocket Server attached and listening on port ${config.port}`);
            console.log('Application started successfully. Happy developing ✨');
        });

        // --- Graceful Shutdown ---
        process.on('SIGINT', async () => {
            console.log('\nSIGINT received. Initiating graceful shutdown...');
            try {
                // Close WebSocket server first (allows clients to disconnect cleanly)
                await closeWebSocketServer();

                // Then close HTTP server (stops accepting new connections)
                await new Promise<void>((resolve, reject) => {
                    server.close((err) => {
                        if (err) {
                            console.error('Error closing HTTP server:', err);
                            return reject(err);
                        }
                        console.log('HTTP server closed.');
                        resolve();
                    });
                });

                // Finally, close the database connection
                await closeDatabase();

                console.log("Graceful shutdown complete.");
                process.exit(0);
            } catch (shutdownError) {
                console.error("Error during graceful shutdown:", shutdownError);
                process.exit(1); // Exit with error code if shutdown fails
            }
        });

    } catch (error) {
        console.error("Fatal error during server startup:", error);
        process.exit(1);
    }
}

// --- Run the Server ---
startServer();

// No need to export db or clients from here anymore
// They are managed within their respective modules