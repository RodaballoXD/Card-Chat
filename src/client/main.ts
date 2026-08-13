import { Message, Player, PlayerState } from "../shared/types.js";
import { actionRequiresCards, canCreateCard, canDiscardCard, hasConversation } from "./state-helpers.js";
import type { ChooseWinnerStateCzar, CreateCardsState, CreateConversationStateCzar, DiscardCardState, PlayCardState, WinnerScreen } from "../shared/types.js";

declare const io: typeof import("socket.io-client").io;

const APP_EL = document.getElementById("app") as HTMLDivElement;
const PLAYER_UUID_KEY = "card-chat-player-uuid";
const socket = io();
let selectedCardId: number | null = null;
let selectableAction: string | null = null;
let errorMessage = "";
let errorTimeout: number | null = null;
let winnerScreen: WinnerScreen | null = null;
let winnerCloseEnabled = false;
let winnerCloseTimeout: number | null = null;
let ownPlayerName = "";

if (!APP_EL) {
    throw new Error("Element with id 'app' not found");
}

document.addEventListener("DOMContentLoaded", () => {
    socket.on("connect", () => {
        console.log("Connected to server");
        const playerUuid = localStorage.getItem(PLAYER_UUID_KEY);
        if (playerUuid) {
            socket.emit("reconnectGame", playerUuid);
        }
    });

    socket.on("disconnect", () => {
        console.log("Disconnected from server");
    });

    socket.on("connect_error", (err) => {
        console.error("Connection error:", err);
        showError(err.message);
    });

    socket.on("gameError", (error: { message: string }) => {
        showError(error?.message ?? "Server error");
    });

    socket.on("gameState", (state: PlayerState) => {
        ownPlayerName = getOwnPlayerName(state);
        renderApp(renderPlayerState(state));
        bindInteractions(state);
    });

    socket.on("joinRequired", () => {
        clearStoredPlayer();
        resetClientState();
        renderJoinScreen();
        bindJoinInteractions();
    });

    socket.on("gameReset", () => {
        clearStoredPlayer();
        resetClientState();
        renderJoinScreen();
        bindJoinInteractions();
    });

    socket.on("winnerScreen", (screen: WinnerScreen) => {
        showWinnerScreen(screen);
    });

    renderJoinScreen();
    bindJoinInteractions();
});



function renderJoinScreen() {
    renderApp(`
        <div class="join-screen">
            <div class="join-box">
                <h1 class="join-title">Card Chat</h1>
                <p class="join-subtitle">Introduce tu nombre para unirte a la partida.</p>
                <input class="join-input" data-action="join-name" type="text" placeholder="Tu nombre" autocomplete="name" />
                <button class="join-button" data-action="join-game">Unirse a la partida</button>
                <div class="join-note">La partida empieza automáticamente cuando hay 3 jugadores conectados.</div>
            </div>
        </div>
    `);
}


function bindJoinInteractions() {
    APP_EL.querySelectorAll("[data-action=join-game]").forEach((button) => {
        button.addEventListener("click", () => {
            const input = APP_EL.querySelector("[data-action=join-name]") as HTMLInputElement | null;
            if (!input) return;
            const value = input.value.trim();
            if (!value) {
                showError("Please enter a name.");
                renderJoinScreen();
                bindJoinInteractions();
                return;
            }
            if (value.startsWith("/settings")) {
                handleSettingsChangeCommand(value);
                return;
            }
            socket.emit("joinGame", {
                name: value,
                playerUuid: getOrCreatePlayerUuid()
            });
        });
    });

    APP_EL.querySelectorAll("[data-action=join-name]").forEach((input) => {
        input.addEventListener("keydown", (event) => {
            const keyboardEvent = event as KeyboardEvent;
            if (keyboardEvent.key === "Enter") {
                keyboardEvent.preventDefault();
                const btn = APP_EL.querySelector("[data-action=join-game]") as HTMLButtonElement | null;
                btn?.click();
            }
        });
    });
}


function renderPlayerState(state: PlayerState): string {
    const showConversation = hasConversation(state.state);

    return `
        <div class="player-state">
            ${renderHeader(state)}
            <div class="player-body${showConversation ? "" : " no-conversation"}">
                ${showConversation ? renderConversation(state) : ""}
            </div>
            ${renderHand(state)}
        </div>
    `;
}


