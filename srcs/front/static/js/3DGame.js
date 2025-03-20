
import { OrbitControls } from '../three/examples/jsm/controls/OrbitControls.js'
import { RoundedBoxGeometry } from '../three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { saveScore } from "./localGame.js";
import * as THREE from "three";
import { LocalPlayer, AIPlayer, AIController, OnlinePlayer } from './3DPlayer.js';
import { Ball, OnlineBall } from './3DBall.js';
import { SceneText, textWinner } from './3DText.js';
import { AmbientLight, DirectionalLight , Vector3} from 'three'
import { drawHeader, navigateTo } from "./main.js";
import { handlePlayersKeydown, handlePlayersKeyup } from "./3DControllers.js" 
import { saveTournamentGameResult, startTournamentGame, stopTournamentGame } from "./tournament.js"
import { checkToken } from "./onlineStatus.js";
import { showModalError } from "./errorHandler.js";

//----------------------------------------------------------------------------//
//-------------------- VARIABLES INITIALIZATION ------------------------------//
//----------------------------------------------------------------------------//

const gamePort = window.env.GAME_PORT;
const host = window.env.HOST;
const protocolSocket = window.env.PROTOCOL_SOCKET;

let renderer, scene, camera, lights, headerHeight;
let limits, plane, controls;
let player1, player2, ai, mainplayer, mainUser, ball; // if the main user is player 1 or 2
let dict, cameraId, gameLoopId, socket, roomID, tournamentId;
let remote, pause, gameStarted = false, gameEnded = false;
export let text = null;

const clock = new THREE.Clock();
clock.start();
const ray = new THREE.Raycaster();
const cursor = new THREE.Vector2(0,0);

const ambientLight = new AmbientLight(0xffffff, 1)
const dirLight = new DirectionalLight(0xffffff, 1)

export const field = {
    x: 20,
    y: 30,
    width: 0.5,
    height: 2,
    radius: 5,
    seg: 0.25
}

export const params = {
	planeColor: 0xDDDDFF, //0x9999DD, //0xDDDDFF, //0x9999DD, // 0x555577, //0xb994ff, //0x9b71ea, //0x6966ff,
	fogColor: 0x000033,//0x000022, //0x9e7aff,
	fogNear: 50,
	fogFar: 150,
    textY:  20,
    buttonColor: 0x9400FF,
    winnerColor: 0x22FFFF,//0x9400FF,//0xF5F045,//0xFF00FF,
}

export const textCount = {
    size: 2.5,
    depth: 0.5,
    curveSegments: 30,
}

const   size = {
    width: window.innerWidth,
    height: window.innerHeight,
}

//---------------------------------------------------------------------------------//
// ------------------ LOCAL GAME WITH ANOTHER PLAYER FUNCTIONS ------------------- //
//---------------------------------------------------------------------------------//

export async function start3DLocalGame(playerName1, playerName2, mainUserNmb, dict) {

    window.gameDict = dict;
    init();
    await setupScene();
    text = new SceneText(scene, dict, null, 0, -Math.PI / 2, 0);
    await text.createText();
    setupCamera();

    mainUser = mainUserNmb;
    await createLights(-20);
    await setupField();

    player1 = new LocalPlayer(dict, limits, scene, -1, playerName1, new THREE.Vector3(0, 0, -field.y + 2), -0.1, -0.5, 0);
    player2 = new LocalPlayer(dict, limits, scene, 1, playerName2, new THREE.Vector3(0, 0, field.y - 2), -0.1, -0.5, 0);
    ball = new Ball(dict, scene, limits, [player1, player2], false);
    setupLocalEvents();
    await animateCameraToField(-39.5, 22.5, 0, 3000)
    setupLocalControls();
    animateLocal();
}

// Event listeners for player controls
export function setupLocalControls() {
    window.addEventListener("keydown", (e) => handlePlayersKeydown(e, player1, player2, null));
    window.addEventListener("keyup", (e) => handlePlayersKeyup(e, player1, player2, null));
    window.addEventListener("keydown", handleButtonKeyControls);
}
async function setupLocalEvents() {

    ball.addEventListener("localfinish", (e) => {
        handleEnd3DGame(e.message);
        if (!player1 || !player2) return;
        saveScore(player1.score, player2.score, mainUser);
    })

    ball.addEventListener("pause", (e) => {
        console.log('goal!! pause');
        pause = true;
        showCountdown(() => {
            ball.resetVelocity(); // Randomize direction
            pause = false;
        });
    })

    window.addEventListener("click", (event) => { buttonsClickManager(event) });
    window.addEventListener('resize', handleResize);
}

