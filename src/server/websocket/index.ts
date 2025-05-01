// src/server/websocket/index.ts
import { WebSocketServer, WebSocket } from 'ws';
import https from 'https'; // Or 'http' if not using SSL
import http from 'http'
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

// Change 'this: WebSocketClient' to 'this: WebSocket'
function heartbeat(this: WebSocket) {
    // We might need to cast 'this' if we accessed client-specific props,
    // but for 'isAlive' it might be okay depending on how WebSocketClient is defined.
    // To be safe, let's cast, although it might not be strictly necessary if
    // isAlive is optional on WebSocketClient or added directly.
    (this as WebSocketClient).isAlive = true;
}

export function setupWebSocket(server: http.Server): WebSocketServer { // Adjust type if using http
    console.log("Setting up WebSocket server...");
    const wss = new WebSocketServer({ server });
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

                // Ensure client is alive before processing game messages (optional but good practice)
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
            // Ensure cleanup happens even on error
            // handleDisconnect will remove the client if userId exists
            // handleDisconnect(client); // Already called in 'close'
        });

        client.on('close', () => {
            // Clear the pong listener when the client disconnects
            client.off('pong', heartbeat);
            handleDisconnect(client); // Handles broadcasting player_left
            // Heartbeat cleanup (termination) is handled by the interval function
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
                // Ensure disconnect logic runs if terminated this way
                // handleDisconnect(client); // handleDisconnect is called by client.terminate() triggering 'close'
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

            // Terminate all client connections
            wssInstance.clients.forEach(client => {
                client.terminate();
            });

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