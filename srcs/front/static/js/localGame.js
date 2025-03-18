import { makeAuthenticatedRequest } from "./login.js";
import { Ball, Player } from "./localClasses.js";

const host = window.env.HOST;
const protocolWeb = window.env.PROTOCOL_WEB
const baseUrl = protocolWeb + "://" + host + ":";  
const gamePort = window.env.GAME_PORT;

// Game Initialization
let canvas = null;
let ctx = null;
let player1 = null;
let player2 = null;
let mainUser = null; // if the main user is player 1 or 2
let ball = null;
let gameLoopId = null;
let maxScore = 2;
let dict = null;

export function saveScore(score1, score2, mainUser) {

    makeAuthenticatedRequest(baseUrl + gamePort + "/api/game/local/save-local-score/", {
        method: "POST",
        body: JSON.stringify({
            // 'player1': player1.name,
            'score1': score1,
            // 'player2': player1.name,
            'score2': score2,
            
            'main_user': mainUser, 
        }),
        headers: {"Content-Type": "application/json"},
    })
    .then((response) => {
        if (!response) return null;
        if (response.ok) {
            console.log('Score saved successfully');
        }
    })
    .catch(error => {
        console.error('Catch error saving score: ', error);
    });
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
async function gameLocalLoop() {
    gameLoopId = requestAnimationFrame(gameLocalLoop);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgb(0 0 0 / 75%)";
	ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw players and ball
    player1.draw(ctx);
    player2.draw(ctx);
    ball.draw();

    console.log('In local game loop!');

    // Draw scores
    player1.drawScore(ctx);
    player2.drawScore(ctx);

    // Move players and ball
    player1.move();
    player2.move();
    if (ball.move(player1, player2) && player1.score != maxScore && player2.score != maxScore) {
		cancelAnimationFrame(gameLoopId);
		await readySteadyGo();
		await gameLocalLoop();
	}

    // Endgame check
    if (player1.score >= maxScore || player2.score >= maxScore) {
        const winner = player1.score > player2.score ? `${player1.name} Wins!` : `${player2.name} Wins!`;
        const finalScore = `${player1.score} - ${player2.score}`;
        cancelAnimationFrame(gameLoopId);
        player1.displayEndgameMessage(ctx, finalScore, winner);
        saveScore(player1.score, player2.score, mainUser);
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

function resizeCanvasLocal() {
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

	if (player1)
		player1.resize(newWidth, newHeight);
    if (player2)
		player2.resize(newWidth, newHeight);
	if (ball)
		ball.resize(newWidth, newHeight);

    canvas.width = newWidth;
    canvas.height = newHeight;
}

window.addEventListener("resize", resizeCanvasLocal);

// Start game function
export async function startLocalGame(playerName1, playerName2, mainUserNmb, dictionary) {
    canvas = document.getElementById("newGameCanvas");
    ctx = canvas.getContext("2d");
	dict = dictionary;
	console.log("dictionary: ", dictionary);

    // canvas.width = window.innerWidth * 0.65; // % of screen width
    // canvas.height = canvas.width * 0.57; // % of screen height
    
    mainUser = mainUserNmb;
    
    resizeCanvasLocal();
    // Initialize players and ball
    console.log('Starting local game...');
    console.log(`Canvas: ${canvas.width} x ${canvas.height}`);
    player1 = new Player(canvas, 0, playerName1);
    player2 = new Player(canvas, 1, playerName2);
    ball = new Ball(canvas, ctx, dict);
    
    setupControls(player1, player2);
	await readySteadyGo();
    await gameLocalLoop();
}

export function cleanupLocal() {
    if (!ball) return;
    // console.log("✅ Local game cleaned up!");
    cancelAnimationFrame(gameLoopId);
    player1 = null;
    player2 = null;
    ball = null;
    console.log("✅ Local game cleaned up!");
}
