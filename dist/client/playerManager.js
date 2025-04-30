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
exports.setupPlayerManager = setupPlayerManager;
exports.addOtherPlayer = addOtherPlayer;
exports.updateOtherPlayerState = updateOtherPlayerState;
exports.removeOtherPlayer = removeOtherPlayer;
exports.updateOtherPlayers = updateOtherPlayers;
exports.getOtherPlayerMeshes = getOtherPlayerMeshes;
exports.cleanupPlayers = cleanupPlayers;
exports.getAllPlayerData = getAllPlayerData;
// src/client/playerManager.ts
const THREE = __importStar(require("three"));
const utils_1 = require("./utils");
// --- Constants ---
const INTERPOLATION_FACTOR = 0.1;
// --- Module State ---
let sceneRef = null;
const otherPlayers = new Map();
// --- Setup ---
function setupPlayerManager(scene) {
    sceneRef = scene;
    console.log("Player Manager initialized.");
}
// --- Add Player ---
function addOtherPlayer(playerData) {
    var _a, _b, _c, _d, _e, _f;
    if (!sceneRef) {
        console.error("PlayerManager: Scene not set.");
        return;
    }
    if (otherPlayers.has(playerData.userId)) {
        updateOtherPlayerState(playerData); // Update if they already exist
        return;
    }
    console.log(`PlayerManager: Adding player ${playerData.username} (ID: ${playerData.userId}) Kills: ${(_a = playerData.kills) !== null && _a !== void 0 ? _a : 0}`);
    // Create Mesh
    const geometry = new THREE.BoxGeometry(1, 1.6, 1);
    const color = playerData.color ? new THREE.Color(playerData.color) : new THREE.Color(0xffffff);
    const material = new THREE.MeshStandardMaterial({ color: color, roughness: 0.6, metalness: 0.3 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(playerData.x, playerData.y, playerData.z);
    if (playerData.rotationY !== undefined) {
        mesh.rotation.y = playerData.rotationY;
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `player_${playerData.userId}`;
    sceneRef.add(mesh);
    // Create Label
    const label = (0, utils_1.createUsernameLabel)(playerData.username);
    label.position.set(playerData.x, playerData.y + 1.0, playerData.z);
    sceneRef.add(label);
    // Store Player Data
    const newPlayerData = Object.assign(Object.assign({}, playerData), { mesh: mesh, label: label, targetX: playerData.x, targetY: playerData.y, targetZ: playerData.z, targetRotY: (_b = playerData.rotationY) !== null && _b !== void 0 ? _b : 0, targetRotX: (_c = playerData.rotationX) !== null && _c !== void 0 ? _c : 0, lastUpdateTime: performance.now(), isDead: ((_d = playerData.health) !== null && _d !== void 0 ? _d : 100) <= 0, kills: (_e = playerData.kills) !== null && _e !== void 0 ? _e : 0 // Ensure kills is stored
     });
    setPlayerDeadState(newPlayerData, (_f = newPlayerData.isDead) !== null && _f !== void 0 ? _f : false);
    otherPlayers.set(playerData.userId, newPlayerData);
}
// --- Update Player State (from network) ---
function updateOtherPlayerState(playerData) {
    var _a, _b;
    const existingPlayer = otherPlayers.get(playerData.userId);
    if (existingPlayer) {
        // Update targets
        existingPlayer.targetX = playerData.x;
        existingPlayer.targetY = playerData.y;
        existingPlayer.targetZ = playerData.z;
        existingPlayer.targetRotY = (_a = playerData.rotationY) !== null && _a !== void 0 ? _a : existingPlayer.targetRotY;
        existingPlayer.targetRotX = (_b = playerData.rotationX) !== null && _b !== void 0 ? _b : existingPlayer.targetRotX;
        // Update Health and Dead Status
        if (playerData.health !== undefined) {
            existingPlayer.health = playerData.health;
            const shouldBeDead = existingPlayer.health <= 0;
            if (shouldBeDead !== existingPlayer.isDead) {
                setPlayerDeadState(existingPlayer, shouldBeDead);
            }
        }
        // --- UPDATE KILLS ---
        if (playerData.kills !== undefined) {
            existingPlayer.kills = playerData.kills;
        }
        // --------------------
        existingPlayer.lastUpdateTime = performance.now();
    }
    else {
        addOtherPlayer(playerData); // Add if they don't exist
    }
}
// --- Remove Player ---
function removeOtherPlayer(userId) {
    const playerData = otherPlayers.get(userId);
    if (playerData && sceneRef) {
        console.log(`PlayerManager: Removing player ${playerData.username} (ID: ${userId})`);
        sceneRef.remove(playerData.mesh);
        sceneRef.remove(playerData.label);
        // Dispose resources
        playerData.mesh.geometry.dispose();
        if (Array.isArray(playerData.mesh.material)) {
            playerData.mesh.material.forEach(m => m.dispose());
        }
        else {
            playerData.mesh.material.dispose();
        }
        if (playerData.label.material.map) {
            playerData.label.material.map.dispose();
        }
        playerData.label.material.dispose();
        otherPlayers.delete(userId);
    }
    else {
        console.warn(`PlayerManager: Tried to remove non-existent player ${userId}`);
    }
}
// --- Update Loop ---
function updateOtherPlayers(currentTime, interpolationDelay) {
    otherPlayers.forEach((player) => {
        if (player.isDead) {
            if (player.mesh.visible || player.label.visible) {
                player.mesh.visible = false;
                player.label.visible = false;
            }
            return; // Don't interpolate dead players
        }
        if (!player.mesh.visible)
            player.mesh.visible = true;
        if (!player.label.visible)
            player.label.visible = true;
        // Interpolate position
        player.mesh.position.x = THREE.MathUtils.lerp(player.mesh.position.x, player.targetX, INTERPOLATION_FACTOR);
        player.mesh.position.y = THREE.MathUtils.lerp(player.mesh.position.y, player.targetY, INTERPOLATION_FACTOR);
        player.mesh.position.z = THREE.MathUtils.lerp(player.mesh.position.z, player.targetZ, INTERPOLATION_FACTOR);
        // Interpolate Yaw
        player.mesh.rotation.y = lerpAngle(player.mesh.rotation.y, player.targetRotY, INTERPOLATION_FACTOR);
        // Update label position
        player.label.position.copy(player.mesh.position);
        player.label.position.y += 1.0;
    });
}
// --- Helper for Angle Interpolation ---
function lerpAngle(startAngle, endAngle, factor) {
    let delta = endAngle - startAngle;
    if (delta > Math.PI)
        delta -= Math.PI * 2;
    if (delta < -Math.PI)
        delta += Math.PI * 2;
    return startAngle + delta * factor;
}
// --- Get Player Meshes (for raycasting) ---
function getOtherPlayerMeshes() {
    const meshes = [];
    otherPlayers.forEach((player) => {
        if (!player.isDead) {
            meshes.push(player.mesh);
        }
    });
    return meshes;
}
// --- Set Visual State for Dead/Alive ---
function setPlayerDeadState(player, isDead) {
    if (player.isDead === isDead)
        return;
    player.isDead = isDead;
    console.log(`Player ${player.username} is now ${isDead ? 'DEAD' : 'ALIVE'}`);
    if (isDead) {
        player.mesh.visible = false;
        player.label.visible = false;
    }
    else {
        player.mesh.visible = true;
        player.label.visible = true;
        // Restore original color if it was changed
        if (!(Array.isArray(player.mesh.material)) && player.color) {
            player.mesh.material.color.set(player.color);
            player.mesh.material.needsUpdate = true;
        }
    }
}
// --- Cleanup ---
function cleanupPlayers() {
    console.log("Cleaning up players...");
    otherPlayers.forEach((player, userId) => {
        if (sceneRef) {
            sceneRef.remove(player.mesh);
            sceneRef.remove(player.label);
            // Dispose resources
            player.mesh.geometry.dispose();
            if (Array.isArray(player.mesh.material)) {
                player.mesh.material.forEach(m => m.dispose());
            }
            else {
                player.mesh.material.dispose();
            }
            if (player.label.material.map) {
                player.label.material.map.dispose();
            }
            player.label.material.dispose();
        }
    });
    otherPlayers.clear();
    sceneRef = null;
    console.log("Players cleanup complete.");
}
// --- NEW: Get All Player Data (for scoreboard) ---
function getAllPlayerData() {
    return otherPlayers;
}
// --- END NEW ---
