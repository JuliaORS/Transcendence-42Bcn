import * as THREE from "three";
import { Vector3, Raycaster } from 'three';
import { EventDispatcher} from 'three';
import { TextGeometry } from '../three/examples/jsm/geometries/TextGeometry.js';
import { FontLoader } from '../three/examples/jsm/loaders/FontLoader.js';
// import { TEXT_PARAMS } from "./3DPlayer";
import { params, field } from "./3DGame.js";
// import { pause } from "./Game.js";
// import { Player, AIPlayer, AIController } from './3DPlayer.js';

// const ballCoef = 0.3;

const TEXT_PARAMS = {
    size: 3,
    depth: 0.5,
    curveSegments: 12,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.05,
    bevelOffset: 0,
    bevelSegments: 5
}

export const ballParams = {
    speed: 25,
    velocity: new Vector3(-0.8, 0, -0.5),
    // velocity1: new Vector3(-0.8, 0, 0.5),
    radius: 0.7,
    color: 0x9400FF,//params.buttonColor,// 0xffaa00,//0xEAE900,//0xF5F045, //0x550055,
    maxScore: 2,
    fontPath: "../three/examples/fonts/helvetiker_regular.typeface.json",
}

export class BasicBall extends EventDispatcher {
    constructor(dict, scene, limits, players, ifAI) {
        super(); // Calls the parent class constructor
        this.dict = dict;
        this.ai = ifAI;
        this.speed = null;
        // this.inicial = ballParams.velocity.normalize();
        this.velocity = null;
        this.radius = null;
        this.color = ballParams.color;
        this.limits = limits;
        this.scene = scene;
        this.players = players;
        this.scored = -1;
        this.geometry = null;
        this.material = null;
        this.mesh = null;
        this.ray = null;
        this.loadedFont = null;
    }

    resetPos() {
        this.mesh.position.set(0, field.height, 0);
    }
}

export class Ball extends BasicBall {

    
    maxScore = ballParams.maxScore;
    
    constructor(dict, scene, limits, players, ifAI) {
        super(dict, scene, limits, players, ifAI); // Calls the parent class constructor
        this.dict = dict;
        this.ai = ifAI;
        this.speed = ballParams.speed;
        // this.inicial = ballParams.velocity.normalize();
        this.velocity = ballParams.velocity.clone();
        this.velocity = this.velocity.normalize();
        this.radius = ballParams.radius;
        this.color = ballParams.color;
        this.limits = limits;
        this.scene = scene;
        this.players = players;
        this.scored = -1;
        this.geometry = new THREE.SphereGeometry(this.radius);
        this.material = new THREE.MeshPhongMaterial({ 
            color: ballParams.color, 
            specular: 0xFFFFFF, 
            shininess: 100 });
        // change later for standard or phong material later
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.resetPos();
        this.scene.add(this.mesh);
        this.velocity.multiplyScalar(this.speed);
        
        this.ray = new Raycaster();
        this.ray.near = 0;
        this.ray.far = limits.y * 2.5;
        this.loadedFont = null;
    }

    createTextGeometry(text, font) {
        const textGeo = new TextGeometry(text, {
                font: font,
                ...TEXT_PARAMS
        })
        textGeo.center();
        return textGeo;
    }

    resetVelocity() {
        this.speed = ballParams.speed;
        this.velocity = ballParams.velocity.clone();
        this.velocity.z *= this.scored;
        this.velocity.normalize().multiplyScalar(this.speed);
    }

    checkScore() {
        if (this.players[1].score < this.maxScore && this.players[0].score < this.maxScore) {
            return false;
        }
        const winner = this.players[0].score >= this.maxScore ? this.players[0] : this.players[1];
        const msg = `${winner.name} ` + this.dict['wins'] + ` ${this.players[0].score}-${this.players[1].score} !`
        this.resetVelocity();
        const type = winner.getType();
        // console.log(type)
        this.players[0].hide();
        this.players[1].hide();
        this.dispatchEvent({ type: type, message: msg, player: winner.name });
        return true;
    }