// Game loop
async function animateLocal() {
   
    const deltaTime = clock.getDelta();
    const dt = Math.min(deltaTime, 0.1)
    
    if (gameStarted && !pause) {
        ball.update(dt);
        player1.move();
        player2.move();
    } else {
        ball.resetPos();
        player1.resetPos();
        player2.resetPos();
    }

    controls.update();
    renderer.render(scene, camera);
    gameLoopId = requestAnimationFrame(animateLocal);
}

//---------------------------------------------------------------------------------//
// ------------------ REMOTE GAME WITH ANOTHER PLAYER FUNCTIONS ------------------- //
//---------------------------------------------------------------------------------//

export async function start3DRemoteGame(dict, tournament, roomId, isCreator) {
    
    if (!roomId && !tournament) {
        navigateTo('/remote-home');
        return ;
    }
    window.gameDict = dict;
    init();
    remote = true;
    tournamentId = tournament;
    roomID = roomId;
    await setupScene(roomId);
    text = new SceneText(scene, dict, true, 0, -Math.PI / 2);
    await text.createText();
    setupCamera();
    await createLights(-20);
    await setupField();
    
    await animateCameraToField(-39.5, 22.5, 0, 1000);
    text.waiting.visible = true;
    if (tournamentId) {
        setupTourEvents();
        startTournamentGame();
    } else {
        roomID = (isCreator | 0) + roomID.toString();
        initializeWebSocket(roomID);
    }
    animateRemote();
}

async function setupTourEvents() {
    window.addEventListener("beforeunload", beforeUnloadHandlerRemote);
}

export function setupRemoteControls(player) {
    window.addEventListener('resize', handleResize);
    window.addEventListener("keydown", (e) => handlePlayersKeydown(e, player, player, null));
    window.addEventListener("keyup", (e) => handlePlayersKeyup(e, player, player, null));
}

async function initializeWebSocket() {
    // let retries = 0;
    const access_token = localStorage.getItem("access_token");
	const token = await checkToken(access_token);
    if (!token) return ;

    if (!socket)
    {
        // text.waiting.visible = true;
        socket = new WebSocket(`${protocolSocket}://${host}:${gamePort}/${protocolSocket}/G/${roomID.toString()}/?token=${token}`);
    }
    socket.onopen = () => {}
    socket.onerror = (error) => {
        // console.log("WebSocket encountered an error:", error);
    };
    socket.onclose = async (event) => {
        // console.log("WebSocket closing with code:", event.code);
        if (event.code === 4242) {
            try {
                await refreshAccessToken();
                initializeWebSocket();
            } catch (err) {
                cleanup3D();
                return; 
            }
        }
    };

    socket.onmessage = async (event) => {
        const data = JSON.parse(event.data);

        switch (data.type) {
            case "role":
                await scale3DGame(data);
                break;
            case "players":
                await setWhoAmI3D(data, socket);
                break;
            case "status":
                await handle3DStatus(data);
                break;
            case "update":
                handle3DUpdate(data);
                break ;
			case "reject":
				socket.close();
				showModalError(data.reason);
				navigateTo("/remote-home");
				return ;
            case "endgame":
                handleOnlineEndgame(data);
                break;
            default:
                console.log("Unhandled message type:", data.type);
        }
    };
}

function convertYToFront(backY) {
    return (limits.x - backY * limits.x * 2);
}

function convertXToFront(backX) {
    return (backX * limits.y * 2 - limits.y);
}

export async function scale3DGame(data)
{
    if (!player1) {
        player1 = new OnlinePlayer(data, dict, limits, scene, -1, "player1", new THREE.Vector3(0, 0, -field.y), -0.1, -0.5, 0);
        player2 = new OnlinePlayer(data, dict, limits, scene, 1, "player2", new THREE.Vector3(0, 0, field.y), -0.1, -0.5, 0);
        ball = new OnlineBall(data, dict, scene, limits, [player1, player2], false);
        pause = true;
    }
    handle3DRoleAssignment(data.role);
}

