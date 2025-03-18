import { makeAuthenticatedRequest } from "./login.js";
import { navigateTo, drawHeader } from "./main.js";
import { clearIntervalIDGame, removeBeforeUnloadListenerAI } from "./AIGame.js"
import { gameAI, playOnline, getDictFor3DGame, getOrInitialize3DOption } from "./game.js";
import { scaleGame, setWhoAmI, handleStatus, handleUpdate, handleEndgame, cleanRemote, removeBeforeUnloadListenerRemote } from "./remoteGame.js"
import { scale3DGame, setWhoAmI3D, handle3DStatus, handle3DUpdate, handleOnlineEndgame} from "./3DGame.js"
import { checkToken } from "./onlineStatus.js";
import { getCookie, getFrontDict } from "./langs.js";
import { showModalError } from "./errorHandler.js";

const host = window.env.HOST;
const protocolWeb = window.env.PROTOCOL_WEB
const baseUrl = protocolWeb + "://" + host + ":";  
const protocolSocket = window.env.PROTOCOL_SOCKET;
const gamePort = window.env.GAME_PORT;

let socket = null, dict = null, tourId = null;

// Define your 2D handlers

const handlers2D = {
    role: (data) => scaleGame(data),          // synchronous
    players: (data, socket) => setWhoAmI(data, socket),       // might be asynchronous
    status: (data, socket) => handleStatus(data, socket),      // might be asynchronous
    update: (data) => handleUpdate(data),      // synchronous
    endgame: (data) => handleEndgame(data) // synchronous
};

// Define your 3D handlers
const handlers3D = {
    role: (data) => scale3DGame(data),          // asynchronous
    players: (data, socket) => setWhoAmI3D(data, socket),      // asynchronous
    status: (data, socket) => handle3DStatus(data, socket),    // asynchronous
    update: (data) => handle3DUpdate(data),    // synchronous or asynchronous
    endgame: (data) => handleOnlineEndgame(data) // synchronous or asynchronous
};

const handlersTour = {
    totalPlayers: totalPlayers,
    html: uploadTournamentPage, 
    new_player_cnt: updatePlayerCount,
    game_update: gameUpdate,
    full: tourFull,
    needs_to_play: (data) => needsPlay(data),
    tournament_status: (data) => tourStatus(data),
    quitted: (data) => quitted(data),
}

const wrapHandlers = (handlers) => {
    const wrapped = {};
    Object.keys(handlers).forEach((key) => {
      wrapped[key] = (...args) => Promise.resolve(handlers[key](...args));
    });
    return wrapped;
  };

const asyncHandlers2D = wrapHandlers(handlers2D);
const asyncHandlers3D = wrapHandlers(handlers3D);
const asyncHandlersTour = wrapHandlers(handlersTour);

const getCombinedHandlers = (is3DEnabled) => {

    const modeHandlers = is3DEnabled ? asyncHandlers3D : asyncHandlers2D;
    return { ...modeHandlers, ...asyncHandlersTour };
};

let currentHandlers = getCombinedHandlers(getOrInitialize3DOption() === "true");

export const updateHandlers = (is3DEnabled) => {
    currentHandlers = getCombinedHandlers(is3DEnabled);
    // console.log("Handlers updated. 3D mode:", is3DEnabled);
};

export const manageTournamentHomeBtn = () => { 
    const inTournament = localStorage.getItem('inTournament');
    if (!socket || !inTournament) {
        if (socket) {
            // console.log("socket there is..");
            if (socket.readyState === WebSocket.OPEN)
            {
                socket.send(JSON.stringify({ "type": "get_status" }));
            }        
        } else {
            // console.log("socket is not here..");
            navigateTo('/tournament-home', true);
        }  
        return;      
    }
    
    if (inTournament === 'waiting') {
        navigateTo('/waiting-room', true);
    } else if (inTournament === 'playing') {
        navigateTo('/tournament-bracket', true);
    } else if (inTournament === 'finished') {
        navigateTo('/end-tournament', true);
    } else {
        navigateTo('/tournament-home', true);
    }
};

