// src/client/threeSetup.ts
import * as THREE from 'three';
// Import config if needed for values like fog distance, colors etc.
// Removed .ts extension (if it was there)
// import * as Config from './config';

// --- Module-level variables (optional, could be returned directly) ---
// let scene: THREE.Scene | null = null;
// let camera: THREE.PerspectiveCamera | null = null;
// let renderer: THREE.WebGLRenderer | null = null;

// --- Interfaces ---
// Define the structure of the object returned by setupThreeJS
export interface ThreeContext {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
}

// --- Helper Functions ---

function initScene(): THREE.Scene {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeeeeee); // Light grey background
    scene.fog = new THREE.Fog(0xeeeeee, 10, 50); // Fog params: color, near, far
    return scene;
}

function initCamera(): THREE.PerspectiveCamera {
    const camera = new THREE.PerspectiveCamera(
        75, // Field of View (degrees)
        window.innerWidth / window.innerHeight, // Aspect Ratio
        0.1, // Near clipping plane
        1000 // Far clipping plane
    );
    // Initial position will be set by PointerLockControls later
    // camera.position.z = Config.PLAYER_START_Z; // Example if needed here
    // camera.position.y = Config.PLAYER_HEIGHT;
    return camera;
}

function initRenderer(gameContainer: HTMLDivElement): THREE.WebGLRenderer | null {
    if (!gameContainer) {
        console.error("Cannot initialize renderer: Game container not found!");
        return null;
    }
    try {
        const renderer = new THREE.WebGLRenderer({
            antialias: true, // Enable anti-aliasing for smoother edges
            canvas: gameContainer.querySelector('canvas') || undefined // Optional: Re-use existing canvas if present
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio); // Adjust for high-DPI displays
        // Append renderer's canvas to the container if it wasn't provided/found
        if (!renderer.domElement.parentNode) {
            gameContainer.appendChild(renderer.domElement);
        }

        // Enable shadow mapping if needed later
        // renderer.shadowMap.enabled = true;
        // renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
        return renderer;
    } catch (error) {
        console.error("Failed to initialize WebGLRenderer:", error);
        // Provide user feedback if WebGL is not supported
        if (gameContainer) {
            gameContainer.innerHTML = '<p style="color: red; text-align: center; margin-top: 50px;">Error: WebGL is not supported or enabled in your browser.</p>';
        }
        return null;
    }
}

function addLights(targetScene: THREE.Scene): void {
    // Ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Color, Intensity
    targetScene.add(ambientLight);

    // Directional light for simulating sunlight and casting shadows
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0); // Color, Intensity
    directionalLight.position.set(5, 10, 7.5); // Position the light source
    // Configure shadows if enabled on the renderer
    // directionalLight.castShadow = true;
    // directionalLight.shadow.mapSize.width = 1024;
    // directionalLight.shadow.mapSize.height = 1024;
    // directionalLight.shadow.camera.near = 0.5;
    // directionalLight.shadow.camera.far = 50;
    targetScene.add(directionalLight);
    // Add helper for debugging light position/direction
    // const helper = new THREE.DirectionalLightHelper(directionalLight, 5);
    // targetScene.add(helper);
}

function addEnvironment(targetScene: THREE.Scene): void {
    // Central Pyramid
    const pyramidRadius = 3;
    const pyramidHeight = 5;
    const pyramidGeometry = new THREE.ConeGeometry(pyramidRadius, pyramidHeight, 4); // Radius, Height, Radial Segments (4 for pyramid)
    const pyramidMaterial = new THREE.MeshStandardMaterial({
        color: 0xffff00, // Yellow
        metalness: 0.3, // Slightly metallic
        roughness: 0.6  // Somewhat rough surface
    });
    const centralPyramid = new THREE.Mesh(pyramidGeometry, pyramidMaterial);
    // Position base of pyramid slightly above y=0 if needed, or center it
    centralPyramid.position.set(0, pyramidHeight / 2, 0);
    // Allow pyramid to cast/receive shadows if enabled
    // centralPyramid.castShadow = true;
    // centralPyramid.receiveShadow = true;
    targetScene.add(centralPyramid);

    // Basic Floor Plane (Optional, replace/enhance later)
    const floorGeometry = new THREE.PlaneGeometry(100, 100); // Width, Height
    const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0x888888, // Grey
        metalness: 0.1,
        roughness: 0.8,
        side: THREE.DoubleSide // Render both sides
    });
    const floorPlane = new THREE.Mesh(floorGeometry, floorMaterial);
    floorPlane.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    floorPlane.position.y = 0; // Position at the base
    // floorPlane.receiveShadow = true; // Allow floor to receive shadows
    targetScene.add(floorPlane);

    // Add more environment elements like walls, obstacles etc. here
}

// --- Window Resize Handler ---
// Needs references to camera and renderer, so it's defined here
// but called from main.ts which holds the references.
// Alternatively, pass camera/renderer back to this function.
function handleWindowResize(camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer): void {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Consider adding a debounce/throttle here for performance if resize events are frequent
}


// --- Main Setup Function ---
export function setupThreeJS(gameContainer: HTMLDivElement | null): ThreeContext | null {
    if (!gameContainer) {
        console.error("Three.js setup failed: Game container element is null.");
        return null;
    }

    const scene = initScene();
    const camera = initCamera();
    const renderer = initRenderer(gameContainer);

    // Stop if renderer failed to initialize (e.g., WebGL not supported)
    if (!renderer) {
        return null;
    }

    addLights(scene);
    addEnvironment(scene);

    // Add resize listener (managed in main.ts now, but could be here)
    // window.addEventListener('resize', () => handleWindowResize(camera, renderer), false);

    console.log("Three.js environment initialized.");

    // Return the core components
    return { scene, camera, renderer };
}

// --- Cleanup Function (Optional but Recommended) ---
// This would be called from main.ts's cleanup
export function cleanupThreeScene(scene: THREE.Scene, renderer: THREE.WebGLRenderer): void {
    console.log("Disposing Three.js scene resources...");

    // Dispose geometries, materials, textures
    scene.traverse(object => {
        if (object instanceof THREE.Mesh) {
            object.geometry?.dispose();
            if (Array.isArray(object.material)) {
                object.material.forEach(material => material.dispose());
            } else {
                object.material?.dispose();
            }
            // Dispose textures if they exist on the material
            const material = object.material as THREE.Material & { map?: THREE.Texture, envMap?: THREE.Texture /* etc */ };
            material.map?.dispose();
            material.envMap?.dispose();
            // Add other texture types (normalMap, roughnessMap, etc.) if used
        } else if (object instanceof THREE.Sprite) {
            // Handle sprite disposal (like username labels)
            const spriteMaterial = object.material as THREE.SpriteMaterial;
            spriteMaterial.map?.dispose();
            spriteMaterial.dispose();
        }
    });

    // Dispose renderer
    renderer.dispose();
    // Remove canvas from DOM
    if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
    console.log("Three.js scene resources disposed.");
}