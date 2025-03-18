import { Ball, Player } from "./remoteClasses.js";
import { setupControls } from "./localGame.js";
import { setupControlsAI } from "./AIGame.js"
import { refreshAccessToken } from "./login.js";
import { startTournamentGame, stopTournamentGame, saveTournamentGameResult } from "./tournament.js";
import { makeAuthenticatedRequest } from "./login.js"
import { navigateTo } from "./main.js";
import { checkToken } from "./onlineStatus.js";
import { showModalError } from "./errorHandler.js";

const gamePort = window.env.GAME_PORT;
const host = window.env.HOST;
const protocolSocket = window.env.PROTOCOL_SOCKET;
const protocolWeb = window.env.PROTOCOL_WEB
const baseUrl = protocolWeb + "://" + host + ":";

// const endgameMsg = {
// 	"winner": "Congratuations! You've won!\n",
// 	"loser": "Better luck next time :')\n"
// };

let canvas, ctx = null;

let ball, targetBallX, targetBallY = null;
let player, opponent = null, dict = null;

let socket = null;
let gameLoopId = null;
let gameStop = false;
let tourId = null;
let countdownTimeout = null;

 
// console.log("Hi! This is remoteGame.js :D");

export function handleRoleAssignment(data) {
	if (data.role === "player1") {
		// console.log("Hi! I'm " + data.role + " and I'm a player");
		player = new Player(data, canvas, "player1");
		opponent = new Player(data, canvas, "player2");
	}
	else {
		// console.log("Hi! I'm " + data.role + " and I'm a player");
		player = new Player(data, canvas, "player2");
		opponent = new Player(data, canvas, "player1");
	}

}

export function scaleGame(data)
{
	// console.log("2222222D sCALE GAME")
	handleRoleAssignment(data)
	ball.setVars(data);
}

async function firstCountdown(callback) {
    let countdown = 2;
    const msg = ["1", "2", "3"];
    let div = document.getElementById("wait");
    const interval = setInterval(() => {
        if (countdown < 0) {
            clearInterval(interval);
            div.textContent = "";
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // console.log("RESUME")
            // handleOnlineEndgame();
            callback(); // Resume the game
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            div.textContent = msg[countdown];
            div.style.fontSize = Math.floor(canvas.width * 0.25) + "px";
            ctx.fillStyle = "rgb(0 0 0 / 25%)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            div.style.display = "block";
        }
        countdown--;
    }, 500);
}



async function readySteadyGo(countdown)
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
		if (countdown >= 0)
			countdownTimeout = setTimeout(() => readySteadyGo(--countdown), 500);

		else
			div.style.display = "none";
	}
}

function displayCountdown()
{
	// console.log("entering displayCountdown");
	if (!ctx)
		return ;
	let div = document.getElementById("wait");

	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.fillStyle = "rgb(0 0 0 / 25%)"; //rectangle style
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	div.textContent = dict['waiting_enemy'];

	div.style.fontSize = Math.floor(canvas.width * 0.05) + "px";
	div.style.display = 'block';
}


export function handleEndgame(data) { 
	if (socket && socket.readyState === WebSocket.OPEN && !tourId) {
		socket.close();
	}
	let ifTour = tourId;
	tourId = null;
	socket = null;
	const { winner, loser, scores} = data;
//	let div = document.getElementById("wait");
	// console.log(`winner ${winner} loser ${loser}`);
	// console.log(`I am: ${player.whoAmI}`);

	//div.style.display = 'none';
	// console.log(`winner ${winner} loser ${loser}`);

	if (gameLoopId)
		cancelAnimationFrame(gameLoopId);
	clearTimeout(countdownTimeout); // Clear the timeout
    let div = document.getElementById("wait");
    if (div) div.style.display = "none";
	player.score = data["scores"][player.role];
	opponent.score = data["scores"][opponent.role];
	// console.log(`player's score: ${player.score}\nopponent's score ${opponent.score}`);
	if (player.whoAmI == loser)
		player.displayEndgameMessage(ctx, opponent.score, dict['good_luck']);
	else
		player.displayEndgameMessage(ctx, opponent.score, dict['congrats']);
	if (ifTour)
		saveTournamentGameResult(data["winner"], data["loser"], data["scores"]["player1"], data["scores"]["player2"]);

}

