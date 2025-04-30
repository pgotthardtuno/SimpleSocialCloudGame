// public/game.js
import * as THREE from 'three';
// Import PointerLockControls
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// --- Global Variables ---
let scene, camera, renderer, userCube, controls;
const movementSpeed = 5.0; // PointerLockControls uses different units, adjust speed
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let moveUp = false;
let moveDown = false;
const velocity = new THREE.Vector3(); // For smoother movement physics
const direction = new THREE.Vector3(); // Direction based on key input
const clock = new THREE.Clock(); // For delta time calculation
let isChatting = false; // Track chat state

// DOM Elements
const userInfoEl = document.getElementById('user-info');
const logoutButton = document.getElementById('logout-button');
const gameContainer = document.getElementById('game-container');
const instructionsEl = document.getElementById('instructions');
const chatContainer = document.getElementById('chat-container');
const chatOutput = document.getElementById('chat-output');
const chatInput = document.getElementById('chat-input');

// Auth/User Info
const token = localStorage.getItem('authToken');
let userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');

// --- WebSocket Variables ---
let ws; // WebSocket connection instance
// Map to store other players: userId -> {
//     mesh: THREE.Mesh,
//     label: THREE.Sprite,
//     username: string,
//     previousPos: { x: number, y: number, z: number, timestamp: number },
//     targetPos: { x: number, y: number, z: number, timestamp: number }
// }
const otherPlayers = new Map();

// --- Function to Initialize WebSocket ---
function initWebSocket() {
    // Construct WebSocket URL (ws:// or wss:// for secure)
    // --- UPDATED FOR HTTPS ---
    // This logic correctly determines the protocol based on the page's protocol
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // If you wanted to force wss:, you could use: const wsProtocol = 'wss:';
    // --- END UPDATE ---
    const wsUrl = `${wsProtocol}//${window.location.host}`; // Connect to the same host/port

    console.log(`Connecting to WebSocket at ${wsUrl}...`); // Should now log wss://...
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('WebSocket connection established.');
        // Authenticate immediately after opening
        if (token) {
            ws.send(JSON.stringify({
                type: 'authenticate',
                payload: { token: token }
            }));
        } else {
            console.error('Cannot authenticate WebSocket: No token found.');
            if (userInfoEl) userInfoEl.textContent = 'Error: Missing authentication token.';
            // Consider redirecting: window.location.href = '/login.html';
        }
    };

    ws.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            // Optional: Filter out noisy position updates for cleaner console
            if (message.type !== 'player_moved') {
                console.log('WebSocket message received:', message);
            }

            // Handle different message types from server
            switch (message.type) {
                case 'authenticated':
                    console.log('WebSocket authentication successful:', message.payload.message);
                    // Now we are ready to start sending updates and receiving game state
                    break;
                case 'auth_error':
                    console.error('WebSocket authentication failed:', message.payload.message);
                    alert('Session invalid or expired. Please log in again.');
                    window.location.href = '/login.html';
                    break;

                // Handle receiving the list of current players when you join
                case 'initial_state':
                    console.log("Received initial state:", message.payload);
                    if (message.payload && Array.isArray(message.payload.players)) {
                        message.payload.players.forEach(playerData => {
                            // Avoid adding yourself if server includes you in the list
                            if (playerData.userId !== userInfo.id && !otherPlayers.has(playerData.userId)) {
                                addOtherPlayer(playerData);
                            }
                        });
                    }
                    break;

                // Handle a new player joining after you're already connected
                case 'player_joined':
                    console.log("Player joined:", message.payload);
                    // Avoid adding yourself if server broadcasts your own join
                    if (message.payload && message.payload.userId !== userInfo.id && !otherPlayers.has(message.payload.userId)) {
                        addOtherPlayer(message.payload);
                    }
                    break;

                // Handle position updates from other players
                case 'player_moved':
                    // No console log here usually, too noisy
                    if (message.payload && message.payload.userId !== userInfo.id) {
                        updateOtherPlayerPosition(message.payload); // <-- Will now handle interpolation state
                    }
                    break;

                // Handle a player leaving the game
                case 'player_left':
                    console.log("Player left:", message.payload);
                    if (message.payload && message.payload.userId !== userInfo.id) {
                        removeOtherPlayer(message.payload.userId);
                    }
                    break;

                // Handle chat messages
                case 'new_chat_message':
                    if (message.payload) {
                        displayChatMessage(message.payload.username, message.payload.message);
                    }
                    break;

                default:
                    console.log('Unknown message type:', message.type);
            }
        } catch (e) {
            console.error('Failed to parse WebSocket message:', event.data, e);
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        if (userInfoEl) userInfoEl.textContent = 'Connection error. Please refresh or try logging in again.';
    };

    ws.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        if (userInfoEl) userInfoEl.textContent = 'Disconnected. Please refresh or log in again.';
        ws = null; // Clear the instance
        if (controls?.isLocked) {
            controls.unlock();
        }
        // Clean up other players when disconnected
        otherPlayers.forEach((player, userId) => {
            if (scene) {
                if (player.mesh) {
                    scene.remove(player.mesh);
                    player.mesh.geometry.dispose();
                    player.mesh.material.dispose();
                }
                if (player.label) {
                    scene.remove(player.label);
                    if (player.label.material.map) {
                        player.label.material.map.dispose();
                    }
                    player.label.material.dispose();
                }
            }
        });
        otherPlayers.clear();
        // Ensure chat is closed on disconnect
        if (isChatting) {
            toggleChat(true); // Force close chat without sending message
        }
    };
}

