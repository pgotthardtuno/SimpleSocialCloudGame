// src/server/websocket/match.ts
import { getAllClients, broadcastToAllIncludingDead, getScoreboard, ScoreboardEntry } from './clients';
import { respawnPlayer } from './handlers'; // Import the respawn function

const MATCH_DURATION_MS = 1 * 60 * 1000; // 1 minutes
const POST_MATCH_DELAY_MS = 10 * 1000; // 10 seconds

let matchEndTime: number = 0;
let matchTimerInterval: NodeJS.Timeout | null = null;
let postMatchTimeout: NodeJS.Timeout | null = null;

export function getCurrentMatchEndTime(): number {
    return matchEndTime;
}

function checkMatchEnd(): void {
    if (Date.now() >= matchEndTime) {
        console.log("Match timer ended.");
        endMatch();
    }
}

export function startNewMatch(): void {
    console.log("Starting new match...");
    // Clear any existing timers
    if (matchTimerInterval) clearInterval(matchTimerInterval);
    if (postMatchTimeout) clearTimeout(postMatchTimeout);

    matchEndTime = Date.now() + MATCH_DURATION_MS;

    // Reset scores and respawn all players
    const clients = getAllClients();
    clients.forEach((client) => {
        client.kills = 0; // Reset kills
        respawnPlayer(client); // Respawn player (handles sending message)
    });

    // Broadcast new match start message
    const newMatchMessage = JSON.stringify({
        type: 'new_match',
        payload: {
            matchEndTime: matchEndTime
        }
    });
    broadcastToAllIncludingDead(newMatchMessage);

    // Start the interval timer to check for match end
    matchTimerInterval = setInterval(checkMatchEnd, 1000); // Check every second
    console.log(`New match started. Ends at: ${new Date(matchEndTime).toLocaleTimeString()}`);
}

function endMatch(): void {
    console.log("Ending match...");
    if (matchTimerInterval) {
        clearInterval(matchTimerInterval);
        matchTimerInterval = null;
    }

    // Get final scores
    const finalScores = getScoreboard();

    // Broadcast match end message with scores
    const matchEndMessage = JSON.stringify({
        type: 'match_end',
        payload: {
            scores: finalScores
        }
    });
    broadcastToAllIncludingDead(matchEndMessage);
    console.log("Match ended. Final scores sent.");

    // Set timeout to start the next match
    postMatchTimeout = setTimeout(startNewMatch, POST_MATCH_DELAY_MS);
    console.log(`Next match starts in ${POST_MATCH_DELAY_MS / 1000} seconds.`);
}

export function stopMatchTimer(): void {
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