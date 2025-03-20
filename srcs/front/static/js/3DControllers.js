// import { gameStarted, gameEnded, text } from "./3DGame.js";

export function handlePlayersKeydown(e, player1, player2, player3) {

    if (player1) {
        if (e.key === "w") player1.up = true;
        if (e.key === "s") player1.down = true;
    }

    if (player2) {
        if (e.key === "ArrowUp") player2.up = true;
        if (e.key === "ArrowDown") player2.down = true;
    }

    if (player3) {
        if (e.key === "ArrowRight") player3.up = true;
        if (e.key === "ArrowLeft") player3.down = true;
    }
}

export function handlePlayersKeyup(e, player1, player2, player3) {

    if (player1) {
        if (e.key === "w") player1.up = false;
        if (e.key === "s") player1.down = false;
    }

    if (player2) {
        if (e.key === "ArrowUp") player2.up = false;
        if (e.key === "ArrowDown") player2.down = false;
    }

    if (player3) {
        if (e.key === "ArrowRight") player3.up = false;
        if (e.key === "ArrowLeft") player3.down = false;
    }
}