import { Ball, Player } from "./localClasses.js";
import { saveTournamentGameResult } from "./tournament.js";

// Game Initialization
let canvas = null;
let ctx = null;
let player = null;
let AI = null;
let mainUser = null; // if the main user is player 1 or 2
let ball = null;
let gameLoopId = null;
let maxScore = 2;
let intervalID = null;
let targetY = null;
let difficulty = 3; // 0.5-1 => easy, 3 => already low chance for ai to lose, 5 => almost impossible; 
let errorRange = null;
let tournamentId = null;

// when the ball will hit the top or bottom walls
function getTimeToTopBottom(yspeed, y) {
    return (yspeed > 0) 
        ? (canvas.height - (y + ball.radius)) / yspeed  // bottom wall
        : -(y - ball.radius) / yspeed;                  // top wall
}

// when the ball will hit the left or right walls
function getTimeToLeftRight(xspeed, x) {
    return (xspeed > 0) 
        ? (canvas.width - (x + ball.radius)) / xspeed   // right wall
        : -(x - ball.radius) / xspeed;                  // left wall
}

// if mainUser == 1 => we need to focus on right wall, else => on left wall
// ball.xspeed > 0 => right, < 0 => left
// ball.yspeed > 0 => down, < 0 => up
function predictBallY() {
    let tempX = ball.x;
    let tempY = ball.y;
    let tempXspeed = ball.xspeed;
    let tempYspeed = ball.yspeed;

    // if the ball is going toward opposite wall => return random just for moving & replicating human behaviour
    if (tempXspeed > 0 && mainUser == 2)
        return Math.floor(Math.random() * (canvas.height + 1)); //null;
    if (tempXspeed < 0 && mainUser == 1)
        return Math.floor(Math.random() * (canvas.height + 1)); //null;

    let timeToTopBottom = getTimeToTopBottom(tempYspeed, tempY);
    let timeToLeftRight = getTimeToLeftRight(tempXspeed, tempX);

    while (timeToTopBottom < timeToLeftRight) {
        tempX = tempX + tempXspeed * timeToTopBottom;
        if (tempYspeed < 0) {
            tempY = 0; //ball.radius;
        } else {
            tempY = canvas.height - ball.radius;
        }
        tempYspeed = -tempYspeed;

        timeToTopBottom = getTimeToTopBottom(tempYspeed, tempY);
        timeToLeftRight = getTimeToLeftRight(tempXspeed, tempX);
    }

    tempY = tempY + tempYspeed * timeToLeftRight;

    let error = Math.random() * errorRange - errorRange ;/// 2;  // Random error between ±errorRange/2
    console.log('DIFFICULTY:');
    console.log(difficulty);
    console.log('ERROR-RANGE:');
    console.log(errorRange);
    console.log('ERROR:');
    console.log(error);
    return Math.max(0, Math.min(canvas.height, tempY + error));
    // return tempY;
}

function doMovesAI() {
    if (!AI || !ball)
        return;

    console.log("doing it each sec");
    targetY = predictBallY();
    if (targetY === null)   
        return;

    if (targetY  < AI.y + AI.height / 2) {
        AI.up = true;
        AI.down = false;
    } else if (targetY  > AI.y + AI.height / 2) {
        AI.down = true;
        AI.up = false;
    } else {
        AI.up = false;
        AI.down = false;
    }
}

function checkIfAIneedStop() {
    if (targetY) {
        if (AI.up && AI.y + (AI.height / 2) <= targetY) {
            AI.up = false;
        } else if (AI.down && AI.y + (AI.height / 2) >= targetY) {
            AI.down = false;
        }
    }
}

