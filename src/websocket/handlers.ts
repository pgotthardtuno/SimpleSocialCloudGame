// src/websocket/handlers.ts
import jwt from 'jsonwebtoken';
import config from '../config';
import { UserPayload } from '../middleware/authMiddleware';
// Import broadcastToAll as well
import { WebSocketClient, addClient, broadcast, removeClient, getAllClients, broadcastToAll } from './clients'; // <-- Make sure broadcastToAll is imported

// --- Define Player Data Structure ---
interface PlayerState {
    userId: number;
    username?: string; // Make optional as it might not always be present on client object initially
    color?: string;    // Make optional
    x: number;
    y: number;
    z: number;
}
// --- End Define Player Data Structure ---


// --- Authentication Handler ---
export function handleAuthentication(ws: WebSocketClient, token: string): void {
    try {
        const decoded = jwt.verify(token, config.jwtSecret) as UserPayload;

        // Authentication successful! Assign properties to ws object
        ws.userId = decoded.userId;
        ws.username = decoded.username;
        ws.color = decoded.color;
        ws.isAlive = true; // Reset heartbeat flag
        // Initialize position (important for initial state)
        ws.x = 0; // Or fetch last known position from DB if desired
        ws.y = 1.6; // Default spawn height
        ws.z = 0;

        if (ws.userId !== undefined) {
            // --- Get current players BEFORE adding the new one ---
            // Explicitly type the array using the PlayerState interface
            const currentPlayersData: PlayerState[] = []; // <--- Added : PlayerState[] here
            const allCurrentClients = getAllClients(); // Get the map
            allCurrentClients.forEach((client) => {
                // Ensure client has necessary data and is not the connecting client
                // Also check that username and color exist before adding
                if (client.userId && client.userId !== ws.userId && client.username && client.color) {
                    currentPlayersData.push({
                        userId: client.userId,
                        username: client.username, // Now guaranteed to exist
                        color: client.color,       // Now guaranteed to exist
                        x: client.x || 0,
                        y: client.y || 1.6,
                        z: client.z || 0
                    });
                } else if (client.userId && client.userId !== ws.userId) {
                    // Optional: Log if a client is missing username/color
                    console.warn(`Client ${client.userId} is missing username or color, not included in initial state.`);
                }
            });

            // --- Now add the new client ---
            addClient(ws.userId, ws); // Add to our client map
            console.log(`User ${ws.username} (ID: ${ws.userId}) authenticated via WebSocket.`);

            // --- Send confirmation AND initial state back to the authenticated client ---
            ws.send(JSON.stringify({
                type: 'authenticated', // Keep confirmation
                payload: {
                    message: 'Authentication successful',
                    userId: ws.userId,
                    username: ws.username,
                    color: ws.color
                }
            }));
            // Send the initial state message
            ws.send(JSON.stringify({
                type: 'initial_state',
                payload: { players: currentPlayersData } // Send the list of other players
            }));


            // --- Broadcast new player joined to OTHERS ---
            const joinMessage = JSON.stringify({
                type: 'player_joined',
                payload: {
                    userId: ws.userId,
                    username: ws.username,
                    color: ws.color,
                    x: ws.x, // Send initial position
                    y: ws.y,
                    z: ws.z
                }
            });
            broadcast(ws, joinMessage); // Use broadcast to send to everyone *except* the new client

        } else {
            // Should not happen if verify succeeds and UserPayload is correct
            console.error("Authentication succeeded but userId is undefined.");
            ws.terminate();
        }
    } catch (err: any) {
        console.error('WebSocket authentication error:', err.message);
        ws.send(JSON.stringify({ type: 'auth_error', payload: { message: 'Invalid token' } }));
        ws.terminate(); // Disconnect invalid client
    }
}

// --- Position Update Handler ---
export function handlePositionUpdate(ws: WebSocketClient, payload: any): void {
    if (!ws.userId || !ws.username) {
        console.warn("Received position update from unauthenticated or unknown client.");
        return; // Ignore if client isn't fully authenticated/identified
    }

    const { x, y, z } = payload;

    // Basic validation
    if (typeof x === 'number' && typeof y === 'number' && typeof z === 'number') {
        // 1. Update the sender's state on the server
        ws.x = x;
        ws.y = y;
        ws.z = z;
        // console.log(`Updated position for ${ws.username}: ${x}, ${y}, ${z}`); // Optional logging

        // 2. Broadcast the update to all *other* connected clients
        const updateMessage = JSON.stringify({
            type: 'player_moved',
            payload: {
                userId: ws.userId,
                username: ws.username,
                color: ws.color,
                x: ws.x,
                y: ws.y,
                z: ws.z
            }
        });
        broadcast(ws, updateMessage); // Use the broadcast helper

    } else {
        console.warn(`Received invalid position data from user ${ws.userId}:`, payload);
        // Optionally send an error back to the sender
        // ws.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid position data' } }));
    }
}

// --- Chat Message Handler --- // <-- ADDED
export function handleChatMessage(ws: WebSocketClient, payload: any): void {
    if (!ws.userId || !ws.username) {
        console.warn("Received chat message from unauthenticated client.");
        // Optionally send an error back to the sender
        // ws.send(JSON.stringify({ type: 'error', payload: { message: 'Must be logged in to chat.' } }));
        return;
    }

    const message = payload.message;
    // Basic validation: check type, trim, check length
    if (typeof message !== 'string' || message.trim().length === 0 || message.length > 200) { // Limit message length
        console.warn(`Invalid chat message received from ${ws.username}:`, message);
        // Optionally send an error back
        // ws.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid message format or length (max 200 chars).' } }));
        return;
    }

    const trimmedMessage = message.trim();
    console.log(`Chat message from ${ws.username}: ${trimmedMessage}`);

    // Broadcast the message to ALL connected clients (including sender)
    const chatBroadcastMessage = JSON.stringify({
        type: 'new_chat_message', // Use a different type for broadcast
        payload: {
            userId: ws.userId,
            username: ws.username,
            message: trimmedMessage // Send trimmed message
            // color: ws.color // Optionally include color
        }
    });

    // Use a function that sends to all clients, including the sender
    broadcastToAll(chatBroadcastMessage);
}
// --- END Chat Message Handler --- // <-- ADDED


// --- Disconnect Handler ---
export function handleDisconnect(ws: WebSocketClient): void {
    console.log(`Client disconnected (User ID: ${ws.userId || 'unauthenticated'})`);
    if (ws.userId) {
        removeClient(ws.userId); // Remove from map
        // Broadcast player left message to other clients
        const leaveMessage = JSON.stringify({
            type: 'player_left',
            payload: { userId: ws.userId }
        });
        broadcast(ws, leaveMessage); // Broadcast departure (sender doesn't matter here as they are gone)
    }
}

// --- Error Handler ---
export function handleError(ws: WebSocketClient, error: Error): void {
    console.error(`WebSocket error for client ${ws.userId || 'unknown'}:`, error);
    // Optional: Attempt to remove client if userId is known, though 'close' usually follows
    // if (ws.userId) {
    // Check if client still exists before trying to remove/broadcast
    // const clientExists = !!getClient(ws.userId);
    // if (clientExists) {
    //     removeClient(ws.userId);
    //     const leaveMessage = JSON.stringify({ type: 'player_left', payload: { userId: ws.userId } });
    //     broadcast(ws, leaveMessage);
    // }
    // }
    // Consider terminating if the error is severe and 'close' might not fire
    // ws.terminate();
}