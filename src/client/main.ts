import { Message, Player, PlayerState } from "../shared/types.js";

declare const io: typeof import("socket.io-client").io;

const APP_EL = document.getElementById("app") as HTMLDivElement;
const socket = io();
let joinError = "";
let selectedCardId: number | null = null;
let selectableAction: string | null = null;

if (!APP_EL) {
    throw new Error("Element with id 'app' not found");
}

document.addEventListener("DOMContentLoaded", () => {
    socket.on("connect", () => {
        console.log("Connected to server");
    });

    socket.on("disconnect", () => {
        console.log("Disconnected from server");
    });

    socket.on("connect_error", (err) => {
        console.error("Connection error:", err);
    });

    socket.on("gameError", (error: { message: string }) => {
        joinError = error?.message ?? "Server error";
        renderJoinScreen();
        bindJoinInteractions();
    });

    socket.on("gameState", (state: PlayerState) => {
        joinError = "";
        APP_EL.innerHTML = renderPlayerState(state);
        bindInteractions(state);
    });

    renderJoinScreen();
    bindJoinInteractions();
});



function renderJoinScreen() {
    APP_EL.innerHTML = `
        <div class="join-screen">
            <div class="join-box">
                <h1 class="join-title">Card Chat</h1>
                <p class="join-subtitle">Enter your name to join the game.</p>
                <input class="join-input" data-action="join-name" type="text" placeholder="Your name" autocomplete="name" />
                <button class="join-button" data-action="join-game">Join game</button>
                <div class="join-note">The game starts automatically once 3 players are connected.</div>
                ${joinError ? `<div class="join-error">${escapeHtml(joinError)}</div>` : ""}
            </div>
        </div>
    `;
}