export function handleTourEndgame(data) {
	const { wait, winnerID, loserID } = data;
	
	// console.log(player.whoAmI);
	// console.log(player.role);
	// console.log(loserID);
	// console.log(winnerID);
	if (player.whoAmI == winnerID)
		player.scores++;
	else
		opponent.scores++;
	if (loserID == player.whoAmI)
		player.displayEndgameMessage(ctx, opponent.score, endgameMsg["loser"]);
	else
		player.displayEndgameMessage(ctx, opponent.score, endgameMsg["winner"]);
	cancelAnimationFrame(gameLoopId);
	gameLoopId = null
}

function getTimestamp() {
	const date = new Date();

	return `${date.getDate()}-${date.getMonth() + 1} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`
}

export async function setWhoAmI(data, socket)
{
	player.whoAmI = data[player.role];
	opponent.whoAmI = data[opponent.role];
	socket.send(JSON.stringify({"type": "ready"}))
}

export async function handleStatus(data, tourSocket = null)
{
	if (tourSocket) {
		socket = tourSocket;
	}
	if (data.wait) // data.wait [bool]
	{
		if (gameLoopId)
			cancelAnimationFrame(gameLoopId);
		if (data.countdown == 0)
			displayCountdown();
		else
		{
			// await firstCountdown(() => {});
			await readySteadyGo(data.countdown - 1);
			player.update(data.players, data.scores);
			opponent.update(data.players, data.scores);
			ball.resetPosition();
		}
	}
	else
	{
		window.addEventListener("beforeunload", beforeUnloadHandlerRemote);
		setupControlsAI(player)
		gameLoop();
	}
}

export function handleUpdate(data)
{
	if (data.players)
	{
		player.update(data.players, data.scores);
		opponent.update(data.players, data.scores);
	}
	if (data.ball) {
		ball.x = data.ball.x * canvas.width;
		ball.y = data.ball.y * canvas.height;
	}
	if (gameStop) {
		stopTournamentGame();
	}
}

export async function createRoomId()
{
	let id = Math.floor(1000000 + Math.random() * 9000000) // Ensures a 7-digit number
	try {
		while (1)
		{
			let response = await makeAuthenticatedRequest(baseUrl + gamePort + `/api/check-remote/${id}`,
							{ method: "GET", credentials: "include" });
			let data = await response.json();
			// console.log("createRoomId: data: " + JSON.stringify(data));
			if (!data.active)
				return id;
		}
	}
	catch (error)
	{
		// console.log("Failed to fetch game status: ", error);
		return -1;
	}
}

async function initializeWebSocket(roomId, isCreator) {
	let retries = 0;

	const access_token = localStorage.getItem("access_token");
	const token = await checkToken(access_token);
    if (!token) {
        // console.log("Remote Game No access token found");
        return ;
    }
	//// CHECK ALL
	// console.log(`initWS roomID: ${roomId}`);
	if (!socket && roomId != -1)
	{
		// console.log("ROOM ID pre initWS: " + roomId);
		roomId = (isCreator | 0) + roomId.toString();
		// console.log("ROOM ID post initWS: " + roomId);
		socket = new WebSocket(`${protocolSocket}://${host}:${gamePort}/${protocolSocket}/G/${roomId}/?token=${token}`);
		// console.log("Socket created!");
	}
	socket.onopen = () => {}
		// console.log("WebSocket connection established.");
	socket.onerror = (error) => {
		// console.log("WebSocket encountered an error:", error);
	};
	socket.onclose = async (event) => {
		// console.log("WebSocket connection closing");
		if (event.code === 4242) {
			// Token expired; refresh token logic
			try {
				await refreshAccessToken();
			  // Reconnect with the new token
				initializeWebSocket();
			} catch (err) {
				// console.log("Failed to refresh token", err);
				cleanRemote();
				return ;
			}
		}
	};

	socket.onmessage = async (event) => {
		const data = JSON.parse(event.data);

		// console.log(`data type is: ${data.type}`);
		switch (data.type) {
			case "role":
				scaleGame(data);
				break;
			case "players":
				await setWhoAmI(data, socket);
				break;
			case "status":
				//console.log(`player1: ${data.players.player1.id} scores: ${data.scores.player1}`);
				await handleStatus(data);
				break;
			case "update":
				handleUpdate(data);
				break ;
			case "reject":
				socket.close();
				showModalError(data.reason);
				navigateTo("/remote-home");
				return ;
			case "endgame":
				// console.log("This game's over!");
				handleEndgame(data);
				break ;
			default:
				console.log("Unhandled message type:", data.type);
		}
	};
}