// Game loop
function gameAILoop() {
    gameLoopId = requestAnimationFrame(gameAILoop);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw players and ball
    player.draw(ctx);
    AI.draw(ctx);
    ball.draw(ctx);

    // Draw scores
    player.drawScore(ctx);
    AI.drawScore(ctx);

    // Move players and ball
    player.move();
    AI.move();
    checkIfAIneedStop();
    if (mainUser == 1) {
        ball.move(player, AI);
    } else {
        ball.move(AI, player);
    }
    
    // Endgame check
    if (player.score >= maxScore || AI.score >= maxScore) {
        const winner = player.score > AI.score ? player.name : "@AI";
        const looser = player.score > AI.score ? "@AI" : player.name;
        const winnerMsg = player.score > AI.score ? `${player.name} Wins!` : `${AI.name} Wins!`;
        // const finalScore = `${player.score} - ${AI.score}`; // change properly
        const finalScore = `*final score*`
        cancelAnimationFrame(gameLoopId);
        player.displayEndgameMessage(ctx, finalScore, winnerMsg);
        // saveScore();

        if (intervalID) {
            clearInterval(intervalID);
            intervalID = null;
        }

        if (tournamentId) {
            console.log('TOURNAMENT GAME FINISHED, ID:: ');
            console.log(tournamentId);
            saveTournamentGameResult(tournamentId, winner, looser);
        } else {
            console.log("SIMPLE GAME FINISHED");
        }
    }
}

// Event listeners for player controls
function setupControlsAI() {
    window.addEventListener("keydown", (e) => {
        if (e.key === "w") player.up = true;
        if (e.key === "s") player.down = true;
        if (e.key === "ArrowUp") player.up = true;
        if (e.key === "ArrowDown") player.down = true;
    });

    window.addEventListener("keyup", (e) => {
        if (e.key === "w") player.up = false;
        if (e.key === "s") player.down = false;
        if (e.key === "ArrowUp") player.up = false;
        if (e.key === "ArrowDown") player.down = false;
    });
}

// Start game function
export function startAIGame(playerName1, playerName2, mainUserNmb, tournament) {
    if (intervalID) {
        clearInterval(intervalID);
        intervalID = null;
    }
    if (tournament) {
        difficulty = 3; // medium
        tournamentId = tournament.id;
        console.log(tournament.id);
    }
    canvas = document.getElementById("newGameCanvas");
    ctx = canvas.getContext("2d");
    console.log(mainUserNmb);
    console.log(playerName1);
    console.log(playerName2)

    canvas.width = window.innerWidth * 0.65; // % of screen width
    canvas.height = canvas.width * 0.57; // % of screen height

    mainUser = mainUserNmb;

    // Initialize players and ball
    console.log('Starting AI game...');
    if (mainUserNmb == 1) {
        player = new Player(canvas, 0, playerName1, 0);
        AI = new Player(canvas, 1, playerName2, canvas.width - 10);
    } else {
        player = new Player(canvas, 1, playerName2, canvas.width - 10);
        AI = new Player(canvas, 0, playerName1, 0);
    }
    ball = new Ball(canvas);
    console.log(canvas.width);
    console.log(canvas.height);

    errorRange = (canvas.height / 10) * (2 / difficulty);  // Higher difficulty = smaller error

    setupControlsAI();
    intervalID = setInterval(doMovesAI, 1000);
    console.log(tournamentId);
    gameAILoop();
}

document.addEventListener("click", function (event) {
    if (event.target.classList.contains("difficulty-btn")) {
        const difficultyButtons = document.querySelectorAll(".difficulty-btn");
        const difficultyInput = document.getElementById("difficulty-level");

        // Remove active class from all buttons
        difficultyButtons.forEach(btn => btn.classList.remove("active"));

        // Add active class to selected button
        event.target.classList.add("active");

        // Set the hidden input value
        difficultyInput.value = event.target.getAttribute("data-value");
        console.log("LEVEL SELECTED:");
        console.log(difficultyInput.value);
        difficulty = difficultyInput.value;
    }
});


// document.addEventListener("DOMContentLoaded", function () {
//     const difficultyButtons = document.querySelectorAll(".difficulty-btn");
//     const difficultyInput = document.getElementById("difficulty-level");

//     difficultyButtons.forEach(button => {
//         button.addEventListener("click", function () {
//             // Remove active class from all buttons
//             difficultyButtons.forEach(btn => btn.classList.remove("active"));

//             // Add active class to selected button
//             this.classList.add("active");

//             // Set the hidden input value
//             difficultyInput.value = this.getAttribute("data-value");
//             console.log("LEVEL SELECTED:");
//             console.log(difficultyInput.value);
//         });
//     });

//     // document.getElementById("play-ai-form").addEventListener("submit", function (event) {
//     //     if (!difficultyInput.value) {
//     //         event.preventDefault(); // Prevent form submission if no difficulty is selected
//     //         alert("Please select a difficulty level before starting the game.");
//     //     }
//     // });
// });
