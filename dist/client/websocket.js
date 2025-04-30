"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ws = void 0;
exports.setupWebSocket = setupWebSocket;
exports.sendMessage = sendMessage;
exports.cleanupWebSocket = cleanupWebSocket;
// --- Module State & Functions (remain largely the same) ---
exports.ws = null;
let messageHandler = () => { };
let closeHandler = () => { };
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 3000;
function setupWebSocket(onMessage, onClose) {
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
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/?token=${encodeURIComponent(token)}`;
    console.log(`WebSocket: Attempting to connect to ${wsUrl}...`);
    exports.ws = new WebSocket(wsUrl);
    exports.ws.onopen = () => {
        console.log('WebSocket: Connection opened.');
        reconnectAttempts = 0;
    };
    exports.ws.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            messageHandler(message);
        }
        catch (error) {
            console.error('WebSocket: Failed to parse message:', event.data, error);
        }
    };
    exports.ws.onerror = (event) => {
        console.error('WebSocket: Error occurred:', event);
    };
    exports.ws.onclose = (event) => {
        console.log(`WebSocket: Connection closed. Code: ${event.code}, Reason: ${event.reason || 'N/A'}`);
        exports.ws = null;
        closeHandler();
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
    }
    else {
        console.error(`WebSocket: Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Giving up.`);
    }
}
function sendMessage(message) {
    if (exports.ws && exports.ws.readyState === WebSocket.OPEN) {
        try {
            exports.ws.send(JSON.stringify(message));
        }
        catch (error) {
            console.error("WebSocket: Failed to send message:", message, error);
        }
    }
    else {
        console.warn('WebSocket: Cannot send message, connection is not open.', message);
    }
}
function cleanupWebSocket() {
    if (exports.ws) {
        console.log("WebSocket: Closing connection manually.");
        reconnectAttempts = MAX_RECONNECT_ATTEMPTS;
        exports.ws.close(1000, "Client disconnecting");
        exports.ws = null;
    }
    messageHandler = () => { };
    closeHandler = () => { };
}
