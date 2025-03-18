import { Ball, Player } from "./localClasses.js";
import { saveTournamentGameResult, stopTournamentGame } from "./tournament.js";

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
let gameStop = false;
let dict = null;

export function clearIntervalIDGame() {
    if (intervalID) {
        clearInterval(intervalID);
        intervalID = null;
    }
    // console.log("stopping the game");
    gameStop = true;
}

function saveGameState() {
    const gameState = {
        ballX: ball.x,
        ballY: ball.y,
        ballSpeedX: ball.xspeed,
        ballSpeedY: ball.yspeed,
        playerPaddleY: player.y,
        aiPaddleY: AI.y,
        playerScore: player.score,
        aiScore: AI.score,
        mainUserNmb: mainUser,
    };

    localStorage.setItem("gameState", JSON.stringify(gameState));
}

function loadGameState() {
    const savedState = localStorage.getItem("gameState");
    const username = localStorage.getItem("username");
    if (savedState) {
        const gameState = JSON.parse(savedState);
        mainUser = gameState.mainUserNmb;
        if (mainUser == 1) {
            player = new Player(canvas, 0, username, 0);
            AI = new Player(canvas, 1, "AI", canvas.width - 10);
        } else {
            player = new Player(canvas, 1, username, canvas.width - 10);
            AI = new Player(canvas, 0, "AI", 0);
        }
        ball.x = gameState.ballX;
        ball.y = gameState.ballY;
        ball.xspeed = gameState.ballSpeedX;
        ball.yspeed = gameState.ballSpeedY;
        player.y = gameState.playerPaddleY;
        AI.y = gameState.aiPaddleY;
        player.score = gameState.playerScore;
        AI.score = gameState.aiScore;
    }
}

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
    // console.log('DIFFICULTY:');
    // console.log(difficulty);
    // console.log('ERROR-RANGE:');
    // console.log(errorRange);
    // console.log('ERROR:');
    // console.log(error);
    return Math.max(0, Math.min(canvas.height, tempY + error));
    // return tempY;
}

function doMovesAI() {
    if (!AI || !ball)
        return;

    // console.log("doing it each sec");
    // if (tournamentId)
    //     saveGameState();
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

async function displayCountdown()
{
	//if (tournamentId)
	//	return ;
	if (gameLoopId)
		cancelAnimationFrame(gameLoopId);
	let div = document.getElementById("wait");
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	div.innerHTML = dict["ready"];
	div.style.display = "block";
	div.style.fontSize = Math.floor(canvas.width * 0.05) + "px";
	ctx.fillStyle = "rgb(0 0 0 / 25%)";
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	await new Promise(resolve => setTimeout(resolve, 500));
	div.innerHTML = dict["go"];
	await new Promise(resolve => setTimeout(resolve, 500));
	div.style.display = "none";
	await gameAILoop();
}

async function readySteadyGo(countdown = 3)
{
	const msg = ["1", "2", "3"];
	let div = document.getElementById("wait");

	if (div) {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		div.textContent = msg[countdown];
		div.style.fontSize = Math.floor(canvas.width * 0.25) + "px";

		ctx.fillStyle = "rgb(0 0 0 / 25%)";
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		div.style.display = "block";
		while (countdown >= 0) {
            div.textContent = msg[countdown];
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before the next update
            countdown--;
        }
		div.style.display = "none";
	}
}

// Game loop
async function gameAILoop() {
    gameLoopId = requestAnimationFrame(gameAILoop);
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.fillStyle = "rgb(0 0 0 / 75%)";
	ctx.fillRect(0, 0, canvas.width, canvas.height);

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
        if (ball.move(player, AI) && player.score != maxScore && AI.score != maxScore)
		{
			//await displayCountdown();
			cancelAnimationFrame(gameLoopId);
			await readySteadyGo();
			await gameAILoop();
		}
    } else {
        if (ball.move(AI, player) && player.score != maxScore && AI.score != maxScore)
		{
			//await displayCountdown();
			cancelAnimationFrame(gameLoopId);
			await readySteadyGo();
			await gameAILoop();
		}
    }
    
    if (gameStop || player.score >= maxScore || AI.score >= maxScore) {
        localStorage.removeItem("gameState");
        let winner = player.score > AI.score ? player.name : "@AI";
        let looser = player.score > AI.score ? "@AI" : player.name;
        const winnerMsg = player.score > AI.score ? `${player.name} Wins!` : `${AI.name} Wins!`;
        let finalScore = "";
        if (mainUser == 1)
            finalScore = `${player.score} - ${AI.score}`;
        else
            finalScore = `${AI.score} - ${player.score}`;
        cancelAnimationFrame(gameLoopId);
        if (!gameStop)
            player.displayEndgameMessage(ctx, finalScore, winnerMsg);
        else {
            winner = "@AI";
            looser = player.name;
        }
        // saveScore();

        if (intervalID) {
            clearInterval(intervalID);
            intervalID = null;
        }

        if (tournamentId) {
            // console.log('TOURNAMENT GAME FINISHED');
            // console.log(tournamentId);
            saveTournamentGameResult(winner, looser, player.score, AI.score);
        } 
    }
}