// --- Initialization ---
function initThreeJS() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeeeeee);
    scene.fog = new THREE.Fog(0xeeeeee, 10, 50);

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    if (gameContainer) {
        gameContainer.appendChild(renderer.domElement);
    } else {
        console.error("Game container not found!");
        return;
    }

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // --- ADD THE CENTRAL PYRAMID ---
    const pyramidRadius = 3;
    const pyramidHeight = 5;
    const pyramidRadialSegments = 4;
    const pyramidGeometry = new THREE.ConeGeometry(pyramidRadius, pyramidHeight, pyramidRadialSegments);
    const pyramidMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00 });
    const centralPyramid = new THREE.Mesh(pyramidGeometry, pyramidMaterial);
    centralPyramid.position.set(0, pyramidHeight / 2, 0);
    scene.add(centralPyramid);
    // --- END OF PYRAMID CODE ---

    // Pointer Lock Controls Setup
    controls = new PointerLockControls(camera, renderer.domElement);
    controls.getObject().position.y = 1.6; // Player height
    controls.getObject().position.z = 8; // Starting position
    scene.add(controls.getObject());

    // Event listeners for locking/unlocking pointer
    controls.addEventListener('lock', () => {
        if (instructionsEl) instructionsEl.style.display = 'none';
        console.log('Pointer Locked');
        // Ensure chat is not active when pointer locks
        if (isChatting) {
            toggleChat(true); // Force close chat
        }
    });
    controls.addEventListener('unlock', () => {
        // Only show instructions if chat is NOT active
        if (instructionsEl && !isChatting) {
            instructionsEl.style.display = 'block';
        }
        console.log('Pointer Unlocked');
        // Reset movement flags when pointer is unlocked
        moveForward = moveBackward = moveLeft = moveRight = moveUp = moveDown = false;
    });

    // Add listener to the game container to activate controls on click
    if (gameContainer) {
        gameContainer.addEventListener('click', () => {
            // Only lock controls if chat is not active
            if (controls && !controls.isLocked && !isChatting) {
                controls.lock();
            }
        });
    }

    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);

    // Start animation loop
    animate();
}

function onWindowResize() {
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// --- Game Logic ---
function spawnUserCube(colorString) {
    // This cube represents the player's view/body, often invisible or just hands/weapon
    const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1); // Make it small
    const material = new THREE.MeshStandardMaterial({ color: colorString || 0xffffff });
    userCube = new THREE.Mesh(geometry, material);

    if (controls) {
        // Attach to camera (controls.getObject() is the camera group)
        controls.getObject().add(userCube);
        // Position it slightly in front of the camera
        userCube.position.set(0, -0.1, -0.5);
        console.log(`Spawned user indicator cube with color: ${colorString}`);
    } else {
        console.error("Cannot spawn user cube: Controls not initialized.");
    }
}

