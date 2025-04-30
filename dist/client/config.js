"use strict";
// public/js/config.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.INTERPOLATION_TIME = exports.WS_UPDATE_INTERVAL = exports.FLOOR_Y = exports.PLAYER_START_Z = exports.PLAYER_HEIGHT = exports.DAMPING = exports.ACCELERATION = exports.MOVEMENT_SPEED = void 0;
// Player movement and physics constants
exports.MOVEMENT_SPEED = 5.0; // Base speed factor (adjust as needed)
exports.ACCELERATION = 400.0; // How quickly the player reaches max speed
exports.DAMPING = 10.0; // How quickly the player stops (higher = faster stop)
exports.PLAYER_HEIGHT = 1.6; // Assumed player height for camera
exports.PLAYER_START_Z = 8; // Initial Z position
exports.FLOOR_Y = 1.0; // Y position of the 'floor' for collision
// Network and interpolation constants
exports.WS_UPDATE_INTERVAL = 100; // ms - How often the client sends position updates
exports.INTERPOLATION_TIME = 100; // ms - Time over which to interpolate other players' movement
// Should ideally match or be slightly larger than server update rate/WS_UPDATE_INTERVAL
// Add other configuration constants as needed
// export const MAX_CHAT_LENGTH: number = 200;
// export const LASER_RANGE: number = 100;
