declare const io: typeof import("socket.io-client").io;

document.addEventListener("DOMContentLoaded", () => {
    const connectionStatus = document.getElementById("connection-status");
    const lastEvent = document.getElementById("last-event");
    const gameStateElement = document.getElementById("game-state");
    const joinButton = document.getElementById("join-button");
    const playerNameInput = document.getElementById("player-name") as HTMLInputElement | null;

    const socket = io();

    const updateStatus = (text: string) => {
        if (connectionStatus) connectionStatus.textContent = text;
    };

    const updateEvent = (text: string) => {
        if (lastEvent) lastEvent.textContent = text;
    };

    const updateGameState = (state: unknown) => {
        if (gameStateElement) gameStateElement.textContent = JSON.stringify(state, null, 2);
    };

    socket.on("connect", () => {
        updateStatus("connected");
        updateEvent("Socket connected");
    });

    socket.on("disconnect", () => {
        updateStatus("disconnected");
        updateEvent("Socket disconnected");
    });

    socket.on("connect_error", () => {
        updateStatus("error");
        updateEvent("Connection error");
    });

    socket.on("gameState", (state: unknown) => {
        updateEvent("Game state received");
        updateGameState(state);
    });

    socket.on("gameError", (error: { message: string }) => {
        updateEvent(`Error: ${error?.message ?? "Unknown"}`);
    });

    if (joinButton && playerNameInput) {
        joinButton.addEventListener("click", () => {
            const name = playerNameInput.value.trim();
            if (!name) {
                updateEvent("Enter a player name before joining");
                return;
            }

            socket.emit("joinGame", name);
            updateEvent(`Joining as ${name}...`);
        });
    }
});