export async function handle3DStatus(data, tourSocket = null)
{
	if (tourSocket) {
		socket = tourSocket;
	}
	if (data.wait) {
		if (data.countdown == 3) {
            gameStarted = false;
            pause = true;
            ball.resetPos();
            await remoteCountdown(() => {
                pause = false;
            });
        }
	} else {
        pause = false;
        gameStarted = true;
	}
}

export function handle3DUpdate(data)
{
	if (data.players)
    {
        gameStarted = true;
        let pl1 = data["players"]["player1"]["y"];
        let pl2 = data["players"]["player2"]["y"];
        player1.update(pl1, data["scores"]["player1"]);
        player2.update(pl2, data["scores"]["player2"]);
    }
    if (data.ball) {
        ball.mesh.position.z = convertXToFront(data.ball.x);
        ball.mesh.position.x = convertYToFront(data.ball.y);
    }
}

export async function setWhoAmI3D(data, sock) {
    text.waiting.visible = false;
    text.enemy.visible = true;
    await player1.setupText();
    await player2.setupText();
    player1.setName(data.player1);
    player2.setName(data.player2);
    sock.send(JSON.stringify({"type": "ready"}))
}

export function handle3DRoleAssignment(role) {
	if (role === "player1") {
        setupRemoteControls(player1);
        mainplayer = player1;
	} else if (role === "player2") {
        setupRemoteControls(player2);
        mainplayer = player2;
	}
}

async function animateRemote() {
   
    if (gameStarted && !pause) {
        mainplayer.move(socket);
    } 
    controls.update();
    renderer.render(scene, camera);
    gameLoopId = requestAnimationFrame(animateRemote);
}

const beforeUnloadHandlerRemote = () => {
    if (tournamentId) {
		stopTournamentGame();
	}
};

//--------------------------------------------------------------------//
// -------------------- GAME WITH AI FUNCTIONS ---------------------- //
//--------------------------------------------------------------------//

export async function start3DAIGame(playerName2, dict, tournament = null, difficulty = 1) {

    window.gameDict = dict;
    init();
    if (tournament)
        tournamentId = tournament.id;
    await setupScene();
    text = new SceneText(scene, dict, tournamentId);
    await text.createText();
    setupCamera();
    await createLights(20);
    await setupField();
    player2 = new AIPlayer(dict, limits, scene, 1, playerName2, new THREE.Vector3(0, 0, field.y - 2), -0.1);
    player1 = new AIPlayer(dict, limits, scene, -1, dict['enemy'], new THREE.Vector3(0, 0, -field.y + 2), -0.1);
    ball = new Ball(dict, scene, limits, [player1, player2], true);
    ai = new AIController(player1, ball, limits, difficulty);
    await animateCameraToField(0, 20, 55, 2000)
    setupAIControls();
    animateAI();
    if (tournament) {
        showCountdown(() => {
            ball.resetVelocity();
            gameStarted = true;
        });
    }
}

function setupAIControls() {
    window.addEventListener('resize', handleResize);
    window.addEventListener("keydown", (e) => handlePlayersKeydown(e, null, null, player2));
    window.addEventListener("keyup", (e) => handlePlayersKeyup(e, null, null, player2));
    if (!tournamentId)
        window.addEventListener("keydown", handleButtonKeyControls);
    
    ball.addEventListener("aifinish", (e) => {
        handleEnd3DGame(e.message);
        if (tournamentId) {
            if (e.player == window.gameDict['enemy'])
                saveTournamentGameResult("@AI", player2.name, player1.score, player2.score);
            else
                saveTournamentGameResult(e.player, "@AI", player1.score, player2.score);
        }
        tournamentId = null;
    })

    ball.addEventListener("pause", (e) => {
        pause = true;
        showCountdown(() => {
            ball.resetVelocity(); // Randomize direction
            pause = false;
        });
    })

    window.addEventListener("beforeunload", beforeUnloadHandlerAI);
    
    window.addEventListener("click", (event) => { buttonsClickManager(event) });

}

async function animateAI() {
   
    const deltaTime = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();
    const dt = Math.min(deltaTime, 0.05)
    
    if (gameStarted && !pause) {
        ball.update(dt, pause);
        ai.update(elapsedTime);
        player2.move();
    } else {
        ball.resetPos();
        player1.resetPos();
        player2.resetPos();
    }

    controls.update();
    renderer.render(scene, camera);
    gameLoopId = requestAnimationFrame(animateAI);
}

