import { makeAuthenticatedRequest } from "./login.js";
import { checkPermission, navigateTo } from "./main.js";

const host = window.env.HOST;
const protocolWeb = window.env.PROTOCOL_WEB
const baseUrl = protocolWeb + "://" + host + ":";  
const userMgmtPort = window.env.USER_MGMT_PORT;

export function getUserPreferenceLanguageFromDB() {
    return makeAuthenticatedRequest(baseUrl + userMgmtPort + "/api/get-user-pref-lang", {
        method: "GET"
    })
    .then((response) => {
        if (!response) return null;
        return response.json();
    })
    .then((data) => {
        if (data && data.status === "success") {
            return data.language;
        } else {
            // console.log("Failed to fetch user language preference:", data.message);
            return null;
        }
    })
    .catch((error) => {
        // console.log("Error fetching user language preference:", error);
        return null;
    });
}

function setCookie(name, value) {
    document.cookie = `${name}=${value}; Secure; SameSite=None; path=/;`;
}

function saveUserPreferenceLanguageToDB(lang) {
    makeAuthenticatedRequest(baseUrl + userMgmtPort + "/api/save-user-pref-lang", {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ language: lang }),
    })
    .then(response => response ? response.json() : null)
    .then((data) => {
        if (!data || data.status !== "success") {
            // console.log('Failed to update language on the server.');
        }
    })
}

function updateLanguageButtonUI(lang) {
    const languageButton = document.getElementById("language-button");
    const languageMenu = document.getElementById("language-menu");

    if (languageButton) {
        languageButton.textContent = lang;
    }

    if (languageMenu) {
        languageMenu.classList.add("d-none");
    }
}

export async function updateLanguage(lang) {
    let lang_is_defined = true; 

    if (!lang){
        lang_is_defined = false;
        lang = await getUserPreferenceLanguageFromDB();
    }

    setCookie("language", lang);

    if (lang_is_defined && checkPermission()) {
        await saveUserPreferenceLanguageToDB(lang);
    }
    updateLanguageButtonUI(lang);

    if (lang_is_defined) {
        navigateTo(window.location.pathname, true);
    }
}

document.addEventListener("headerLoaded", () => {
    const headerContainer = document.getElementById("header-container");
    if (headerContainer) {
        const languageButton = document.getElementById("language-button");
        const languageMenu = document.getElementById("language-menu");
        if (languageButton && languageMenu) {
            languageButton.addEventListener("click", () => {
                languageMenu.classList.toggle("d-none");
            });

            languageMenu.addEventListener("click", event => {
                const lang = event.target.getAttribute("data-lang");
                if (lang) { 
                    updateLanguage(lang);
                }
            });
        }
    }
});

export function getFrontDict(lang, key) {
    const dict = {
        "EN": {
            "ACCESS_DENIED": "Access denied",
            "ERROR": "An error occurred. Try again.",
            "WRONG_ID": "Wrong ID",
            "REPEATED_NAME": "Both names cannot be equal. Set another name",
            "SECOND_PLAYER_NEEDED": "Set second player's name",
            "WRONG_TOURNAMENT_ID": "The tournament ID is not correct",
            "FULL_TOURNAMENT": "Tournament is full or it doesn't exist",
            "PLAY_MY_GAME": "Play my game",
			"ALREADY_THERE": "You're already in that room!",
        },
        "ES": {
            "ACCESS_DENIED": "Acceso denegado",
            'ERROR': "Ocurrió un error. Inténtalo de nuevo.",
            "WRONG_ID": "ID incorrecto",
            "REPEATED_NAME": "Ambos nombres no pueden ser iguales. Pon otro nombre.",
            "SECOND_PLAYER_NEEDED": "Pon el nombre del segundo jugador",
            "WRONG_TOURNAMENT_ID": "El ID del torneo no es correcto.",
            "FULL_TOURNAMENT": "El torneo está lleno o no existe",
            "PLAY_MY_GAME": "Jugar mi partida",
			"ALREADY_THERE": "¡Ya estás en esa habitación!",
        },
        "CA": {
            "ACCESS_DENIED": "Accés denegat",
            "ERROR": "S'ha produït un error. Torna-ho a provar.",
            "WRONG_ID": "ID incorrecta",
            "REPEATED_NAME": "Els dos noms no poden ser iguals. Poseu un altre nom.",
            "SECOND_PLAYER_NEEDED": "Poseu el nom del segon jugador",
            "WRONG_TOURNAMENT_ID": "L'ID del torneig no és correcte",
            "FULL_TOURNAMENT": "El torneig està ple o no existeix",
            "PLAY_MY_GAME": "Jugar la meua partida",
			"ALREADY_THERE": "Ja estàs dins d'aquesta habitació!",
        },
        "RU": {
            "ACCESS_DENIED": "Доступ запрещен",
            'ERROR': "Произошла ошибка. Попробуйте снова.",
            "WRONG_ID": "Неверный ID",
            "REPEATED_NAME": "Имена не могут быть одинаковыми. Укажите другое имя",
            "SECOND_PLAYER_NEEDED": "Укажите имя второго игрока",
            "WRONG_TOURNAMENT_ID": "ID турнира некорректен",
            "FULL_TOURNAMENT": "Турнир заполнен или его не существует",
            "PLAY_MY_GAME": "Играть",
			"ALREADY_THERE": "Вы уже в этой комнате!",
        },
        "LV": {
            "ACCESS_DENIED": "Prieiga uždrausta",
            'ERROR': "Radās kļūda. Mēģiniet vēlreiz.",
            "WRONG_ID": "Nederīgs ID",
            "REPEATED_NAME": "Abi vārdi nevar būt vienādi. Ievadiet citu vārdu",
            "SECOND_PLAYER_NEEDED": "Norādiet otra spēlētāja vārdu",
            "WRONG_TOURNAMENT_ID": "Torneja ID nav pareizs",
            "FULL_TOURNAMENT": "Turnyras pilnas arba jo nėra",
            "PLAY_MY_GAME": "Spēlēt manu spēli",
			"ALREADY_THERE": "Tu jau tame kambaryje!",
        }
    };

    return dict[lang]?.[key] || dict["EN"][key] || key;
}

export function getCookie(name) {
    const cookies = document.cookie.split(";");

    for (let i = 0; i < cookies.length; i++) {
        let cookie = cookies[i].trim();
        
        if (cookie.startsWith(name + "=")) {
            return cookie.substring(name.length + 1);
        }
    }
    return 'EN';
}
