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
exports.setupControls = setupControls;
exports.getControls = getControls;
exports.isPointerLocked = isPointerLocked;
exports.resetMovementFlags = resetMovementFlags;
exports.handleMovement = handleMovement;
exports.removeControlListeners = removeControlListeners;
// src/client/playerControls.ts
const THREE = __importStar(require("three"));
// Corrected import path for PointerLockControls
const PointerLockControls_js_1 = require("three/examples/jsm/controls/PointerLockControls.js");
// Removed .ts extension from relative imports
const Config = __importStar(require("./config"));
const chat_1 = require("./chat"); // Import chat state getter
// --- Module State ---
let controls = null;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let moveUp = false;
let moveDown = false;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
// Store references to bound event listeners for easy removal
const boundOnKeyDown = onKeyDown.bind(null);
const boundOnKeyUp = onKeyUp.bind(null);
let boundOnClick = null;
let boundOnLock = null;
let boundOnUnlock = null;
// --- Setup Function ---
function setupControls(camera, domElement, // Renderer's canvas element
scene, instructionsEl) {
    if (!camera || !domElement || !scene) {
        console.error("Cannot setup controls: Missing camera, domElement, or scene.");
        return null;
    }
    controls = new PointerLockControls_js_1.PointerLockControls(camera, domElement);
    // Set initial position using config
    controls.getObject().position.y = Config.PLAYER_HEIGHT;
    controls.getObject().position.z = Config.PLAYER_START_Z;
    scene.add(controls.getObject()); // Add the controls' object (camera group) to the scene
    // Define listeners
    boundOnLock = () => {
        if (instructionsEl)
            instructionsEl.style.display = 'none';
        console.log('Pointer Locked');
        // Reset flags on lock to prevent sticky movement if keys were held during unlock
        resetMovementFlags();
    };
    boundOnUnlock = () => {
        // Only show instructions if chat is NOT active
        if (instructionsEl && !(0, chat_1.isChatting)()) {
            instructionsEl.style.display = 'block';
        }
        console.log('Pointer Unlocked');
        // Reset movement flags when pointer is unlocked to stop movement
        resetMovementFlags();
    };
    boundOnClick = () => {
        // Only lock controls if chat is not active
        if (controls && !controls.isLocked && !(0, chat_1.isChatting)()) {
            controls.lock();
        }
    };
    // Add event listeners
    controls.addEventListener('lock', boundOnLock);
    controls.addEventListener('unlock', boundOnUnlock);
    domElement.addEventListener('click', boundOnClick); // Listen on the canvas
    document.addEventListener('keydown', boundOnKeyDown);
    document.addEventListener('keyup', boundOnKeyUp);
    console.log("Player controls initialized.");
    return controls;
}
// --- Getters ---
function getControls() {
    return controls;
}
function isPointerLocked() {
    return (controls === null || controls === void 0 ? void 0 : controls.isLocked) === true;
}
// --- Reset Movement Flags ---
// Exported so it can be called externally (e.g., on disconnect)
function resetMovementFlags() {
    moveForward = moveBackward = moveLeft = moveRight = moveUp = moveDown = false;
    // Optionally reset velocity as well, though damping should handle it
    // velocity.set(0, 0, 0);
}
// --- Movement Handling (Called in main game loop) ---
function handleMovement(delta) {
    if (!controls)
        return; // Guard clause
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
    if (moveForward || moveBackward)
        velocity.z -= direction.z * Config.ACCELERATION * delta;
    if (moveLeft || moveRight)
        velocity.x -= direction.x * Config.ACCELERATION * delta;
    if (moveUp || moveDown)
        velocity.y += direction.y * Config.ACCELERATION * delta; // Use '+' for up, '-' for down
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
function onKeyDown(event) {
    // Ignore movement keys if chatting
    if ((0, chat_1.isChatting)()) {
        return;
    }
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = true;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = true;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = true;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = true;
            break;
        case 'Space':
            moveUp = true;
            break;
        case 'ShiftLeft':
        case 'KeyC':
            moveDown = true;
            break;
    }
}
function onKeyUp(event) {
    // Reset flags regardless of chat state (safer)
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = false;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = false;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = false;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = false;
            break;
        case 'Space':
            moveUp = false;
            break;
        case 'ShiftLeft':
        case 'KeyC':
            moveDown = false;
            break;
    }
}
// --- Cleanup Function ---
function removeControlListeners() {
    console.log("Removing player control listeners...");
    if (controls) {
        if (boundOnLock)
            controls.removeEventListener('lock', boundOnLock);
        if (boundOnUnlock)
            controls.removeEventListener('unlock', boundOnUnlock);
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
    console.log("Player control listeners removed.");
}