// --- Helper Function to Create Username Labels ---
function createUsernameLabel(username) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    // --- Define sizes ---
    const boxCalcFontSize = 40; // Font size used ONLY for calculating box dimensions
    const drawingFontSize = 40; // Actual font size for drawing the text
    const padding = 10;

    // --- Calculate canvas size based on the SMALLER font size ---
    context.font = `Bold ${boxCalcFontSize}px Arial`; // Use smaller font for measurement
    const textWidth = context.measureText(username).width;
    canvas.width = textWidth + (padding * 2);
    canvas.height = boxCalcFontSize + (padding * 2); // Use smaller font size for height calc

    // --- Style the label ---
    context.fillStyle = 'black'; // Black background
    context.fillRect(0, 0, canvas.width, canvas.height);

    // --- Set the font size for drawing ---
    context.font = `Bold ${drawingFontSize}px Arial`; // Use the specified drawing font size
    context.fillStyle = 'white'; // White text
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    // --- Draw the text centered in the original box dimensions ---
    context.fillText(username, canvas.width / 2, canvas.height / 2);

    // --- Create texture and sprite (no changes needed here) ---
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false
    });

    const sprite = new THREE.Sprite(material);

    // Scale the sprite appropriately (using original canvas dimensions)
    const labelBaseScale = 0.01;
    sprite.scale.x = canvas.width * labelBaseScale;
    sprite.scale.y = canvas.height * labelBaseScale;

    return sprite;
}


// --- Other Player Management ---

function addOtherPlayer(playerData) {
    if (!scene || !playerData.username) return; // Ensure scene and username exist
    console.log(`Adding player ${playerData.username} (ID: ${playerData.userId})`);

    const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const material = new THREE.MeshStandardMaterial({ color: playerData.color || 0xaaaaaa });
    const cube = new THREE.Mesh(geometry, material);

    const initialX = playerData.x || 0;
    const initialY = playerData.y || 1.6;
    const initialZ = playerData.z || 0;
    const now = Date.now(); // Get current time for initial timestamp

    cube.position.set(initialX, initialY, initialZ); // Set initial visual position
    scene.add(cube);

    const labelSprite = createUsernameLabel(playerData.username);
    labelSprite.position.set(initialX, initialY + 0.5, initialZ);
    scene.add(labelSprite);

    // --- Store with Initial Interpolation State --- // <-- MODIFIED
    otherPlayers.set(playerData.userId, {
        mesh: cube,
        label: labelSprite,
        username: playerData.username,
        // Initialize previous and target to the same initial state
        previousPos: { x: initialX, y: initialY, z: initialZ, timestamp: now },
        targetPos: { x: initialX, y: initialY, z: initialZ, timestamp: now }
    });
}

function updateOtherPlayerPosition(playerData) { // <-- MODIFIED
    const player = otherPlayers.get(playerData.userId);
    if (player) {
        const now = Date.now();

        // Shift current target to previous
        player.previousPos = { ...player.targetPos }; // Copy the old target

        // Update target position and timestamp
        player.targetPos = {
            x: playerData.x,
            y: playerData.y,
            z: playerData.z,
            timestamp: now // Use arrival time on client
        };

        // IMPORTANT: Do NOT set player.mesh.position here anymore!
        // The animate loop will handle the interpolation.

    } else {
        // If we get an update for a player we don't know, add them.
        console.warn(`Received position update for unknown player ID: ${playerData.userId}. Adding them.`);
        addOtherPlayer(playerData); // Add them with initial interpolation state
    }
}

