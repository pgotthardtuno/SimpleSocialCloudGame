"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentMatchEndTime = getCurrentMatchEndTime;
exports.startNewMatch = startNewMatch;
exports.stopMatchTimer = stopMatchTimer;
// src/server/websocket/match.ts
const clients_1 = require("./clients");
const handlers_1 = require("./handlers"); // Import the respawn function
const MATCH_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const POST_MATCH_DELAY_MS = 10 * 1000; // 10 seconds
let matchEndTime = 0;
let matchTimerInterval = null;
let postMatchTimeout = null;
function getCurrentMatchEndTime() {
    return matchEndTime;
}
function checkMatchEnd() {
    if (Date.now() >= matchEndTime) {
        console.log("Match timer ended.");
        endMatch();
    }
}
function startNewMatch() {
    console.log("Starting new match...");
    // Clear any existing timers
    if (matchTimerInterval)
        clearInterval(matchTimerInterval);
    if (postMatchTimeout)
        clearTimeout(postMatchTimeout);
    matchEndTime = Date.now() + MATCH_DURATION_MS;
    // Reset scores and respawn all players
    const clients = (0, clients_1.getAllClients)();
    clients.forEach((client) => {
        client.kills = 0; // Reset kills
        (0, handlers_1.respawnPlayer)(client); // Respawn player (handles sending message)
    });
    // Broadcast new match start message
    const newMatchMessage = JSON.stringify({
        type: 'new_match',
        payload: {
            matchEndTime: matchEndTime
        }
    });
    (0, clients_1.broadcastToAllIncludingDead)(newMatchMessage);
    // Start the interval timer to check for match end
    matchTimerInterval = setInterval(checkMatchEnd, 1000); // Check every second
    console.log(`New match started. Ends at: ${new Date(matchEndTime).toLocaleTimeString()}`);
}
function endMatch() {
    console.log("Ending match...");
    if (matchTimerInterval) {
        clearInterval(matchTimerInterval);
        matchTimerInterval = null;
    }
    // Get final scores
    const finalScores = (0, clients_1.getScoreboard)();
    // Broadcast match end message with scores
    const matchEndMessage = JSON.stringify({
        type: 'match_end',
        payload: {
            scores: finalScores
        }
    });
    (0, clients_1.broadcastToAllIncludingDead)(matchEndMessage);
    console.log("Match ended. Final scores sent.");
    // Set timeout to start the next match
    postMatchTimeout = setTimeout(startNewMatch, POST_MATCH_DELAY_MS);
    console.log(`Next match starts in ${POST_MATCH_DELAY_MS / 1000} seconds.`);
}
function stopMatchTimer() {
    if (matchTimerInterval) {
        clearInterval(matchTimerInterval);
        matchTimerInterval = null;
    }
    if (postMatchTimeout) {
        clearTimeout(postMatchTimeout);
        postMatchTimeout = null;
    }
    console.log("Match timers stopped.");
}
