// src/server/websocket/handlers.ts
import jwt from 'jsonwebtoken';
import config from '../config';
import { UserPayload } from '../middleware/authMiddleware';
// Import ScoreboardEntry and getScoreboard
import {
    WebSocketClient, addClient, broadcast, removeClient, getAllClients,
    broadcastToAll, getClient, broadcastToAllIncludingDead, getScoreboard, ScoreboardEntry
} from './clients';
// Import match control functions (we'll define these elsewhere)
import { getCurrentMatchEndTime, startNewMatch } from './match'; // Assuming a match.ts file or similar

// --- Constants ---
const PLAYER_MAX_HEALTH = 100;
const LASER_DAMAGE = 100;
const RESPAWN_DELAY_MS = 3000; // 3 seconds

// --- Define Player Data Structure (ensure it matches client's PlayerState) ---
interface PlayerState {
    userId: number;
    username?: string;
    color?: string;
    x: number;
    y: number;
    z: number;
    rotationY?: number;
    rotationX?: number;
    health?: number;
    // --- ADDED KILLS ---
    kills?: number;
    // -------------------
}
// --- End Define Player Data Structure ---

// --- Define Vector3 Data Structure (for laser payload) ---
interface Vector3Data {
    x: number;
    y: number;
    z: number;
}
// --- END NEW ---


// --- Authentication Handler ---
export function handleAuthentication(ws: WebSocketClient, token: string): void {
    try {
        const decoded = jwt.verify(token, config.jwtSecret) as UserPayload;

        // Authentication successful! Assign properties to ws object
        ws.userId = decoded.userId;
        ws.username = decoded.username;
        ws.color = decoded.color;
        ws.isAlive = true;
        ws.health = PLAYER_MAX_HEALTH;
        // --- INITIALIZE KILLS ---
        ws.kills = 0;
        // ------------------------
        // Initialize position and rotation
        ws.x = Math.random() * 10 - 5; // Random spawn
        ws.y = 1.6;
        ws.z = Math.random() * 10 - 5; // Random spawn
        ws.rotationY = 0;
        ws.rotationX = 0;

        if (ws.userId !== undefined) {
            // --- Get current players BEFORE adding the new one ---
            const currentPlayersData: PlayerState[] = [];
            const allCurrentClients = getAllClients();
            allCurrentClients.forEach((client) => {
                // Include all connected players, dead or alive initially
                if (client.userId && client.userId !== ws.userId && client.username && client.color) {
                    currentPlayersData.push({
                        userId: client.userId,
                        username: client.username,
                        color: client.color,
                        x: client.x || 0,
                        y: client.y || 1.6,
                        z: client.z || 0,
                        rotationY: client.rotationY || 0,
                        rotationX: client.rotationX || 0,
                        health: client.health ?? PLAYER_MAX_HEALTH, // Send current health
                        kills: client.kills ?? 0 // Send current kills
                    });
                }
            });

            // --- Now add the new client ---
            addClient(ws.userId, ws);
            console.log(`User ${ws.username} (ID: ${ws.userId}) authenticated via WebSocket. Health: ${ws.health}, Kills: ${ws.kills}`);

            // --- Send confirmation AND initial state back to the authenticated client ---
            ws.send(JSON.stringify({
                type: 'authenticated',
                payload: {
                    message: 'Authentication successful',
                    userId: ws.userId,
                    username: ws.username,
                    color: ws.color,
                    health: ws.health,
                    kills: ws.kills // Send initial kills
                }
            }));
            ws.send(JSON.stringify({
                type: 'initial_state',
                payload: {
                    players: currentPlayersData, // Includes health and kills
                    currentUser: {
                        userId: ws.userId,
                        username: ws.username,
                        color: ws.color,
                        x: ws.x,
                        y: ws.y,
                        z: ws.z,
                        rotationY: ws.rotationY,
                        rotationX: ws.rotationX,
                        health: ws.health,
                        kills: ws.kills // Include kills
                    },
                    // --- ADD MATCH END TIME ---
                    matchEndTime: getCurrentMatchEndTime()
                    // --------------------------
                }
            }));

            // --- Broadcast new player joined to OTHERS ---
            const joinMessage = JSON.stringify({
                type: 'player_joined',
                payload: {
                    userId: ws.userId,
                    username: ws.username,
                    color: ws.color,
                    x: ws.x,
                    y: ws.y,
                    z: ws.z,
                    rotationY: ws.rotationY,
                    rotationX: ws.rotationX,
                    health: ws.health,
                    kills: ws.kills // Include kills
                }
            });
            // Broadcast to all including dead so everyone's scoreboard is updated
            broadcastToAllIncludingDead(joinMessage);

        } else {
            console.error("Authentication succeeded but userId is undefined.");
            ws.terminate();
        }
    } catch (err: any) {
        console.error('WebSocket authentication error:', err.message);
        ws.send(JSON.stringify({ type: 'auth_error', payload: { message: 'Invalid token' } }));
        ws.terminate();
    }
}

