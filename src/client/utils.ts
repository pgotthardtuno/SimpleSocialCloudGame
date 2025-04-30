// src/client/utils.ts
import * as THREE from 'three';
// Import camera type if needed
import { PerspectiveCamera, Scene, Vector3 } from 'three'; // Added full types for clarity

export function showLaserEffect(
    scene: Scene,
    camera: PerspectiveCamera, // Keep camera param
    startPoint: Vector3,
    endPoint: Vector3,
    color: number = 0xff0000,
    durationMs: number = 200
): void {
    // --- Enhanced Logging ---
    //console.log(`[showLaserEffect ENTRY] Called. Scene object received:`, scene ? 'Exists' : 'MISSING');
    //console.log(`[showLaserEffect ENTRY] Camera object received:`, camera ? 'Exists' : 'MISSING');
    // ---

    if (!scene || !camera) {
        //console.error("[showLaserEffect] Returning early because scene or camera object is missing!");
        return;
    }

    //console.log(`[showLaserEffect] Creating laser. Start: ${startPoint.toArray().map(n => n.toFixed(2))}, End: ${endPoint.toArray().map(n => n.toFixed(2))}, Color: ${color.toString(16)}, Duration: ${durationMs}`);

    // 1. Create Geometry
    const points = [startPoint.clone(), endPoint.clone()];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    // 2. Create Material
    const material = new THREE.LineBasicMaterial({
        color: color,
        linewidth: 2, // Note: linewidth > 1 might not work on all platforms/drivers
        transparent: true,
        opacity: 0.8,
        // --- Add depthTest/depthWrite false? ---
        // Sometimes helps ensure lines render over other geometry, might affect appearance
         depthTest: false,
         depthWrite: false
        // ---
    });

    // 3. Create Line
    const line = new THREE.Line(geometry, material);
    line.name = "laser_effect";
    // --- Log Line Creation ---
    //console.log(`[showLaserEffect] Line object created: UUID=${line.uuid}, Name=${line.name}`);
    // ---

    // 4. Add to Scene
    const childrenBeforeAdd = scene.children.length; // Log count before
    //console.log(`[showLaserEffect] Adding line ${line.uuid} to scene. Current children count: ${childrenBeforeAdd}`);
    scene.add(line);
    const childrenAfterAdd = scene.children.length; // Log count after
    //console.log(`[showLaserEffect] Line added. New children count: ${childrenAfterAdd}`);

    // --- Check if add actually worked ---
    if (childrenAfterAdd <= childrenBeforeAdd) {
        console.error(`[showLaserEffect] CRITICAL: Scene children count did NOT increase after adding line ${line.uuid}!`);
    } else {
        //console.log(`[showLaserEffect] Confirmed line ${line.uuid} is in scene children.`);
    }
    // ---

    // --- TRY UPDATING GEOMETRY BOUNDING SPHERE ---
    // This recalculates the object's spatial bounds, which might
    // signal to the renderer that it needs to be included in the render.
    geometry.computeBoundingSphere();
    //console.log('[showLaserEffect] Called geometry.computeBoundingSphere()');
    // ---------------------------------------------

    // 5. Remove after duration
    setTimeout(() => {
        // --- Log Removal ---
        //console.log(`[showLaserEffect setTimeout] Attempting to remove line ${line.uuid} after ${durationMs}ms.`);
        // ---
        if (scene) { // Check scene still exists
            const lineExists = scene.getObjectByProperty('uuid', line.uuid);
            if (lineExists) {
                scene.remove(line);
                //console.log(`[showLaserEffect setTimeout] Successfully removed line ${line.uuid}.`);
            } else {
                //console.warn(`[showLaserEffect setTimeout] Line ${line.uuid} was already removed or not found.`);
            }
        } else {
            //console.warn(`[showLaserEffect setTimeout] Scene object missing, cannot remove line ${line.uuid}.`);
        }
        // Dispose resources
        geometry.dispose();
        material.dispose();
        //console.log(`[showLaserEffect setTimeout] Disposed geometry and material for line ${line.uuid}.`);
    }, durationMs);
}

// ... rest of utils.ts (createUsernameLabel, sanitizeHTML) ...

/**
 * Creates a Sprite-based username label.
 * @param username The text for the label.
 * @returns A THREE.Sprite object.
 */
export function createUsernameLabel(username: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
        console.error("Failed to get 2D context for username label");
        // Return a dummy sprite or handle error appropriately
        return new THREE.Sprite();
    }

    const fontSize = 48; // Higher resolution for better quality
    context.font = `Bold ${fontSize}px Arial`;
    const textWidth = context.measureText(username).width;

    // Adjust canvas size based on text
    canvas.width = textWidth + 20; // Add some padding
    canvas.height = fontSize + 10; // Add some padding

    // Re-apply font settings after resize
    context.font = `Bold ${fontSize}px Arial`;
    context.fillStyle = 'rgba(255, 255, 255, 0.8)'; // White, slightly transparent background
    context.fillRect(0, 0, canvas.width, canvas.height); // Optional background

    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = 'rgba(0, 0, 0, 0.9)'; // Black text
    context.fillText(username, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false, // Render on top of other objects (optional)
        depthWrite: false
    });

    const sprite = new THREE.Sprite(material);
    // Scale the sprite down to a reasonable size in the 3D world
    const scaleFactor = 0.01; // Adjust as needed
    sprite.scale.set(canvas.width * scaleFactor, canvas.height * scaleFactor, 1.0);

    return sprite;
}

/**
 * Sanitizes HTML string to prevent XSS.
 * Creates a temporary div, sets its textContent, then reads innerHTML.
 * @param str The potentially unsafe HTML string.
 * @returns A sanitized string safe for innerHTML.
 */
export function sanitizeHTML(str: string): string {
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}