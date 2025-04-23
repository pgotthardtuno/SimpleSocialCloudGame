// src/websocket/clients.ts
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
    // Add rotation later if needed
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

// Helper to broadcast messages
export function broadcast(senderWs: WebSocketClient, message: string): void {
    clients.forEach((client, clientId) => {
        // Send to everyone *except* the sender and ensure the client is open
        if (client !== senderWs && client.readyState === WebSocket.OPEN) {
            try {
                client.send(message);
            } catch (sendError) {
                console.error(`Failed to send message to client ${clientId}:`, sendError);
                // Optional: Handle failed send (e.g., remove client if error persists)
            }
        }
    });
}

// Helper to broadcast including the sender
export function broadcastToAll(message: string): void {
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