function renderHeader(state: PlayerState): string {
    const ownPlayer = state.players.find((player) => player.id === state.playerId);
    const sortedPlayers = [...state.players]
        .filter((player) => player.id !== state.playerId)
        .sort((a, b) => b.roundsWon - a.roundsWon);

    return `
        <header class="header" data-action="toggle-players">
            ${renderPlayerHeaderRow(
                ownPlayer ?? {
                    id: 0,
                    name: "Únete a la partida",
                    isConnected: true,
                    isCzar: false,
                    roundsWon: 0,
                    winningCards: 0,
                },
                true
            )}
            <div class="players-panel" data-panel="players" hidden>
                ${sortedPlayers.map((player) => renderPlayerHeaderRow(player)).join("")}
            </div>
        </header>
    `;
}


function renderPlayerHeaderRow(player: Player, isOwn = false): string {
    return `
        <div class="player-row${isOwn ? " current" : ""}">
            <div class="player-left">${escapeHtml(player.name)}</div>
            <div class="player-right">
                ${player.isCzar ? `<span class="player-tag">zar</span>` : ""}
                <span>${player.roundsWon} 🏆</span>
                <span>${player.winningCards} 🃏</span>
            </div>
        </div>
    `;
}

function renderConversation(state: PlayerState): string {
    const messages = getConversationMessages(state.state);
    return renderConversationMessages(messages, ownPlayerName);
}


function getConversationMessages(state: PlayerState["state"]): Message[] {
    if (!state) {
        return [];
    }

    if (state.phase === "playCards" || state.phase === "chooseWinner" || state.phase === "awaitWinnerChoice") {
        return state.conversation;
    }

    return [];
}


function renderActionSection(state: PlayerState): string {
    const ownPlayer = state.players.find((player) => player.id === state.playerId);
    const phase = state.state?.phase;
    const isCzar = ownPlayer?.isCzar ?? false;
    const hasConversationState = hasConversation(state.state);
    const requiresCards = actionRequiresCards(state.state);
    let content = "";
    selectableAction = null;

    if (phase === "playCards") {
        if (isCzar) {
            content = `<div class="action-text">Eres el zar. Esperando a que los jugadores jueguen una carta.</div>`;
        } else if ((state.state as PlayCardState).played) {
            content = `<div class="action-text">Carta jugada. Esperando al zar.</div>`;
        } else {
            content = `<div class="action-text">Elige una carta para jugarla.</div>`;
            selectableAction = "play-card";
        }
    } else if (phase === "chooseWinner") {
        const choices = ((state.state as ChooseWinnerStateCzar).choices ?? []);
        selectableAction = "choose-winner";
        content = `
            <div class="action-text">Elige la carta ganadora.</div>
            <div class="choice-list">
                ${choices
                    .map(
                        (choice) => `
                            <button class="hand-card choice-card${selectedCardId === choice.uuid ? " selected" : ""}" data-action="select-card" data-card-id="${choice.uuid}">
                                <span class="hand-card-text">${escapeHtml(choice.content)}</span>
                            </button>
                        `
                    )
                    .join("")}
            </div>
            <button class="action-button" data-action="confirm-choice"}>Seleccionar</button>
        `;
    } else if (phase === "awaitWinnerChoice") {
        content = `<div class="action-text">Esperando a que el zar elija un ganador.</div>`;
    }
    else if (phase === "createCards") {
        if (isCzar) {
            content = `<div class="action-text">Eres el zar. Esperando a que los jugadores creen cartas.</div>`;
        } else {
            const amount = (state.state as CreateCardsState).amount ?? 1;
            const canCreate = canCreateCard(state.state);
            content = `
                <div class="action-text">Crea ${amount} carta${amount === 1 ? "" : "s"}.</div>
                <div class="action-row">
                    <div class="input-counter-wrap">
                        <input class="action-input" data-action="create-card-input" type="text" maxlength="100" placeholder="Escribe una carta" ${canCreate ? "" : "disabled"} />
                        <span class="char-counter" data-char-counter="create-card">0/100</span>
                    </div>
                    <button class="action-button" data-action="create-card" ${canCreate ? "" : "disabled"}>Crear</button>
                </div>
            `;
        }
    } else if (phase === "createConversation") {
        content = `
            <div class="action-text">${(state.state as CreateConversationStateCzar).created ?? "Escribe un nuevo mensaje inicial"}</div>
            <div class="action-row">
                <div class="input-counter-wrap">
                    <input class="action-input" data-action="create-conversation-input" type="text" maxlength="100" placeholder="Escribe una conversación" />
                    <span class="char-counter" data-char-counter="create-conversation">0/100</span>
                </div>
                <button class="action-button" data-action="create-conversation">Enviar</button>
            </div>
        `;
    } else if (phase === "discardCard") {
        const canDiscard = canDiscardCard(state.state);
        content = `
            <div class="action-text">Descarta una carta o conserva tu mano.</div>
            <button class="action-button" data-action="keep-cards" ${canDiscard ? "" : "disabled"}>Conservar mano</button>
        `;
        if (canDiscard) {
            selectableAction = "discard-card";
        }
    } else {
        content = `<div class="action-text">Esperando a que empiece la partida.</div>`;
    }

    const actionSummary = renderActionSummary(state);

    return `
        <section class="action-panel${!hasConversationState ? " full-height" : ""}${requiresCards ? " requires-cards" : ""}">
            <div class="section-title">Acción</div>
            <div class="action-content">
                ${actionSummary ? `<div class="action-summary">${actionSummary}</div>` : ""}
                ${content}
            </div>
        </section>
    `;
}

