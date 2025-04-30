// src/client/main.ts
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { setupScene, scene, camera, renderer, animate as startAnimateLoop, cleanupScene } from './scene';
// Import ScoreboardEntry along with other types
import { setupWebSocket, sendMessage, ws, cleanupWebSocket, ServerMessage, ClientMessage, PlayerState, ScoreboardEntry } from './websocket';
// Import getAllPlayerData along with other functions
import { setupPlayerManager, addOtherPlayer, updateOtherPlayerState, removeOtherPlayer, cleanupPlayers, updateOtherPlayers, PlayerData, getOtherPlayerMeshes, getAllPlayerData } from './playerManager';
import { setupUI, updateUserInfo, showLoginError, cleanupUI } from './ui';
import { setupChat, displayChatMessage, cleanupChat, toggleChatInput, isChatting } from './chat';
import { Raycaster, Vector2 } from 'three';
import { showLaserEffect, sanitizeHTML } from './utils'; // Import sanitizeHTML

// --- State ---
let controls: PointerLockControls | null = null;
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

let raycaster: THREE.Raycaster;
const pointer = new THREE.Vector2();
let animationFrameId: number | null = null;

// --- Player State ---
let localPlayerId: number | null = null;
let localPlayerUsername: string = "Player"; // Store username locally
let localPlayerHealth: number = 100;
let localPlayerKills: number = 0; // Store kills locally
let isLocalPlayerDead: boolean = false;
// --------------------

// --- Scoreboard State ---
let scoreboardVisible: boolean = false;
let playerScores = new Map<number, { username: string, kills: number }>();
let showingEndGameScoreboard = false;
// ----------------------

// --- Match State ---
let matchEndTime: number = 0;
// -----------------

