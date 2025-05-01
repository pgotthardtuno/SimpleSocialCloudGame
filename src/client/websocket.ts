// src/client/websocket.ts
import * as THREE from 'three';

// --- Type Definitions ---
export interface PlayerState {
    userId: number;
    username: string;
    color?: string;
    x: number;
    y: number;
    z: number;
    rotationY?: number;
    rotationX?: number;
    health?: number;
    kills?: number;
}

interface Vector3Data {
    x: number;
    y: number;
    z: number;
}

// --- Client -> Server Messages ---
interface UpdatePositionClientPayload { x: number; y: number; z: number; rotationY: number; rotationX: number; }
interface ChatMessageClientPayload { message: string; }
interface PlayerHitClientPayload { targetUserId: number; }
interface LaserFiredClientPayload { startPoint: Vector3Data; endPoint: Vector3Data; color: number; }

export type ClientMessage =
    | { type: 'player_move'; payload: UpdatePositionClientPayload }
    | { type: 'chat_message'; payload: ChatMessageClientPayload }
    | { type: 'player_hit'; payload: PlayerHitClientPayload }
    | { type: 'laser_fired'; payload: LaserFiredClientPayload };

// --- Server -> Client Messages ---
interface AuthenticatedPayload { message: string; userId: number; username: string; color: string; health: number; kills: number; }
interface AuthErrorPayload { message: string; }
interface InitialStatePayload { players: PlayerState[]; currentUser: PlayerState; matchEndTime: number; }
interface NewChatMessagePayload { userId: number; username: string; message: string; }
interface PlayerHitSuccessPayload { targetUserId: number; targetHealth: number; }
interface PlayerWasHitPayload { attackerUserId: number; attackerUsername: string; newHealth: number; }
interface ShowLaserServerPayload { startPoint: Vector3Data; endPoint: Vector3Data; color: number; attackerUserId: number; }
interface PlayerDiedPayload { victimId: number; victimUsername: string; attackerId: number; attackerUsername: string; attackerKills: number; }
interface PlayerRespawnedPayload extends PlayerState { /* inherits kills */ }

// --- NEW: Scoreboard and Match Payloads ---
// --- FIX: Add export here ---
export interface ScoreboardEntry { userId: number; username: string; kills: number; }
// ---------------------------
interface MatchEndPayload { scores: ScoreboardEntry[]; }
interface NewMatchPayload { matchEndTime: number; }
// --- END NEW ---

export type ServerMessage =
    | { type: 'authenticated'; payload: AuthenticatedPayload }
    | { type: 'auth_error'; payload: AuthErrorPayload }
    | { type: 'initial_state'; payload: InitialStatePayload }
    | { type: 'player_joined'; payload: PlayerState }
    | { type: 'player_moved'; payload: PlayerState }
    | { type: 'player_left'; payload: { userId: number } }
    | { type: 'new_chat_message'; payload: NewChatMessagePayload }
    | { type: 'player_hit_success'; payload: PlayerHitSuccessPayload }
    | { type: 'player_was_hit'; payload: PlayerWasHitPayload }
    | { type: 'show_laser'; payload: ShowLaserServerPayload }
    | { type: 'player_died'; payload: PlayerDiedPayload }
    | { type: 'player_respawned'; payload: PlayerRespawnedPayload }
    | { type: 'match_end'; payload: MatchEndPayload }
    | { type: 'new_match'; payload: NewMatchPayload }
    | { type: 'error'; payload: { message: string } };


// --- Module State & Functions (remain largely the same) ---
export let ws: WebSocket | null = null;
let messageHandler: (message: ServerMessage) => void = () => {};
let closeHandler: () => void = () => {};
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 3000;

export function setupWebSocket(
    onMessage: (message: ServerMessage) => void,
    onClose: () => void
): void {
    messageHandler = onMessage;
    closeHandler = onClose;
    connectWebSocket();
}

function connectWebSocket() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        console.error("WebSocket: No auth token found. Cannot connect.");
        window.location.href = '/login.html';
        return;
    }
    // --- CHANGE: Determine WebSocket protocol for HTTP ---
    // Always use ws: since we are not using https:
    const protocol = 'ws:';
    // const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'; // Old logic
    // ----------------------------------------------------
    const host = window.location.host; // This should still work fine
    const wsUrl = `${protocol}//${host}/?token=${encodeURIComponent(token)}`;
    console.log(`WebSocket: Attempting to connect to ${wsUrl}...`);
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('WebSocket: Connection opened.');
        reconnectAttempts = 0;
    };
    ws.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data) as ServerMessage;
            messageHandler(message);
        } catch (error) {
            console.error('WebSocket: Failed to parse message:', event.data, error);
        }
    };
    ws.onerror = (event) => {
        console.error('WebSocket: Error occurred:', event);
    };
    ws.onclose = (event) => {
        console.log(`WebSocket: Connection closed. Code: ${event.code}, Reason: ${event.reason || 'N/A'}`);
        ws = null;
        closeHandler();
        // Reconnect logic remains the same
        if (event.code !== 1000 && event.code !== 1005) {
            attemptReconnect();
        }
    };
}

function attemptReconnect() {
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        const delay = RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts - 1) + Math.random() * 1000;
        console.log(`WebSocket: Attempting reconnect ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${(delay / 1000).toFixed(1)}s...`);
        setTimeout(connectWebSocket, delay);
    } else {
        console.error(`WebSocket: Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Giving up.`);
    }
}

export function sendMessage(message: ClientMessage): void {
    if (ws && ws.readyState === WebSocket.OPEN) {
        try {
            ws.send(JSON.stringify(message));
        } catch (error) {
            console.error("WebSocket: Failed to send message:", message, error);
        }
    } else {
        console.warn('WebSocket: Cannot send message, connection is not open.', message);
    }
}

export function cleanupWebSocket(): void {
    if (ws) {
        console.log("WebSocket: Closing connection manually.");
        reconnectAttempts = MAX_RECONNECT_ATTEMPTS;
        ws.close(1000, "Client disconnecting");
        ws = null;
    }
    messageHandler = () => {};
    closeHandler = () => {};
}