// public/js/config.ts

// Player movement and physics constants
export const MOVEMENT_SPEED: number = 5.0; // Base speed factor (adjust as needed)
export const ACCELERATION: number = 400.0; // How quickly the player reaches max speed
export const DAMPING: number = 10.0;      // How quickly the player stops (higher = faster stop)
export const PLAYER_HEIGHT: number = 1.6;   // Assumed player height for camera
export const PLAYER_START_Z: number = 8;    // Initial Z position
export const FLOOR_Y: number = 1.0;       // Y position of the 'floor' for collision

// Network and interpolation constants
export const WS_UPDATE_INTERVAL: number = 100; // ms - How often the client sends position updates
export const INTERPOLATION_TIME: number = 100; // ms - Time over which to interpolate other players' movement
// Should ideally match or be slightly larger than server update rate/WS_UPDATE_INTERVAL

// Add other configuration constants as needed
// export const MAX_CHAT_LENGTH: number = 200;
// export const LASER_RANGE: number = 100;