function renderActionSummary(state: PlayerState): string {
    if (!state.state) return "";

    if (state.state.phase === "playCards") {
        const played = (state.state as PlayCardState).played;
        if (!played) return "";
        return `<span class="action-summary-label">Jugada</span><span class="action-summary-value">${escapeHtml(played.content)}</span>`;
    }

    if (state.state.phase === "createCards") {
        const created = ((state.state as CreateCardsState).created ?? []);
        if (!created.length) return "";
        return `<span class="action-summary-label">Creadas</span><span class="action-summary-value">${created.map((card) => escapeHtml(card.content)).join(" • ")}</span>`;
    }

    if (state.state.phase === "createConversation") {
        const created = (state.state as CreateConversationStateCzar).created;
        if (!created) return "";
        return `<span class="action-summary-label">Conversación</span><span class="action-summary-value">${escapeHtml(created.text)}</span>`;
    }

    if (state.state.phase === "discardCard") {
        const discarded = (state.state as DiscardCardState).discarded;
        if (discarded === null) return "";
        if (discarded === "none") return `<span class="action-summary-label">Descartada</span><span class="action-summary-value">mano conservada</span>`;
        return `<span class="action-summary-label">Descartada</span><span class="action-summary-value">${escapeHtml(discarded.content)}</span>`;
    }

    return "";
}


function renderHand(state: PlayerState): string {
    const hand = state.hand;
    const ownPlayer = state.players.find((player) => player.id === state.playerId);
    const isCzar = ownPlayer?.isCzar ?? false;
    const mayPlay = selectableAction === "play-card" && !isCzar && !(state.state as any).played;
    const mayDiscard = selectableAction === "discard-card";
    const isSelecting = mayPlay || mayDiscard;
    const showConversation = hasConversation(state.state);
    const actionPanel = renderActionSection(state);

    if (!hand.length) {
        return `
            <section class="hand-panel${showConversation ? "" : " no-conversation"}">
                ${actionPanel}
                <div class="hand-empty">No tienes cartas en la mano.</div>
            </section>
        `;
    }

    return `
        <section class="hand-panel${isSelecting ? " selecting" : ""}${showConversation ? "" : " no-conversation"}">
            ${actionPanel}
            ${isSelecting ? `<button class="hand-confirm" data-action="confirm-card">Confirmar</button>` : ""}
            <div class="hand-list">
                ${hand.map((card) => `
                    <button class="hand-card${selectedCardId === card.uuid ? " selected" : ""}" data-card-id="${card.uuid}" data-action="${isSelecting ? "select-card" : "none"}">
                        <span class="hand-card-text">${escapeHtml(card.content)}</span>
                    </button>
                `).join("")}
            </div>
        </section>
    `;
}