function removeOtherPlayer(userId) {
    if (!scene) return;
    const player = otherPlayers.get(userId);
    if (player) {
        console.log(`Removing player ${player.username} (ID: ${userId})`);

        // Remove and dispose mesh
        if (player.mesh) {
            scene.remove(player.mesh);
            player.mesh.geometry.dispose();
            player.mesh.material.dispose();
        }

        // Remove and dispose label
        if (player.label) {
            scene.remove(player.label);
            if (player.label.material.map) {
                player.label.material.map.dispose(); // Dispose texture
            }
            player.label.material.dispose(); // Dispose material
        }

        otherPlayers.delete(userId); // Remove from map
    }
}

// --- Helper Function to Display Chat Messages ---
function displayChatMessage(username, message) {
    if (!chatOutput) return;

    const messageElement = document.createElement('p');
    // Basic sanitization (replace < and > to prevent HTML injection)
    const safeUsername = (username || 'System').replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeMessage = message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    messageElement.innerHTML = `<strong>${safeUsername}:</strong> ${safeMessage}`; // Use innerHTML for bold, but with sanitized content

    chatOutput.appendChild(messageElement);

    // Auto-scroll to the bottom
    chatOutput.scrollTop = chatOutput.scrollHeight;
}


// --- Animation Loop (Definition) ---
function animate() { // <-- MODIFIED
    requestAnimationFrame(animate);

    const delta = clock.getDelta(); // Time elapsed since last frame (in seconds)
    const now = Date.now(); // Current time in milliseconds

    // --- Interpolate Other Players --- //
    // Adjust this value to smooth out jitter vs. responsiveness
    // 100ms = Match update interval exactly
    // 150ms = Slight buffer for jitter
    // 200ms = Double buffer (might feel slightly laggy)
    const interpolationTime = 100; // Using 150ms as suggested

    otherPlayers.forEach((player) => {
        if (!player.mesh || !player.targetPos) return; // Skip if mesh or targetPos doesn't exist

        const timeSinceLastUpdate = now - player.targetPos.timestamp;
        let t = timeSinceLastUpdate / interpolationTime; // Calculate interpolation factor (0 to 1)
        t = Math.max(0, Math.min(t, 1)); // Clamp t between 0 and 1

        // Interpolate position using THREE.Vector3.lerpVectors
        const interpolatedPosition = new THREE.Vector3();
        // Ensure previousPos exists before creating vectors
        if (player.previousPos) {
            const prevVec = new THREE.Vector3(player.previousPos.x, player.previousPos.y, player.previousPos.z);
            const targetVec = new THREE.Vector3(player.targetPos.x, player.targetPos.y, player.targetPos.z);
            interpolatedPosition.lerpVectors(prevVec, targetVec, t);

            // Set the mesh position
            player.mesh.position.copy(interpolatedPosition);

            // Interpolate label position as well
            if (player.label) {
                player.label.position.set(
                    interpolatedPosition.x,
                    interpolatedPosition.y + 0.5, // Keep the offset
                    interpolatedPosition.z
                );
            }
        } else {
            // Fallback or initial state: Set directly to target if previous is missing
            player.mesh.position.set(player.targetPos.x, player.targetPos.y, player.targetPos.z);
            if (player.label) {
                player.label.position.set(player.targetPos.x, player.targetPos.y + 0.5, player.targetPos.z);
            }
        }
    });
    // --- End Interpolation ---


    // Update local player movement only if pointer is locked and not chatting
    if (controls && controls.isLocked === true && !isChatting) {
        handleMovement(delta);
        sendPositionUpdate(); // Send updates if connected and locked
    }

    // Render the scene
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}