function bindJoinInteractions() {
    APP_EL.querySelectorAll("[data-action=join-game]").forEach((button) => {
        button.addEventListener("click", () => {
            const input = APP_EL.querySelector("[data-action=join-name]") as HTMLInputElement | null;
            if (!input) return;
            const value = input.value.trim();
            if (!value) {
                joinError = "Please enter a name.";
                renderJoinScreen();
                bindJoinInteractions();
                return;
            }
            socket.emit("joinGame", value);
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
    return `
        <div class="player-state">
            ${renderHeader(state)}
            <div class="player-body">
                ${renderConversation(state)}
                ${renderActionSection(state)}
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
                    name: "Join the game",
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
                ${player.isCzar ? `<span class="player-tag">czar</span>` : ""}
                <span>${player.roundsWon} 🏆</span>
                <span>${player.winningCards} 🃏</span>
            </div>
        </div>
    `;
}

function renderConversation(state: PlayerState): string {
    const messages = getConversationMessages(state.state);

    const items = messages.length
        ? messages
              .map((message) => `
                <div class="conversation-item${message.sender === getOwnPlayerName(state) ? " self" : ""}">
                    <div class="conversation-sender">${escapeHtml(message.sender)}</div>
                    <div class="conversation-text">${escapeHtml(message.text)}</div>
                </div>
            `)
              .join("")
        : `<div class="conversation-empty">No conversation yet.</div>`;

    return `
        <section class="conversation">
            <div class="section-title">Conversation</div>
            <div class="conversation-list">
                ${items}
            </div>
        </section>
    `;
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
    const phase = state.state?.phase ?? "waiting";
    const isCzar = ownPlayer?.isCzar ?? false;
    let content = "";
    selectableAction = null;

    if (phase === "playCards") {
        if (isCzar) {
            content = `<div class="action-text">You are the czar. Waiting for players to play.</div>`;
        } else if ((state.state as any).played) {
            content = `<div class="action-text">Card played. Waiting for the czar.</div>`;
        } else {
            content = `<div class="action-text">Select a card to play.</div>`;
            selectableAction = "play-card";
        }
    } else if (phase === "chooseWinner") {
        if (isCzar) {
            const choices = ((state.state as any).choices ?? []) as Array<{ uuid: number; content: string }>;
            content = `
                <div class="action-text">Choose a winning card.</div>
                <div class="choice-list">
                    ${choices
                        .map(
                            (choice) => `
                                <button class="choice-button" data-action="choose-winner" data-card-id="${choice.uuid}">${escapeHtml(choice.content)}</button>
                            `
                        )
                        .join("")}
                </div>
            `;
        } else {
            content = `<div class="action-text">Waiting for the czar to choose.</div>`;
        }
    } else if (phase === "createCards") {
        if (isCzar) {
            content = `<div class="action-text">You are the czar. Waiting for players to create cards.</div>`;
        } else {
            const amount = (state.state as any).amount ?? 1;
            content = `
                <div class="action-text">Create ${amount} card${amount === 1 ? "" : "s"}.</div>
                <div class="action-row">
                    <input class="action-input" data-action="create-card-input" type="text" placeholder="Write a card" />
                    <button class="action-button" data-action="create-card">Create</button>
                </div>
            `;
        }
    } else if (phase === "createConversation") {
        if (isCzar) {
            content = `
                <div class="action-text">Write the new conversation starter.</div>
                <div class="action-row">
                    <input class="action-input" data-action="create-conversation-input" type="text" placeholder="Write a conversation" />
                    <button class="action-button" data-action="create-conversation">Send</button>
                </div>
            `;
        } else {
            content = `<div class="action-text">Waiting for the czar to start the conversation.</div>`;
        }
    } else if (phase === "discardCard") {
        content = `
            <div class="action-text">Discard a card or keep your hand.</div>
            <button class="action-button" data-action="keep-cards">Keep cards</button>
        `;
        selectableAction = "discard-card";
    } else {
        content = `<div class="action-text">Waiting for the game to start.</div>`;
    }

    return `
        <section class="action-panel">
            <div class="section-title">Action</div>
            <div class="action-content">
                ${content}
            </div>
        </section>
    `;
}


function renderHand(state: PlayerState): string {
    const hand = state.hand;
    const ownPlayer = state.players.find((player) => player.id === state.playerId);
    const isCzar = ownPlayer?.isCzar ?? false;
    const mayPlay = selectableAction === "play-card" && !isCzar && !(state.state as any).played;
    const mayDiscard = selectableAction === "discard-card";
    const isSelecting = mayPlay || mayDiscard;

    if (!hand.length) {
        return `
            <section class="hand-panel">
                <div class="hand-empty">No cards in hand.</div>
            </section>
        `;
    }

    return `
        <section class="hand-panel${isSelecting ? " selecting" : ""}">
            ${isSelecting ? `<button class="hand-confirm" data-action="confirm-card">Confirm</button>` : ""}
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
            if (!text) return;
            socket.emit("createCard", text);
            input.value = "";
        });
    });

    APP_EL.querySelectorAll("[data-action=create-conversation]").forEach((button) => {
        button.addEventListener("click", () => {
            const input = APP_EL.querySelector("[data-action=create-conversation-input]") as HTMLInputElement | null;
            if (!input) return;
            const text = input.value.trim();
            if (!text) return;
            socket.emit("createConversation", text);
            input.value = "";
        });
    });

    APP_EL.querySelectorAll("[data-action=choose-winner]").forEach((button) => {
        button.addEventListener("click", () => {
            const cardId = button.getAttribute("data-card-id");
            if (!cardId) return;
            socket.emit("chooseWinner", Number(cardId));
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
                socket.emit("discardCard", selectedCardId);
            }
            selectedCardId = null;
            selectableAction = null;
        });
    });

    APP_EL.querySelectorAll("[data-action=keep-cards]").forEach((button) => {
        button.addEventListener("click", () => {
            socket.emit("discardCard", null);
        });
    });
}



function getOwnPlayerName(state: PlayerState): string {
    return state.players.find((player) => player.id === state.playerId)?.name ?? "";
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
