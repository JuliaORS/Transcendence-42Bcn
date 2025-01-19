import { loadProfilePage } from "./profile.js";
import { handleLogout } from "./logout.js"
import { navigateTo } from "./main.js";
import { loadHomePage } from "./home.js";
import { updateLanguage } from "./langs.js";

var baseUrl = "http://localhost"; // change (parse) later

function refreshAccessToken() {
    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) {
        console.error("No refresh token found. User needs to log in again.");
        handleLogout();
        return Promise.reject("No refresh token available");
    }

    return fetch(baseUrl + ":8000/api/token/refresh/", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({refresh: refreshToken}),
    })
    .then((response) => {
        if (response.ok) {
            return response.json();
        } else {
            console.error("Refresh token invalid or expired.");
            handleLogout();
            return Promise.reject("Refresh token invalid or expired.");
        }
    })
    .then((data) => {
        if (data.access) {
            localStorage.setItem("access_token", data.access);
            if (data.refresh) {
                console.log("new refresh!!!!");
                localStorage.setItem("refresh_token", data.refresh);
            }
            return data.access;
        }
    })
    .catch((error) => {
        console.error("Error during token refresh:", error);
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        throw error;
    });
};

export const makeAuthenticatedRequest = (url, options = {}) => {
    const accessToken = localStorage.getItem("access_token");
    if (!accessToken) {
        console.error("No access token available.");
        return Promise.reject("No access token.");
    }

    options.headers = {
        ...options.headers,
        Authorization: `Bearer ${accessToken}`, // adding authorization header with the access token
    };
  
    // if (url == baseUrl + ":8000/api/2fa/verify/" || url == baseUrl + ":8000/api/2fa/enable/") {
    //     alert("here");
    // }
    return fetch(url, options).then((response) => {
        if (url == baseUrl + ":8000/api/2fa/verify/")
            alert("hereee");
        if (response.status === 401) {
            console.log("Access token expired, attempting refresh..");
            return refreshAccessToken().then((newAccessToken) => {
                options.headers["Authorization"] = `Bearer ${newAccessToken}`;
                return fetch(url, options); //retry the original request
            });
        } else {

            if (url == baseUrl + ":8000/api/2fa/verify/")
                alert("response ok");

          return response; // means that response is valid
        }
    });
};

// export const loadLoginPage = () => {
//     const contentArea = document.getElementById("content-area");
//     fetch('html/login_form.html')  // Call the API endpoint to get the form as JSON
//         .then(response => response.text())
//         .then(data => {
//             if (data) {
//                     console.log('Form html returned!');
//                     contentArea.innerHTML = data;
//             }
//         })
//         .catch(error => console.error('Error loading login form:', error));
// };

export const loadLoginPage = () => {
    fetch(baseUrl + ":8000/api/login-form/", {
        method: 'GET',
        credentials: "include"
    })
    .then((response) => response.json())
    .then(data => {
        if (data.form_html) {
            console.log('Form html returned!');
            document.getElementById('content-area').innerHTML = data.form_html;
        } else {
            console.error('Form HTML not found in response:', data);
        }
    })
    .catch(error => {
        console.error('Error loading page', error);
    });
};

const handleLogin = () => {
    const loginForm = document.getElementById('login-form');
    const formData = new FormData(loginForm);
    fetch(baseUrl + ":8000/api/login/", {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(formData)),
        headers: { 'Content-Type': 'application/json' }

    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {

            localStorage.setItem('access_token', data.tokens.access);
            localStorage.setItem('refresh_token', data.tokens.refresh);
          
            updateLanguage();
            // loadProfilePage(); //navigateTo later instead
            // navigateTo('/profile'); // change to navigate to home
            // loadHomePage();
            navigateTo('/home', true);

        } else {
            displayLoginError('Invalid credentials. Please try again.', 'login-form');
            }
        })
    .catch(error => {
        console.error('Error logging in:', error);
        alert('An error occurred during login.');
    });
};

