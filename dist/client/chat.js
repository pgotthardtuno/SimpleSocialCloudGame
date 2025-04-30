"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupChat = setupChat;
exports.isChatting = isChatting;
exports.toggleChatInput = toggleChatInput;
exports.displayChatMessage = displayChatMessage;
exports.cleanupChat = cleanupChat;
const utils_1 = require("./utils");
// --- Module State ---
let isChattingState = false;
let chatInputElement = null;
let chatOutputElement = null;
let chatContainerElement = null;
let handleSendMessageCallback = () => { };
let chatInputKeyListener = null;
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
function setupChat(containerEl, outputEl, inputEl, onSendMessage) {
    // --- ADD THESE ASSIGNMENTS ---
    chatContainerElement = containerEl;
    chatOutputElement = outputEl;
    chatInputElement = inputEl; // Assign the passed element to the module variable
    handleSendMessageCallback = onSendMessage;
    // --- END OF ADDED ASSIGNMENTS ---
    // Add the log we added previously to confirm
    console.log(`[setupChat] chatInputElement assigned:`, chatInputElement);
    isChattingState = false; // Initialize state
    // Now this check uses the correctly assigned module variable
    if (chatInputElement) {
        chatInputElement.style.display = 'none';
        chatInputKeyListener = (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                event.stopPropagation(); // Keep this
                toggleChatInput(false);
            }
            else if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation(); // Keep this
                toggleChatInput(false, true);
            }
        };
        chatInputElement.addEventListener('keydown', chatInputKeyListener);
    }
    else {
        // This error should no longer occur if the element exists in HTML
        console.error("Chat input element was null during setup.");
    }
    console.log("Chat module initialized.");
}
// --- State Getter ---
function isChatting() {
    // --- ADD LOGGING ---
    // Consider removing this verbose logging once stable
    //console.log(`[isChatting getter] Returning: ${isChattingState}`);
    // -------------------
    return isChattingState;
}
// --- Toggle Chat Input Visibility and Focus ---
function toggleChatInput(show, forceCloseNoSend = false) {
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
    }
    else {
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
function displayChatMessage(username, message) {
    if (!chatOutputElement)
        return;
    const messageElement = document.createElement('p');
    const safeUsername = (0, utils_1.sanitizeHTML)(username || 'System');
    const safeMessage = (0, utils_1.sanitizeHTML)(message);
    messageElement.innerHTML = `<strong>${safeUsername}:</strong> ${safeMessage}`;
    chatOutputElement.appendChild(messageElement);
    chatOutputElement.scrollTop = chatOutputElement.scrollHeight;
}
// --- Cleanup Function ---
function cleanupChat() {
    //console.log("Cleaning up chat module...");
    if (chatInputElement && chatInputKeyListener) {
        chatInputElement.removeEventListener('keydown', chatInputKeyListener);
        //console.log("Removed chat input key listener.");
    }
    chatInputElement = null;
    chatOutputElement = null;
    chatContainerElement = null;
    handleSendMessageCallback = () => { };
    chatInputKeyListener = null;
    // REMOVED: onChatCloseCallback = null;
    isChattingState = false;
    //console.log("Chat module cleanup complete.");
}
