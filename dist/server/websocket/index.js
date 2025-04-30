"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupWebSocket = setupWebSocket;
exports.closeWebSocketServer = closeWebSocketServer;
// src/server/websocket/index.ts
const ws_1 = require("ws");
const url_1 = __importDefault(require("url"));
const handlers_1 = require("./handlers");
// --- Import Match Timer ---
const match_1 = require("./match");
let wssInstance = null;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
// Change 'this: WebSocketClient' to 'this: WebSocket'
function heartbeat() {
    // We might need to cast 'this' if we accessed client-specific props,
    // but for 'isAlive' it might be okay depending on how WebSocketClient is defined.
    // To be safe, let's cast, although it might not be strictly necessary if
    // isAlive is optional on WebSocketClient or added directly.
    this.isAlive = true;
}
function setupWebSocket(server) {
    console.log("Setting up WebSocket server...");
    const wss = new ws_1.WebSocketServer({ server });
    wssInstance = wss;
    wss.on('connection', (ws, req) => {
        const client = ws;
        // Initialize isAlive on the client object itself when connection is established
        client.isAlive = true;
        // --- Authentication via Query Parameter ---
        const parameters = url_1.default.parse(req.url || '', true).query;
        const token = parameters.token;
        if (!token) {
            console.log('WebSocket connection attempt without token. Closing.');
            client.terminate();
            return;
        }
        // Authenticate using the token
        // Make sure handleAuthentication initializes client.kills
        (0, handlers_1.handleAuthentication)(client, token);
        // If authentication fails, handleAuthentication will terminate the connection
        // --- Heartbeat Setup ---
        // Now the 'this' types match what .on() expects
        client.on('pong', heartbeat);
        // --- Message Handling ---
        client.on('message', (message) => {
            try {
                const parsedMessage = JSON.parse(message.toString());
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
                        (0, handlers_1.handlePositionUpdate)(client, parsedMessage.payload);
                        break;
                    case 'chat_message':
                        (0, handlers_1.handleChatMessage)(client, parsedMessage.payload);
                        break;
                    case 'player_hit':
                        (0, handlers_1.handlePlayerHit)(client, parsedMessage.payload);
                        break;
                    case 'laser_fired':
                        (0, handlers_1.handleLaserFired)(client, parsedMessage.payload);
                        break;
                    default:
                        // Use type assertion for exhaustive check if needed
                        const _exhaustiveCheck = parsedMessage;
                        console.warn(`Received unknown message type: ${_exhaustiveCheck.type}`);
                }
            }
            catch (error) {
                console.error('Failed to process message or invalid JSON:', message.toString(), error);
                // Optionally send an error message back to the client
                // client.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid message format.' } }));
            }
        });
        // --- Error and Close Handling ---
        client.on('error', (error) => {
            (0, handlers_1.handleError)(client, error);
            // Ensure cleanup happens even on error
            // handleDisconnect will remove the client if userId exists
            // handleDisconnect(client); // Already called in 'close'
        });
        client.on('close', () => {
            // Clear the pong listener when the client disconnects
            client.off('pong', heartbeat);
            (0, handlers_1.handleDisconnect)(client); // Handles broadcasting player_left
            // Heartbeat cleanup (termination) is handled by the interval function
        });
    });
    // --- Heartbeat Interval ---
    const interval = setInterval(() => {
        // Use wss.clients which is a Set<WebSocket>
        wss.clients.forEach((ws) => {
            // Cast to WebSocketClient to check our custom property
            const client = ws;
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
        (0, match_1.stopMatchTimer)();
        // ------------------------
        wssInstance = null;
    });
    console.log("WebSocket server setup complete.");
    // --- Start First Match ---
    (0, match_1.startNewMatch)();
    // -------------------------
    return wss;
}
function closeWebSocketServer() {
    return new Promise((resolve, reject) => {
        if (wssInstance) {
            console.log("Closing WebSocket server connections...");
            // Stop match timers immediately
            (0, match_1.stopMatchTimer)();
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
        }
        else {
            resolve(); // Already closed or never started
        }
    });
}