//--------------------------------------------------------------------//
// ---------------------- COMMON FUNCTIONS -------------------------- //
//--------------------------------------------------------------------//

async function setupScene(roomId = null) {
    const contentArea = document.getElementById('content-area');
    contentArea.style.padding = 0;
    
    scene = new THREE.Scene();
    let id_3d;
    drawHeader('3d').then(() => {
        if (roomId && !tournamentId) {
            id_3d = document.getElementById("3D-header-id");
            if (id_3d) {
                id_3d.textContent = `ID: ${roomId}`;
                id_3d.style.color = "white";
            }
        }
    });
    scene.background = new THREE.Color(params.fogColor);
    scene.fog = new THREE.Fog(params.fogColor, params.fogNear, params.fogFar);
}

function setupCamera() {
    camera = new THREE.PerspectiveCamera(75, size.width / (size.height - 36), 0.1, 1000);
    camera.lookAt(new THREE.Vector3(0, 0, 0))
}


async function createLights(posX) {

    dirLight.position.set(posX, 20, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.camera.top = 40;
    dirLight.shadow.camera.bottom = -40;
    dirLight.shadow.camera.left = -40;
    dirLight.shadow.camera.right = 40;
    dirLight.shadow.radius = 10;
    dirLight.shadow.blurSamples = 20;
    dirLight.shadow.bias = -0.001;
    dirLight.shadow.camera.updateProjectionMatrix();

    lights = [dirLight, ambientLight]
}

async function setupField() {
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(size.width, size.height);
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    renderer.shadowMap.type = THREE.VSMShadowMap; //THREE.PCFSoftShadowMap; // Soft shadows
    document.getElementById('content-area').appendChild(renderer.domElement);
    handleResize();
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true
    scene.add(...lights);
    
    limits = new THREE.Vector2(field.x, field.y);
    let planeGeo = new THREE.PlaneGeometry(
        limits.x * 20,
        limits.y * 20,
        limits.x * 20,
        limits.y * 20,
    );

    planeGeo.rotateX(-Math.PI * 0.5);
    let planeMat = new THREE.MeshStandardMaterial({ 
        color: params.planeColor,
    });
    plane = new THREE.Mesh(planeGeo, planeMat);
    plane.receiveShadow = true;
    scene.add(plane)

    const boundGeo = new RoundedBoxGeometry(field.width, field.height, limits.y * 2, field.radius, field.seg);
    const boundMat = new THREE.MeshPhongMaterial({
        color: params.planeColor,
        specular: 0xFFFFFF, 
        shininess: 100 
    });
    const leftBound = new THREE.Mesh(boundGeo, boundMat);
    leftBound.position.x = -limits.x - field.width / 2;
    leftBound.position.y = field.height;
    leftBound.castShadow = true;
    leftBound.receiveShadow = true;
    const rightBound = leftBound.clone();
    rightBound.position.x *= -1;
    scene.add(leftBound, rightBound);

    await createSky();
}

async function animateCameraToField( x = -39.5, y = 22.5, z = 0, duration = 1000) {
    const startPosition = new THREE.Vector3(-70.5, 240.5, 0);
    const targetPosition = new THREE.Vector3(x, y, z); // Adjust to your desired final camera position
    const startLookAt = new THREE.Vector3(0, 170, 52);
    const targetLookAt = new THREE.Vector3(0, 7, 0); // Field position (where camera should look)
    const startTime = performance.now();

    function easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }
    
    function updateCamera() {
        const elapsedTime = performance.now() - startTime;
        const t = Math.min(elapsedTime / duration, 1); // Normalize to 0-1 range
        const easedT = easeInOutQuad(t); // Apply easing function
        // Interpolate (lerp) between current and target positions
        if (!camera) 
            return ;
        camera.position.lerpVectors(startPosition, targetPosition, easedT);
        controls.target.lerpVectors(startLookAt, targetLookAt, easedT);
        controls.update(); // Update orbit controls
        renderer.render(scene, camera);

        if (t < 1) {
            cameraId = requestAnimationFrame(updateCamera); // Continue animation
        } else {
            cancelAnimationFrame(cameraId);
            return;
        } 
    }
    cameraId = requestAnimationFrame(updateCamera); // Start animation loop
}


