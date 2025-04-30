// src/client/chat.ts
// Removed PointerLockControls import as it's unused here
import { sendMessage, ClientMessage } from './websocket';
import { sanitizeHTML } from './utils';

// --- Module State ---
let isChattingState: boolean = false;
let chatInputElement: HTMLInputElement | null = null;
let chatOutputElement: HTMLDivElement | null = null;
let chatContainerElement: HTMLDivElement | null = null;
let handleSendMessageCallback: (messageText: string) => void = () => {};
let chatInputKeyListener: ((event: KeyboardEvent) => void) | null = null;
// REMOVED: let onChatCloseCallback: ((isNowChatting: boolean) => void) | null = null;

// --- Setup Function ---
/**
 * Initializes the chat module.
 * @param containerEl - The main chat container element.
 * @param outputEl - The element where messages are displayed.
 * @param inputEl - The text input element for chat.
 * @param onSendMessage - Callback function from main.ts to send a message via WebSocket.
 */
// src/client/chat.ts

export function setupChat(
    containerEl: HTMLElement | null,
    outputEl: HTMLElement | null,
    inputEl: HTMLInputElement | null,
    onSendMessage: (messageText: string) => void
): void {
    // --- ADD THESE ASSIGNMENTS ---
    chatContainerElement = containerEl as HTMLDivElement | null;
    chatOutputElement = outputEl as HTMLDivElement | null;
    chatInputElement = inputEl; // Assign the passed element to the module variable
    handleSendMessageCallback = onSendMessage;
    // --- END OF ADDED ASSIGNMENTS ---

    // Add the log we added previously to confirm
    console.log(`[setupChat] chatInputElement assigned:`, chatInputElement);

    isChattingState = false; // Initialize state

    // Now this check uses the correctly assigned module variable
    if (chatInputElement) {
        chatInputElement.style.display = 'none';

        chatInputKeyListener = (event: KeyboardEvent) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                event.stopPropagation(); // Keep this
                toggleChatInput(false);
            } else if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation(); // Keep this
                toggleChatInput(false, true);
            }
        };
        chatInputElement.addEventListener('keydown', chatInputKeyListener);

    } else {
        // This error should no longer occur if the element exists in HTML
        console.error("Chat input element was null during setup.");
    }
    console.log("Chat module initialized.");
}


// --- State Getter ---
export function isChatting(): boolean {
    // --- ADD LOGGING ---
    // Consider removing this verbose logging once stable
    //console.log(`[isChatting getter] Returning: ${isChattingState}`);
    // -------------------
    return isChattingState;
}


// --- Toggle Chat Input Visibility and Focus ---
export function toggleChatInput(show: boolean, forceCloseNoSend: boolean = false): void {
    if (!chatInputElement) {
        console.warn("Cannot toggle chat input: Input element missing.");
        return;
    }

    const wasChatting = isChattingState; // Check state *before* changing it

    if (show) {
        // --- Opening Chat ---
        //console.log("[toggleChatInput] Opening chat."); // Log opening
        isChattingState = true;
        chatInputElement.style.display = 'block';
        chatInputElement.focus();
    } else {
        // --- Closing Chat ---
        //console.log("[toggleChatInput] Closing chat."); // Log closing
        const message = chatInputElement.value.trim();

        if (!forceCloseNoSend && message) {
            handleSendMessageCallback(message);
        }

        chatInputElement.style.display = 'none';
        chatInputElement.value = '';

        // --- Set state and log immediately ---
        isChattingState = false;
        //console.log(`[toggleChatInput] isChattingState set to: ${isChattingState}`);
        // ------------------------------------

        // --- REMOVED CALLBACK CALL ---
        // if (wasChatting && onChatCloseCallback) {
        //     onChatCloseCallback(false);
        // }
        // ---------------------------
    }
}


// --- Display Chat Message ---
export function displayChatMessage(username: string | null | undefined, message: string): void {
    if (!chatOutputElement) return;

    const messageElement = document.createElement('p');
    const safeUsername = sanitizeHTML(username || 'System');
    const safeMessage = sanitizeHTML(message);
    messageElement.innerHTML = `<strong>${safeUsername}:</strong> ${safeMessage}`;
    chatOutputElement.appendChild(messageElement);
    chatOutputElement.scrollTop = chatOutputElement.scrollHeight;
}

// --- Cleanup Function ---
export function cleanupChat(): void {
    //console.log("Cleaning up chat module...");
    if (chatInputElement && chatInputKeyListener) {
        chatInputElement.removeEventListener('keydown', chatInputKeyListener);
        //console.log("Removed chat input key listener.");
    }
    chatInputElement = null;
    chatOutputElement = null;
    chatContainerElement = null;
    handleSendMessageCallback = () => {};
    chatInputKeyListener = null;
    // REMOVED: onChatCloseCallback = null;
    isChattingState = false;
    //console.log("Chat module cleanup complete.");
}