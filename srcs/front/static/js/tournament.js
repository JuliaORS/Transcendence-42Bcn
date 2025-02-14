import { loadHomePage } from "./home.js";
import { makeAuthenticatedRequest } from "./login.js";
// import { historyTracker } from "./main.js";

var baseUrl = "http://localhost"; // change (parse) later
let socket = null;

function isOnWaitingRoomPage() {
	return window.location.pathname.includes("waiting-room");
}

function isOnBracketPage() {
	return window.location.pathname.includes("bracket");
}

export const loadTournamentHomePage = () => {
    makeAuthenticatedRequest(baseUrl + ":8001/api/tournament-home-page/", 
        {method: "GET", credentials: "include"})
    .then((response) => response.json())
    .then(data => {
        if (data.tournament_home_page_html) {
            document.getElementById('content-area').innerHTML = data.tournament_home_page_html;
        } else {
            console.error('Tournament home page HTML not found in response:', data);
        }
    })
    .catch(error => {
        console.error('Error loading page', error);
    });
};


export const handleCreateTournament = () => {
    makeAuthenticatedRequest(baseUrl + ":8001/api/tournament-creator/", 
        {method: "GET", credentials: "include"})
    .then((response) => response.json())
    .then(data => {
        if (data.success) {
            navigateTo('/waiting-room', true, data.tournament_id)
        } else {
            console.error('Create tournament page HTML not found in response:', data);
        }
    })
    .catch(error => {
        console.error('Error loading page', error);
    });

};

export const loadJoinTournamentPage = () => {
    makeAuthenticatedRequest(baseUrl + ":8001/api/join-tournament-page/", 
        {method: "GET", credentials: "include"})
    .then((response) => response.json())
    .then(data => {
        if (data.join_tournament_html) {
            document.getElementById('content-area').innerHTML = data.join_tournament_html;
        } else {
            console.error('Join tournament page HTML not found in response:', data);
        }
    })
    .catch(error => {
        console.error('Error loading page', error);
    });
};


