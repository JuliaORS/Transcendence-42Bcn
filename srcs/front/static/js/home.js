import { makeAuthenticatedRequest } from "./login.js";

var baseUrl = "http://localhost";

export const loadHomePage = () => {
    console.log('Loading home page...');
    makeAuthenticatedRequest(baseUrl + ":8000/api/home-page/", {method: "GET"})
        .then((response) => {
            console.log('Response received:', response); // Log para confirmar la respuesta
            if (response.ok) {
                console.log('Response is OK');
                return response.json();
            } else {
                console.error("Failed to load home page:", response.status, response.statusText);
                return null; // Aseguramos que no se siga al siguiente `.then`
            }
        })
        .then((data) => {
            console.log('Data received:', data); // Log para depurar el JSON recibido
            if (data && data.home_html) {
                console.log('2');
                document.getElementById('content-area').innerHTML = data.home_html;
                console.log('Home page loaded');
            } else {
                console.error("home_html not found in the response data");
            }
        })
        .catch((error) => console.error("Error loading home page:", error));
};