// DOM Elements
const instructions = document.getElementById('instructions');
const gameContainer = document.getElementById('game-container');
const userInfoElement = document.getElementById('user-info');
const logoutButton = document.getElementById('logout-button') as HTMLButtonElement | null;
const chatOutput = document.getElementById('chat-output');
const chatInput = document.getElementById('chat-input') as HTMLInputElement | null;
const chatContainer = document.getElementById('chat-container');
const healthDisplayElement = document.getElementById('health-display');
// --- NEW: Scoreboard & Timer Elements ---
const scoreboardElement = document.getElementById('scoreboard');
// --- FIX: Cast scoreboardTableBody to the correct type ---
const scoreboardTableBody = document.querySelector('#scoreboard-table tbody') as HTMLTableSectionElement | null;
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
        if (!gameContainer) console.error("Missing: #game-container");
        if (!instructions) console.error("Missing: #instructions");
        if (!userInfoElement) console.error("Missing: #user-info");
        if (!chatOutput) console.error("Missing: #chat-output");
        if (!chatInput) console.error("Missing: #chat-input");
        if (!chatContainer) console.error("Missing: #chat-container");
        if (!healthDisplayElement) console.error("Missing: #health-display");
        if (!scoreboardElement) console.error("Missing: #scoreboard");
        // --- FIX: Check the casted variable ---
        if (!scoreboardTableBody) console.error("Missing: #scoreboard-table tbody");
        // --------------------------------------
        if (!scoreboardMessageElement) console.error("Missing: #scoreboard-message");
        if (!matchTimerElement) console.error("Missing: #match-timer");
        return;
    }
    // ------------------------------------

    updateHealthDisplay(); // Initial update

    // Scene Setup
    setupScene(gameContainer);
    if (!camera || !renderer || !scene) {
        console.error("Scene setup failed.");
        return;
    }

    // Controls Setup
    controls = new PointerLockControls(camera, renderer.domElement);
    scene.add(controls.object);

    // UI Setup
    setupUI(logoutButton, userInfoElement, handleLogout);

    // Chat Setup
    setupChat(chatContainer, chatOutput, chatInput, handleSendMessage);

    // WebSocket Setup
    setupWebSocket(handleServerMessage, handleWebSocketClose);

    // Player Manager Setup
    setupPlayerManager(scene);

    // Initialize Raycaster
    raycaster = new THREE.Raycaster();

    // Event Listeners
    window.addEventListener('resize', onWindowResize);

    if (gameContainer) {
        gameContainerClickListener = () => {
            const currentChatState = isChatting();
            if (!currentChatState && !isLocalPlayerDead && controls && !controls.isLocked) {
                controls.lock();
            }
        };
        gameContainer.addEventListener('click', gameContainerClickListener);
    } else {
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
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

function onPointerLockChange() {
    if (controls && instructions) {
        const isActuallyLocked = document.pointerLockElement === renderer?.domElement;
        if (isActuallyLocked) {
            instructions.style.display = 'none';
            // --- Hide scoreboard on lock ---
            if (scoreboardVisible && !showingEndGameScoreboard) {
                toggleScoreboard(false);
            }
            // -----------------------------
        } else {
            if (!isChatting() && !isLocalPlayerDead) {
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

function onKeyDown(event: KeyboardEvent) {
    if (isLocalPlayerDead && event.key !== 'Tab') { // Allow TAB even when dead
        return;
    }

    if (isChatting()) {
        return; // Chat input handles Enter/Escape
    }

    // Handle TAB for scoreboard toggle
    if (event.key === 'Tab') {
        event.preventDefault(); // Prevent tabbing to next element

        // Allow showing the scoreboard if it's hidden, even during end game (though it should already be shown)
        // Prevent hiding the scoreboard via TAB if it's the end-game display
        if (!scoreboardVisible) {
            toggleScoreboard(true);
        } else if (scoreboardVisible && !showingEndGameScoreboard) {
            // If you want TAB to toggle hide when NOT in end-game, uncomment the next line
            // toggleScoreboard(false);
        }
        // If you want press-and-hold, handle it in onKeyUp

        return; // Don't process other keys if TAB was pressed
    }

    // Pointer is locked, not chatting, not dead
    switch (event.key) {
        case 'ArrowUp': case 'w': case 'W': moveForward = true; break;
        case 'ArrowLeft': case 'a': case 'A': moveLeft = true; break;
        case 'ArrowDown': case 's': case 'S': moveBackward = true; break;
        case 'ArrowRight': case 'd': case 'D': moveRight = true; break;
        case ' ': moveUp = true; break;
        case 'Shift': case 'c': case 'C': moveDown = true; break;
        case 'Escape':
            controls?.unlock();
            break;
        case 'Enter':
            controls?.unlock();
            toggleChatInput(true);
            break;
    }
}

function onKeyUp(event: KeyboardEvent) {
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
        case 'ArrowUp': case 'w': case 'W': moveForward = false; break;
        case 'ArrowLeft': case 'a': case 'A': moveLeft = false; break;
        case 'ArrowDown': case 's': case 'S': moveBackward = false; break;
        case 'ArrowRight': case 'd': case 'D': moveRight = false; break;
        case ' ': moveUp = false; break;
        case 'Shift': case 'c': case 'C': moveDown = false; break;
    }
}

function onPointerDown(event: PointerEvent) {
    if (controls && controls.isLocked && !isChatting() && !isLocalPlayerDead) {
        performRaycast();
    }
}

function performRaycast() {
    if (!camera || !scene || !controls || !raycaster || isLocalPlayerDead) return;
    pointer.x = 0;
    pointer.y = 0;
    raycaster.setFromCamera(pointer, camera);
    const playerMeshes = getOtherPlayerMeshes();
    let endPoint: THREE.Vector3 | null = null;
    let laserColor: number = 0x000000;
    const laserOrigin = new THREE.Vector3();
    camera.getWorldPosition(laserOrigin);
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
                sendMessage({ type: 'player_hit', payload: { targetUserId: hitPlayerId } });
                laserColor = 0xff0000; // Red for hit
            } else {
                laserColor = 0xffa500; // Orange for unknown hit
            }
        }
    }

    if (!endPoint) {
        endPoint = new THREE.Vector3();
        endPoint.copy(laserOrigin).addScaledVector(raycaster.ray.direction, missDistance);
        laserColor = 0x00ffff; // Cyan for miss
    }

    sendMessage({
        type: 'laser_fired',
        payload: {
            startPoint: { x: laserOrigin.x, y: laserOrigin.y, z: laserOrigin.z },
            endPoint: { x: endPoint.x, y: endPoint.y, z: endPoint.z },
            color: laserColor
        }
    });
}

// --- Game Loop ---
function animate(time: number) {
    animationFrameId = requestAnimationFrame(animate);
    const currentTime = performance.now();
    const delta = (currentTime - prevTime) / 1000;
    const canMove = controls?.isLocked === true && !isLocalPlayerDead;

    if (canMove && controls && camera) {
        // --- Movement ---
        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();
        const speed = 5.0;
        velocity.z = direction.z * speed;
        velocity.x = direction.x * speed;
        const verticalSpeed = 4.0;
        if (moveUp) velocity.y = verticalSpeed;
        else if (moveDown) velocity.y = -verticalSpeed;
        else velocity.y = 0;
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
        camera.getWorldDirection(directionVector);
        const currentRotationY = Math.atan2(directionVector.x, directionVector.z);
        const currentRotationX = camera.rotation.x;
        const positionChanged = velocity.lengthSq() > 0.001;
        const rotationChangedY = Math.abs(currentRotationY - lastSentRotationY) > 0.01;
        const rotationChangedX = Math.abs(currentRotationX - lastSentRotationX) > 0.01;
        const rotationChanged = rotationChangedY || rotationChangedX;
        if (currentTime - lastSentTime > SEND_INTERVAL && (positionChanged || rotationChanged)) {
            const currentPosition = controls.object.position;
            sendMessage({
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
    } else {
        velocity.set(0, 0, 0);
    }

    // Update other players
    updateOtherPlayers(currentTime, INTERPOLATION_DELAY);

    // --- Update Match Timer Display ---
    updateMatchTimerDisplay();
    // --------------------------------

    // Render
    if (renderer && scene && camera) {
        startAnimateLoop(time);
    }
    prevTime = currentTime;
}

// --- WebSocket Message Handling ---
function handleServerMessage(message: ServerMessage) {
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
                    localPlayerHealth = message.payload.currentUser.health ?? 100;
                    localPlayerKills = message.payload.currentUser.kills ?? 0;
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
                message.payload.players.forEach((playerData: PlayerState) => {
                    addOtherPlayer(playerData);
                    playerScores.set(playerData.userId, { username: playerData.username, kills: playerData.kills ?? 0 });
                });
                updateScoreboardDisplay(); // Update scoreboard with initial players

                if (message.payload.currentUser) {
                    updateUserInfo(userInfoElement, `Logged in as: ${message.payload.currentUser.username} (ID: ${message.payload.currentUser.userId})`);
                    if (camera && controls && message.payload.currentUser.x !== undefined) {
                        controls.object.position.set(
                            message.payload.currentUser.x,
                            message.payload.currentUser.y,
                            message.payload.currentUser.z
                        );
                        lastSentRotationY = message.payload.currentUser.rotationY || 0;
                        lastSentRotationX = message.payload.currentUser.rotationX || 0;
                        isLocalPlayerDead = (message.payload.currentUser.health ?? 100) <= 0;
                        if (isLocalPlayerDead) {
                            handleLocalPlayerDeath();
                        }
                    }
                }
                break;

            case 'player_joined':
                if (message.payload.userId !== localPlayerId) {
                    addOtherPlayer(message.payload);
                    // Add to scores
                    playerScores.set(message.payload.userId, { username: message.payload.username, kills: message.payload.kills ?? 0 });
                    updateScoreboardDisplay();
                }
                break;

            case 'player_left':
                if (message.payload.userId !== localPlayerId) {
                    removeOtherPlayer(message.payload.userId);
                    // Remove from scores
                    playerScores.delete(message.payload.userId);
                    updateScoreboardDisplay();
                }
                break;

            case 'player_moved':
                if (message.payload.userId !== localPlayerId) {
                    updateOtherPlayerState(message.payload);
                    // Update score data if needed (e.g., username change, though not implemented)
                    const scoreData = playerScores.get(message.payload.userId);
                    if (scoreData && message.payload.username && scoreData.username !== message.payload.username) {
                        scoreData.username = message.payload.username;
                        updateScoreboardDisplay();
                    }
                }
                break;

            case 'new_chat_message':
                displayChatMessage(message.payload.username, message.payload.message);
                break;

            case 'auth_error':
                console.error("Authentication error:", message.payload.message);
                showLoginError(userInfoElement, `Login Failed: ${message.payload.message}`);
                if (controls) controls.unlock();
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
                displayChatMessage('System', `${message.payload.victimUsername} was killed by ${message.payload.attackerUsername}`);

                // Update attacker's score
                const attackerScore = playerScores.get(message.payload.attackerId);
                if (attackerScore) {
                    attackerScore.kills = message.payload.attackerKills;
                    updateScoreboardDisplay();
                } else if (message.payload.attackerId === localPlayerId) {
                    // If the attacker is the local player, update local state too
                    localPlayerKills = message.payload.attackerKills;
                    const localScore = playerScores.get(localPlayerId);
                    if (localScore) localScore.kills = localPlayerKills;
                    updateScoreboardDisplay();
                }


                if (message.payload.victimId === localPlayerId) {
                    handleLocalPlayerDeath();
                } else {
                    updateOtherPlayerState({ userId: message.payload.victimId, health: 0, kills: playerScores.get(message.payload.victimId)?.kills } as PlayerState); // Pass kills too
                }
                break;

            case 'player_respawned':
                console.log(`Player Respawned: ${message.payload.username}`);
                // Update score data (kills might have reset to 0 on server)
                const respawnedScore = playerScores.get(message.payload.userId);
                if (respawnedScore) {
                    respawnedScore.kills = message.payload.kills ?? 0;
                    updateScoreboardDisplay();
                }

                if (message.payload.userId === localPlayerId) {
                    handleLocalPlayerRespawn(message.payload);
                } else {
                    updateOtherPlayerState(message.payload); // This now includes kills
                }
                break;

            // --- HANDLE MATCH & SCORE ---
            case 'match_end':
                console.log("Match ended. Final scores:", message.payload.scores);
                displayChatMessage('System', `Match Over! Final Scores:`);
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
                displayChatMessage('System', `New Match Starting!`);
                matchEndTime = message.payload.matchEndTime; // Update timer
                // Reset local scores
                playerScores.clear();
                // Add self back
                if (localPlayerId !== null) {
                    localPlayerKills = 0; // Reset local kills
                    playerScores.set(localPlayerId, { username: localPlayerUsername, kills: localPlayerKills });
                }
                // Reset scores for other players managed locally (they will get respawn messages)
                getAllPlayerData().forEach(player => {
                    if (player.userId !== localPlayerId) {
                        playerScores.set(player.userId, { username: player.username, kills: 0 });
                    }
                });

                // Hide end-game scoreboard if it was visible and reset the flag
                if (showingEndGameScoreboard) {
                    console.log("new_match: Hiding end-game scoreboard and resetting flag.");
                    showingEndGameScoreboard = false; // Reset the flag FIRST
                    toggleScoreboard(false);      // Then hide the board
                } else {
                    // Ensure scoreboard is hidden if it was somehow left open but not in end game state
                    if(scoreboardVisible) {
                        toggleScoreboard(false);
                    }
                }
                updateScoreboardDisplay(); // Update with reset scores (clears message)
                break;
            // --- END HANDLE MATCH & SCORE ---

            case 'show_laser':
                if (scene && camera && renderer) {
                    const { startPoint, endPoint, color } = message.payload;
                    const startVec = new THREE.Vector3(startPoint.x, startPoint.y, startPoint.z);
                    const endVec = new THREE.Vector3(endPoint.x, endPoint.y, endPoint.z);
                    showLaserEffect(scene, camera, startVec, endVec, color, 200);
                }
                break;

            case 'error':
                console.error("Server error message:", message.payload.message);
                displayChatMessage('System', `Server Error: ${message.payload.message}`);
                break;

            default:
                const _exhaustiveCheck: never = message;
                console.warn("Received unhandled message type:", (_exhaustiveCheck as any)?.type);
        }
    } catch (error) {
        console.error("Error processing server message:", error, "Message:", message);
    }
}

// --- Handle Local Player Death ---
function handleLocalPlayerDeath() {
    if (isLocalPlayerDead) return;
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
function handleLocalPlayerRespawn(payload: PlayerState) {
    console.log("--- RESPAWNED ---");
    isLocalPlayerDead = false;
    localPlayerHealth = payload.health ?? 100;
    localPlayerKills = payload.kills ?? 0; // Update kills on respawn
    updateHealthDisplay();

    // Update score map
    if (localPlayerId !== null) {
        const scoreData = playerScores.get(localPlayerId);
        if (scoreData) scoreData.kills = localPlayerKills;
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
    if (controls && camera) {
        controls.object.position.set(payload.x, payload.y, payload.z);
        lastSentRotationY = payload.rotationY ?? 0;
        lastSentRotationX = payload.rotationX ?? 0;
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


function updateMatchTimerDisplay() { // Remove currentTime parameter
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
function toggleScoreboard(show: boolean) {
    if (!scoreboardElement) return; // Element must exist

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
    if (show && controls?.isLocked) {
        console.log("toggleScoreboard: Unlocking controls.");
        controls.unlock();
    }
    // --- No change needed for unlocking ---
    // If hiding scoreboard (and not in end game state), potentially re-lock if needed (though usually done by clicking)
    // else if (!show && !showingEndGameScoreboard) {
    //     // Optional: Add logic here if you want TAB to re-lock pointer lock immediately
    // }
}

function updateScoreboardDisplay(message: string | null = null) {
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

        nameCell.textContent = sanitizeHTML(score.username);
        killsCell.textContent = score.kills.toString();

        // Highlight local player
        const scoreData = playerScores.get(localPlayerId ?? -1);
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
        showLoginError(userInfoElement, "Connection lost. Attempting to reconnect...");
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
    if (scoreboardVisible) toggleScoreboard(false); // Hide scoreboard
    matchEndTime = 0; // Reset timer
    updateMatchTimerDisplay();
}

function handleSendMessage(messageText: string) {
    if (messageText.trim() && !isLocalPlayerDead) {
        sendMessage({
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

let gameContainerClickListener: (() => void) | null = null;

function cleanup() {
    console.log("Cleaning up client...");
    if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
    window.removeEventListener('resize', onWindowResize);
    if (gameContainer && gameContainerClickListener) gameContainer.removeEventListener('click', gameContainerClickListener);
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

    cleanupPlayers();
    cleanupWebSocket();
    cleanupUI();
    cleanupChat();
    cleanupScene();

    // Reset state
    controls = null;
    moveForward = moveBackward = moveLeft = moveRight = moveUp = moveDown = false;
    velocity.set(0, 0, 0); direction.set(0, 0, 0);
    lastSentRotationY = 0; lastSentRotationX = 0;
    localPlayerId = null; localPlayerUsername = "Player";
    localPlayerHealth = 100; localPlayerKills = 0;
    isLocalPlayerDead = false;
    scoreboardVisible = false; playerScores.clear(); showingEndGameScoreboard = false;
    matchEndTime = 0;
    animationFrameId = null; gameContainerClickListener = null;

    console.log("Client cleanup complete.");
}

// --- Start ---
const token = localStorage.getItem('authToken');
if (!token) {
    console.log("No token found, redirecting to login.");
    window.location.href = '/login.html';
} else {
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes flashRed { 0% { background-color: transparent; } 50% { background-color: rgba(255, 0, 0, 0.3); } 100% { background-color: transparent; } }
        body { min-height: 100vh; }
    `;
    document.head.appendChild(style);
    window.addEventListener('beforeunload', cleanup);
    init();
}