export const loadTournamentHomePage = () => {
    if (socket) {
        navigateTo('/tournament');
        return;
    }
    drawHeader('main').then(() => {
      return  makeAuthenticatedRequest(baseUrl + gamePort + "/api/tournament-home-page/", 
            {method: "GET", credentials: "include"})
        .then(response => response ? response.json() : null)
        .then(data => {
            if (data && data.tournament_home_page_html) {
                document.getElementById('content-area').innerHTML = data.tournament_home_page_html;
            } else {
                console.log('Tournament home page HTML not found in response:', data);
            }
        })
        .catch(error => {
            console.log('Error loading page', error);
        });
    })     
};

export const createTournament = async () => {
    const nPlayers = getNumberOfPlayers();
    tourId = await getTournamentId(); 
    if (tourId > 0) {
        tournamentConnect(tourId, nPlayers)
            .then(() => console.log("Successfully connected!"))
            .catch(() => console.log("Can't connect to tournament."));
    }
};

export const joinTournament = () => {
    if (!document.getElementById('tournament-id-input')) {
        navigateTo('/tournament-home', true);
        return;
    }
    tourId = document.getElementById('tournament-id-input').value.trim();
    // console.log("TOOOOOUR ID: ", tourId);
    if (! /^\d{7}$/.test(tourId)) {
        showModalError("WRONG_TOURNAMENT_ID")
        navigateTo('/tournament-home', true);
        return;
    }
    tournamentConnect(tourId)
        .then(() => console.log("Successfully connected!"))
        .catch(() => console.log("Can't connect to tournament."));
};

function isOnWaitingRoomPage() {
	return window.location.pathname.includes("waiting-room");
}

function isOnBracketPage() {
	return window.location.pathname.includes("bracket");
}

function isOnTournamentHomePage() {
	return (window.location.pathname.includes("tournament-home") || window.location.pathname.includes("join-tournament") || window.location.pathname.includes("create-tournament"));
}


export const loadWaitingRoomPage = () => {
    if (!socket) {
        // console.log("socket is not here..");
        navigateTo('/tournament-home', true);
        return;
    }
    if (socket.readyState === WebSocket.OPEN)
	{
		let lang = getCookie("language");
        const data = {
			"type": "waiting_room_page_request",
            "lang": lang,
		};
		socket.send(JSON.stringify(data));
	}
};

export const loadBracketTournamentPage = () => {
    if (!socket) {
        // console.log("socket is not here..");
        navigateTo('/tournament-home', true);
        return;
    }
    if (socket.readyState === WebSocket.OPEN)
	{
        let lang = getCookie("language");
        const data = {
			"type": "bracket_page_request",
            "lang": lang,
		};
		socket.send(JSON.stringify(data));
        // console.log("we have sent the request for bracket page!")
	}
    else {
        console.log(socket.readyState);
    }
};

export const loadFinalTournamentPage = () => {
    if (!socket) {
        // console.log("socket is not here..");
        navigateTo('/tournament-home', true);
        return;
    }
    if (socket.readyState === WebSocket.OPEN)
	{
        let lang = getCookie("language");
        const data = {
			"type": "final_page_request",
            "lang": lang,
		};
		socket.send(JSON.stringify(data));
	}
};

export const quitTournament = () => {
    clearIntervalIDGame();
    removeBeforeUnloadListenerAI();
    removeBeforeUnloadListenerRemote();
    // console.log("QUIT button clicked")
    if (!socket) {
        // console.log("No socket")
        navigateTo('/home', true);
        return;
    }
    localStorage.setItem("user_quit", "true");
    if (socket.readyState === WebSocket.OPEN)
        {
            const data = {
                "type": "quit",
            };
            socket.send(JSON.stringify(data));
        }
}

