// src/server/websocket/clients.ts
import { WebSocket } from 'ws';

// Define structure for connected clients
export interface WebSocketClient extends WebSocket {
    isAlive?: boolean;
    userId?: number;
    username?: string;
    color?: string;
    x?: number;
    y?: number;
    z?: number;
    rotationY?: number;
    rotationX?: number;
    health?: number;
    // --- ADDED KILLS ---
    kills: number; // Track kills per match
    // -------------------
}

// Map to store connected clients (userId -> WebSocketClient)
const clients = new Map<number, WebSocketClient>();

export function addClient(userId: number, client: WebSocketClient): void {
    clients.set(userId, client);
}

export function removeClient(userId: number): void {
    clients.delete(userId);
}

export function getClient(userId: number): WebSocketClient | undefined {
    return clients.get(userId);
}

export function getAllClients(): Map<number, WebSocketClient> {
    return clients;
}

// Helper to broadcast messages (excluding sender, only to living)
export function broadcast(senderWs: WebSocketClient, message: string): void {
    clients.forEach((client, clientId) => {
        if (client !== senderWs && client.readyState === WebSocket.OPEN && (client.health ?? 0) > 0) {
            try {
                client.send(message);
            } catch (sendError) {
                console.error(`Failed to send message to client ${clientId}:`, sendError);
            }
        }
    });
}

// Helper to broadcast including the sender (only to living)
export function broadcastToAll(message: string): void {
    clients.forEach((client, clientId) => {
        if (client.readyState === WebSocket.OPEN && (client.health ?? 0) > 0) {
            try {
                client.send(message);
            } catch (sendError) {
                console.error(`Failed to send message to client ${clientId}:`, sendError);
            }
        }
    });
}

// Broadcast to ALL including dead players (for specific messages like death/respawn/match events)
export function broadcastToAllIncludingDead(message: string): void {
    clients.forEach((client, clientId) => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(message);
            } catch (sendError) {
                console.error(`Failed to send message to client ${clientId}:`, sendError);
            }
        }
    });
}

// --- NEW: Get Scoreboard Data ---
export interface ScoreboardEntry {
    userId: number;
    username: string;
    kills: number;
}

export function getScoreboard(): ScoreboardEntry[] {
    const scores: ScoreboardEntry[] = [];
    clients.forEach((client) => {
        if (client.userId && client.username) { // Ensure client is fully authenticated
            scores.push({
                userId: client.userId,
                username: client.username,
                kills: client.kills ?? 0, // Use nullish coalescing for safety
            });
        }
    });
    // Sort by kills descending
    scores.sort((a, b) => b.kills - a.kills);
    return scores;
}
// --- END NEW ---