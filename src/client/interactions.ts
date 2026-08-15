import type { Socket } from "socket.io-client";
import type { PlayerState } from "../shared/types.js";
import type { ClientState } from "./client-state.js";
import { canCreateCard, canDiscardCard } from "./state-helpers.js";
import { getOrCreatePlayerUuid } from "./player-session.js";
import { updateCharCounter } from "./interactive-state.js";

interface InteractionContext {
    appEl: HTMLElement;
    socket: Socket;
    clientState: ClientState;
    renderJoinView: () => void;
    showError: (message: string) => void;
}

export function bindJoinInteractions(context: InteractionContext) {
    const { appEl, socket, renderJoinView, showError } = context;

    appEl.querySelectorAll("[data-action=join-game]").forEach((button) => {
        button.addEventListener("click", () => {
            const input = appEl.querySelector("[data-action=join-name]") as HTMLInputElement | null;
            if (!input) return;
            const value = input.value.trim();
            if (!value) {
                showError("Please enter a name.");
                renderJoinView();
                return;
            }
            if (value.startsWith("/")) {
                handleSettingsChangeCommand(socket, value, showError);
                return;
            }
            socket.emit("joinGame", {
                name: value,
                playerUuid: getOrCreatePlayerUuid()
            });
        });
    });

    appEl.querySelectorAll("[data-action=join-name]").forEach((input) => {
        input.addEventListener("keydown", (event) => {
            const keyboardEvent = event as KeyboardEvent;
            if (keyboardEvent.key === "Enter") {
                keyboardEvent.preventDefault();
                const btn = appEl.querySelector("[data-action=join-game]") as HTMLButtonElement | null;
                btn?.click();
            }
        });
    });
}

export function bindGameInteractions(context: InteractionContext, state: PlayerState) {
    const { appEl, socket, clientState } = context;

    appEl.querySelector("[data-action=toggle-players]")?.addEventListener("click", () => {
        const panel = appEl.querySelector("[data-panel=players]") as HTMLElement | null;
        if (!panel) return;
        if (panel.hasAttribute("hidden")) {
            panel.removeAttribute("hidden");
        } else {
            panel.setAttribute("hidden", "true");
        }
        updatePanelToggleIndicator(appEl);
    });
    updatePanelToggleIndicator(appEl);

    appEl.querySelectorAll("[data-action=create-card]").forEach((button) => {
        button.addEventListener("click", () => {
            const input = appEl.querySelector("[data-action=create-card-input]") as HTMLInputElement | null;
            if (!input) return;
            const text = input.value.trim();
            if (!text || text.length > 100) return;
            if (!canCreateCard(state.state)) return;
            socket.emit("createCard", text);
            input.value = "";
            updateCharCounter(appEl, input, "create-card");
        });
    });

    appEl.querySelectorAll("[data-action=create-conversation]").forEach((button) => {
        button.addEventListener("click", () => {
            const input = appEl.querySelector("[data-action=create-conversation-input]") as HTMLInputElement | null;
            if (!input) return;
            const text = input.value.trim();
            if (!text || text.length > 100) return;
            socket.emit("createConversation", text);
            input.value = "";
            updateCharCounter(appEl, input, "create-conversation");
        });
    });

    appEl.querySelectorAll("[data-action=create-card-input]").forEach((input) => {
        input.addEventListener("input", () => {
            const element = input as HTMLInputElement;
            if (element.value.length > 100) {
                element.value = element.value.slice(0, 100);
            }
            updateCharCounter(appEl, element, "create-card");
        });
    });

    appEl.querySelectorAll("[data-action=create-conversation-input]").forEach((input) => {
        input.addEventListener("input", () => {
            const element = input as HTMLInputElement;
            if (element.value.length > 100) {
                element.value = element.value.slice(0, 100);
            }
            updateCharCounter(appEl, element, "create-conversation");
        });
    });

    appEl.querySelectorAll("[data-action=confirm-choice]").forEach((button) => {
        button.addEventListener("click", () => {
            if (clientState.selectedCardId === null) return;
            socket.emit("chooseWinner", clientState.selectedCardId);
        });
    });

    appEl.querySelectorAll("[data-action=select-card]").forEach((button) => {
        button.addEventListener("click", () => {
            const cardId = button.getAttribute("data-card-id");
            if (!cardId) return;
            clientState.selectedCardId = Number(cardId);
            button.classList.add("selected");
            appEl.querySelectorAll("[data-action=select-card]").forEach((otherButton) => {
                if (otherButton !== button) {
                    otherButton.classList.remove("selected");
                }
            });
        });
    });

    appEl.querySelectorAll("[data-action=confirm-card]").forEach((button) => {
        button.addEventListener("click", () => {
            if (clientState.selectedCardId === null || !clientState.selectableAction) return;
            if (clientState.selectableAction === "play-card") {
                socket.emit("playCard", clientState.selectedCardId);
            } else if (clientState.selectableAction === "discard-card") {
                if (!canDiscardCard(state.state)) return;
                socket.emit("discardCard", clientState.selectedCardId);
            }
            clientState.selectedCardId = null;
            clientState.selectableAction = null;
        });
    });

    appEl.querySelectorAll("[data-action=keep-cards]").forEach((button) => {
        button.addEventListener("click", () => {
            if (!canDiscardCard(state.state)) return;
            socket.emit("discardCard", null);
        });
    });
}

function handleSettingsChangeCommand(socket: Socket, command: string, showError: (message: string) => void) {
    try {
        const settingsString = command.replace("/settings", "").trim();
        const settings = JSON.parse(settingsString);
        for (const key in settings) {
            socket.emit("changeSettings", key, settings[key]);
        }
    } catch (error) {
        showError((error instanceof Error) ? error.message : "Invalid settings command");
    }
}

function updatePanelToggleIndicator(appEl: HTMLElement) {
    const panel = appEl.querySelector("[data-panel=players]") as HTMLElement | null;
    const indicator = appEl.querySelector("[data-panel-toggle-indicator]") as HTMLElement | null;
    if (!panel || !indicator) return;

    const isOpen = !panel.hasAttribute("hidden");
    indicator.innerHTML = isOpen ? "&#9662;" : "&#9656;";
    indicator.setAttribute("aria-label", isOpen ? "Panel abierto" : "Panel cerrado");
}