export const saveTournamentGameResult = (winner, loser, playerScore, AIScore) => {
    const button = document.getElementById('play-again');
    if (button) {
        button.textContent = dict['back_tour'] || "Back to Tournament Page";
        button.setAttribute("data-route", "/tournament-bracket");
    }
    removeBeforeUnloadListenerAI();
    removeBeforeUnloadListenerRemote();
    console.log("Sending request to save the game result..");

    if (socket.readyState === WebSocket.OPEN)
    {
        let lang = getCookie("language");
        const data = {
            "type": "game_result",
            "winner": winner,
            "winner_score": playerScore > AIScore ? playerScore : AIScore,
            "loser": loser,
            "loser_score": playerScore > AIScore ? AIScore : playerScore,
            "lang": lang,
        };
        socket.send(JSON.stringify(data));
    }
}

export const tournamentGameRequest = () => {
    clearIntervalIDGame();
    if (socket && socket.readyState === WebSocket.OPEN)
    {
        socket.send(JSON.stringify({ "type": "wants_to_play" }));
    } else {
        navigateTo('/tournament', true);
    }
}

export const tournamentGameAIstart = (data, tourId) => {
    if (data.needs_to_play) {
        let args = {
            tournament: true,
            tournamentId: tourId,
        }
        gameAI(args);                    
    } else {
        navigateTo('/tournament', true);
    }
}

function addGameButton(data) {
    // tournament ID needed!! or maybe not..
    // console.log('Player needs to play!!');
    const bracketSection = document.getElementById("bracket");
    // if (bracketSection) {
    //     console.log("bracket section here");
    // } else {
    //     console.log("no bracket section...");
    // }
    const playButton = document.createElement("button");
    playButton.id = "play-game-in-tournament";
    playButton.classList.add("button-trn");
    playButton.style.marginTop = "10%";
    playButton.style.width = "40%";
    
    const span = document.createElement("span");
    span.classList.add("button-content-trn");
    // const dictionary = getDictFor3DGame();
    // span.textContent = "Play my game";
    const lang = getCookie("language");
    span.textContent = getFrontDict(lang || "EN", 'PLAY_MY_GAME') || "Play my game";

    playButton.appendChild(span);

    // Seleccionar el contenedor donde está el botón existente
    const existingButtonContainer = document.querySelector(".row.justify-content-center.mt-4 .col-12");

    // Crear un nuevo contenedor para colocar los botones en línea
    const buttonWrapper = document.createElement("div");
    buttonWrapper.classList.add("d-flex", "justify-content-between", "gap-3"); // Flexbox para alinearlos

    // Mover el botón existente dentro del nuevo contenedor
    const existingButton = existingButtonContainer.querySelector("button");
    buttonWrapper.appendChild(existingButton);

    // Agregar el nuevo botón
    buttonWrapper.appendChild(playButton);

    // Reemplazar el contenido del contenedor con el nuevo diseño
    existingButtonContainer.appendChild(buttonWrapper);
    
    if (data.opponent == "@AI") {
        playButton.setAttribute("data-route", '/tournament-game-ai');
        // Pass arguments as a JSON string inside `data-args`
        // playButton.setAttribute("data-args", JSON.stringify({ tournament: "true", tournamentId: 1234 }));
    }
	else {
        playButton.setAttribute("data-route", '/tournament-game-remote');
	}
    playButton.addEventListener('click', () => {
        if (socket && socket.readyState === WebSocket.OPEN)
        {
			//CHANGED BY diana
            socket.send(JSON.stringify({ "type": "game_started" }));
            // socket.send(JSON.stringify({ "type": "start_game" }));
        }
    });
    //bracketSection.append(playButton);
}

function changePage(data) {
    drawHeader('main');
    document.getElementById('content-area').innerHTML = data.html;
    if (data.redirect) {
        let path = data.redirect;
        // history.pushState({ path }, null, path);
        history.replaceState({ path }, null, path);
    }
    if (data.needs_to_play) {
        addGameButton(data);
    }
}