// --- Movement Handling (using PointerLockControls) ---
function handleMovement(delta) {
    // Apply damping/friction
    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;
    velocity.y -= velocity.y * 10.0 * delta; // Apply damping to vertical velocity too

    // Calculate direction vector based on key states
    direction.z = Number(moveForward) - Number(moveBackward);
    direction.x = Number(moveRight) - Number(moveLeft);
    direction.y = Number(moveUp) - Number(moveDown); // Use moveUp/moveDown for vertical
    direction.normalize(); // Ensures consistent speed regardless of direction

    // Apply movement based on direction and speed
    const acceleration = 400.0; // Adjust acceleration as needed
    if (moveForward || moveBackward) velocity.z -= direction.z * acceleration * delta;
    if (moveLeft || moveRight) velocity.x -= direction.x * acceleration * delta;
    if (moveUp || moveDown) velocity.y += direction.y * acceleration * delta; // Use '+' for up, '-' for down

    // Move the controls object (player)
    if (controls) {
        controls.moveRight(-velocity.x * delta); // Strafe
        controls.moveForward(-velocity.z * delta); // Move forward/backward
        controls.getObject().position.y += (velocity.y * delta); // Apply vertical movement

        // Floor constraint (optional, adjust Y value as needed)
        if (controls.getObject().position.y < 1.0) {
            velocity.y = 0; // Stop falling
            controls.getObject().position.y = 1.0; // Snap to floor
        }
        // Ceiling constraint (optional)
        // const ceilingHeight = 20.0;
        // if (controls.getObject().position.y > ceilingHeight) {
        //     velocity.y = 0;
        //     controls.getObject().position.y = ceilingHeight;
        // }
    }
}

// --- Event Listeners for Controls ---
const onKeyDown = (event) => {
    // Handle chat toggle first
    if (event.code === 'Enter') {
        event.preventDefault(); // Prevent default form submission behavior
        toggleChat();
        return; // Stop processing other keys if Enter was pressed
    }

    // Handle ESC key specifically for chat or pointer lock
    if (event.code === 'Escape') {
        if (isChatting) {
            toggleChat(true); // Close chat without sending if ESC is pressed
        } else if (controls?.isLocked) {
            // PointerLockControls handles ESC to unlock by default
        }
        return;
    }

    // Handle movement keys ONLY if not chatting
    if (!isChatting) {
        switch (event.code) {
            case 'ArrowUp': case 'KeyW': moveForward = true; break;
            case 'ArrowLeft': case 'KeyA': moveLeft = true; break;
            case 'ArrowDown': case 'KeyS': moveBackward = true; break;
            case 'ArrowRight': case 'KeyD': moveRight = true; break;
            case 'Space': moveUp = true; break; // Use Space for Up
            case 'ShiftLeft': case 'KeyC': moveDown = true; break; // Use Shift or C for Down
        }
    }
};

const onKeyUp = (event) => {
    // Don't process keyup for Enter here if handled in keydown
    if (event.code === 'Enter' || event.code === 'Escape') return;

    // Reset movement flags regardless of chat state (safer)
    switch (event.code) {
        case 'ArrowUp': case 'KeyW': moveForward = false; break;
        case 'ArrowLeft': case 'KeyA': moveLeft = false; break;
        case 'ArrowDown': case 'KeyS': moveBackward = false; break;
        case 'ArrowRight': case 'KeyD': moveRight = false; break;
        case 'Space': moveUp = false; break;
        case 'ShiftLeft': case 'KeyC': moveDown = false; break;
    }
};

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);


// --- Chat Toggle Function ---
function toggleChat(forceClose = false) {
    if (!chatInput || !controls) return;

    if (isChatting || forceClose) {
        // --- Closing Chat ---
        const message = chatInput.value.trim();

        // Only send if not force closing and message exists
        if (!forceClose && message) {
            // Send message via WebSocket
            if (ws && ws.readyState === WebSocket.OPEN) {
                console.log("Sending chat message:", message);
                ws.send(JSON.stringify({
                    type: 'chat_message', // Send this type to server
                    payload: { message: message }
                }));
            } else {
                console.error("Cannot send chat message: WebSocket not open.");
                displayChatMessage('System', 'Error: Not connected to chat.'); // Inform user
            }
        }

        // Hide input, clear it, update state
        chatInput.style.display = 'none';
        chatInput.value = ''; // Clear input
        isChatting = false;

        // Try to re-lock pointer controls (if not already unlocked by ESC)
        if (!controls.isLocked) {
            // Small delay to prevent immediate re-lock if user just pressed ESC
            setTimeout(() => {
                if (!isChatting) controls.lock(); // Check isChatting again in case user hit Enter quickly
            }, 50);
        }
        // Hide instructions only if pointer lock is successful
        if (controls.isLocked && instructionsEl) {
            instructionsEl.style.display = 'none';
        }


    } else {
        // --- Opening Chat ---
        if (controls.isLocked) {
            controls.unlock(); // Unlock pointer controls to allow typing
        }
        isChatting = true;
        chatInput.style.display = 'block'; // Show input
        chatInput.focus(); // Focus the input field

        // Show instructions while chat is open
        if (instructionsEl) instructionsEl.style.display = 'block';

        // Ensure all movement stops when chat opens
        moveForward = moveBackward = moveLeft = moveRight = moveUp = moveDown = false;
        velocity.set(0, 0, 0); // Reset velocity
    }
}


