import { makeAuthenticatedRequest } from "./login.js";
import { clearURL, navigateTo } from "./main.js"

function getUserPreferenceLanguageFromDB() {
    return makeAuthenticatedRequest("http://localhost:8000/api/get-user-pref-lang", {
        method: "GET",
        credentials: "include"  // This ensures cookies are sent along with the request 
    })
    .then((response) => {
        return response.json();
    })
    .then((data) => {
        if (data.status === "success") {
            return data.language;
        } else {
            console.log("Failed to fetch user language preference:", data.message);
            return null;
        }
    })
    .catch((error) => {
        console.log("Error fetching user language preference:", error);
        return null;
    });
}

function setCookie(name, value) {
    document.cookie = `${name}=${value}; Secure; SameSite=None; path=/;`;
}

function saveUserPreferenceLanguageToDB(lang) {
    makeAuthenticatedRequest("http://localhost:8000/api/save-user-pref-lang", {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ language: lang }),
    })
    .then((response) => response.json())
    .then((data) => {
        if (data.status !== "success") {
            console.error('Failed to update language on the server.');
        }
    })
    .catch((error) => {
        console.error('Error updating language:', error);
    });
}

function updateLanguageButtonUI(lang) {
    const languageButton = document.getElementById("language-button");
    const languageMenu = document.getElementById("language-menu");

    if (languageButton) {
        languageButton.textContent = lang.toUpperCase();
    }

    if (languageMenu) {
        languageMenu.classList.add("d-none"); // Hide the menu after updating
    }
}

export async function updateLanguage(lang) {
    let lang_is_defined = true; 
    
    //STEP 1: Get user language preference when login (no lang passed as parameter)
    if (!lang){ //when login /signin
        lang_is_defined = false; //when login/signin 
        lang = await getUserPreferenceLanguageFromDB();
    }

    //STEP 2: Set language cookies
    setCookie("language", lang);

    //STEP 3: Save lang in bbdd (only if update comes from button - not login)
    if (lang_is_defined) {
        saveUserPreferenceLanguageToDB(lang);
    }

    //STEP 4: Update button UI
    updateLanguageButtonUI(lang);

    //STEP 5: TODO: Update page (Pending Dina code)
    if (lang_is_defined) {
        navigateTo(window.location.pathname, true);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const headerContainer = document.getElementById("header-container");

    if (headerContainer) {
        const languageButton = document.getElementById("language-button");
        const languageMenu = document.getElementById("language-menu");
    
        // Toggle the visibility of the language menu
        if (languageButton && languageMenu) {
            languageButton.addEventListener("click", () => {
                languageMenu.classList.toggle("d-none");
            });
        }
    
        languageMenu.addEventListener("click", event => {
            const lang = event.target.getAttribute("data-lang");
            if (lang) {
                updateLanguage(lang);
            }
        });
    }
});
