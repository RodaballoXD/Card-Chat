export class GameConnector {
    constructor(io, game) {
        this.io = io;
        this.game = game;
        this.playerSockets = new Map();
        this.socketPlayers = new Map();
        io.on("connection", (socket) => {
            this.handleConnection(socket);
        });
    }
    handleConnection(socket) {
        socket.on("joinGame", (name) => {
            this.joinGame(socket, name);
        });
        // simple debug message for testing from client
        socket.on("debugMessage", (payload) => {
            try {
                console.log(`Received debugMessage from ${socket.id}:`, payload);
                // Echo back to the sender so the client can verify round-trip
                socket.emit("debugEcho", payload);
            }
            catch (err) {
                console.error("Error handling debugMessage:", err);
            }
        });
        socket.on("playCard", (cardId) => {
            this.handleAction(socket, () => {
                this.game.playCard(this.getPlayerId(socket), cardId);
            });
        });
        socket.on("createCard", (text) => {
            this.handleAction(socket, () => {
                this.game.createCard(this.getPlayerId(socket), text);
            });
        });
        socket.on("chooseWinner", (cardId) => {
            this.handleAction(socket, () => {
                const playerId = this.getPlayerId(socket);
                if (!this.game.isCzar(playerId)) {
                    throw new Error("You are not the czar");
                }
                this.game.chooseWinnerCard(cardId);
            });
        });
        socket.on("discardCard", (cardId) => {
            this.handleAction(socket, () => {
                this.game.discardCard(this.getPlayerId(socket), cardId);
            });
        });
        socket.on("disconnect", () => {
            this.handleDisconnect(socket);
        });
    }
    joinGame(socket, name) {
        if (this.socketPlayers.has(socket.id)) {
            this.sendError(socket, "You are already in the game");
            return;
        }
        try {
            const player = this.game.connectPlayer(name);
            this.playerSockets.set(player.id, socket);
            this.socketPlayers.set(socket.id, player.id);
            this.update();
            this.tryStartGame();
        }
        catch (error) {
            this.sendError(socket, error);
        }
    }
    tryStartGame() {
        const connectedCount = this.game.connectedPlayers().length;
        if (connectedCount >= 3) {
            try {
                this.game.startGame();
            }
            catch (err) {
                // If game cannot be started (already started or other), ignore.
            }
        }
    }
    handleDisconnect(socket) {
        const playerId = this.socketPlayers.get(socket.id);
        if (playerId === undefined)
            return;
        this.socketPlayers.delete(socket.id);
        this.playerSockets.delete(playerId);
        try {
            this.game.disconnectPlayer(playerId);
            this.update();
        }
        catch (error) {
            console.error("Error disconnecting player:", error);
        }
    }
    handleAction(socket, action) {
        try {
            action();
            this.update();
        }
        catch (error) {
            this.sendError(socket, error);
        }
    }
    update() {
        for (const [playerId, socket] of this.playerSockets) {
            try {
                const state = this.game.playerState(playerId);
                socket.emit("gameState", state);
            }
            catch (error) {
                console.error(`Could not create state for player ${playerId}:`, error);
            }
        }
    }
    getPlayerId(socket) {
        const playerId = this.socketPlayers.get(socket.id);
        if (playerId === undefined) {
            throw new Error("You are not connected to a game");
        }
        return playerId;
    }
    sendError(socket, error) {
        const message = error instanceof Error
            ? error.message
            : "Unknown error";
        socket.emit("gameError", { message });
    }
}
//# sourceMappingURL=game-connector.js.map