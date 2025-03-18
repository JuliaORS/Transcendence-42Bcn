import { makeAuthenticatedRequest } from "./login.js";
import { drawHeader } from "./main.js";
import { getDictFor3DGame } from "./game.js";

const host = window.env.HOST;
const protocolWeb = window.env.PROTOCOL_WEB
const baseUrl = protocolWeb + "://" + host + ":";  
const userMgmtPort = window.env.USER_MGMT_PORT;

export const displayUpdatingMessage = (message, color) => {
    const profileSettingsContainer = document.getElementById('profile-settings-form');
    if (!profileSettingsContainer)
        return;

    const existingError = document.getElementById('settings-update-error');
    if (existingError)
        existingError.remove();

    const errorMessage = document.createElement('div');
    errorMessage.id = 'settings-update-error';
    errorMessage.style.color = color;
    errorMessage.style.marginBottom = '15px';
    errorMessage.textContent = message;

    profileSettingsContainer.prepend(errorMessage); //adding at the top of the login container
};

const fetchLastTenGames = () => {
    return makeAuthenticatedRequest(baseUrl + userMgmtPort + "/api/last-ten-games/", {
        method: "GET",
    }).then(response => response ? response.json() : null);
}

const fillLastTenGamesChart = (gamesData, username, dictionary) => {

    const scoreStr = dictionary['score_wo'] || "Score";
    const opponentStr = dictionary['opponent'] || "Opponent";
    const winnerStr = dictionary['winner_wo'] || "Winner";
    const tournamentStr = dictionary['tournament'] || "Tournament";
    const gameStr = dictionary['game_wo'] || "Game";

    const ctx = document.getElementById('last-ten-games-chart').getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(187, 134, 252, 1)');
    gradient.addColorStop(1, 'rgba(187, 134, 252, 0.5)');
    
    const gameCnt = parseInt(document.getElementById('games-played').textContent, 10);
    const labels = gamesData.map((_, index) => {
        return `${gameStr} ${gameCnt - (gamesData.length - 1 - index)}`;
    });
    
    const scores = gamesData.map((game) => {
        if (game.player1 === username) {
            return game.score_player1;
        } else if (game.player2 === username) {
            return game.score_player2;
        }
        return 0;
    });

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: scoreStr,
                data: scores,
                backgroundColor: gradient,
                borderColor: "rgba(152, 40, 237, 0.5)",
                borderWidth: 1,
                borderRadius: 5, // Redondea las esquinas de las barras
            }]
        },
        options: {
            responsive: true,
            layout: {
                padding: {
                  top: 20,
                  right: 10,
                  bottom: 10,
                  left: 10 
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            },
            plugins: {
                title: {
                    display: true,
                    text: dictionary['game_evolution'],
                    font: { size: 18 },
                    padding: {
                      top: 10,
                      bottom: 10
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (tooltipItem) => {
                            const game = gamesData[tooltipItem.dataIndex];
                            const opponent = 
                                game.player1 === username
                                    ? game.player2
                                    : game.player1;
                            const score = 
                                game.player1 === username
                                    ? game.score_player1
                                    : game.score_player2;
                            const winner = game.winner;
                            const tournament =
                                game.tournament_id >= 0
                                    ? 'yes'
                                    : 'no';
                            return `${scoreStr}: ${score}; ${opponentStr}: ${opponent}; ${winnerStr}: ${winner}; ${tournamentStr}: ${tournament}`;
                        },
                    },
                    displayColors: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    titleColor: 'white',
                    bodyColor: 'white',
                    bodyFont: { size: 14 },
                    titleFont: { size: 16 },
                },
                title: {
                    display: true,
                    text: dictionary['last_10_games_performance'],
                    font: {
                        size: 18,
                    },
                },
                legend: {
                    display: false,
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: scoreStr,
                    },
                    grid: {
                        color: 'rgba(200,200,200,0.2)',
                    },
                    ticks: {
                        color: 'white',
                    }
                },
                x: {
                    grid: {
                        display: false,
                    },
                    ticks: {
                        color: 'white',
                    }
                }
            },
        },
    });
}

