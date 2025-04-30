"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// src/client/main.ts
const THREE = __importStar(require("three"));
const PointerLockControls_js_1 = require("three/examples/jsm/controls/PointerLockControls.js");
const scene_1 = require("./scene");
// Import ScoreboardEntry along with other types
const websocket_1 = require("./websocket");
// Import getAllPlayerData along with other functions
const playerManager_1 = require("./playerManager");
const ui_1 = require("./ui");
const chat_1 = require("./chat");
const utils_1 = require("./utils"); // Import sanitizeHTML
// --- State ---
let controls = null;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let moveUp = false;
let moveDown = false;
let prevTime = performance.now();
let lastSentTime = 0;
const SEND_INTERVAL = 100;
const INTERPOLATION_DELAY = 150;
let lastSentRotationY = 0;
let lastSentRotationX = 0;
let raycaster;
const pointer = new THREE.Vector2();
let animationFrameId = null;
// --- Player State ---
let localPlayerId = null;
let localPlayerUsername = "Player"; // Store username locally
let localPlayerHealth = 100;
let localPlayerKills = 0; // Store kills locally
let isLocalPlayerDead = false;
// --------------------
// --- Scoreboard State ---
let scoreboardVisible = false;
let playerScores = new Map();
let showingEndGameScoreboard = false;
// ----------------------
// --- Match State ---
let matchEndTime = 0;
// -----------------
// DOM Elements
const instructions = document.getElementById('instructions');
const gameContainer = document.getElementById('game-container');
const userInfoElement = document.getElementById('user-info');
const logoutButton = document.getElementById('logout-button');
const chatOutput = document.getElementById('chat-output');
const chatInput = document.getElementById('chat-input');
const chatContainer = document.getElementById('chat-container');
const healthDisplayElement = document.getElementById('health-display');
// --- NEW: Scoreboard & Timer Elements ---
const scoreboardElement = document.getElementById('scoreboard');
// --- FIX: Cast scoreboardTableBody to the correct type ---
const scoreboardTableBody = document.querySelector('#scoreboard-table tbody');
// ---------------------------------------------------------
const scoreboardMessageElement = document.getElementById('scoreboard-message');
const matchTimerElement = document.getElementById('match-timer');
// --------------------------------------
// --- Initialization ---
function init() {
    // --- Check ALL required elements ---
    // Check scoreboardTableBody specifically
    if (!gameContainer || !instructions || !userInfoElement || !chatOutput || !chatInput || !chatContainer || !healthDisplayElement || !scoreboardElement || !scoreboardTableBody || !matchTimerElement || !scoreboardMessageElement) {
        console.error("Initialization failed: One or more required DOM elements are missing.");
        // Log missing elements
        if (!gameContainer)
            console.error("Missing: #game-container");
        if (!instructions)
            console.error("Missing: #instructions");
        if (!userInfoElement)
            console.error("Missing: #user-info");
        if (!chatOutput)
            console.error("Missing: #chat-output");
        if (!chatInput)
            console.error("Missing: #chat-input");
        if (!chatContainer)
            console.error("Missing: #chat-container");
        if (!healthDisplayElement)
            console.error("Missing: #health-display");
        if (!scoreboardElement)
            console.error("Missing: #scoreboard");
        // --- FIX: Check the casted variable ---
        if (!scoreboardTableBody)
            console.error("Missing: #scoreboard-table tbody");
        // --------------------------------------
        if (!scoreboardMessageElement)
            console.error("Missing: #scoreboard-message");
        if (!matchTimerElement)
            console.error("Missing: #match-timer");
        return;
    }
    // ------------------------------------
    updateHealthDisplay(); // Initial update
    // Scene Setup
    (0, scene_1.setupScene)(gameContainer);
    if (!scene_1.camera || !scene_1.renderer || !scene_1.scene) {
        console.error("Scene setup failed.");
        return;
    }
    // Controls Setup
    controls = new PointerLockControls_js_1.PointerLockControls(scene_1.camera, scene_1.renderer.domElement);
    scene_1.scene.add(controls.object);
    // UI Setup
    (0, ui_1.setupUI)(logoutButton, userInfoElement, handleLogout);
    // Chat Setup
    (0, chat_1.setupChat)(chatContainer, chatOutput, chatInput, handleSendMessage);
    // WebSocket Setup
    (0, websocket_1.setupWebSocket)(handleServerMessage, handleWebSocketClose);
    // Player Manager Setup
    (0, playerManager_1.setupPlayerManager)(scene_1.scene);
    // Initialize Raycaster
    raycaster = new THREE.Raycaster();
    // Event Listeners
    window.addEventListener('resize', onWindowResize);
    if (gameContainer) {
        gameContainerClickListener = () => {
            const currentChatState = (0, chat_1.isChatting)();
            if (!currentChatState && !isLocalPlayerDead && controls && !controls.isLocked) {
                controls.lock();
            }
        };
        gameContainer.addEventListener('click', gameContainerClickListener);
    }
    else {
        console.error("Game container element not found, cannot add click listener for pointer lock.");
    }
    if (controls) {
        controls.addEventListener('lock', onPointerLockChange);
        controls.addEventListener('unlock', onPointerLockChange);
    }
    document.addEventListener('pointerlockerror', onPointerLockError);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('pointerdown', onPointerDown);
    // Initial Scoreboard Update (empty)
    updateScoreboardDisplay();
    animate(0);
    console.log("Client initialization complete.");
}
// --- Event Handlers ---
function onWindowResize() {
    if (scene_1.camera && scene_1.renderer) {
        scene_1.camera.aspect = window.innerWidth / window.innerHeight;
        scene_1.camera.updateProjectionMatrix();
        scene_1.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}
function onPointerLockChange() {
    if (controls && instructions) {
        const isActuallyLocked = document.pointerLockElement === (scene_1.renderer === null || scene_1.renderer === void 0 ? void 0 : scene_1.renderer.domElement);
        if (isActuallyLocked) {
            instructions.style.display = 'none';
            // --- Hide scoreboard on lock ---
            if (scoreboardVisible && !showingEndGameScoreboard) {
                toggleScoreboard(false);
            }
            // -----------------------------
        }
        else {
            if (!(0, chat_1.isChatting)() && !isLocalPlayerDead) {
                instructions.style.display = 'block';
            }
            moveForward = moveBackward = moveLeft = moveRight = moveUp = moveDown = false;
        }
    }
}
function onPointerLockError() {
    console.error('PointerLockControls: Unable to use Pointer Lock API');
    if (instructions && !isLocalPlayerDead) {
        instructions.style.display = 'block';
    }
}
function onKeyDown(event) {
    if (isLocalPlayerDead && event.key !== 'Tab') { // Allow TAB even when dead
        return;
    }
    if ((0, chat_1.isChatting)()) {
        return; // Chat input handles Enter/Escape
    }
    // Handle TAB for scoreboard toggle
    if (event.key === 'Tab') {
        event.preventDefault(); // Prevent tabbing to next element
        // Allow showing the scoreboard if it's hidden, even during end game (though it should already be shown)
        // Prevent hiding the scoreboard via TAB if it's the end-game display
        if (!scoreboardVisible) {
            toggleScoreboard(true);
        }
        else if (scoreboardVisible && !showingEndGameScoreboard) {
            // If you want TAB to toggle hide when NOT in end-game, uncomment the next line
            // toggleScoreboard(false);
        }
        // If you want press-and-hold, handle it in onKeyUp
        return; // Don't process other keys if TAB was pressed
    }
    // Pointer is locked, not chatting, not dead
    switch (event.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            moveForward = true;
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            moveLeft = true;
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            moveBackward = true;
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            moveRight = true;
            break;
        case ' ':
            moveUp = true;
            break;
        case 'Shift':
        case 'c':
        case 'C':
            moveDown = true;
            break;
        case 'Escape':
            controls === null || controls === void 0 ? void 0 : controls.unlock();
            break;
        case 'Enter':
            controls === null || controls === void 0 ? void 0 : controls.unlock();
            (0, chat_1.toggleChatInput)(true);
            break;
    }
}
function onKeyUp(event) {
    // Allow TAB release detection
    if (event.key === 'Tab') {
        // --- If using press-and-hold scoreboard ---
        // Check if the scoreboard is visible AND it's NOT the end-game board
        if (scoreboardVisible && !showingEndGameScoreboard) {
            toggleScoreboard(false); // Hide on release
        }
        // --- End press-and-hold ---
        return;
    }
    // Reset movement flags
    switch (event.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            moveForward = false;
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            moveLeft = false;
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            moveBackward = false;
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            moveRight = false;
            break;
        case ' ':
            moveUp = false;
            break;
        case 'Shift':
        case 'c':
        case 'C':
            moveDown = false;
            break;
    }
}
function onPointerDown(event) {
    if (controls && controls.isLocked && !(0, chat_1.isChatting)() && !isLocalPlayerDead) {
        performRaycast();
    }
}
function performRaycast() {
    if (!scene_1.camera || !scene_1.scene || !controls || !raycaster || isLocalPlayerDead)
        return;
    pointer.x = 0;
    pointer.y = 0;
    raycaster.setFromCamera(pointer, scene_1.camera);
    const playerMeshes = (0, playerManager_1.getOtherPlayerMeshes)();
    let endPoint = null;
    let laserColor = 0x000000;
    const laserOrigin = new THREE.Vector3();
    scene_1.camera.getWorldPosition(laserOrigin);
    const missDistance = 50;
    if (playerMeshes.length > 0) {
        const intersects = raycaster.intersectObjects(playerMeshes);
        if (intersects.length > 0) {
            const closestHit = intersects[0];
            endPoint = closestHit.point;
            const meshName = closestHit.object.name;
            const match = meshName.match(/^player_(\d+)$/);
            if (match && match[1]) {
                const hitPlayerId = parseInt(match[1], 10);
                (0, websocket_1.sendMessage)({ type: 'player_hit', payload: { targetUserId: hitPlayerId } });
                laserColor = 0xff0000; // Red for hit
            }
            else {
                laserColor = 0xffa500; // Orange for unknown hit
            }
        }
    }
    if (!endPoint) {
        endPoint = new THREE.Vector3();
        endPoint.copy(laserOrigin).addScaledVector(raycaster.ray.direction, missDistance);
        laserColor = 0x00ffff; // Cyan for miss
    }
    (0, websocket_1.sendMessage)({
        type: 'laser_fired',
        payload: {
            startPoint: { x: laserOrigin.x, y: laserOrigin.y, z: laserOrigin.z },
            endPoint: { x: endPoint.x, y: endPoint.y, z: endPoint.z },
            color: laserColor
        }
    });
}
// --- Game Loop ---
function animate(time) {
    animationFrameId = requestAnimationFrame(animate);
    const currentTime = performance.now();
    const delta = (currentTime - prevTime) / 1000;
    const canMove = (controls === null || controls === void 0 ? void 0 : controls.isLocked) === true && !isLocalPlayerDead;
    if (canMove && controls && scene_1.camera) {
        // --- Movement ---
        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();
        const speed = 5.0;
        velocity.z = direction.z * speed;
        velocity.x = direction.x * speed;
        const verticalSpeed = 4.0;
        if (moveUp)
            velocity.y = verticalSpeed;
        else if (moveDown)
            velocity.y = -verticalSpeed;
        else
            velocity.y = 0;
        controls.moveRight(velocity.x * delta);
        controls.moveForward(velocity.z * delta);
        controls.object.position.y += velocity.y * delta;
        const floorY = 1.6;
        if (controls.object.position.y < floorY) {
            controls.object.position.y = floorY;
            velocity.y = 0;
        }
        // --- Rotation & Send Updates ---
        const directionVector = new THREE.Vector3();
        scene_1.camera.getWorldDirection(directionVector);
        const currentRotationY = Math.atan2(directionVector.x, directionVector.z);
        const currentRotationX = scene_1.camera.rotation.x;
        const positionChanged = velocity.lengthSq() > 0.001;
        const rotationChangedY = Math.abs(currentRotationY - lastSentRotationY) > 0.01;
        const rotationChangedX = Math.abs(currentRotationX - lastSentRotationX) > 0.01;
        const rotationChanged = rotationChangedY || rotationChangedX;
        if (currentTime - lastSentTime > SEND_INTERVAL && (positionChanged || rotationChanged)) {
            const currentPosition = controls.object.position;
            (0, websocket_1.sendMessage)({
                type: 'player_move',
                payload: {
                    x: currentPosition.x, y: currentPosition.y, z: currentPosition.z,
                    rotationY: currentRotationY, rotationX: currentRotationX
                }
            });
            lastSentTime = currentTime;
            lastSentRotationY = currentRotationY;
            lastSentRotationX = currentRotationX;
        }
    }
    else {
        velocity.set(0, 0, 0);
    }
    // Update other players
    (0, playerManager_1.updateOtherPlayers)(currentTime, INTERPOLATION_DELAY);
    // --- Update Match Timer Display ---
    updateMatchTimerDisplay();
    // --------------------------------
    // Render
    if (scene_1.renderer && scene_1.scene && scene_1.camera) {
        (0, scene_1.animate)(time);
    }
    prevTime = currentTime;
}
// --- WebSocket Message Handling ---
function handleServerMessage(message) {
    var _a, _b, _c, _d, _e, _f;
    if (!message || typeof message.type !== 'string') {
        console.warn("Received invalid message from server:", message);
        return;
    }
    try {
        switch (message.type) {
            case 'authenticated':
                localPlayerId = message.payload.userId;
                localPlayerUsername = message.payload.username; // Store username
                localPlayerHealth = message.payload.health;
                localPlayerKills = message.payload.kills; // Store initial kills
                updateHealthDisplay();
                // Add self to scores
                playerScores.set(localPlayerId, { username: localPlayerUsername, kills: localPlayerKills });
                updateScoreboardDisplay();
                console.log(`Authenticated as ${localPlayerUsername} (ID: ${localPlayerId}), Health: ${localPlayerHealth}, Kills: ${localPlayerKills}`);
                break;
            case 'initial_state':
                matchEndTime = message.payload.matchEndTime; // Store match end time
                if (localPlayerId === null && message.payload.currentUser) {
                    localPlayerId = message.payload.currentUser.userId;
                    localPlayerUsername = message.payload.currentUser.username;
                    localPlayerHealth = (_a = message.payload.currentUser.health) !== null && _a !== void 0 ? _a : 100;
                    localPlayerKills = (_b = message.payload.currentUser.kills) !== null && _b !== void 0 ? _b : 0;
                    updateHealthDisplay();
                    // Add self to scores
                    playerScores.set(localPlayerId, { username: localPlayerUsername, kills: localPlayerKills });
                }
                console.log("Received initial state:", message.payload);
                // Add other players to scores
                playerScores.clear(); // Clear just in case
                if (localPlayerId !== null) { // Re-add self if already known
                    playerScores.set(localPlayerId, { username: localPlayerUsername, kills: localPlayerKills });
                }
                message.payload.players.forEach((playerData) => {
                    var _a;
                    (0, playerManager_1.addOtherPlayer)(playerData);
                    playerScores.set(playerData.userId, { username: playerData.username, kills: (_a = playerData.kills) !== null && _a !== void 0 ? _a : 0 });
                });
                updateScoreboardDisplay(); // Update scoreboard with initial players
                if (message.payload.currentUser) {
                    (0, ui_1.updateUserInfo)(userInfoElement, `Logged in as: ${message.payload.currentUser.username} (ID: ${message.payload.currentUser.userId})`);
                    if (scene_1.camera && controls && message.payload.currentUser.x !== undefined) {
                        controls.object.position.set(message.payload.currentUser.x, message.payload.currentUser.y, message.payload.currentUser.z);
                        lastSentRotationY = message.payload.currentUser.rotationY || 0;
                        lastSentRotationX = message.payload.currentUser.rotationX || 0;
                        isLocalPlayerDead = ((_c = message.payload.currentUser.health) !== null && _c !== void 0 ? _c : 100) <= 0;
                        if (isLocalPlayerDead) {
                            handleLocalPlayerDeath();
                        }
                    }
                }
                break;
            case 'player_joined':
                if (message.payload.userId !== localPlayerId) {
                    (0, playerManager_1.addOtherPlayer)(message.payload);
                    // Add to scores
                    playerScores.set(message.payload.userId, { username: message.payload.username, kills: (_d = message.payload.kills) !== null && _d !== void 0 ? _d : 0 });
                    updateScoreboardDisplay();
                }
                break;
            case 'player_left':
                if (message.payload.userId !== localPlayerId) {
                    (0, playerManager_1.removeOtherPlayer)(message.payload.userId);
                    // Remove from scores
                    playerScores.delete(message.payload.userId);
                    updateScoreboardDisplay();
                }
                break;
            case 'player_moved':
                if (message.payload.userId !== localPlayerId) {
                    (0, playerManager_1.updateOtherPlayerState)(message.payload);
                    // Update score data if needed (e.g., username change, though not implemented)
                    const scoreData = playerScores.get(message.payload.userId);
                    if (scoreData && message.payload.username && scoreData.username !== message.payload.username) {
                        scoreData.username = message.payload.username;
                        updateScoreboardDisplay();
                    }
                }
                break;
            case 'new_chat_message':
                (0, chat_1.displayChatMessage)(message.payload.username, message.payload.message);
                break;
            case 'auth_error':
                console.error("Authentication error:", message.payload.message);
                (0, ui_1.showLoginError)(userInfoElement, `Login Failed: ${message.payload.message}`);
                if (controls)
                    controls.unlock();
                setTimeout(() => window.location.href = '/login.html', 3000);
                break;
            case 'player_hit_success':
                // Optional feedback
                break;
            case 'player_was_hit':
                if (localPlayerId !== null) {
                    localPlayerHealth = message.payload.newHealth;
                    updateHealthDisplay();
                    console.log(`Ouch! Hit by ${message.payload.attackerUsername}. Health: ${localPlayerHealth}`);
                    document.body.style.animation = 'flashRed 0.2s ease-out';
                    setTimeout(() => document.body.style.animation = '', 200);
                }
                break;
            case 'player_died':
                console.log(`Player Died: ${message.payload.victimUsername} (killed by ${message.payload.attackerUsername})`);
                (0, chat_1.displayChatMessage)('System', `${message.payload.victimUsername} was killed by ${message.payload.attackerUsername}`);
                // Update attacker's score
                const attackerScore = playerScores.get(message.payload.attackerId);
                if (attackerScore) {
                    attackerScore.kills = message.payload.attackerKills;
                    updateScoreboardDisplay();
                }
                else if (message.payload.attackerId === localPlayerId) {
                    // If the attacker is the local player, update local state too
                    localPlayerKills = message.payload.attackerKills;
                    const localScore = playerScores.get(localPlayerId);
                    if (localScore)
                        localScore.kills = localPlayerKills;
                    updateScoreboardDisplay();
                }
                if (message.payload.victimId === localPlayerId) {
                    handleLocalPlayerDeath();
                }
                else {
                    (0, playerManager_1.updateOtherPlayerState)({ userId: message.payload.victimId, health: 0, kills: (_e = playerScores.get(message.payload.victimId)) === null || _e === void 0 ? void 0 : _e.kills }); // Pass kills too
                }
                break;
            case 'player_respawned':
                console.log(`Player Respawned: ${message.payload.username}`);
                // Update score data (kills might have reset to 0 on server)
                const respawnedScore = playerScores.get(message.payload.userId);
                if (respawnedScore) {
                    respawnedScore.kills = (_f = message.payload.kills) !== null && _f !== void 0 ? _f : 0;
                    updateScoreboardDisplay();
                }
                if (message.payload.userId === localPlayerId) {
                    handleLocalPlayerRespawn(message.payload);
                }
                else {
                    (0, playerManager_1.updateOtherPlayerState)(message.payload); // This now includes kills
                }
                break;
            // --- HANDLE MATCH & SCORE ---
            case 'match_end':
                console.log("Match ended. Final scores:", message.payload.scores);
                (0, chat_1.displayChatMessage)('System', `Match Over! Final Scores:`);
                // Update local scores map with final data
                playerScores.clear();
                message.payload.scores.forEach(score => {
                    playerScores.set(score.userId, { username: score.username, kills: score.kills });
                    // Optionally display final scores in chat too
                    // displayChatMessage('System', `- ${score.username}: ${score.kills}`);
                });
                // Update and show scoreboard
                updateScoreboardDisplay("Match Over! Next round starts soon...");
                showingEndGameScoreboard = true; // Mark that we are showing the end game board
                console.log("match_end: Set showingEndGameScoreboard = true");
                toggleScoreboard(true); // Force show the scoreboard
                // Hide after 10 seconds (handled by new_match now)
                break;
            case 'new_match':
                console.log("New match starting.");
                (0, chat_1.displayChatMessage)('System', `New Match Starting!`);
                matchEndTime = message.payload.matchEndTime; // Update timer
                // Reset local scores
                playerScores.clear();
                // Add self back
                if (localPlayerId !== null) {
                    localPlayerKills = 0; // Reset local kills
                    playerScores.set(localPlayerId, { username: localPlayerUsername, kills: localPlayerKills });
                }
                // Reset scores for other players managed locally (they will get respawn messages)
                (0, playerManager_1.getAllPlayerData)().forEach(player => {
                    if (player.userId !== localPlayerId) {
                        playerScores.set(player.userId, { username: player.username, kills: 0 });
                    }
                });
                // Hide end-game scoreboard if it was visible and reset the flag
                if (showingEndGameScoreboard) {
                    console.log("new_match: Hiding end-game scoreboard and resetting flag.");
                    showingEndGameScoreboard = false; // Reset the flag FIRST
                    toggleScoreboard(false); // Then hide the board
                }
                else {
                    // Ensure scoreboard is hidden if it was somehow left open but not in end game state
                    if (scoreboardVisible) {
                        toggleScoreboard(false);
                    }
                }
                updateScoreboardDisplay(); // Update with reset scores (clears message)
                break;
            // --- END HANDLE MATCH & SCORE ---
            case 'show_laser':
                if (scene_1.scene && scene_1.camera && scene_1.renderer) {
                    const { startPoint, endPoint, color } = message.payload;
                    const startVec = new THREE.Vector3(startPoint.x, startPoint.y, startPoint.z);
                    const endVec = new THREE.Vector3(endPoint.x, endPoint.y, endPoint.z);
                    (0, utils_1.showLaserEffect)(scene_1.scene, scene_1.camera, startVec, endVec, color, 200);
                }
                break;
            case 'error':
                console.error("Server error message:", message.payload.message);
                (0, chat_1.displayChatMessage)('System', `Server Error: ${message.payload.message}`);
                break;
            default:
                const _exhaustiveCheck = message;
                console.warn("Received unhandled message type:", _exhaustiveCheck === null || _exhaustiveCheck === void 0 ? void 0 : _exhaustiveCheck.type);
        }
    }
    catch (error) {
        console.error("Error processing server message:", error, "Message:", message);
    }
}
// --- Handle Local Player Death ---
function handleLocalPlayerDeath() {
    if (isLocalPlayerDead)
        return;
    console.log("--- YOU DIED ---");
    isLocalPlayerDead = true;
    localPlayerHealth = 0;
    updateHealthDisplay();
    if (controls) {
        controls.unlock();
    }
    if (instructions) {
        instructions.textContent = "You died! Respawning soon...";
        instructions.style.display = 'block';
    }
    moveForward = moveBackward = moveLeft = moveRight = moveUp = moveDown = false;
    velocity.set(0, 0, 0);
}
// --- Handle Local Player Respawn ---
function handleLocalPlayerRespawn(payload) {
    var _a, _b, _c, _d;
    console.log("--- RESPAWNED ---");
    isLocalPlayerDead = false;
    localPlayerHealth = (_a = payload.health) !== null && _a !== void 0 ? _a : 100;
    localPlayerKills = (_b = payload.kills) !== null && _b !== void 0 ? _b : 0; // Update kills on respawn
    updateHealthDisplay();
    // Update score map
    if (localPlayerId !== null) {
        const scoreData = playerScores.get(localPlayerId);
        if (scoreData)
            scoreData.kills = localPlayerKills;
        updateScoreboardDisplay();
    }
    if (instructions) {
        instructions.innerHTML = `
            <div>Click to play</div>
            <div>W, A, S, D / Arrows: Move</div>
            <div>SPACE: Up</div>
            <div>SHIFT / C: Down</div>
            <div>ESC: Release mouse</div>
            <div>ENTER: Toggle Chat</div>
            <div>TAB: Show/Hide Scoreboard</div>
        `;
        instructions.style.display = 'none';
    }
    if (controls && scene_1.camera) {
        controls.object.position.set(payload.x, payload.y, payload.z);
        lastSentRotationY = (_c = payload.rotationY) !== null && _c !== void 0 ? _c : 0;
        lastSentRotationX = (_d = payload.rotationX) !== null && _d !== void 0 ? _d : 0;
        controls.object.updateMatrixWorld(true);
    }
}
// --- Update Health Display ---
function updateHealthDisplay() {
    if (healthDisplayElement) {
        healthDisplayElement.textContent = `Health: ${localPlayerHealth}`;
        // Change color based on health
        const healthPercent = Math.max(0, localPlayerHealth) / 100;
        const red = Math.round(200 * (1 - healthPercent));
        const green = Math.round(180 * healthPercent); // Keep some green even at low health
        healthDisplayElement.style.backgroundColor = `rgba(${red}, ${green}, 0, 0.7)`;
    }
}
function updateMatchTimerDisplay() {
    if (!matchTimerElement) {
        return;
    }
    if (matchEndTime <= 0) {
        matchTimerElement.style.display = 'none';
        return;
    }
    // Use Date.now() here to match the server's time reference
    const currentEpochTime = Date.now();
    const remainingMs = Math.max(0, matchEndTime - currentEpochTime); // Use currentEpochTime
    // -----------------------------------------------------------------
    const remainingSeconds = Math.floor(remainingMs / 1000);
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    matchTimerElement.textContent = `Match Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    matchTimerElement.style.display = 'block';
}
// --- Scoreboard Functions ---
function toggleScoreboard(show) {
    if (!scoreboardElement)
        return; // Element must exist
    // Prevent hiding via TAB if the end-game scoreboard is forced visible
    if (!show && showingEndGameScoreboard) {
        console.log("toggleScoreboard: Preventing hide because showingEndGameScoreboard is true.");
        return;
    }
    // Allow showing the scoreboard regardless of showingEndGameScoreboard state
    // Allow hiding if showingEndGameScoreboard is false
    scoreboardVisible = show;
    scoreboardElement.style.display = show ? 'block' : 'none';
    console.log(`toggleScoreboard: Set display to ${show ? 'block' : 'none'}. scoreboardVisible=${scoreboardVisible}`);
    // If showing scoreboard (and not already unlocked by end game), unlock pointer
    if (show && (controls === null || controls === void 0 ? void 0 : controls.isLocked)) {
        console.log("toggleScoreboard: Unlocking controls.");
        controls.unlock();
    }
    // --- No change needed for unlocking ---
    // If hiding scoreboard (and not in end game state), potentially re-lock if needed (though usually done by clicking)
    // else if (!show && !showingEndGameScoreboard) {
    //     // Optional: Add logic here if you want TAB to re-lock pointer lock immediately
    // }
}
function updateScoreboardDisplay(message = null) {
    // --- FIX: Add null check here for safety ---
    if (!scoreboardTableBody || !scoreboardMessageElement) {
        console.warn("Scoreboard elements not found, cannot update display.");
        return;
    }
    // -------------------------------------------
    // Clear previous scores
    scoreboardTableBody.innerHTML = '';
    // Get scores from map and sort
    const sortedScores = Array.from(playerScores.values()).sort((a, b) => b.kills - a.kills);
    // Populate table
    sortedScores.forEach(score => {
        // --- FIX: Use the correctly typed scoreboardTableBody ---
        const row = scoreboardTableBody.insertRow();
        // -------------------------------------------------------
        const nameCell = row.insertCell();
        const killsCell = row.insertCell();
        nameCell.textContent = (0, utils_1.sanitizeHTML)(score.username);
        killsCell.textContent = score.kills.toString();
        // Highlight local player
        const scoreData = playerScores.get(localPlayerId !== null && localPlayerId !== void 0 ? localPlayerId : -1);
        if (scoreData && scoreData.username === score.username) {
            row.style.backgroundColor = 'rgba(255, 255, 100, 0.2)'; // Yellowish highlight
            row.style.fontWeight = 'bold';
        }
    });
    // Update message
    scoreboardMessageElement.textContent = message || '';
    scoreboardMessageElement.style.display = message ? 'block' : 'none';
}
// --- End Scoreboard Functions ---
function handleWebSocketClose() {
    console.log("WebSocket connection closed.");
    if (userInfoElement) {
        (0, ui_1.showLoginError)(userInfoElement, "Connection lost. Attempting to reconnect...");
    }
    if (controls) {
        controls.unlock();
    }
    isLocalPlayerDead = true;
    if (instructions) {
        instructions.textContent = "Connection Lost...";
        instructions.style.display = 'block';
    }
    updateHealthDisplay();
    // Clear scores on disconnect
    playerScores.clear();
    updateScoreboardDisplay("Disconnected");
    if (scoreboardVisible)
        toggleScoreboard(false); // Hide scoreboard
    matchEndTime = 0; // Reset timer
    updateMatchTimerDisplay();
}
function handleSendMessage(messageText) {
    if (messageText.trim() && !isLocalPlayerDead) {
        (0, websocket_1.sendMessage)({
            type: 'chat_message',
            payload: { message: messageText }
        });
    }
}
function handleLogout() {
    console.log("Logging out...");
    cleanup();
    localStorage.removeItem('authToken');
    localStorage.removeItem('userInfo');
    window.location.href = '/login.html';
}
let gameContainerClickListener = null;
function cleanup() {
    console.log("Cleaning up client...");
    if (animationFrameId !== null)
        cancelAnimationFrame(animationFrameId);
    window.removeEventListener('resize', onWindowResize);
    if (gameContainer && gameContainerClickListener)
        gameContainer.removeEventListener('click', gameContainerClickListener);
    if (controls) {
        controls.removeEventListener('lock', onPointerLockChange);
        controls.removeEventListener('unlock', onPointerLockChange);
        controls.dispose();
    }
    document.removeEventListener('pointerlockerror', onPointerLockError);
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
    document.removeEventListener('pointerdown', onPointerDown);
    // No need to remove health display if it's part of HTML
    (0, playerManager_1.cleanupPlayers)();
    (0, websocket_1.cleanupWebSocket)();
    (0, ui_1.cleanupUI)();
    (0, chat_1.cleanupChat)();
    (0, scene_1.cleanupScene)();
    // Reset state
    controls = null;
    moveForward = moveBackward = moveLeft = moveRight = moveUp = moveDown = false;
    velocity.set(0, 0, 0);
    direction.set(0, 0, 0);
    lastSentRotationY = 0;
    lastSentRotationX = 0;
    localPlayerId = null;
    localPlayerUsername = "Player";
    localPlayerHealth = 100;
    localPlayerKills = 0;
    isLocalPlayerDead = false;
    scoreboardVisible = false;
    playerScores.clear();
    showingEndGameScoreboard = false;
    matchEndTime = 0;
    animationFrameId = null;
    gameContainerClickListener = null;
    console.log("Client cleanup complete.");
}
// --- Start ---
const token = localStorage.getItem('authToken');
if (!token) {
    console.log("No token found, redirecting to login.");
    window.location.href = '/login.html';
}
else {
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes flashRed { 0% { background-color: transparent; } 50% { background-color: rgba(255, 0, 0, 0.3); } 100% { background-color: transparent; } }
        body { min-height: 100vh; }
    `;
    document.head.appendChild(style);
    window.addEventListener('beforeunload', cleanup);
    init();
}
