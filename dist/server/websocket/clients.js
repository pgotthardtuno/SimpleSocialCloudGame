"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addClient = addClient;
exports.removeClient = removeClient;
exports.getClient = getClient;
exports.getAllClients = getAllClients;
exports.broadcast = broadcast;
exports.broadcastToAll = broadcastToAll;
exports.broadcastToAllIncludingDead = broadcastToAllIncludingDead;
exports.getScoreboard = getScoreboard;
// src/server/websocket/clients.ts
const ws_1 = require("ws");
// Map to store connected clients (userId -> WebSocketClient)
const clients = new Map();
function addClient(userId, client) {
    clients.set(userId, client);
}
function removeClient(userId) {
    clients.delete(userId);
}
function getClient(userId) {
    return clients.get(userId);
}
function getAllClients() {
    return clients;
}
// Helper to broadcast messages (excluding sender, only to living)
function broadcast(senderWs, message) {
    clients.forEach((client, clientId) => {
        var _a;
        if (client !== senderWs && client.readyState === ws_1.WebSocket.OPEN && ((_a = client.health) !== null && _a !== void 0 ? _a : 0) > 0) {
            try {
                client.send(message);
            }
            catch (sendError) {
                console.error(`Failed to send message to client ${clientId}:`, sendError);
            }
        }
    });
}
// Helper to broadcast including the sender (only to living)
function broadcastToAll(message) {
    clients.forEach((client, clientId) => {
        var _a;
        if (client.readyState === ws_1.WebSocket.OPEN && ((_a = client.health) !== null && _a !== void 0 ? _a : 0) > 0) {
            try {
                client.send(message);
            }
            catch (sendError) {
                console.error(`Failed to send message to client ${clientId}:`, sendError);
            }
        }
    });
}
// Broadcast to ALL including dead players (for specific messages like death/respawn/match events)
function broadcastToAllIncludingDead(message) {
    clients.forEach((client, clientId) => {
        if (client.readyState === ws_1.WebSocket.OPEN) {
            try {
                client.send(message);
            }
            catch (sendError) {
                console.error(`Failed to send message to client ${clientId}:`, sendError);
            }
        }
    });
}
function getScoreboard() {
    const scores = [];
    clients.forEach((client) => {
        var _a;
        if (client.userId && client.username) { // Ensure client is fully authenticated
            scores.push({
                userId: client.userId,
                username: client.username,
                kills: (_a = client.kills) !== null && _a !== void 0 ? _a : 0, // Use nullish coalescing for safety
            });
        }
    });
    // Sort by kills descending
    scores.sort((a, b) => b.kills - a.kills);
    return scores;
}
// --- END NEW ---
