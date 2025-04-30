// src/client/playerControls.ts
import * as THREE from 'three';
// Corrected import path for PointerLockControls
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
// Removed .ts extension from relative imports
import * as Config from './config';
import { isChatting } from './chat'; // Import chat state getter

// --- Module State ---
let controls: PointerLockControls | null = null;
let moveForward: boolean = false;
let moveBackward: boolean = false;
let moveLeft: boolean = false;
let moveRight: boolean = false;
let moveUp: boolean = false;
let moveDown: boolean = false;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

// Store references to bound event listeners for easy removal
const boundOnKeyDown = onKeyDown.bind(null);
const boundOnKeyUp = onKeyUp.bind(null);
let boundOnClick: (() => void) | null = null;
let boundOnLock: (() => void) | null = null;
let boundOnUnlock: (() => void) | null = null;

// --- Setup Function ---
export function setupControls(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLCanvasElement, // Renderer's canvas element
    scene: THREE.Scene,
    instructionsEl: HTMLDivElement | null
): PointerLockControls | null {
    if (!camera || !domElement || !scene) {
        console.error("Cannot setup controls: Missing camera, domElement, or scene.");
        return null;
    }

    controls = new PointerLockControls(camera, domElement);

    // Set initial position using config
    controls.getObject().position.y = Config.PLAYER_HEIGHT;
    controls.getObject().position.z = Config.PLAYER_START_Z;
    scene.add(controls.getObject()); // Add the controls' object (camera group) to the scene

    // Define listeners
    boundOnLock = () => {
        if (instructionsEl) instructionsEl.style.display = 'none';
        //console.log('Pointer Locked');
        // Reset flags on lock to prevent sticky movement if keys were held during unlock
        resetMovementFlags();
    };

    boundOnUnlock = () => {
        // Only show instructions if chat is NOT active
        if (instructionsEl && !isChatting()) {
            instructionsEl.style.display = 'block';
        }
        //console.log('Pointer Unlocked');
        // Reset movement flags when pointer is unlocked to stop movement
        resetMovementFlags();
    };

    boundOnClick = () => {
        // Only lock controls if chat is not active
        if (controls && !controls.isLocked && !isChatting()) {
            controls.lock();
        }
    };

    // Add event listeners
    controls.addEventListener('lock', boundOnLock);
    controls.addEventListener('unlock', boundOnUnlock);
    domElement.addEventListener('click', boundOnClick); // Listen on the canvas
    document.addEventListener('keydown', boundOnKeyDown);
    document.addEventListener('keyup', boundOnKeyUp);

    //console.log("Player controls initialized.");
    return controls;
}

// --- Getters ---
export function getControls(): PointerLockControls | null {
    return controls;
}

export function isPointerLocked(): boolean {
    return controls?.isLocked === true;
}

// --- Reset Movement Flags ---
// Exported so it can be called externally (e.g., on disconnect)
export function resetMovementFlags(): void {
    moveForward = moveBackward = moveLeft = moveRight = moveUp = moveDown = false;
    // Optionally reset velocity as well, though damping should handle it
    // velocity.set(0, 0, 0);
}

// --- Movement Handling (Called in main game loop) ---
export function handleMovement(delta: number): void {
    if (!controls) return; // Guard clause

    // Apply damping/friction (prevents infinite sliding)
    velocity.x -= velocity.x * Config.DAMPING * delta;
    velocity.z -= velocity.z * Config.DAMPING * delta;
    velocity.y -= velocity.y * Config.DAMPING * delta; // Damp vertical too

    // Calculate direction vector based on current key states
    direction.z = Number(moveForward) - Number(moveBackward);
    direction.x = Number(moveRight) - Number(moveLeft);
    direction.y = Number(moveUp) - Number(moveDown);
    direction.normalize(); // Ensures consistent speed regardless of direction combination

    // Apply acceleration based on input direction
    // Only apply acceleration if the corresponding key is pressed
    if (moveForward || moveBackward) velocity.z -= direction.z * Config.ACCELERATION * delta;
    if (moveLeft || moveRight) velocity.x -= direction.x * Config.ACCELERATION * delta;
    if (moveUp || moveDown) velocity.y += direction.y * Config.ACCELERATION * delta; // Use '+' for up, '-' for down

    // Move the player using controls methods
    controls.moveRight(-velocity.x * delta); // Strafe left/right
    controls.moveForward(-velocity.z * delta); // Move forward/backward
    controls.getObject().position.y += (velocity.y * delta); // Apply vertical movement

    // Floor constraint
    if (controls.getObject().position.y < Config.FLOOR_Y) {
        velocity.y = 0; // Stop downward velocity
        controls.getObject().position.y = Config.FLOOR_Y; // Snap to floor
    }
    // Optional Ceiling constraint (add to config if needed)
    // const ceilingY = 20.0;
    // if (controls.getObject().position.y > ceilingY) {
    //     velocity.y = 0;
    //     controls.getObject().position.y = ceilingY;
    // }
}

// --- Event Listeners (Bound) ---
function onKeyDown(event: KeyboardEvent): void {
    // Ignore movement keys if chatting
    if (isChatting()) {
        return;
    }

    switch (event.code) {
        case 'ArrowUp': case 'KeyW': moveForward = true; break;
        case 'ArrowLeft': case 'KeyA': moveLeft = true; break;
        case 'ArrowDown': case 'KeyS': moveBackward = true; break;
        case 'ArrowRight': case 'KeyD': moveRight = true; break;
        case 'Space': moveUp = true; break;
        case 'ShiftLeft': case 'KeyC': moveDown = true; break;
    }
}

function onKeyUp(event: KeyboardEvent): void {
    // Reset flags regardless of chat state (safer)
    switch (event.code) {
        case 'ArrowUp': case 'KeyW': moveForward = false; break;
        case 'ArrowLeft': case 'KeyA': moveLeft = false; break;
        case 'ArrowDown': case 'KeyS': moveBackward = false; break;
        case 'ArrowRight': case 'KeyD': moveRight = false; break;
        case 'Space': moveUp = false; break;
        case 'ShiftLeft': case 'KeyC': moveDown = false; break;
    }
}

// --- Cleanup Function ---
export function removeControlListeners(): void {
    //console.log("Removing player control listeners...");
    if (controls) {
        if (boundOnLock) controls.removeEventListener('lock', boundOnLock);
        if (boundOnUnlock) controls.removeEventListener('unlock', boundOnUnlock);
        // Attempt to remove listener from the original DOM element
        if (boundOnClick && controls.domElement) {
            controls.domElement.removeEventListener('click', boundOnClick);
        }
    }
    document.removeEventListener('keydown', boundOnKeyDown);
    document.removeEventListener('keyup', boundOnKeyUp);

    // Clear references
    controls = null;
    boundOnClick = null;
    boundOnLock = null;
    boundOnUnlock = null;
    resetMovementFlags(); // Ensure movement stops
    velocity.set(0, 0, 0); // Reset velocity
    //console.log("Player control listeners removed.");
}