export const handleSignup = () => {
    const loginForm = document.getElementById('login-form');
    
    if (loginForm) loginForm.remove();
    
    fetch(baseUrl + ":8000/api/signup-form/", {
        method: 'GET',
        credentials: "include"
    })
    .then(response => response.json()) // Expecting JSON response
    .then(data => {
        if (data && data.form_html) {
            console.log('Form HTML returned!');
            document.getElementById('content-area').innerHTML = data.form_html;

            const signupForm = document.getElementById('signup-form');
            if (signupForm) {
                signupForm.addEventListener('submit', (event) => {
                    event.preventDefault();
                    console.log('Submit of signup clicked!');
                    
                    const formData = new FormData(signupForm);
                    const formAction = signupForm.action || `${baseUrl}/api/signup/`; // Fallback action URL
                    
                    fetch(formAction, {
                        method: 'POST',
                        body: JSON.stringify(Object.fromEntries(formData)),
                        headers: { 'Content-Type': 'application/json' }
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            localStorage.setItem('access_token', data.tokens.access);
                            localStorage.setItem('refresh_token', data.tokens.refresh);
                            updateLanguage();
                            //loadProfilePage();
                            navigateTo('/home', true);
                        } else {
                            displayLoginError(`${data.error} Please try again.`, 'signup-form');
                        }
                    })
                    .catch(error => {
                        console.error('Error submitting signup form:', error);
                    });
                });
            } 
        }
    })
    .catch(error => {
        console.error('Error loading Sign In form:', error);
    });
};

// export const handleSignup = () => {
//     const contentArea = document.getElementById("content-area");
//     const loginForm = document.getElementById('login-form');
//     if (loginForm)
//         loginForm.remove();
//     fetch('html/signup_form.html')
//         .then(response => response.text())
//         .then(html => {
//             contentArea.innerHTML = html;
//             const signupForm = document.getElementById('signup-form');
//             if (signupForm) {
//                 console.log('Exists signup form');
//                 signupForm.addEventListener('submit', (event) => {
//                     event.preventDefault();
//                     console.log('Submit of sign up clicked!');
//                     const formData = new FormData(signupForm);
//                     fetch(signupForm.action, {
//                         method: 'POST',
//                         body: JSON.stringify(Object.fromEntries(formData)),
//                         headers: {'Content-Type': 'application/json'}
//                     })
//                     .then(response => response.json())
//                     .then(data => {
//                         if (data.success) {
//                             localStorage.setItem('access_token', data.tokens.access);
//                             localStorage.setItem('refresh_token', data.tokens.refresh);
//                             navigateTo('/home', true);
//                         } else {
//                             displayLoginError(data.error + ' Please try again.', 'signup-form');
//                         }
//                     })
//                 })
//             }
//         })
//         .catch(error => console.error('Error loading Sign In form:', error));
// };

export const displayLoginError = (message, form) => {
    const loginContainer = document.getElementById('login-container');
    if (!loginContainer)
        return;

    const existingError = document.getElementById('login-error');
    if (existingError)
        existingError.remove();

    const errorMessage = document.createElement('div');
    errorMessage.id = 'login-error';
    errorMessage.style.color = 'red';
    errorMessage.style.marginBottom = '15px';
    errorMessage.textContent = message;

    loginContainer.prepend(errorMessage); //adding at the top of the login container
    
    const loginForm = document.getElementById(form);
    if (loginForm) {
        loginForm.reset();  // to clear the form
    }
};

document.addEventListener("DOMContentLoaded", () => {
    const contentArea = document.getElementById("content-area");

    contentArea.addEventListener('submit', (event) => {
        if (event.target && event.target.id === "login-form") {
            event.preventDefault();
            console.log('Submit button clicked!');

            handleLogin();
        }
    });

    // contentArea.addEventListener('click', (event) => {
    //     if (event.target && event.target.id === 'signup-link') {
    //         event.preventDefault();
    //         console.log('Sign up button clicked!');

    //         navigateTo('/signup')
    //         // handleSignup(); // navigateTo ??
    //     }
    // });  
});