function gameLoop() {
	gameLoopId = requestAnimationFrame(gameLoop);
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.fillStyle = "rgb(0 0 0 / 75%)";
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	player.move(socket);
	player.draw(ctx);
	opponent.draw(ctx);
	player.drawScore(ctx);
	opponent.drawScore(ctx);
	ball.draw(ctx);

	if (gameStop) {
		stopTournamentGame();
	}
}

function resizeCanvasRemote() {
	if (!canvas)
		return ;

    canvas = document.getElementById("newGameCanvas");
    const container = document.getElementById("newGameBoard");
	if (!canvas || !container)
		return ;

    let maxWidth = container.clientWidth;
    let maxHeight = container.clientHeight;

    let newWidth = maxWidth;
    let newHeight = (4 / 6) * newWidth;

	//Apply aspect ratio
    if (newHeight > maxHeight) {
        newHeight = maxHeight;
        newWidth = (6 / 4) * newHeight;
	}

    newWidth = Math.floor(newWidth);
    newHeight = Math.floor(newHeight);

    canvas.style.width = `${newWidth}px`;
    canvas.style.height = `${newHeight}px`;
	ctx = canvas.getContext('2d');
	if (player)
		player.resize(newWidth, newHeight);
	if (opponent)
		opponent.resize(newWidth, newHeight);
	if (ball)
		ball.resize(newWidth, newHeight);
    canvas.width = newWidth;
    canvas.height = newHeight;
}

// Resize canvas when the window resizes
window.addEventListener("resize", resizeCanvasRemote);

export function startGame(roomId, isCreator, dictionary, tour = null)
{
	canvas = document.getElementById('newGameCanvas');
	

	tourId = tour;
	// console.log("tour is : ", tour);
	dict = dictionary;
  if (!roomId && !tour)
	{
		navigateTo("/remote-home");
		return ;
	}
	if (!canvas)
		return ;
	ball = new Ball(canvas);
	resizeCanvasRemote();
	targetBallX = ball.x;
	targetBallY = ball.y;
	gameStop = false;
	if (!tourId)
		initializeWebSocket(roomId, isCreator);
	else {
		// console.log("it is a tour game");
		startTournamentGame();
		const button = document.getElementById('play-again');
        if (button) {
            button.textContent = dictionary['quit_tournament'] || "Quit Tournament";
            button.setAttribute("data-route", "/quit-tournament");
            button.setAttribute("replace-url", true);
        }
	}
}

export function cleanRemote() {

	if (gameLoopId)
		cancelAnimationFrame(gameLoopId);
	// console.log("CLEAN REMOTE tourId::: ", tourId);
	if (socket && socket.readyState === WebSocket.OPEN && !tourId) {
        socket.close();
//         socket = null;
    }
	gameLoopId = null;

	socket = null;

	if (tourId) {
		gameStop = true;
		// tourId = null;
	}

}

const beforeUnloadHandlerRemote = () => {
    if (tourId) {
		stopTournamentGame();
	}
};

export const removeBeforeUnloadListenerRemote = () => {
    window.removeEventListener("beforeunload", beforeUnloadHandlerRemote);
};
