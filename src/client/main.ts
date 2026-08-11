declare const io: typeof import("socket.io-client").io;

document.addEventListener("DOMContentLoaded", () => {
    const connectionStatus = document.getElementById("connection-status");
    const lastEvent = document.getElementById("last-event");
    const gameStateElement = document.getElementById("game-state");
    const eventNameInput = document.getElementById("event-name") as HTMLInputElement | null;
    const eventPayloadInput = document.getElementById("event-payload") as HTMLInputElement | null;
    const sendEventButton = document.getElementById("send-event");
    const lastDebug = document.getElementById("last-debug");
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

    socket.on("debugEcho", (payload: unknown) => {
        if (lastDebug) lastDebug.textContent = typeof payload === 'string' ? payload : JSON.stringify(payload);
        updateEvent("debugEcho received");
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

    if (sendEventButton && eventNameInput && eventPayloadInput) {
        sendEventButton.addEventListener("click", () => {
            const eventName = eventNameInput.value.trim();
            const payloadRaw = eventPayloadInput.value;
            if (!eventName) {
                updateEvent("Enter an event name to emit");
                return;
            }

            // Try to parse the payload as JSON; fall back to string
            let payload: unknown = payloadRaw;
            try {
                payload = payloadRaw === "" ? null : JSON.parse(payloadRaw);
            } catch (err) {
                // leave payload as raw string
            }

            socket.emit(eventName, payload);
            updateEvent(`Emitted event '${eventName}'`);
        });
    }
});