function uploadTournamentPage(data) {
    // console.log("CUR PATHNAME: ", window.location.pathname);
    if (data.redirect == "/tournament-bracket") {
        if (isOnWaitingRoomPage() || isOnBracketPage() || isOnTournamentHomePage()) {
            changePage(data);
        }
    } else if (data.redirect == "/end-tournament") {
        if (isOnBracketPage()) {
            changePage(data);
        }
    }
    if (data.request) {
        // console.log("IT WAS A REQUEST");
        changePage(data);
    }

    // document.getElementById('content-area').innerHTML = data.html;
    const bracketSection = document.getElementById("bracket");
    // if (bracketSection) {
    //     console.log("bracket section here");
    // } else {
    //     console.log("no bracket section...");
    // }

    // if (data.needs_to_play) {
    //     addGameButton(data);
    // }
    setTournamentStatus(data.status)
    
    if (data.status === 'finish') {
        console.log("tournament is finished");
    }
}

function updatePlayerCount(data) {
    if (isOnWaitingRoomPage()) {
        if (document.getElementById('cur-player-cnt'))
            document.getElementById('cur-player-cnt').textContent = data.player_cnt;
    }
}

export async function tournamentConnect(tourID, nPlayers=null) {
    dict = await getDictFor3DGame();
    return new Promise( async (resolve, reject) => {
        const access_token = localStorage.getItem("access_token");
        const token = await checkToken(access_token);
        // console.log(token);

        if (!token)
        {
            console.log("Tournament No access token found");
            reject("No access token found");
            return ;
        }
        // console.log("tournamentConnect token: " + token);
        tourId = tourID;
        localStorage.setItem("currentTournamentId", tourId);
        // console.log(" Tour id is: " + tourId + " // Num players: " + nPlayers);

        currentHandlers = getCombinedHandlers(getOrInitialize3DOption() === "true");

        if (nPlayers) {
            socket = new WebSocket(`${protocolSocket}://${host}:${gamePort}/${protocolSocket}/T/${tourId}/?nPlayers=${nPlayers}&token=${token}`);
        } else {
            socket = new WebSocket(`${protocolSocket}://${host}:${gamePort}/${protocolSocket}/T/${tourId}/?token=${token}`);
        }
        
        socket.onopen = () => {
            console.log("WebSocket connection established");
            let status = localStorage.getItem('inTournament');
            if (!status)
                localStorage.setItem('inTournament', 'waiting');
            window.addEventListener("beforeunload", () => {
                if (socket && socket.readyState === WebSocket.OPEN) {
                    localStorage.setItem("currentTournamentId", tourId);
                    localStorage.setItem("tournamentReload", true);
                }
            });
            resolve(socket); // Resolve the promise once the socket is open
        };
        
        socket.onerror = (error) => {
            console.log("WebSocket encountered an error: ", error)
            localStorage.removeItem('inTournament');
            localStorage.removeItem("user_quit");
            localStorage.removeItem("currentTournamentId");
            localStorage.removeItem("gameState");
            removeBeforeUnloadListenerAI();
            removeBeforeUnloadListenerRemote();
            navigateTo('/home', true);
            reject("WebSocket error");
        };

        socket.onclose = () => {
            socket = null;
            cleanRemote();
            removeBeforeUnloadListenerAI();
            removeBeforeUnloadListenerRemote();
            if (localStorage.getItem("user_quit") == "true") {
                // console.log("User quit. No reconnection.");
                localStorage.removeItem('inTournament');
                localStorage.removeItem("user_quit");
                localStorage.removeItem("currentTournamentId");
                localStorage.removeItem("gameState");
                navigateTo('/home', true);
            } else if (localStorage.getItem("tournamentReload")) {
                console.log("Closing websocket.");
            } else {
                // console.log("Closing websocket onclose");
                localStorage.removeItem('inTournament');
                localStorage.removeItem("currentTournamentId");
                localStorage.removeItem("gameState");
            }
        };

        socket.onmessage = async (event) => { //we're receiving messages from the backend via WB
            const data = JSON.parse(event.data);
            localStorage.setItem("currentTournamentId", tourId);
            // console.log(`SDFGHJKLSDFGHJKL: ${getOrInitialize3DOption()}`)
            currentHandlers = getCombinedHandlers(getOrInitialize3DOption() === "true");
            // dict = await getDictFor3DGame();

            const handler = currentHandlers[data.type];
            // console.log(data.type);
            if (handler) {
                await handler(data, socket);
            } else {
                console.log("Unhandled message type:", data.type);
            }
        };
});
}