export function handleButtonKeyControls(e) {

    if (e.code === "Space" && !gameStarted && !gameEnded && text.start.visible == true) {
        // console.log("Spacebar pressed! Starting game...");
        gameStarted = true;
        text.start.visible = false;
        text.button.visible = false;
    }
    if (e.code === "Space" && !gameStarted && gameEnded && text.tryAgain.visible == true) {
        restart();
    }
}

const beforeUnloadHandlerAI = () => {
    if (tournamentId && !roomID) {
        saveTournamentGameResult("@AI", player2.name, 0, player1.score);
    }
};

async function buttonsClickManager(event) {
    if (gameStarted) return; // Ignore clicks after the game starts
    if (!text || !text.button || !text.start || !text.tryAgain) {
        return;
    }
    // Convert mouse position to normalized device coordinates (-1 to +1)
    const rect = renderer.domElement.getBoundingClientRect();
    // Calculate normalized coordinates relative to the canvas
    cursor.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    cursor.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Raycast to check for intersections
    ray.setFromCamera(cursor, camera);
    const intersects = ray.intersectObject(text.button);
    const intersectsStart = ray.intersectObject(text.start);
    const intersectsTryAgain = ray.intersectObject(text.tryAgain);

    if ((intersects.length > 0 || intersectsStart.length > 0) && !gameEnded && text.start.visible == true ) {
        // console.log("3D Start Button Clicked!");
        text.start.visible = false;
        text.button.visible = false;
        gameStarted = true;
    } else if ((intersects.length > 0 || intersectsTryAgain.length > 0) && gameEnded && text.tryAgain.visible == true) {
        // console.log("3D TryAgain Button Clicked!");
        restart();
    }
}

async function showCountdown(callback) {
    let count = 2;
    text.updateGeometry(text.countdownText, "3", textCount);
    text.countdownText.visible = true;
    const interval = setInterval((dict) => {
        if (!scene)
            return ;
        if (count === 0) {
            text.updateGeometry(text.countdownText, window.gameDict['go'], textCount);
        } else if (count < 0) {
            clearInterval(interval);
            text.countdownText.visible = false;
            callback();
        } else {
            text.updateGeometry(text.countdownText, `${count}`, textCount);
        }
        count--;  
    }, 500);
}

async function remoteCountdown(callback) {
    let count = 3;
    if (text.enemy.visible === true) {
        count = 2;
    } else {
        text.updateGeometry(text.countdownText, `${count}`, textCount);
        text.countdownText.visible = true;
    }
    const interval = setInterval(() => {   
        if (!scene)
            return ; 
        if (count == 2 && text.enemy.visible === true) {
            text.enemy.visible = false;
            text.updateGeometry(text.countdownText, `${count}`, textCount);
            player1.show();
            player2.show();
            text.countdownText.visible = true;
        } else if (count === 0) {
            text.updateGeometry(text.countdownText, window.gameDict['go'], textCount);
        } else if (count < 0) {
            clearInterval(interval);
            text.countdownText.visible = false;
            callback();
        } else {
            text.updateGeometry(text.countdownText, `${count}`, textCount);
        }
        count--;  
    }, 500);
}

async function handleEnd3DGame(message) {
    gameEnded = true;
    gameStarted = false;
    if (!text)
        return ;
    if (text.winnerMessage)
        text.updateGeometry(text.winnerMessage, message, textWinner);
    text.countdownText.visible = false;
    text.winnerMessage.visible = true;
    if (!remote && !tournamentId) {
        text.button.visible = true;
        text.tryAgain.visible = true;
    }
}

export async function  handleOnlineEndgame(data) {
    
    const { winner, loser, scores} = data;
    const msg = `${winner} ` + window.gameDict['wins'] + " !";
    if (!scene)
        return ;
	if (socket && socket.readyState === WebSocket.OPEN && !tournamentId) {
        // console.log(`Closing socket tourId: ${tournamentId}`);
		socket.close();
		socket = null;
	} 
    handleEnd3DGame(msg);
    if (tournamentId){
        saveTournamentGameResult(data["winner"], data["loser"], data["scores"]["player1"], data["scores"]["player2"]);
    }
    resetOnlineTeam();
}