// --- Position Update Handler ---
export function handlePositionUpdate(ws: WebSocketClient, payload: any): void {
    if (!ws.userId || !ws.username || (ws.health ?? 0) <= 0) {
        return;
    }
    // ... (rest of the function remains the same)
    const { x, y, z, rotationY, rotationX } = payload;

    if (typeof x === 'number' && typeof y === 'number' && typeof z === 'number' &&
        typeof rotationY === 'number' && typeof rotationX === 'number') {
        ws.x = x;
        ws.y = y;
        ws.z = z;
        ws.rotationY = rotationY;
        ws.rotationX = rotationX;

        const updateMessage = JSON.stringify({
            type: 'player_moved',
            payload: {
                userId: ws.userId,
                x: ws.x,
                y: ws.y,
                z: ws.z,
                rotationY: ws.rotationY,
                rotationX: ws.rotationX,
                // No health/kills update needed on move
            }
        });
        broadcast(ws, updateMessage); // Only living players need move updates

    } else {
        console.warn(`Received invalid position/rotation data from user ${ws.userId}:`, payload);
    }
}

// --- Chat Message Handler ---
export function handleChatMessage(ws: WebSocketClient, payload: any): void {
    if (!ws.userId || !ws.username || (ws.health ?? 0) <= 0) {
        return;
    }
    // ... (rest of the function remains the same)
    const message = payload.message;
    if (typeof message !== 'string' || message.trim().length === 0 || message.length > 200) {
        console.warn(`Invalid chat message received from ${ws.username}:`, message);
        return;
    }

    const trimmedMessage = message.trim();
    console.log(`Chat message from ${ws.username}: ${trimmedMessage}`);

    const chatBroadcastMessage = JSON.stringify({
        type: 'new_chat_message',
        payload: {
            userId: ws.userId,
            username: ws.username,
            message: trimmedMessage
        }
    });
    broadcastToAll(chatBroadcastMessage); // Only living players need chat
}

// --- Player Hit Handler ---
export function handlePlayerHit(ws: WebSocketClient, payload: any): void {
    if (!ws.userId || !ws.username || (ws.health ?? 0) <= 0) {
        return;
    }

    const targetUserId = payload.targetUserId;
    if (typeof targetUserId !== 'number') {
        console.warn(`Invalid targetUserId received from ${ws.username}:`, payload);
        ws.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid target player ID.' } }));
        return;
    }

    if (targetUserId === ws.userId) {
        return; // Cannot hit self
    }

    const targetClient = getClient(targetUserId);

    if (targetClient && targetClient.readyState === WebSocket.OPEN && (targetClient.health ?? 0) > 0) {
        targetClient.health = (targetClient.health ?? PLAYER_MAX_HEALTH) - LASER_DAMAGE;
        console.log(`Player ${targetClient.username} (ID: ${targetUserId}) hit by ${ws.username}. New health: ${targetClient.health}`);

        ws.send(JSON.stringify({
            type: 'player_hit_success',
            payload: {
                targetUserId: targetUserId,
                targetHealth: targetClient.health
            }
        }));

        targetClient.send(JSON.stringify({
            type: 'player_was_hit',
            payload: {
                attackerUserId: ws.userId,
                attackerUsername: ws.username,
                newHealth: targetClient.health
            }
        }));

        if (targetClient.health <= 0) {
            targetClient.health = 0; // Ensure health doesn't stay negative
            // --- INCREMENT KILLS ---
            ws.kills = (ws.kills ?? 0) + 1;
            console.log(`Player ${targetClient.username} (ID: ${targetUserId}) was killed by ${ws.username} (Kills: ${ws.kills}).`);
            // -----------------------

            // Broadcast death event
            const deathMessage = JSON.stringify({
                type: 'player_died',
                payload: {
                    victimId: targetUserId,
                    victimUsername: targetClient.username,
                    attackerId: ws.userId,
                    attackerUsername: ws.username,
                    // --- SEND ATTACKER KILLS ---
                    attackerKills: ws.kills
                    // -------------------------
                }
            });
            broadcastToAllIncludingDead(deathMessage); // Everyone needs to know for scoreboard

            // --- Simple Respawn Logic ---
            setTimeout(() => {
                // Check if client is still connected AND match hasn't ended in the meantime
                if (getClient(targetUserId) && Date.now() < getCurrentMatchEndTime()) {
                    targetClient.health = PLAYER_MAX_HEALTH;
                    targetClient.x = Math.random() * 10 - 5;
                    targetClient.y = 1.6;
                    targetClient.z = Math.random() * 10 - 5;
                    targetClient.rotationY = 0;
                    targetClient.rotationX = 0;
                    console.log(`Player ${targetClient.username} (ID: ${targetUserId}) respawned.`);

                    const respawnMessage = JSON.stringify({
                        type: 'player_respawned',
                        payload: {
                            userId: targetUserId,
                            username: targetClient.username,
                            color: targetClient.color,
                            x: targetClient.x,
                            y: targetClient.y,
                            z: targetClient.z,
                            rotationY: targetClient.rotationY,
                            rotationX: targetClient.rotationX,
                            health: targetClient.health,
                            kills: targetClient.kills // Send kills on respawn too
                        }
                    });
                    broadcastToAllIncludingDead(respawnMessage);
                } else if (getClient(targetUserId)) {
                    console.log(`Player ${targetClient.username} (ID: ${targetUserId}) did not respawn (match ended?).`);
                    // Client is still connected but match ended before respawn timer finished.
                    // They will be respawned by the startNewMatch function.
                }
            }, RESPAWN_DELAY_MS);
            // --------------------------

        } // --- End Death Check ---

    } else {
        const reason = !targetClient ? 'not found' : (targetClient.readyState !== WebSocket.OPEN ? 'disconnected' : 'already dead');
        ws.send(JSON.stringify({
            type: 'error',
            payload: { message: `Target player ${targetUserId} ${reason}.` }
        }));
    }
}

