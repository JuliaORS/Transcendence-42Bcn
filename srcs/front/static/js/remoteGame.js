import { Ball, Player } from "./remoteClasses.js";
import { setupControls } from "./localGame.js"

const endgameMsg = {
	"winner": "Congratuations! You've won!\n",
	"loser": "Better luck next time :')\n",
}

let canvas, ctx = null;

const ballCoef = 0.3;
let ball, targetBallX, targetBallY = null;
let player, opponent = null;

let socket = null;
let gameLoopId = null;
 
console.log("Hi! This is remoteGame.js :D");

function interpolateBall() {
	ball.x += (targetBallX - ball.x) * ballCoef;
	ball.y += (targetBallY - ball.y) * ballCoef;
}

function handleRoleAssignment(role) {
	console.log("Hi! I'm " + role);
	if (role === "player1") {
		player = new Player(canvas, "player1", 0);
		opponent = new Player(canvas, "player2");
	} else if (role === "player2") {
		player = new Player(canvas, "player2");
		opponent = new Player(canvas, "player1", 0);
	}
}

function displayStatus(wait) {
	const message = document.getElementById("gameStatus");
	message.style.display = wait ? "block" : "none";
	message.style.width = `${canvas.width}px`;
	message.style.height = `${canvas.height}px`;
	message.style.left = `${canvas.offsetLeft}px`;
	message.style.top = `${canvas.offsetTop}px`;
}

function handleEndgame(data) {
	const { wait, winnerId, loserRole, scores } = data;
	const finalScore = `${scores.player1} - ${scores.player2}`;

	displayStatus(0);
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	if (loserRole == player.role)
		player.displayEndgameMessage(ctx, finalScore, endgameMsg["loser"]);
	else
		player.displayEndgameMessage(ctx, finalScore, endgameMsg["winner"]);
	cancelAnimationFrame(gameLoopId);
}

//function initializeWebSocket(roomId) {
function initializeWebSocket() {
	//const roomID = new URLSearchParams(window.location.search).get("room") || "default";
	const roomId = 123

	const token = localStorage.getItem("access_token");
	if (!token)
	{
		console.warn("No access token found");
		return ;
	}
	console.log("token is: " + token);
	socket = new WebSocket(`ws://localhost:8001/ws/G/${roomId}/?token=${token}`);

	socket.onopen = () => console.log("WebSocket connection established.");
	socket.onerror = (error) => {
		console.error("WebSocket encountered an error:", error);
		alert("Unable to connect to the server. Please check your connection.");
	};
	socket.onclose = () => {
		console.warn("WebSocket connection closed. Retrying...");
		setTimeout(initializeWebSocket, 1000);
	};

	socket.onmessage = (event) => {
		const data = JSON.parse(event.data);

		switch (data.type) {
			case "status":
				console.log("status msg received! wait = " + data.wait)
				displayStatus(data.wait);
				if (!data.wait)
				{
					//console.log("player: " + player + " p.role: " + player.role);
					setupControls(player, opponent)
					gameLoop();
				}
				break;
			case "role":
				handleRoleAssignment(data.role);
				break;
			case "update":
				if (data.wait)
					return;
				console.log(player.role + " is receiving updates");
				if (data.players)
				{
					if (player.role == "player1")
						opponent.update(data.players.player2.y, data.scores.player2);
					else if (player.role == "player2")
						opponent.update(data.players.player1.y, data.scores.player1);
				}
				if (data.ball) {
					targetBallX = data.ball.x;
					targetBallY = data.ball.y;
				}
				break;
			case "endgame":
				handleEndgame(data);
				break;
			default:
				console.warn("Unhandled message type:", data.type);
		}
	};
}
/*
function ft_switch(data)
{
		switch (data.type) {
			case "status":
				console.log("status msg received! wait = " + data.wait)
				displayStatus(data.wait);
				if (!data.wait)
				{
					//console.log("player: " + player + " p.role: " + player.role);
					setupControls(player, opponent)
					gameLoop();
				}
				break;
			case "role":
				handleRoleAssignment(data.role);
				break;
			case "update":
				if (data.wait)
					return;
				if (data.players)
				{
					if (player.role == "player1")
						opponent.update(data.players.player2.y, data.scores.player2);
					else if (player.role == "player2")
						opponent.update(data.players.player1.y, data.scores.player1);
				}
				if (data.ball) {
					targetBallX = data.ball.x;
					targetBallY = data.ball.y;
				}
				break;
			case "endgame":
				handleEndgame(data);
				break;
			default:
				console.warn("Unhandled message type:", data.type);
		}
	
}*/

function gameLoop() {
	gameLoopId = requestAnimationFrame(gameLoop);
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	player.draw(ctx);
	opponent.draw(ctx);
	player.drawScore(ctx, 1);
	opponent.drawScore(ctx, 2);
	interpolateBall();
	ball.draw(ctx);

	player.move(socket);
	ball.move(player, opponent, gameLoopId, socket);
}


window.addEventListener("resize", () => {
	console.log("player canvas width: " + player.canvas.width);
	console.log("actual canvas width: " + canvas.width);
});

export function startGame()
{
	canvas = document.getElementById('newGameCanvas');
	ctx = canvas.getContext('2d');
	ball = new Ball(canvas);
	targetBallX = ball.x;
	targetBallY = ball.y;
	initializeWebSocket();
}
