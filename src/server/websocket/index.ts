// src/server/websocket/index.ts
import { WebSocketServer, WebSocket } from 'ws';
// import https from 'https'; // Or 'http' if not using SSL (Keep http import below)
import http from 'http'; // Use http since the server itself is http
import url from 'url';
import { handleAuthentication, handlePositionUpdate, handleChatMessage, handleDisconnect, handleError, handlePlayerHit, handleLaserFired } from './handlers';
import { WebSocketClient, removeClient, getClient } from './clients';
// --- Import Match Timer ---
import { startNewMatch, stopMatchTimer } from './match';
// --------------------------

// Define message types (consider moving to a shared types file)
type ClientMessage =
// | { type: 'authenticate'; payload: { token: string } } // If using message-based auth
    | { type: 'player_move'; payload: any }
    | { type: 'chat_message'; payload: any }
    | { type: 'player_hit'; payload: any }
    | { type: 'laser_fired'; payload: any };

let wssInstance: WebSocketServer | null = null;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

// Corrected: 'this' type is WebSocket as expected by ws library's .on('pong', ...)
function heartbeat(this: WebSocket) {
    // Cast 'this' to WebSocketClient to access the custom 'isAlive' property
    (this as WebSocketClient).isAlive = true;
}

export function setupWebSocket(server: http.Server): WebSocketServer { // Use http.Server
    console.log("Setting up WebSocket server...");
    const wss = new WebSocketServer({ server }); // Pass the http server
    wssInstance = wss;

    wss.on('connection', (ws: WebSocket, req) => {
        const client = ws as WebSocketClient;
        // Initialize isAlive on the client object itself when connection is established
        client.isAlive = true;

        // --- Authentication via Query Parameter ---
        const parameters = url.parse(req.url || '', true).query;
        const token = parameters.token as string;

        if (!token) {
            console.log('WebSocket connection attempt without token. Closing.');
            client.terminate();
            return;
        }

        // Authenticate using the token
        // Make sure handleAuthentication initializes client.kills
        handleAuthentication(client, token);
        // If authentication fails, handleAuthentication will terminate the connection

        // --- Heartbeat Setup ---
        // Now the 'this' types match what .on() expects
        client.on('pong', heartbeat);

        // --- Message Handling ---
        client.on('message', (message) => {
            try {
                const parsedMessage = JSON.parse(message.toString()) as ClientMessage;

                // Ensure client is authenticated before processing most messages
                // Simplified check: If userId isn't set, they aren't authenticated yet.
                if (!client.userId) {
                    console.warn("Received message from unauthenticated client:", parsedMessage.type);
                    // Optionally send an error message
                    // client.send(JSON.stringify({ type: 'error', payload: { message: 'Not authenticated' } }));
                    return; // Exit early if not authenticated
                }

                // Optional: Check if client is alive before processing game messages
                // if (!client.isAlive) {
                //     console.warn(`Received message from non-alive client: ${client.userId}`);
                //     return;
                // }

                switch (parsedMessage.type) {
                    // No 'authenticate' case needed here as it's handled on connection
                    case 'player_move':
                        handlePositionUpdate(client, parsedMessage.payload);
                        break;
                    case 'chat_message':
                        handleChatMessage(client, parsedMessage.payload);
                        break;
                    case 'player_hit':
                        handlePlayerHit(client, parsedMessage.payload);
                        break;
                    case 'laser_fired':
                        handleLaserFired(client, parsedMessage.payload);
                        break;
                    default:
                        // Use type assertion for exhaustive check if needed
                        const _exhaustiveCheck: never = parsedMessage;
                        console.warn(`Received unknown message type: ${(_exhaustiveCheck as any).type}`);
                }
            } catch (error) {
                console.error('Failed to process message or invalid JSON:', message.toString(), error);
                // Optionally send an error message back to the client
                // client.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid message format.' } }));
            }
        });

        // --- Error and Close Handling ---
        client.on('error', (error) => {
            handleError(client, error);
            // Cleanup is handled by the 'close' event which is usually triggered after 'error'
        });

        client.on('close', () => {
            // Clear the pong listener when the client disconnects
            client.off('pong', heartbeat);
            handleDisconnect(client); // Handles broadcasting player_left
            // Heartbeat cleanup (termination) is handled by the interval function below
        });
    });

    // --- Heartbeat Interval ---
    const interval = setInterval(() => {
        // Use wss.clients which is a Set<WebSocket>
        wss.clients.forEach((ws) => {
            // Cast to WebSocketClient to check our custom property
            const client = ws as WebSocketClient;

            // Check if the client object exists and if isAlive is false
            if (client.isAlive === false) {
                console.log(`Client ${client.userId || 'unknown'} timed out. Terminating.`);
                // handleDisconnect is called implicitly when client.terminate() triggers the 'close' event
                return client.terminate(); // Terminate the connection
            }

            // Set isAlive to false, expecting a pong response to set it back to true
            client.isAlive = false;
            client.ping(); // Send a ping
        });
    }, HEARTBEAT_INTERVAL);

    wss.on('close', () => {
        console.log("WebSocket server shutting down.");
        clearInterval(interval);
        // --- Stop Match Timer ---
        stopMatchTimer();
        // ------------------------
        wssInstance = null;
    });

    console.log("WebSocket server setup complete.");
    // --- Start First Match ---
    startNewMatch();
    // -------------------------
    return wss;
}

export function closeWebSocketServer(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (wssInstance) {
            console.log("Closing WebSocket server connections...");
            // Stop match timers immediately
            stopMatchTimer();

            // Terminate all client connections gracefully
            wssInstance.clients.forEach(client => {
                client.terminate();
            });

            // Close the server itself
            wssInstance.close((err) => {
                if (err) {
                    console.error("Error closing WebSocket server:", err);
                    return reject(err);
                }
                console.log("WebSocket server closed.");
                wssInstance = null;
                resolve();
            });
        } else {
            resolve(); // Already closed or never started
        }
    });
}