// --- Laser Fired Handler ---
export function handleLaserFired(ws: WebSocketClient, payload: any): void {
    if (!ws.userId || !ws.username || (ws.health ?? 0) <= 0) {
        return;
    }
    // ... (rest of the function remains the same)
    const { startPoint, endPoint, color } = payload;

    const isValidPoint = (p: any): p is Vector3Data =>
        p && typeof p === 'object' &&
        typeof p.x === 'number' && typeof p.y === 'number' && typeof p.z === 'number';

    if (!isValidPoint(startPoint) || !isValidPoint(endPoint) || typeof color !== 'number') {
        console.warn(`Invalid laser_fired payload received from ${ws.username}:`, payload);
        ws.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid laser data format.' } }));
        return;
    }

    const showLaserMessage = JSON.stringify({
        type: 'show_laser',
        payload: {
            startPoint: startPoint,
            endPoint: endPoint,
            color: color,
            attackerUserId: ws.userId
        }
    });

    broadcastToAll(showLaserMessage); // Only living players need to see laser
}


// --- Disconnect Handler ---
export function handleDisconnect(ws: WebSocketClient): void {
    console.log(`Client disconnected (User ID: ${ws.userId || 'unauthenticated'})`);
    if (ws.userId) {
        const userId = ws.userId; // Store before removing
        removeClient(userId);
        // Broadcast player_left regardless of whether they were alive,
        // so clients can remove them from the scoreboard.
        const leaveMessage = JSON.stringify({
            type: 'player_left',
            payload: { userId: userId }
        });
        // Send to everyone including dead players
        broadcastToAllIncludingDead(leaveMessage);
    }
}

// --- Error Handler ---
export function handleError(ws: WebSocketClient, error: Error): void {
    console.error(`WebSocket error for client ${ws.userId || 'unknown'}:`, error);
}

// --- NEW: Respawn Player Function (called by match logic) ---
export function respawnPlayer(ws: WebSocketClient): void {
    if (!ws.userId || !ws.username) return; // Should not happen if called correctly

    ws.health = PLAYER_MAX_HEALTH;
    ws.x = Math.random() * 10 - 5; // Random spawn
    ws.y = 1.6;
    ws.z = Math.random() * 10 - 5; // Random spawn
    ws.rotationY = 0;
    ws.rotationX = 0;
    console.log(`Player ${ws.username} (ID: ${ws.userId}) respawned by match reset.`);

    // Send respawn message
    const respawnMessage = JSON.stringify({
        type: 'player_respawned',
        payload: {
            userId: ws.userId,
            username: ws.username,
            color: ws.color,
            x: ws.x,
            y: ws.y,
            z: ws.z,
            rotationY: ws.rotationY,
            rotationX: ws.rotationX,
            health: ws.health,
            kills: ws.kills // Send kills (should be 0 after reset)
        }
    });
    // Send directly to the respawned player first
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(respawnMessage);
    }
    // Then broadcast to others (including dead)
    broadcastToAllIncludingDead(respawnMessage);
}
// --- END NEW ---