export function startTournamentGame() {
	socket.send(JSON.stringify({"type": "start_game"}));
}

export function stopTournamentGame() {
    removeBeforeUnloadListenerRemote();
    if (socket)
        socket.send(JSON.stringify({"type": "stop_game"}));
}

////////////////// UTILS //////////////////////

async function getTournamentId() {
    let id = Math.floor(1000000 + Math.random() * 9000000); // Ensures a 7-digit number
    // let id = 1234567
    try {
        const response = await makeAuthenticatedRequest(baseUrl + gamePort + `/api/check-tournament/${id}/`, 
            { method: "GET", credentials: "include" });
        if (!response) return -1;
        const data = await response.json();
        
        console.log("ACTIVE?");
        console.log(data.active);

        if (!data.active) {
            return id;  // If not active, return the id
        } else {
            showModalError("ERROR");
            return -1;  // If the ID is active, return -1
        }
    } catch (error) {
        console.log('Failed to fetch tournament status:', error);
        return -1;  // Return -1 in case of an error
    }
}

function getNumberOfPlayers() {
    if (! document.getElementById('create-tournament-form')) {
        navigateTo('/tournament-home', true);
        return;
    }
//     const nPlayers = document.getElementById('tournament-count').value;
    const nPlayers = document.querySelector('input[name="btn"]:checked').value;
    const validPlayers = ["3", "4", "7", "8", "1", "2"];
    
    if (!validPlayers.includes(nPlayers)) {
        return null;
    }
    return nPlayers;
}

function setTournamentStatus(status) {
    if (status) {
        localStorage.setItem('inTournament', status);
    }
}

export function disconnectTournamentWS() {
    if (socket) {
        localStorage.setItem("user_quit", "true");
        if (socket.readyState === WebSocket.OPEN)
            {
                const data = {
                    "type": "quit",
                };
                socket.send(JSON.stringify(data));
            }
    }
}

// export function changePathFromGameCheck(prevPath, curPath) {
//     // '/tournament-game-ai': tournamentGameRequest,
//     // '/tournament-game-remote': tournamentGameRequest,
//     const pathAi = '/tournament-game-ai';
//     const pathRemote = '/tournament-game-remote';
//     let pathChange = true;
//     if (prevPath == pathAi && curPath == pathAi) {
//         pathChange = false;
//     } else if (prevPath == pathRemote && curPath == pathRemote) {
//         pathChange = false;
//     }
//     if (pathChange && prevPath == pathAi) {
//         console.log("CHANGING PATH from ai game");
//     } else if (pathChange && prevPath == pathRemote) {
//         console.log("CHANGING PATH from remote game");
//     }
// }

/*
back/forward , path change , reload ---> you lose
back/forward DONE (with popstate)
but
path change , reload ---> main.js from start, all vars in games are cleared
path change is the same as reload
event listener before onload -> game end
*/

function totalPlayers() {
    console.log("current number of players in the tournament: " + data.total);
}

function gameUpdate() {
    alert("GAME_UPDATE??  A player has disconnected. Waiting for reconnection...");
}

function tourFull() {
    console.log("Tournament is full");
    showModalError("FULL_TOURNAMENT")
    localStorage.removeItem('inTournament');
    localStorage.removeItem("user_quit");
    localStorage.removeItem("currentTournamentId");
    socket.close();
    navigateTo('/tournament-home', true);
}

function needsPlay(data) {
    if (!data.needs_to_play)
        navigateTo('/tournament', true);
    else if (data.opponent == "@AI") {
        tournamentGameAIstart(data, tourId);
    } else {
        playOnline(tourId);
    }
}

function tourStatus(data) {
    localStorage.setItem('inTournament', data.status);
    navigateTo('/tournament');
}

function quitted(data) {
    quitTournament();
}