function bindInteractions(state: PlayerState) {
    APP_EL.querySelector("[data-action=toggle-players]")!.addEventListener("click", () => {
        const panel = APP_EL.querySelector("[data-panel=players]") as HTMLElement | null;
        if (!panel) return;
        if (panel.hasAttribute("hidden")) {
            panel.removeAttribute("hidden");
        } else {
            panel.setAttribute("hidden", "true");
        }
    });

    APP_EL.querySelectorAll("[data-action=create-card]").forEach((button) => {
        button.addEventListener("click", () => {
            const input = APP_EL.querySelector("[data-action=create-card-input]") as HTMLInputElement | null;
            if (!input) return;
            const text = input.value.trim();
            if (!text || text.length > 100) return;
            if (!canCreateCard(state.state)) return;
            socket.emit("createCard", text);
            input.value = "";
            updateCharCounter(input, "create-card");
        });
    });

    APP_EL.querySelectorAll("[data-action=create-conversation]").forEach((button) => {
        button.addEventListener("click", () => {
            const input = APP_EL.querySelector("[data-action=create-conversation-input]") as HTMLInputElement | null;
            if (!input) return;
            const text = input.value.trim();
            if (!text || text.length > 100) return;
            socket.emit("createConversation", text);
            input.value = "";
            updateCharCounter(input, "create-conversation");
        });
    });

    APP_EL.querySelectorAll("[data-action=create-card-input]").forEach((input) => {
        input.addEventListener("input", () => {
            const element = input as HTMLInputElement;
            if (element.value.length > 100) {
                element.value = element.value.slice(0, 100);
            }
            updateCharCounter(element, "create-card");
        });
    });

    APP_EL.querySelectorAll("[data-action=create-conversation-input]").forEach((input) => {
        input.addEventListener("input", () => {
            const element = input as HTMLInputElement;
            if (element.value.length > 100) {
                element.value = element.value.slice(0, 100);
            }
            updateCharCounter(element, "create-conversation");
        });
    });

    APP_EL.querySelectorAll("[data-action=confirm-choice]").forEach((button) => {
        button.addEventListener("click", () => {
            if (selectedCardId === null) return;
            socket.emit("chooseWinner", selectedCardId);
        });
    });

    APP_EL.querySelectorAll("[data-action=select-card]").forEach((button) => {
        button.addEventListener("click", () => {
            const cardId = button.getAttribute("data-card-id");
            if (!cardId) return;
            selectedCardId = Number(cardId);
            button.classList.add("selected");
            APP_EL.querySelectorAll("[data-action=select-card]").forEach((otherButton) => {
                if (otherButton !== button) {
                    otherButton.classList.remove("selected");
                }
            });
        });
    });

    APP_EL.querySelectorAll("[data-action=confirm-card]").forEach((button) => {
        button.addEventListener("click", () => {
            if (selectedCardId === null || !selectableAction) return;
            if (selectableAction === "play-card") {
                socket.emit("playCard", selectedCardId);
            } else if (selectableAction === "discard-card") {
                if (!canDiscardCard(state.state)) return;
                socket.emit("discardCard", selectedCardId);
            }
            selectedCardId = null;
            selectableAction = null;
        });
    });

    APP_EL.querySelectorAll("[data-action=keep-cards]").forEach((button) => {
        button.addEventListener("click", () => {
            if (!canDiscardCard(state.state)) return;
            socket.emit("discardCard", null);
        });
    });
}


function renderApp(content: string) {
    APP_EL.innerHTML = content;
    renderOverlayElements();
}

function renderOverlayElements() {
    APP_EL.querySelectorAll(".error-toast, .winner-overlay").forEach((element) => element.remove());
    const overlays = renderOverlays();
    if (!overlays.trim()) return;

    APP_EL.insertAdjacentHTML("beforeend", overlays);
    bindOverlayInteractions();
}

function renderOverlays(): string {
    return `
        ${errorMessage ? renderErrorToast(errorMessage) : ""}
        ${winnerScreen ? renderWinnerScreen(winnerScreen) : ""}
    `;
}

function renderErrorToast(message: string): string {
    return `
        <div class="error-toast" role="alert">
            ${escapeHtml(message)}
        </div>
    `;
}

