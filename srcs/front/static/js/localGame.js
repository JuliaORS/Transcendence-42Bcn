import { makeAuthenticatedRequest } from "./login.js";
// import { addLogoutListener } from "./logout.js";
import { navigateTo, checkPermission } from "./main.js"
import { Ball, Player } from "./localClasses.js";

var baseUrl = "http://localhost"; // change (parse) later



// Game Initialization
let canvas = null;
let ctx = null;
let player1 = null;
let player2 = null;
let mainUser = null; // if the main user is player 1 or 2
let ball = null;
let gameLoopId = null;
let maxScore = 2;

export function saveScore() {

    makeAuthenticatedRequest(baseUrl + ":8001/api/game/local/save-local-score/", {
        method: "POST",
        body: JSON.stringify({
            // 'player1': player1.name,
            'score1': player1.score,
            // 'player2': player1.name,
            'score2': player2.score,
            
            'main_user': mainUser, 
        }),
        headers: {"Content-Type": "application/json"},
    })
    .then((response) => {
        if (response.ok) {
            console.log('Score saved successfully');
        }
    })
    .catch(error => {
        console.error('Catch error saving score: ', error);
    });
}

// Game loop
function gameLocalLoop() {
    gameLoopId = requestAnimationFrame(gameLocalLoop);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw players and ball
    player1.draw(ctx);
    player2.draw(ctx);
    ball.draw(ctx);

    console.log('In local game loop!');

    // Draw scores
    player1.drawScore(ctx);
    player2.drawScore(ctx);

    // Move players and ball
    player1.move();
    player2.move();
    ball.move(player1, player2);

    // Endgame check
    if (player1.score >= maxScore || player2.score >= maxScore) {
        const winner = player1.score > player2.score ? `${player1.name} Wins!` : `${player2.name} Wins!`;
        const finalScore = `${player1.score} - ${player2.score}`;
        cancelAnimationFrame(gameLoopId);
        player1.displayEndgameMessage(ctx, finalScore, winner);
        saveScore();
    }
}

// Event listeners for player controls
export function setupControls(player1, player2) {
    window.addEventListener("keydown", (e) => {
        if (e.key === "w" || e.key === "W") player1.up = true;
        if (e.key === "s" || e.key === "S") player1.down = true;
        if (e.key === "ArrowUp") player2.up = true;
        if (e.key === "ArrowDown") player2.down = true;
    });

    window.addEventListener("keyup", (e) => {
        if (e.key === "w" || e.key === "W") player1.up = false;
        if (e.key === "s" || e.key === "S") player1.down = false;
        if (e.key === "ArrowUp") player2.up = false;
        if (e.key === "ArrowDown") player2.down = false;
    });
}

// Start game function
export function startLocalGame(playerName1, playerName2, mainUserNmb) {
    canvas = document.getElementById("newGameCanvas");
    ctx = canvas.getContext("2d");

    canvas.width = window.innerWidth * 0.65; // % of screen width
    canvas.height = canvas.width * 0.5; // % of screen height

    mainUser = mainUserNmb;

    // Initialize players and ball
    console.log('Starting local game...');
    console.log(`Canvas: ${canvas.width} x ${canvas.height}`);
    player1 = new Player(canvas, 0, playerName1);
    player2 = new Player(canvas, 1, playerName2);
    ball = new Ball(canvas);

    setupControls(player1, player2);
    gameLocalLoop();
}
