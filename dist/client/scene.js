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
exports.renderer = exports.camera = exports.scene = void 0;
exports.setupScene = setupScene;
exports.animate = animate;
exports.cleanupScene = cleanupScene;
// src/client/scene.ts
const THREE = __importStar(require("three"));
// --- Setup Function ---
/**
 * Initializes the Three.js scene, camera, renderer, and basic lighting/objects.
 * @param container - The HTML element to append the renderer's canvas to.
 */
function setupScene(container) {
    // --- ADD SCENE CREATION ---
    exports.scene = new THREE.Scene();
    exports.scene.background = new THREE.Color(0x87ceeb); // Light blue background
    exports.scene.fog = new THREE.Fog(0x87ceeb, 50, 150); // Add fog matching background
    // --------------------------
    // --- ADD CAMERA CREATION ---
    exports.camera = new THREE.PerspectiveCamera(75, // Field of View
    window.innerWidth / window.innerHeight, // Aspect Ratio
    0.1, // Near clipping plane
    1000 // Far clipping plane
    );
    // Note: Camera position is usually set by controls later, but you could set an initial one:
    // camera.position.set(0, 1.6, 5); // Example initial position
    // -------------------------
    // 3. Renderer
    exports.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    exports.renderer.setSize(window.innerWidth, window.innerHeight);
    exports.renderer.setPixelRatio(window.devicePixelRatio);
    exports.renderer.shadowMap.enabled = true; // Enable shadows
    exports.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
    // --- IMPORTANT: Set initial sortObjects state ---
    // Set to false initially. We will only toggle it briefly when needed.
    exports.renderer.sortObjects = false;
    // --------------------------------------------
    container.appendChild(exports.renderer.domElement); // Add canvas to the container
    // --- ADD LIGHTING ---
    // Ambient Light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Soft white light
    exports.scene.add(ambientLight);
    // Directional Light (like sunlight)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(15, 20, 10); // Position the light source
    directionalLight.castShadow = true;
    // Configure shadow properties for better quality/performance
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    exports.scene.add(directionalLight);
    // Optional: Add a helper to visualize the light's direction
    // const lightHelper = new THREE.DirectionalLightHelper(directionalLight, 5);
    // scene.add(lightHelper);
    // const shadowHelper = new THREE.CameraHelper(directionalLight.shadow.camera);
    // scene.add(shadowHelper);
    // --------------------
    // --- ADD FLOOR ---
    const floorGeometry = new THREE.PlaneGeometry(200, 200); // Large plane
    const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0xaaaaaa, // Grey color
        roughness: 0.8,
        metalness: 0.2
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    floor.receiveShadow = true; // Allow floor to receive shadows
    exports.scene.add(floor);
    // -----------------
    // --- ADD GRID HELPER (Optional) ---
    const gridHelper = new THREE.GridHelper(200, 50); // Size and divisions
    exports.scene.add(gridHelper);
    // ----------------------------------
    console.log("Three.js scene initialized.");
}
// --- Animation Loop ---
/**
 * The main animation loop function that gets called repeatedly.
 * Renders the scene.
 * @param time - The timestamp provided by requestAnimationFrame.
 */
function animate(time) {
    // Note: requestAnimationFrame is called from main.ts now
    // --- Add any scene-specific animations here ---
    // Render the scene from the camera's perspective
    if (exports.renderer && exports.scene && exports.camera) {
        // --- REMOVED DIAGNOSTIC TOGGLE ---
        // renderer.sortObjects = !renderer.sortObjects; // <-- REMOVED
        // --- END REMOVED ---
        //console.log("Rendering frame");
        exports.renderer.render(exports.scene, exports.camera); // The actual render call
    }
    else {
        console.warn("Skipping render: Renderer, scene, or camera not ready.");
    }
}
// --- NEW: Function to force a render state change ---
/**
 * Briefly toggles renderer.sortObjects to try and force an update.
 * Use sparingly as it can impact performance if called frequently.
 */
/*export function forceRenderSortNudge(): void {
    if (renderer) {
        // Only set to true here. It will be reset after the render call in main.ts.
        if (!renderer.sortObjects) { // Avoid redundant console logs if already true
            console.log("[forceRenderSortNudge] Setting renderer.sortObjects = true for next render.");
            renderer.sortObjects = true; // Force a sort check in the upcoming render
        }
    }
} */
// --- END NEW ---
// --- Cleanup Function ---
/**
 * Cleans up resources used by the scene.
 */
function cleanupScene() {
    var _a, _b;
    console.log("Cleaning up scene...");
    if (exports.scene) {
        // Dispose geometries, materials, textures in the scene
        exports.scene.traverse((object) => {
            var _a, _b, _c, _d, _e, _f;
            if (object instanceof THREE.Mesh) {
                (_a = object.geometry) === null || _a === void 0 ? void 0 : _a.dispose();
                if (Array.isArray(object.material)) {
                    object.material.forEach(material => material.dispose());
                }
                else if (object.material) {
                    object.material.dispose();
                }
            }
            else if (object instanceof THREE.Sprite) {
                (_c = (_b = object.material) === null || _b === void 0 ? void 0 : _b.map) === null || _c === void 0 ? void 0 : _c.dispose();
                (_d = object.material) === null || _d === void 0 ? void 0 : _d.dispose();
            }
            else if (object instanceof THREE.Line) {
                (_e = object.geometry) === null || _e === void 0 ? void 0 : _e.dispose();
                (_f = object.material) === null || _f === void 0 ? void 0 : _f.dispose();
            }
            // Add other types if necessary (e.g., lights, helpers)
        });
        // Clear the scene children array
        while (exports.scene.children.length > 0) {
            exports.scene.remove(exports.scene.children[0]);
        }
    }
    if (exports.renderer) {
        exports.renderer.dispose(); // Dispose renderer resources
        // Remove canvas from DOM if it exists
        (_b = (_a = exports.renderer.domElement) === null || _a === void 0 ? void 0 : _a.parentNode) === null || _b === void 0 ? void 0 : _b.removeChild(exports.renderer.domElement);
    }
    // Clear references - Note: We can't reassign exported 'let' variables to undefined
    // They will be garbage collected if no longer referenced elsewhere.
    console.log("Scene cleanup complete.");
}
