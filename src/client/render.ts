import type {
    ChooseWinnerStateCzar,
    CreateCardsState,
    CreateConversationStateCzar,
    DiscardCardState,
    Message,
    PlayCardState,
    Player,
    PlayerState,
} from "../shared/types.js";
import type { ClientState } from "./client-state.js";
import { actionRequiresCards, canCreateCard, canDiscardCard, hasConversation } from "./state-helpers.js";
import { escapeHtml } from "./html.js";

export function renderJoinScreen(): string {
    return `
        <div class="join-screen">
            <div class="join-box">
                <h1 class="join-title">Card Chat</h1>
                <p class="join-subtitle">Introduce tu nombre para unirte a la partida.</p>
                <input class="join-input" data-action="join-name" type="text" placeholder="Tu nombre" autocomplete="name" />
                <button class="join-button" data-action="join-game">Unirse a la partida</button>
                <div class="join-note">La partida empieza automáticamente cuando hay 3 jugadores conectados.</div>
            </div>
        </div>
    `;
}

export function renderPlayerState(playerState: PlayerState, clientState: ClientState): string {
    const showConversation = hasConversation(playerState.state);

    return `
        <div class="player-state">
            ${renderHeader(playerState)}
            <div class="player-body${showConversation ? "" : " no-conversation"}">
                ${showConversation ? renderConversation(playerState, clientState.ownPlayerName) : ""}
            </div>
            ${renderHand(playerState, clientState)}
        </div>
    `;
}

export function renderConversationMessages(messages: Message[], currentPlayerName: string): string {
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
                    didAction: "noAction",
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
                ${renderDidActionIndicator(player)}
                ${player.isCzar ? `<span class="player-tag">zar</span>` : ""}
                <span>${player.roundsWon} 🏆</span>
                <span>${player.winningCards} 🃏</span>
            </div>
            ${isOwn ? `<span class="panel-toggle-indicator" data-panel-toggle-indicator aria-label="Panel cerrado">&#9656;</span>` : ""}
        </div>
    `;
}

function renderDidActionIndicator(player: Player): string {
    if (player.didAction === "noAction") {
        return "";
    }

    if (player.didAction) {
        return `<span class="player-action player-action-done" aria-label="Accion completada">&#10003;</span>`;
    }

    return `<span class="player-action"><span class="loader" aria-label="Esperando accion"></span></span>`;
}

function renderConversation(state: PlayerState, ownPlayerName: string): string {
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

function renderActionSection(state: PlayerState, clientState: ClientState): string {
    const ownPlayer = state.players.find((player) => player.id === state.playerId);
    const phase = state.state.phase;
    const isCzar = ownPlayer?.isCzar ?? false;
    const hasConversationState = hasConversation(state.state);
    const requiresCards = actionRequiresCards(state.state);
    let content = "";

    if (phase === "playCards") {
        if (isCzar) {
            content = `<div class="action-text">Eres el zar. Esperando a que los jugadores jueguen una carta.</div>`;
        } else if ((state.state as PlayCardState).played) {
            content = `<div class="action-text">Carta jugada. Esperando al zar.</div>`;
        } else {
            content = `<div class="action-text">Elige una carta para jugarla.</div>`;
        }
    } else if (phase === "chooseWinner") {
        const choices = ((state.state as ChooseWinnerStateCzar).choices ?? []);
        content = `
            <div class="action-text">Elige la carta ganadora.</div>
            <div class="choice-list">
                ${choices
                    .map(
                        (choice) => `
                            <button class="hand-card choice-card${clientState.selectedCardId === choice.uuid ? " selected" : ""}" data-action="select-card" data-card-id="${choice.uuid}">
                                <span class="hand-card-text">${escapeHtml(choice.content)}</span>
                            </button>
                        `
                    )
                    .join("")}
            </div>
            <button class="action-button" data-action="confirm-choice">Seleccionar</button>
        `;
    } else if (phase === "awaitWinnerChoice") {
        content = `<div class="action-text">Esperando a que el zar elija un ganador.</div>`;
    } else if (phase === "createCards") {
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
    } else if (phase === "createConversation") {
        content = `
            <div class="action-text">${(state.state as CreateConversationStateCzar).created ? escapeHtml(state.state!.created!.text) : "Escribe un nuevo mensaje inicial"}</div>
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
    } else {
        content = `<div class="action-text">${state.state.text}</div>`;
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

function renderHand(state: PlayerState, clientState: ClientState): string {
    const hand = state.hand;
    const ownPlayer = state.players.find((player) => player.id === state.playerId);
    const isCzar = ownPlayer?.isCzar ?? false;
    const actionPanel = renderActionSection(state, clientState);
    const mayPlay = clientState.selectableAction === "play-card" && !isCzar && !(state.state as any).played;
    const mayDiscard = clientState.selectableAction === "discard-card";
    const isSelecting = mayPlay || mayDiscard;
    const showConversation = hasConversation(state.state);

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
                    <button class="hand-card${clientState.selectedCardId === card.uuid ? " selected" : ""}" data-card-id="${card.uuid}" data-action="${isSelecting ? "select-card" : "none"}">
                        <span class="hand-card-text">${escapeHtml(card.content)}</span>
                    </button>
                `).join("")}
            </div>
        </section>
    `;
}