// Event listeners for player controls
export function setupControlsAI(player) {
    window.addEventListener("keydown", (e) => {
        // console.log("REMOTE CONTROLS ACTING")
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

function resizeCanvasAI() {
	if (!canvas)
		return ;

    canvas = document.getElementById("newGameCanvas");
    const container = document.getElementById("newGameBoard");
	if (!canvas || !container)
		return ;

    let maxWidth = container.clientWidth;
    let maxHeight = container.clientHeight;

    let newWidth = maxWidth;
    let newHeight = (9 / 16) * newWidth;

	//Apply aspect ratio
    if (newHeight > maxHeight) {
        newHeight = maxHeight;
        newWidth = (16 / 9) * newHeight;
    }

    // newWidth = Math.max(500, Math.min(newWidth, 1200));
    // newHeight = Math.max(300, Math.min(newHeight, 800));

    newWidth = Math.floor(newWidth);
    newHeight = Math.floor(newHeight);

    canvas.style.width = `${newWidth - 5}px`;
    canvas.style.height = `${newHeight}px`;
	ctx = canvas.getContext('2d');

	if (player)
		player.resize(newWidth, newHeight);
    if (AI)
		AI.resize(newWidth, newHeight);
	if (ball)
		ball.resize(newWidth, newHeight);

    canvas.width = newWidth;
    canvas.height = newHeight;
}

window.addEventListener("resize", resizeCanvasAI);

// Start game function
export async function startAIGame(playerName1, playerName2, mainUserNmb, tournament, dictionary) {
	dict = dictionary;
    if (intervalID) {
        clearInterval(intervalID);
        intervalID = null;
    }
    gameStop = false;
    if (tournament) {
        difficulty = 1; // medium
        tournamentId = tournament.id;
        // console.log(tournament.id);
    } else {
        tournamentId = null;
    }
    canvas = document.getElementById("newGameCanvas");
    ctx = canvas.getContext("2d");
    // console.log(mainUserNmb);
    // console.log(playerName1);
    // console.log(playerName2);

    // canvas.width = window.innerWidth * 0.65; // % of screen width
    // canvas.height = canvas.width * 0.57; // % of screen height

    resizeCanvasAI();

    mainUser = mainUserNmb;

    // Initialize players and ball
    // console.log('Starting AI game...');
    // if (!gameStop) {
    //     console.log("game was not stopped!");
        if (mainUserNmb == 1) {
            player = new Player(canvas, 0, playerName1, 0);
            AI = new Player(canvas, 1, playerName2, canvas.width - 10);
        } else {
            player = new Player(canvas, 1, playerName2, canvas.width - 10);
            AI = new Player(canvas, 0, playerName1, 0);
        }
        ball = new Ball(canvas, ctx);
        // loadGameState();
    // } else {
    //     console.log("game was stopped");
    // }
    // console.log(canvas.width);
    // console.log(canvas.height);

    errorRange = (canvas.height / 10) * (2 / difficulty);  // Higher difficulty = smaller error

    setupControlsAI(player);
    window.addEventListener("beforeunload", beforeUnloadHandlerAI);
    intervalID = setInterval(doMovesAI, 1000);
    // console.log(tournamentId);
	await readySteadyGo();
    await gameAILoop();
}

const beforeUnloadHandlerAI = () => {
    if (tournamentId) {
        saveTournamentGameResult("@AI", player.name, 0, AI.score);
    }
};

export const removeBeforeUnloadListenerAI = () => {
    window.removeEventListener("beforeunload", beforeUnloadHandlerAI);
};

document.addEventListener("click", function (event) {
    // Detectamos si se clicó dentro de una opción
    const option = event.target.closest(".option-trn");
    if (option) {
      // Marcamos el radio button dentro de la opción
      const radio = option.querySelector(".input-trn");
      if (radio) {
        radio.checked = true;
        // Removemos la clase "active" de todas las opciones
        document.querySelectorAll(".option-trn").forEach(opt => opt.classList.remove("active"));
        // Añadimos "active" a la opción clicada
        option.classList.add("active");
  
        // Obtenemos el valor de la dificultad
        const difficulty_btn = radio.getAttribute("data-value");
        // console.log("LEVEL SELECTED:", difficulty_btn);
        // Aquí asignas a la variable global si es necesario:
        difficulty = difficulty_btn;
      }
    }
});

export function cleanupAI() {
    if (!ball) return;

    cancelAnimationFrame(gameLoopId);
    player = null;
    AI = null;
    ball = null;
    // console.log("✅ AI game cleaned up!");
}

