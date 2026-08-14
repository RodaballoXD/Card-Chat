import type { Socket } from "socket.io-client";
import type { PlayerState, WinnerScreen } from "../shared/types.js";
import { createClientState, getOwnPlayerName, getSelectableAction, resetClientState } from "./client-state.js";
import { captureInteractiveState, restoreInteractiveState } from "./interactive-state.js";
import { bindGameInteractions, bindJoinInteractions } from "./interactions.js";
import { clearStoredPlayer, getStoredPlayerUuid } from "./player-session.js";
import { renderJoinScreen, renderPlayerState } from "./render.js";
import { renderOverlayElements, showError, showWinnerScreen } from "./overlays.js";

declare const io: typeof import("socket.io-client").io;

const appEl = document.getElementById("app") as HTMLDivElement;
const socket = io();
const clientState = createClientState();

if (!appEl) {
    throw new Error("Element with id 'app' not found");
}

document.addEventListener("DOMContentLoaded", () => {
    bindSocketEvents(socket);
    renderJoinView();
});

function bindSocketEvents(socket: Socket) {
    socket.on("connect", () => {
        console.log("Connected to server");
        const playerUuid = getStoredPlayerUuid();
        if (playerUuid) {
            socket.emit("reconnectGame", playerUuid);
        }
    });

    socket.on("disconnect", () => {
        console.log("Disconnected from server");
    });

    socket.on("connect_error", (err) => {
        console.error("Connection error:", err);
        showClientError(err.message);
    });

    socket.on("gameError", (error: { message: string }) => {
        showClientError(error?.message ?? "Server error");
        console.log("Game error:", error?.message ?? "Unknown error");
    });

    socket.on("gameState", (state: PlayerState) => {
        console.log(`Recieved gameState: ${JSON.stringify(state)}`);

        const interactiveState = captureInteractiveState(appEl);
        clientState.ownPlayerName = getOwnPlayerName(state);
        clientState.selectableAction = getSelectableAction(state);

        renderApp(renderPlayerState(state, clientState));
        restoreInteractiveState(appEl, interactiveState);
        bindGameInteractions(makeInteractionContext(), state);
    });

    socket.on("joinRequired", () => {
        resetToJoinView();
    });

    socket.on("gameReset", () => {
        resetToJoinView();
    });

    socket.on("winnerScreen", (screen: WinnerScreen) => {
        showWinnerScreen(appEl, clientState, screen);
    });
}

function renderJoinView() {
    renderApp(renderJoinScreen());
    bindJoinInteractions(makeInteractionContext());
}

function resetToJoinView() {
    clearStoredPlayer();
    resetClientState(clientState);
    renderJoinView();
}

function renderApp(content: string) {
    appEl.innerHTML = content;
    renderOverlayElements(appEl, clientState);
}

function showClientError(message: string) {
    showError(appEl, clientState, message);
}

function makeInteractionContext() {
    return {
        appEl,
        socket,
        clientState,
        renderJoinView,
        showError: showClientError,
    };
}