async function createSky() {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const sphereRadius = 70;  // The radius of the transparent sphere where the stars will be placed outside
    
    for ( let i = 0; i < 200000; i ++ ) {
        let x, y, z;
        do {
            x = THREE.MathUtils.randFloatSpread(1000); // Random x coordinate
            y = THREE.MathUtils.randFloatSpread(1000); // Random y coordinate
            z = THREE.MathUtils.randFloatSpread(1000); // Random z coordinate
        } while (Math.sqrt(x * x + y * y + z * z) < sphereRadius); // Check if the star is inside the sphere, if so, try again
        vertices.push(x, y, z);
    }
    geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
    const particles = new THREE.Points( geometry, new THREE.PointsMaterial( { 
        color: 0xffffff,
        size: 0.7, 
        opacity: 0.8, 
        transparent: true,
     } ) );
    scene.add( particles );
}

async function restart() {
    resetTeam();
    gameEnded = false;
    text.tryAgain.visible = false; 
    text.winnerMessage.visible = false;
    text.start.visible = true;
}

function resetOnlineTeam() {
    player1.resetPos();
    player2.resetPos();
    ball.resetPos();
}

function resetTeam() {
    player1.resetAll();
    player2.resetAll();
    ball.resetVelocity();
}

window.addEventListener('resize', handleResize);

async function handleResize() {
    if (!scene) return ;
    const header = document.getElementById('header-container');
    if (!header)    return ;
    // console.log("RESIZING 3D")
    headerHeight = header.offsetHeight;
    size.width = window.innerWidth;
    size.height = window.innerHeight - headerHeight;

    if (camera && camera.aspect) {
        camera.aspect = size.width / size.height;
        camera.updateProjectionMatrix();
        renderer.setSize(size.width, size.height);

        const pixelRatio = Math.min(window.devicePixelRatio, 2);
        renderer.setPixelRatio(pixelRatio);
    }
}

// -------------------------- UTILS ---------------------------- //

export async function exit3D() {
    cleanup3D();
    navigateTo('/home');
}
// Dispose of all geometries, materials, and textures
export async function cleanup3D() {

    if (!scene) return;
    
    if (tournamentId && remote)
        stopTournamentGame();

    drawHeader('main')
    const contentArea = document.getElementById('content-area');
    contentArea.style.padding = "3rem";
    
    
    if (socket && socket.readyState === WebSocket.OPEN && !tournamentId) {
        socket.close();
        socket = null;
    }
    // Stop animation loop
    cancelAnimationFrame(gameLoopId);

    // Remove event listeners (if any)
    window.removeEventListener("resize", handleResize);
    window.removeEventListener("click", buttonsClickManager);
    window.removeEventListener("keydown", handleButtonKeyControls);
    window.removeEventListener("keydown", handlePlayersKeydown);
    window.removeEventListener("keyup", handlePlayersKeyup);
    if (remote && tournamentId) {
        window.removeEventListener("beforeunload", beforeUnloadHandlerRemote);
    } else if (!remote && tournamentId) {
        window.removeEventListener("beforeunload", beforeUnloadHandlerAI);
    }
    scene.traverse((object) => {
        if (object.isMesh) {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(mat => mat.dispose());
                } else {
                    object.material.dispose();
                }
            }
        }
    });

    // Remove all objects from the scene
    while (scene.children.length > 0) {
        scene.remove(scene.children[0]);
    }
    ball = null;
    player1 = null;
    player2 = null;
    text = null;
    ai = null;

    // Dispose of the renderer
    renderer.dispose();
    renderer.domElement.remove();

    // Dispose of controls if using OrbitControls
    if (controls) controls.dispose();
    scene = null;
    camera = null;
    lights = null;
    plane = null;
    gameLoopId = null;
    remote = false ; 
    tournamentId = null;
    gameStarted = false;
    gameEnded = false;
    roomID = null;
    moveCamera = false;
    pause = false;

    // console.log("✅ 3D Scene cleaned up!");
}


function init() {
    renderer = null;
    scene = null; 
    camera = null; 
    lights = null; 
    headerHeight = null;
    limits= null; 
    plane = null; 
    addplane = null; 
    controls = null;
    player1 = null; 
    player2 = null; 
    ai = null; 
    mainplayer = null;
    mainUser = null; 
    ball = null; 
    
    dict = null; 
    cameraId = null; 
    gameLoopId = null; 
    socket = null; 
    roomID = null;
    tournamentId = null;
    
    text = null;
    remote = false;
    gameEnded = false;
    gameStarted = false;
    pause = false;
    moveCamera = false;

    const contentArea = document.getElementById('content-area');
    contentArea.style.padding = 0;
}
