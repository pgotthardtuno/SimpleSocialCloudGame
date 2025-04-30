// src/client/playerManager.ts
import * as THREE from 'three';
import { createUsernameLabel } from './utils';
import { PlayerState } from './websocket'; // Import PlayerState which now includes health and kills

// --- Constants ---
const INTERPOLATION_FACTOR = 0.1;

// --- Interfaces ---
export interface PlayerData extends PlayerState {
    mesh: THREE.Mesh;
    label: THREE.Sprite;
    // Interpolation targets
    targetX: number;
    targetY: number;
    targetZ: number;
    targetRotY: number;
    targetRotX: number;
    lastUpdateTime: number;
    isDead?: boolean;
    // --- ADDED KILLS ---
    // kills is already part of PlayerState, no need to add again
    // -------------------
}

// --- Module State ---
let sceneRef: THREE.Scene | null = null;
const otherPlayers = new Map<number, PlayerData>();

// --- Setup ---
export function setupPlayerManager(scene: THREE.Scene): void {
    sceneRef = scene;
    console.log("Player Manager initialized.");
}

// --- Add Player ---
export function addOtherPlayer(playerData: PlayerState): void {
    if (!sceneRef) {
        console.error("PlayerManager: Scene not set.");
        return;
    }
    if (otherPlayers.has(playerData.userId)) {
        updateOtherPlayerState(playerData); // Update if they already exist
        return;
    }

    console.log(`PlayerManager: Adding player ${playerData.username} (ID: ${playerData.userId}) Kills: ${playerData.kills ?? 0}`);

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
    const label = createUsernameLabel(playerData.username);
    label.position.set(playerData.x, playerData.y + 1.0, playerData.z);
    sceneRef.add(label);

    // Store Player Data
    const newPlayerData: PlayerData = {
        ...playerData, // Includes userId, username, color, health, kills etc.
        mesh: mesh,
        label: label,
        targetX: playerData.x,
        targetY: playerData.y,
        targetZ: playerData.z,
        targetRotY: playerData.rotationY ?? 0,
        targetRotX: playerData.rotationX ?? 0,
        lastUpdateTime: performance.now(),
        isDead: (playerData.health ?? 100) <= 0,
        kills: playerData.kills ?? 0 // Ensure kills is stored
    };

    setPlayerDeadState(newPlayerData, newPlayerData.isDead ?? false);
    otherPlayers.set(playerData.userId, newPlayerData);
}

// --- Update Player State (from network) ---
export function updateOtherPlayerState(playerData: PlayerState): void {
    const existingPlayer = otherPlayers.get(playerData.userId);
    if (existingPlayer) {
        // Update targets
        existingPlayer.targetX = playerData.x;
        existingPlayer.targetY = playerData.y;
        existingPlayer.targetZ = playerData.z;
        existingPlayer.targetRotY = playerData.rotationY ?? existingPlayer.targetRotY;
        existingPlayer.targetRotX = playerData.rotationX ?? existingPlayer.targetRotX;

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
    } else {
        addOtherPlayer(playerData); // Add if they don't exist
    }
}

// --- Remove Player ---
export function removeOtherPlayer(userId: number): void {
    const playerData = otherPlayers.get(userId);
    if (playerData && sceneRef) {
        console.log(`PlayerManager: Removing player ${playerData.username} (ID: ${userId})`);
        sceneRef.remove(playerData.mesh);
        sceneRef.remove(playerData.label);
        // Dispose resources
        playerData.mesh.geometry.dispose();
        if (Array.isArray(playerData.mesh.material)) {
            playerData.mesh.material.forEach(m => m.dispose());
        } else {
            playerData.mesh.material.dispose();
        }
        if (playerData.label.material.map) {
            playerData.label.material.map.dispose();
        }
        playerData.label.material.dispose();

        otherPlayers.delete(userId);
    } else {
        console.warn(`PlayerManager: Tried to remove non-existent player ${userId}`);
    }
}

// --- Update Loop ---
export function updateOtherPlayers(currentTime: number, interpolationDelay: number): void {
    otherPlayers.forEach((player) => {
        if (player.isDead) {
            if (player.mesh.visible || player.label.visible) {
                player.mesh.visible = false;
                player.label.visible = false;
            }
            return; // Don't interpolate dead players
        }

        if (!player.mesh.visible) player.mesh.visible = true;
        if (!player.label.visible) player.label.visible = true;

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
function lerpAngle(startAngle: number, endAngle: number, factor: number): number {
    let delta = endAngle - startAngle;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    return startAngle + delta * factor;
}

// --- Get Player Meshes (for raycasting) ---
export function getOtherPlayerMeshes(): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = [];
    otherPlayers.forEach((player) => {
        if (!player.isDead) {
            meshes.push(player.mesh);
        }
    });
    return meshes;
}

// --- Set Visual State for Dead/Alive ---
function setPlayerDeadState(player: PlayerData, isDead: boolean): void {
    if (player.isDead === isDead) return;

    player.isDead = isDead;
    console.log(`Player ${player.username} is now ${isDead ? 'DEAD' : 'ALIVE'}`);

    if (isDead) {
        player.mesh.visible = false;
        player.label.visible = false;
    } else {
        player.mesh.visible = true;
        player.label.visible = true;
        // Restore original color if it was changed
        if (!(Array.isArray(player.mesh.material)) && player.color) {
            (player.mesh.material as THREE.MeshStandardMaterial).color.set(player.color);
            (player.mesh.material as THREE.MeshStandardMaterial).needsUpdate = true;
        }
    }
}

// --- Cleanup ---
export function cleanupPlayers(): void {
    console.log("Cleaning up players...");
    otherPlayers.forEach((player, userId) => {
        if (sceneRef) {
            sceneRef.remove(player.mesh);
            sceneRef.remove(player.label);
            // Dispose resources
            player.mesh.geometry.dispose();
            if (Array.isArray(player.mesh.material)) {
                player.mesh.material.forEach(m => m.dispose());
            } else {
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
export function getAllPlayerData(): Map<number, PlayerData> {
    return otherPlayers;
}
// --- END NEW ---