function renderWinnerScreen(screen: WinnerScreen): string {
    let winnerResult: string;

    if (screen.winnerCard) {
        const winnerName = screen.winnerName;
        const creatorName = screen.creatorName;
        winnerResult = `
            <div class="winner-result">
                <div class="winner-card-text">${escapeHtml(screen.winnerCard.content)}</div>
                <div class="winner-line">🏆 ${escapeHtml(winnerName)}</div>
                ${(creatorName)
                    ? (`<div class="winner-line creator">🃏 ${escapeHtml(creatorName)}</div>`)
                    : ""
                }
            </div>
        `;
    }
    else {
        winnerResult = `
            <div class="winner-result">
                <div class="winner-card-text">El zar ha abandonado la partida</div>
                <div class="winner-line">No hay ganador en esta ronda</div>
            </div>
        `;
    }

    return `
        <div class="winner-overlay" role="dialog" aria-modal="true">
            <div class="winner-screen">
                <div class="winner-conversation">
                    ${renderConversationMessages(screen.conversation, ownPlayerName)}
                </div>
                ${winnerResult}
                <button class="winner-close" data-action="close-winner-screen" ${winnerCloseEnabled ? "" : "disabled"}>Cerrar</button>
            </div>
        </div>
    `;
}

function renderConversationMessages(messages: Message[], currentPlayerName: string): string {
    if (!messages.length) {
        return "";
    }

    const items = messages
        .map((message) => `
            <div class="conversation-item${message.sender === currentPlayerName ? " self" : ""}">
                <div class="conversation-sender">${escapeHtml(message.sender)}</div>
                <div class="conversation-text">${escapeHtml(message.text)}</div>
            </div>
        `)
        .join("");

    return `
        <section class="conversation">
            <div class="section-title">Conversación</div>
            <div class="conversation-list">
                ${items}
            </div>
        </section>
    `;
}

function bindOverlayInteractions() {
    APP_EL.querySelectorAll("[data-action=close-winner-screen]").forEach((button) => {
        button.addEventListener("click", () => {
            if (!winnerCloseEnabled) return;
            winnerScreen = null;
            renderOverlayElements();
        });
    });
}

function showError(message: string) {
    errorMessage = message;

    if (errorTimeout !== null) {
        window.clearTimeout(errorTimeout);
    }

    errorTimeout = window.setTimeout(() => {
        errorMessage = "";
        errorTimeout = null;
        renderOverlayElements();
    }, 3500);

    renderOverlayElements();
}

function showWinnerScreen(screen: WinnerScreen) {
    winnerScreen = screen;
    winnerCloseEnabled = false;

    if (winnerCloseTimeout !== null) {
        window.clearTimeout(winnerCloseTimeout);
    }

    winnerCloseTimeout = window.setTimeout(() => {
        winnerCloseEnabled = true;
        winnerCloseTimeout = null;
        renderOverlayElements();
    }, 1500);

    renderOverlayElements();
}

function getOrCreatePlayerUuid(): string {
    const existing = localStorage.getItem(PLAYER_UUID_KEY);
    if (existing) return existing;

    const uuid = (crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(PLAYER_UUID_KEY, uuid);
    return uuid;
}

function clearStoredPlayer() {
    localStorage.removeItem(PLAYER_UUID_KEY);
}

function resetClientState() {
    selectedCardId = null;
    selectableAction = null;
    winnerScreen = null;
    winnerCloseEnabled = false;
    ownPlayerName = "";

    if (winnerCloseTimeout !== null) {
        window.clearTimeout(winnerCloseTimeout);
        winnerCloseTimeout = null;
    }
}


function getOwnPlayerName(state: PlayerState): string {
    return state.players.find((player) => player.id === state.playerId)?.name ?? "";
}

function updateCharCounter(input: HTMLInputElement, key: string) {
    const counter = APP_EL.querySelector(`[data-char-counter="${key}"]`) as HTMLElement | null;
    if (!counter) return;

    const length = input.value.length;
    counter.textContent = `${length}/100`;
    counter.classList.toggle("over-limit", length > 100);
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}



function handleSettingsChangeCommand(command: string) {
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