    update(dt) {
        const dir = this.velocity.clone().normalize();
        this.ray.set(this.mesh.position, dir);
        const s = this.velocity.clone().multiplyScalar(dt); // A displacement vector representing how far the object will move in this frame.
        const tPos = this.mesh.position.clone().add(s); // The target position of the moving object after applying the displacement.
        
        // collitions here
        const dx = this.limits.x - this.radius - Math.abs(this.mesh.position.x)
        const dz = this.limits.y - this.radius - Math.abs(this.mesh.position.z)

        if (dx <= 0) {
            tPos.x = (this.limits.x - this.radius + dx) * Math.sign(this.mesh.position.x)
            this.velocity.x *= -1;
        }
        else if (dz < 0) {
            if (this.mesh.position.z > 0) {
                this.players[0].scored();
                this.scored = -1;             
            } else {
                this.players[1].scored();
                this.scored = 1;
            }
            if (!this.checkScore())
                this.onGoal();
            return ;
        }

        // if (this.isPaused) return;
        // Find the Paddle the Ball is Moving Towards:
        // Math.sign(paddle.mesh.position.z) checks if the paddle is on the positive or negative Z-axis.
        // Math.sign(this.velocity.z) checks if the ball is moving forward or backward along the Z-axis.
        const paddle = this.players.find((paddle) => {
            return Math.sign(paddle.mesh.position.z) === Math.sign(this.velocity.z);
        })
        // This ensures the code only checks for collisions with the paddle the ball is heading towards.
        // The paddle might have multiple child objects (e.g., visual components), and the ray checks all of them for intersections.
        // Destructures the first intersection from the array of intersected objects (if any).
        
        const [intersection] = this.ray.intersectObjects(paddle.mesh.children)

        if (intersection) {

        // Check If the Collision Happens Before the Ball Fully Moves
        // If the intersection distance is less than the intended movement:
        // A collision will occur within this frame, so the code handles the collision.
            if (intersection.distance < s.length()) {
                // console.log('Collision with paddle');

                // Handle the Collision (Bounce Effect):
                tPos.copy(intersection.point); // Move the ball to the exact collision point
                const d = s.length() - intersection.distance; // Remaining distance after the collision
                const normal = intersection.normal; // Get the surface normal at the point of collision
                normal.y = 0; // Prevent vertical reflections (lock movement in the XZ)
                normal.normalize(); // Normalize the normal vector to ensure it has a unit length for accurate reflection
                // Reflect the velocity to simulate a bounce
                // Reflects the ball's velocity vector across the paddle's surface normal, causing it to bounce off in the opposite direction.
                this.velocity.reflect(normal); // Reflect velocity (bounce off)
                const dS = this.velocity.clone().normalize().multiplyScalar(d); // Remaining movement after bouncing
                tPos.add(dS); // Move the ball the remaining distance in the new direction

                this.speed *= 1.1;
                this.velocity.normalize().multiplyScalar(this.speed);
                
            }
        }

        this.mesh.position.copy(tPos);
    }

    onGoal() {
        this.resetPos();
        this.dispatchEvent({ type: 'aipause'});
    }
}

export class OnlineBall extends BasicBall {

    constructor (data, dict, scene, limits, players, ifAI) {
        super(dict, scene, limits, players, ifAI);
        this.radius = limits.y * 2 * data.ballRad / data.canvasX;
        // this.inicial = new Vector3(data.ballSy / 10, 0, data.ballSx / 10)
        // this.radius = ballParams.radius;
        // this.inicial = ballParams.velocity;
        // this.velocity = this.inicial.clone();

        this.geometry = new THREE.SphereGeometry(this.radius);
        this.material = new THREE.MeshPhongMaterial({ 
            color: ballParams.color, 
            specular: 0xFFFFFF, 
            shininess: 100 });
        // change later for standard or phong material later
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.resetPos();
        this.scene.add(this.mesh);
        // console.log(`Creating ball, position x ${this.mesh.position.z}, y ${this.mesh.position.x}`)
        // this.velocity.multiplyScalar(this.speed);
        
        // this.ray = new Raycaster();
        // this.ray.near = 0;
        // this.ray.far = limits.y * 2.5;
        // this.isPaused = false;
        // this.createCountdownText();
        this.loadedFont = null;
        this.targetX = this.mesh.position.z;
        this.targetY = this.mesh.position.x;
    }

    interpolate() {
        // ball.x += (targetBallX - ball.x) * ballCoef;
        // ball.y += (targetBallY - ball.y) * ballCoef;
        this.mesh.position.z += (this.targetX - this.mesh.position.z) * ballCoef;
        this.mesh.position.x += (this.targetY - this.mesh.position.x) * ballCoef;
        // console.log(`ball.x: ${this.mesh.position.z}, ball.y: ${this.mesh.position.x}`)

    }

    // send(socket) {
	// 	if (socket.readyState === WebSocket.OPEN)
	// 	{
	// 		const data = {
	// 			"type": "ballUpdate",
	// 			"x": this.convertXToBack(this.mesh.position.z),
	// 			"y": this.convertYToBack(this.mesh.position.x),
	// 			"xspeed": this.velocity.z,
	// 			"yspeed": this.velocity.x,
	// 		};
	// 		socket.send(JSON.stringify(data));
	// 	}
	// }

    convertYToBack(frontY) {
        return ((limits.x - frontY) / (limits.x * 2));
    }

    convertXToBack(frontX) {
        return ((limits.y - frontX) / (limits.y * 2));
    }

}

