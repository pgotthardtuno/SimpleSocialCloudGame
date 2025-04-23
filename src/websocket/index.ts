// src/websocket/index.ts
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { WebSocketClient, getAllClients } from './clients'; // Import our extended type and map access
// Import handleChatMessage as well
import {
    handleAuthentication,
    handlePositionUpdate,
    handleDisconnect,
    handleError,
    handleChatMessage // <-- Import chat handler
} from './handlers';

let wssInstance: WebSocketServer | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;

export function setupWebSocket(server: http.Server): WebSocketServer {
    if (wssInstance) {
        console.warn("WebSocket server already initialized.");
        return wssInstance;
    }

    console.log("Setting up WebSocket server...");
    const wss = new WebSocketServer({ server });
    wssInstance = wss; // Store the instance

    wss.on('connection', (ws: WebSocketClient) => { // Use our extended type here
        console.log('Client connected via WebSocket');
        ws.isAlive = true; // Initialize heartbeat flag

        ws.on('pong', () => {
            ws.isAlive = true; // Keepalive check response
        });

        ws.on('message', (message) => {
            try {
                const parsedMessage = JSON.parse(message.toString());
                // console.log('Received:', parsedMessage); // Keep for debugging if needed, can be noisy

                // Route message to appropriate handler based on type
                switch (parsedMessage.type) {
                    case 'authenticate':
                        if (parsedMessage.payload?.token) {
                            handleAuthentication(ws, parsedMessage.payload.token);
                        } else {
                            console.warn("Authentication message missing token.");
                            ws.send(JSON.stringify({ type: 'auth_error', payload: { message: 'Token missing' } }));
                            ws.terminate();
                        }
                        break;
                    case 'update_position':
                        if (parsedMessage.payload) {
                            handlePositionUpdate(ws, parsedMessage.payload);
                        } else {
                            console.warn("Position update message missing payload.");
                            // Optionally send error back
                        }
                        break;

                    // --- ADD CHAT CASE --- // <-- ADDED
                    case 'chat_message':
                        if (parsedMessage.payload) {
                            handleChatMessage(ws, parsedMessage.payload); // <-- Call handler
                        } else {
                            console.warn("Chat message missing payload.");
                            // Optionally send error back
                        }
                        break;
                    // --- END CHAT CASE --- // <-- ADDED

                    default:
                        if (ws.userId) { // Only log if authenticated but unknown type
                            console.log(`Received unknown message type from ${ws.username}:`, parsedMessage.type);
                        } else {
                            console.log(`Received unknown message type from unauthenticated client:`, parsedMessage.type);
                        }
                    // Optionally send an error back
                    // ws.send(JSON.stringify({ type: 'error', payload: { message: `Unknown message type: ${parsedMessage.type}` } }));
                }

            } catch (e) {
                console.error('Failed to parse message or invalid message format:', message.toString(), e);
                // Optionally send an error back to the client
                // ws.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid message format' } }));
            }
        });

        ws.on('close', () => {
            handleDisconnect(ws); // Use handler
        });

        ws.on('error', (error) => {
            handleError(ws, error); // Use handler
        });
    });

    // --- Heartbeat to remove dead connections ---
    console.log("Starting WebSocket heartbeat interval (30s)...");
    heartbeatInterval = setInterval(() => {
        const clients = getAllClients(); // Get current clients from the map
        clients.forEach((clientWs) => { // Iterate through the map's values
            if (clientWs.isAlive === false) {
                console.log(`Terminating inactive connection (User ID: ${clientWs.userId || 'unknown'})`);
                return clientWs.terminate(); // Terminate the connection directly
            }
            clientWs.isAlive = false; // Expect a pong response to set it back to true
            clientWs.ping(); // Send ping
        });
        // Also clean up connections directly on wss.clients that might not be in our map yet (e.g., before auth)
        wss.clients.forEach((rawWs) => {
            const clientWs = rawWs as WebSocketClient;
            if (!clientWs.userId && clientWs.isAlive === false) { // Check unauthenticated clients too
                console.log(`Terminating inactive unauthenticated connection...`);
                return clientWs.terminate();
            }
            if (!clientWs.userId) { // Ping unauthenticated clients too
                clientWs.isAlive = false;
                clientWs.ping();
            }
        });

    }, 30000); // Check every 30 seconds

    wss.on('close', () => {
        console.log("WebSocket server closing, clearing heartbeat interval.");
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
        }
        wssInstance = null; // Clear the instance
    });

    console.log('WebSocket server setup complete.');
    return wss;
}

// Function to get the WSS instance (needed for graceful shutdown)
export function getWss(): WebSocketServer {
    if (!wssInstance) {
        throw new Error("WebSocketServer has not been initialized. Call setupWebSocket first.");
    }
    return wssInstance;
}

// Function to close the WebSocket server (for graceful shutdown)
export function closeWebSocketServer(): Promise<void> {
    return new Promise((resolve) => {
        const wss = getWss();
        if (wss) {
            console.log("Closing WebSocket server...");
            wss.close(() => {
                console.log("WebSocket server closed.");
                resolve();
            });
            // Force close remaining connections after a short delay
            wss.clients.forEach(client => client.terminate());
        } else {
            resolve(); // Already closed or never opened
        }
    });
}