// --- Authentication & Data Fetching ---
async function fetchGameData() {
    if (!token) {
        console.log('No token found, redirecting to login.');
        if (userInfoEl) userInfoEl.textContent = 'Error: Not logged in.';
        window.location.href = '/login.html';
        return;
    }

    // Attempt to display user info from localStorage immediately
    if (userInfo.username && userInfoEl) {
        userInfoEl.textContent = `Logged in as: ${userInfo.username} (Color: ${userInfo.color})`;
    } else if (userInfoEl) {
        userInfoEl.textContent = 'User info loading...';
    }

    try {
        // Fetch protected data to verify token
        const response = await fetch('/api/game/data', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                console.log('Authentication failed, redirecting to login.');
                localStorage.removeItem('authToken');
                localStorage.removeItem('userInfo');
                alert('Session invalid or expired. Please log in again.');
                window.location.href = '/login.html';
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return;
        }

        const data = await response.json();
        console.log('Protected game data received:', data);

        // --- Initialize Three.js ---
        initThreeJS();
        // Spawn user representation
        spawnUserCube(userInfo.color); // Use color from localStorage initially

        // --- Initialize WebSocket AFTER basic setup ---
        initWebSocket();

    } catch (fetchError) {
        console.error('Error fetching game data:', fetchError);
        if (userInfoEl) userInfoEl.textContent = 'Error loading game data. Please try logging in again.';
        if (instructionsEl) instructionsEl.style.display = 'none';
    }
}

// --- Function to send updates (called in animate loop) ---
let lastUpdateTime = 0;
const updateInterval = 100; // Send update every 100ms (10 times/sec)

function sendPositionUpdate() {
    // Only send if WebSocket is connected, controls exist, pointer is locked, AND not chatting
    if (ws && ws.readyState === WebSocket.OPEN && controls && controls.isLocked && !isChatting) {
        const now = Date.now();
        if (now - lastUpdateTime > updateInterval) {
            const position = controls.getObject().position;
            ws.send(JSON.stringify({
                type: 'update_position',
                payload: {
                    x: position.x,
                    y: position.y,
                    z: position.z
                    // TODO: Add rotation: quaternion: controls.getObject().quaternion.toArray()
                }
            }));
            lastUpdateTime = now;
        }
    }
}

// --- Logout ---
if (logoutButton) {
    logoutButton.addEventListener('click', () => {
        if (controls && controls.isLocked) {
            controls.unlock(); // Unlock pointer if locked
        }
        if (ws && ws.readyState === WebSocket.OPEN) {
            console.log("Closing WebSocket connection before logout.");
            ws.close(); // Gracefully close WebSocket
        }
        // Clear other players from the scene and map
        otherPlayers.forEach((player, userId) => {
            if (scene) {
                if (player.mesh) {
                    scene.remove(player.mesh);
                    player.mesh.geometry.dispose();
                    player.mesh.material.dispose();
                }
                if (player.label) {
                    scene.remove(player.label);
                    if (player.label.material.map) {
                        player.label.material.map.dispose();
                    }
                    player.label.material.dispose();
                }
            }
        });
        otherPlayers.clear(); // Empty the map

        // Clear local storage and redirect
        localStorage.removeItem('authToken');
        localStorage.removeItem('userInfo');
        console.log('Logged out.');
        window.location.href = '/login.html'; // Redirect to login page
    });
} else {
    console.error("Logout button not found!");
}


// --- Initial Load ---
fetchGameData(); // Start the process when the script loads
