// public/js/ui.ts

// --- Module State ---
let userInfoElement: HTMLElement | null = null;
let logoutButtonElement: HTMLButtonElement | null = null;
let logoutHandler: () => void = () => {}; // Placeholder for the logout function from main.ts

// --- Setup Function ---
/**
 * Initializes the UI module by storing references to DOM elements
 * and attaching the logout event listener.
 * @param logoutBtn - The logout button element.
 * @param userInfoEl - The element to display user information.
 * @param onLogout - The function to call when the logout button is clicked.
 */
export function setupUI(
    logoutBtn: HTMLButtonElement | null,
    userInfoEl: HTMLElement | null, // Use HTMLElement for more general compatibility
    onLogout: () => void
): void {
    logoutButtonElement = logoutBtn;
    userInfoElement = userInfoEl;
    logoutHandler = onLogout; // Store the passed logout function

    if (logoutButtonElement) {
        // Add listener only if the button exists
        logoutButtonElement.addEventListener('click', () => {
            console.log("Logout button clicked via UI module.");
            logoutHandler(); // Call the main logout handler passed during setup
        });
    } else {
        // Log an error if the button wasn't found by main.ts
        console.error("Logout button element not found during UI setup.");
    }

    if (!userInfoElement) {
        console.error("User info element not found during UI setup.");
    }

    console.log("UI module initialized.");
}

// --- Update User Info Display ---
/**
 * Updates the text content of the user info element.
 * @param message - The text message to display.
 */
export function updateUserInfo(
    targetElement: HTMLElement | null, // Allow passing the element directly
    message: string
): void {
    const element = targetElement || userInfoElement; // Use passed element or default
    if (element) {
        element.textContent = message;
        element.style.color = ''; // Reset color in case it was an error
    } else {
        console.warn("Cannot update user info: Target element not found.");
    }
}

// --- Show Login/Error Message ---
/**
 * Displays an error message in the user info element.
 * @param message - The error message to display.
 */
export function showLoginError(
    targetElement: HTMLElement | null, // Allow passing the element directly
    message: string
): void {
    const element = targetElement || userInfoElement; // Use passed element or default
    if (element) {
        element.textContent = message;
        element.style.color = 'red'; // Make error messages red for visibility
    }
    // Log the error to the console as well for debugging
    console.error("UI Error Displayed:", message);
}

// Optional: Function to update instructions display (if needed by UI module)
// export function showInstructions(show: boolean, instructionsEl: HTMLElement | null): void {
//     if (instructionsEl) {
//         instructionsEl.style.display = show ? 'block' : 'none';
//     }
// }

// --- Cleanup Function (Optional) ---
// Removes listeners added by this module
export function cleanupUI(): void {
    if (logoutButtonElement) {
        // To properly remove, we'd need to store the bound listener function,
        // but since it's a simple anonymous function calling logoutHandler,
        // and the element might be removed anyway on logout/redirect,
        // explicit removal might be overkill unless this becomes part of an SPA.
        // For now, just clearing references.
        console.log("Cleaning up UI listeners (references)...");
    }
    // Clear references
    userInfoElement = null;
    logoutButtonElement = null;
    logoutHandler = () => {}; // Reset handler
}