import type { WinnerScreen } from "../shared/types.js";
import type { ClientState } from "./client-state.js";
import { escapeHtml } from "./html.js";
import { renderConversationMessages } from "./render.js";

export function renderOverlayElements(appEl: HTMLElement, state: ClientState) {
    appEl.querySelectorAll(".error-toast, .winner-overlay").forEach((element) => element.remove());
    const overlays = renderOverlays(state);
    if (!overlays.trim()) return;

    appEl.insertAdjacentHTML("beforeend", overlays);
    bindOverlayInteractions(appEl, state);
}

export function showError(appEl: HTMLElement, state: ClientState, message: string) {
    state.errorMessage = message;

    if (state.errorTimeout !== null) {
        window.clearTimeout(state.errorTimeout);
    }

    state.errorTimeout = window.setTimeout(() => {
        state.errorMessage = "";
        state.errorTimeout = null;
        renderOverlayElements(appEl, state);
    }, 3500);

    renderOverlayElements(appEl, state);
}

export function showWinnerScreen(appEl: HTMLElement, state: ClientState, screen: WinnerScreen) {
    state.winnerScreen = screen;
    state.winnerCloseEnabled = false;

    if (state.winnerCloseTimeout !== null) {
        window.clearTimeout(state.winnerCloseTimeout);
    }

    state.winnerCloseTimeout = window.setTimeout(() => {
        state.winnerCloseEnabled = true;
        state.winnerCloseTimeout = null;
        renderOverlayElements(appEl, state);
    }, 1500);

    renderOverlayElements(appEl, state);
}

function renderOverlays(state: ClientState): string {
    return `
        ${state.errorMessage ? renderErrorToast(state.errorMessage) : ""}
        ${state.winnerScreen ? renderWinnerScreen(state.winnerScreen, state) : ""}
    `;
}

function renderErrorToast(message: string): string {
    return `
        <div class="error-toast" role="alert">
            ${escapeHtml(message)}
        </div>
    `;
}

function renderWinnerScreen(screen: WinnerScreen, state: ClientState): string {
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
    } else {
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
                    ${renderConversationMessages(screen.conversation, state.ownPlayerName)}
                </div>
                ${winnerResult}
                <button class="winner-close" data-action="close-winner-screen" ${state.winnerCloseEnabled ? "" : "disabled"}>Cerrar</button>
            </div>
        </div>
    `;
}

function bindOverlayInteractions(appEl: HTMLElement, state: ClientState) {
    appEl.querySelectorAll("[data-action=close-winner-screen]").forEach((button) => {
        button.addEventListener("click", () => {
            if (!state.winnerCloseEnabled) return;
            state.winnerScreen = null;
            renderOverlayElements(appEl, state);
        });
    });
}