export const loadMatchHistoryPage = () => {
    drawHeader('main').then(() => {
       return makeAuthenticatedRequest(baseUrl + userMgmtPort + "/api/match-history-page/", {method: "GET"})
            .then(response => response ? response.json() : null)
            .then(data => {
                if (data && data.match_history_html) {
                    document.getElementById('content-area').innerHTML = data.match_history_html;
                } else {
                    // console.log('Error fetching settings:', data.error);
                }
            })
            .catch(error => {
                // console.log('Error fetching settings:', error);
            });
        })
}

const applyFilters = () => {
    const dateFilter = document.getElementById('filter-date').value;
    const winnerFilter = document.getElementById('filter-winner').value.toLowerCase();
    const tournamentFilter = document.getElementById('filter-tournament').value.toLowerCase();

    let rows = document.querySelectorAll('#match-history-table-body tr');

    rows.forEach(row => {
        const date = row.children[0].textContent;
        const winner = row.children[5].textContent.toLowerCase();
        const tournament = row.children[6].textContent.toLowerCase();

        let matchesDate = !dateFilter || date.startsWith(dateFilter);
        let matchesWinner = !winnerFilter || winner.includes(winnerFilter);
        let matchesTournament = !tournamentFilter || (tournamentFilter == tournament);

        if (matchesDate && matchesWinner && matchesTournament) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }

    });
}


export const loadProfileSettingsPage = () => {
    drawHeader('main').then(() => {
    return  makeAuthenticatedRequest(baseUrl + userMgmtPort + "/api/profile-settings-page/", {
        method: "GET",
        credentials: 'include'
    })
        .then(response => response ? response.json() : null)
        .then(data => {
            if (data && data.profile_settings_html) {
                document.getElementById('content-area').innerHTML = data.profile_settings_html;
            } else {
                // console.log('Error fetching settings:', data.error);
            }
        })
        .catch(error => {
            // console.log('Error fetching settings:', error);
        });
    })
};

export const loadProfilePage = async () => {
    const dictionary = await getDictFor3DGame();
    drawHeader('main').then(() => {
    return makeAuthenticatedRequest(baseUrl + userMgmtPort + "/api/profile-page/", {
        method: "GET",
        credentials: 'include'
        })
    })
    .then((response) => {
        if (response.ok) {
            return response.json();
        } else {
            // console.log("Failed to load user info");
        }
    })
    .then((data) => {
        if (data && data.profile_html) {
            document.getElementById('content-area').innerHTML = data.profile_html;
            // addLogoutListener();
            fetchLastTenGames().then((gamesData) => {
                if (gamesData) {
                    const { username, games } = gamesData;
                    fillLastTenGamesChart(games, username, dictionary);
                }
            });
        }
    })
    .catch((error) => {});
};

const updateProfileSettings = (form) => {
    const formData = new FormData(form);
    makeAuthenticatedRequest(baseUrl + userMgmtPort + "/api/update-profile-settings/", {
        method: "POST",
        body: formData,
        credentials: 'include',
    })
        .then(response => response ? response.json() : null)
        .then((data) => {
            if (data && data.success) {
                displayUpdatingMessage("Settings were updated!", 'green');
            } else {
                displayUpdatingMessage(data.error, 'red');
            }
        })
        .catch((error) => {
            // console.log("Error updating settings: ", error);
        });
};

document.addEventListener("DOMContentLoaded", () => {
    const contentArea = document.getElementById("content-area");
    contentArea.addEventListener("click", (event) => {
        // if (event.target && event.target.id == "profile-settings-button") {
        //     loadProfileSettingsPage();
        // }
        if (event.target && event.target.id == "save-settings-button") {
            event.preventDefault();
            const form = document.querySelector("#profile-settings-container form");
            updateProfileSettings(form);
        }
        // if (event.target && event.target.id == "match-history-button") {
        //     loadMatchHistoryPage();
        // }
        if (event.target && event.target.id == "apply-filters") {
            applyFilters();
        }
        // if (event.target && event.target.id == "back-to-profile-button") {
        //     loadProfilePage();
        // }
        if (event.target && event.target.id == "game") {
            loadGame(contentArea);
        }
    });
});