export const handleJoinTournament = async () => {
    const tournamentCode = document.getElementById('tournament-code-input').value.trim();

    const response = await makeAuthenticatedRequest(`${baseUrl}:8001/api/get-tournament-id/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournament_code: tournamentCode })
    });

    response.json().then(data => {
        if (data.success && data.tournament_id) {
            navigateTo('/waiting-room', true, data.tournament_id);
        } else {
            alert(data.error || "Failed to join tournament.");
        }
    }).catch(error => {
        console.error('Error joining tournament', error);
        alert("An error occurred. Please try again.");
    });

};

export const loadWaitingRoomPage = (tournamentId) => {
    makeAuthenticatedRequest(`${baseUrl}:8001/api/waiting-room-page/${tournamentId}`, {
        method: "GET",
        credentials: "include"
    })
    .then((response) => response.json())
    .then(data => {
        if (data.waiting_room_html) {
            document.getElementById('content-area').innerHTML = data.waiting_room_html;
            waitingUntilTournamentStarts(data.tournament_id);
        } else {
            console.error('Waiting room page HTML not found in response:', data);
        }
    })
    .catch(error => {
    console.error('Error loading page', error);
    });
}

// const waitingUntilTournamentStarts = (tournamentId) => {
//     const startButton = document.getElementById('start-tournament-button');
//     const homeButton = document.getElementById('home-button');
    
//     // const intervalId = setInterval(() => {
//         makeAuthenticatedRequest(`${baseUrl}:8001/api/get-players-count/${tournamentId}`, 
//             {method: "GET", credentials: "include"})
//         .then(response => response.json())
//         .then(data => {

//             if (data.players_count !== undefined) {
             
//                 const playerCountElement = document.querySelector('.tournament-value.d-inline');
//                 const currentPlayerCount = parseInt(playerCountElement.textContent);

//                 if (data.players_count !== currentPlayerCount) {
//                     playerCountElement.textContent = data.players_count;
//                     //loadWaitingRoomPage(tournamentId);
//                 }

//                 if (data.players_count >= 4) {
//                     clearInterval(intervalId);
//                     loadBracketTournamentPage(tournamentId);
//                 }
//             }
//         })
//         .catch(error => {
//             console.error('Error checking player count', error);
//         });
//     // }, 10000);

//     startButton.addEventListener('click', () => {
//         // clearInterval(intervalId);
//         //navigateTo('/tournament-bracket', true);
//         loadBracketTournamentPage(tournamentId);
//     });

//     homeButton.addEventListener('click', () => {
//         // clearInterval(intervalId);
//         loadHomePage('/home');
//     });

// };

export const loadBracketTournamentPage = () => {
    if (socket.readyState === WebSocket.OPEN)
	{
		const data = {
			"type": "bracket_page_request",
		};
		socket.send(JSON.stringify(data));
	}
};

export const saveTournamentGameResult = (tournamentId, winner, looser) => {
    const button = document.getElementById('play-again');
    if (button) {
        button.textContent = "Back to Tournament Page";
        button.setAttribute("data-route", "/tournament-bracket");
    }

    if (socket.readyState === WebSocket.OPEN)
    {
        const data = {
            "type": "game_result",
            "winner": winner,
            "winner_score": 2, // change
            "looser": looser,
            "looser_score": 0, // change
        };
        socket.send(JSON.stringify(data));
    }
}

function addGameButton(data) {
    // tournament ID needed!! or maybe not..
    console.log('Player needs to play!!');
    const bracketSection = document.getElementById("bracket");
    if (bracketSection) {
        console.log("bracket section here");
    } else {
        console.log("no bracket section...");
    }
    const playButton = document.createElement("button");
    playButton.id = "play-game-in-tournament";
    playButton.textContent = "Play My Game";
    if (data.opponent == "@AI") {
        playButton.setAttribute("data-route", "/play-ai");
        // Pass arguments as a JSON string inside `data-args`
        playButton.setAttribute("data-args", JSON.stringify({ tournament: "true", tournamentId: 1234 }));
    }
    bracketSection.append(playButton);
}

function uploadTournamentPage(data) {
    document.getElementById('content-area').innerHTML = data.html;
    const bracketSection = document.getElementById("bracket");
    if (bracketSection) {
        console.log("bracket section here");
    } else {
        console.log("no bracket section...");
    }
    if (data.redirect) {
        // window.location.href = data.redirect; // Change the URL/route
        // history.pushState({}, '', data.redirect);
        // navigateTo(data.redirect);
        let path = data.redirect;
        history.pushState({ path }, null, path);
        // historyTracker.push({ action: 'pushState', path });
    }
    if (data.needs_to_play) {
        addGameButton(data);
    }
}

function updatePlayerCount(data) {
    if (isOnWaitingRoomPage()) {
        document.getElementById('cur-player-cnt').textContent = data.player_cnt;
        // let prev_player_cnt = document.getElementById('cur-player-cnt');
        // if (prev_player_cnt) {
        //     prev_player_cnt.textContent = data.player_cnt;
        // }
    }
}

function tournamentConnect(tourId) {
	const token = localStorage.getItem("access_token");
	if (!token)
	{
		console.warn("No access token found");
		return ;
	}
	console.log("token is: " + token);
    console.log("id is: " + tourId);
	socket = new WebSocket(`ws://localhost:8001/ws/T/${tourId}/?token=${token}`);

	socket.onopen = () => console.log("WebSocket connection established")
	socket.onerror = (error) => {
		console.error("WebSocket encountered an error: ", error);
		alert("Unable to connect to the server. Please check your connection.");
	};
	socket.onclose = () => {
		console.warn("WebSocket connection close. Retrying...");
		setTimeout(tournamentConnect, 1000) //waits 1s and tries to reconnect
	};

	socket.onmessage = (event) => { //we're receiving messages from the backend via WB
		const data = JSON.parse(event.data);

		console.log(data);
		switch(data.type)
		{
			case "totalPlayers":
				console.log("current number of players in the tournament: " + data.total);
                break;
			case "html":
				uploadTournamentPage(data);
                break;
            case "new_player_cnt":
                updatePlayerCount(data);
                break;
            default:
                console.warn("Unhandled message type: ", data.type);
		}
	}
}
