// src/client/scene.ts
import * as THREE from 'three';

// --- Module Scope Variables ---
export let scene: THREE.Scene;
export let camera: THREE.PerspectiveCamera;
export let renderer: THREE.WebGLRenderer;

// --- Setup Function ---
/**
 * Initializes the Three.js scene, camera, renderer, and basic lighting/objects.
 * @param container - The HTML element to append the renderer's canvas to.
 */
export function setupScene(container: HTMLElement): void {

    // --- ADD SCENE CREATION ---
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Light blue background
    scene.fog = new THREE.Fog(0x87ceeb, 50, 150); // Add fog matching background
    // --------------------------

    // --- ADD CAMERA CREATION ---
    camera = new THREE.PerspectiveCamera(
        75, // Field of View
        window.innerWidth / window.innerHeight, // Aspect Ratio
        0.1, // Near clipping plane
        1000 // Far clipping plane
    );
    // Note: Camera position is usually set by controls later, but you could set an initial one:
    // camera.position.set(0, 1.6, 5); // Example initial position
    // -------------------------

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true; // Enable shadows
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
    // --- IMPORTANT: Set initial sortObjects state ---
    // Set to false initially. We will only toggle it briefly when needed.
    renderer.sortObjects = false;
    // --------------------------------------------
    container.appendChild(renderer.domElement); // Add canvas to the container

    // --- ADD LIGHTING ---
    // Ambient Light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Soft white light
    scene.add(ambientLight);

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
    scene.add(directionalLight);
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
    scene.add(floor);
    // -----------------

    // --- ADD GRID HELPER (Optional) ---
    const gridHelper = new THREE.GridHelper(200, 50); // Size and divisions
    scene.add(gridHelper);
    // ----------------------------------

    console.log("Three.js scene initialized.");
}

// --- Animation Loop ---
/**
 * The main animation loop function that gets called repeatedly.
 * Renders the scene.
 * @param time - The timestamp provided by requestAnimationFrame.
 */
export function animate(time: number): void {
    // Note: requestAnimationFrame is called from main.ts now

    // --- Add any scene-specific animations here ---

    // Render the scene from the camera's perspective
    if (renderer && scene && camera) {

        // --- REMOVED DIAGNOSTIC TOGGLE ---
        // renderer.sortObjects = !renderer.sortObjects; // <-- REMOVED
        // --- END REMOVED ---

        console.log("Rendering frame");
        renderer.render(scene, camera); // The actual render call

    } else {
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
export function cleanupScene(): void {
    console.log("Cleaning up scene...");
    if (scene) {
        // Dispose geometries, materials, textures in the scene
        scene.traverse((object) => {
            if (object instanceof THREE.Mesh) {
                object.geometry?.dispose();
                if (Array.isArray(object.material)) {
                    object.material.forEach(material => material.dispose());
                } else if (object.material) {
                    object.material.dispose();
                }
            } else if (object instanceof THREE.Sprite) {
                object.material?.map?.dispose();
                object.material?.dispose();
            } else if (object instanceof THREE.Line) {
                object.geometry?.dispose();
                object.material?.dispose();
            }
            // Add other types if necessary (e.g., lights, helpers)
        });
        // Clear the scene children array
        while(scene.children.length > 0){
            scene.remove(scene.children[0]);
        }
    }
    if (renderer) {
        renderer.dispose(); // Dispose renderer resources
        // Remove canvas from DOM if it exists
        renderer.domElement?.parentNode?.removeChild(renderer.domElement);
    }
    // Clear references - Note: We can't reassign exported 'let' variables to undefined
    // They will be garbage collected if no longer referenced elsewhere.
    console.log("Scene cleanup complete.");
}