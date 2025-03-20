import * as THREE from "three";
import { CapsuleGeometry, MeshNormalMaterial } from 'three';
import { MathUtils} from 'three';
import { TextGeometry } from '../three/examples/jsm/geometries/TextGeometry.js';
import { FontLoader } from '../three/examples/jsm/loaders/FontLoader.js';
import { ballParams } from "./3DBall.js";
import { field, text } from "./3DGame.js";
import { EventDispatcher } from "../three/build/three.core.js";
import { RoundedBoxGeometry } from '../three/examples/jsm/geometries/RoundedBoxGeometry.js'

export const paddle = {
    radius: 0.35,
    length: 7,
    capSeg: 20,
    radSeg: 20,
    speed: 0.6,
    color: 0x7C62A0, //0x550055,
    // fontPath: "../three/examples/fonts/helvetiker_regular.typeface.json",
}

const TEXT_PARAMS = {
    size: 2.5,
    depth: 0.5,
    curveSegments: 12,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.05,
    bevelOffset: 0,
    bevelSegments: 5
}

const TEXT_PARAMS_NAME = {
    size: 2,
    depth: 0.5,
    curveSegments: 12,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.05,
    bevelOffset: 0,
    bevelSegments: 5
}

export class BasicPlayer {
    constructor(dict, limits, scene, role, name, position, rotationX = 0, rotationY = 0, rotationZ = 0) {
        this.dict = dict;
        this.speed = paddle.speed;
        this.color = paddle.color;
        // this.loader = new FontLoader();
        this.textMesh = null;
        this.textName = null;
        // this.fontPath = paddle.fontPath;
        this.loadedFont = null;
        this.limits = limits;
        this.up = false;
        this.down = false;
        this.score = 0;
        this.role = role; // 1 - right or -1 - left (AI)
        this.name = name;
        // console.log(`My name is ${this.name}`)
        // console.log(`Originally ${name}`)
        this.scene = scene;
        this.text = `${this.score}`;
        this.initial = position;
        this.initial.y += field.height;
        this.rotationX = rotationX;
        this.rotationY = rotationY;
        this.rotationZ = rotationZ;
        this.geometry = null;
        this.material = null;
        this.mesh = null;
        this.collitionMat = null;
        this.helperGeo = null;
        this.collitionMesh = null;
    }

    drawGeometry() {
        this.geometry = new CapsuleGeometry(this.limits.x * 0.02, paddle.length, paddle.capSeg, paddle.radSeg);
        this.geometry.rotateZ(Math.PI * 0.5);
        this.helperGeo = new CapsuleGeometry(paddle.radius + ballParams.radius, paddle.length + 0.5, paddle.capSeg, 8)
        this.helperGeo.rotateZ(Math.PI * 0.5);
        this.helperGeo.rotateX(Math.PI / 8);
    }

    drawPaddle() {
        this.material = new THREE.MeshPhongMaterial({ 
            color: paddle.color,
            specular: 0xFFFFFF, 
            shininess: 50 }); 
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.collitionMat = new THREE.MeshNormalMaterial({ 
            transparent: true, 
            opacity: 0.5, 
            visible: false 
        });
        this.collitionMesh = new THREE.Mesh(
            this.helperGeo,
            this.collitionMat,
        )
        this.mesh.add(this.collitionMesh);
        this.mesh.position.copy(this.initial);
        this.scene.add(this.mesh);
    }

    hide() {
        this.textMesh.visible = false;
        this.textName.visible = false;
    }

    show() {
        this.textMesh.visible = true;
        this.textName.visible = true;
    }


    createTextGeometry(text, font, params) {
        const textGeo = new TextGeometry(text, {
                font: font,
                ...params
        })
        textGeo.center();
        textGeo.rotateX(Math.PI * this.rotationX);
        textGeo.rotateY(Math.PI * this.rotationY);
        textGeo.rotateZ(Math.PI * this.rotationZ);
        return textGeo;
    }

    updateGeo() {
        this.textMesh.geometry.dispose();
        this.textMesh.geometry = this.createTextGeometry(this.text, text.fonts['roboto'], TEXT_PARAMS);
        this.textMesh.castShadow = true;
        this.textMesh.receiveShadow = true;
        this.textMesh.geometry.getAttribute('position').needsUpdate = true;
    }

    resetAll() {
        this.score = 0;
        this.setText();
        this.updateGeo();
        this.resetPos();
        this.show();
    }

    scored() {
        this.score++;
        this.setText();
        this.updateGeo();
    }
    move() {
        // console.log(`The arrow left is ${this.down}, mesh pos is ${this.mesh.position.x - paddle.length / 2}, limits are ${this.limits.x * -1 + 0.5}`)
        if (this.down && ((this.mesh.position.x - paddle.length / 2) > (this.limits.x * -1 + 0.5))) {
            // console.log("Move 2 down, arrow left");
            this.mesh.position.x -= this.speed;
        }
        if (this.up && (this.mesh.position.x + paddle.length / 2) < this.limits.x - 0.5) {
            // console.log("Move 2 up, arrow right");
            this.mesh.position.x += this.speed;
        }
    }

    setText() {
        this.text = `${this.score}`;
    }

    resetPos() {
        this.mesh.position.copy(this.initial);
    }
}

export class LocalPlayer extends BasicPlayer {

    constructor(dict, limits, scene, role, name, position, rotationX = 0, rotationY = 0, rotationZ = 0) {
        super(dict, limits, scene, role, name, position, rotationX, rotationY, rotationZ)
        this.setText();
        this.setupText();
        this.drawGeometry();
        this.drawPaddle();
    }

    setupText() {
        const textGeo = this.createTextGeometry(this.text, text.fonts['roboto'], TEXT_PARAMS);
        this.textMesh = new THREE.Mesh(textGeo, new THREE.MeshStandardMaterial({ color: paddle.color }));
        const geoName = this.createTextGeometry(this.name, text.fonts['roboto'], TEXT_PARAMS_NAME);
        this.textName = new THREE.Mesh(geoName, new THREE.MeshStandardMaterial({ color: paddle.color }));
        this.textMesh.castShadow = true;
        this.textMesh.receiveShadow = true;
        this.textMesh.position.set(field.x + 3, 8, (this.limits.y - 5) * this.role);
        this.textName.castShadow = true;
        this.textName.receiveShadow = true;
        this.textName.position.set(field.x + 3, 12, (this.limits.y - 7) * this.role);
        this.scene.add(this.textMesh, this.textName);
    }

    getType() {
        return ("localfinish");
    }
}

export class AIPlayer extends BasicPlayer {

    constructor(dict, limits, scene, role, name, position, rotationX = 0, rotationY = 0, rotationZ = 0) {
        super(dict, limits, scene, role, name, position, rotationX, rotationY, rotationZ);
        
        this.setText();
        this.setupText();
        this.drawGeometry();
        this.drawPaddle();
    }

    setupText() {
        const textGeo = this.createTextGeometry(this.text, text.fonts['roboto'], TEXT_PARAMS);
        this.textMesh = new THREE.Mesh(textGeo, new THREE.MeshStandardMaterial({ color: paddle.color }));
        this.textMesh.castShadow = true;
        this.textMesh.receiveShadow = true;
        this.textMesh.position.set(0, 3, (this.limits.y + 5) * this.role);
        this.scene.add(this.textMesh);
    }

    hide() {
        this.textMesh.visible = false;
    }

    show() {
        this.textMesh.visible = true;
    }

    setText() {
        this.text = `${this.name} - ${this.score}`;
        if (this.role === 1) {
            this.text = this.dict['you'] + ` - ${this.score}`
        }
        return (this.text);
    }

    getType() {
        return ("aifinish");
    }
}

export class AIController {
    constructor(paddle, target, limits, difficulty) {
        this.paddle = paddle;
        this.target = target;
        this.time = 0;
        this.targetX = this.paddle.mesh.position.x;
        this.lastUpdateTime = 0;
        this.maxSpeed = paddle.speed;
        this.limits = limits;
        this.difficulty = difficulty; // 0.5-1 => easy, 3 => already low chance for ai to lose, 5 => almost impossible; 
        this.errorRange = (limits.x / 10) * (2 / this.difficulty); 
    }

    update(elapsedTime) {
        if (elapsedTime - this.lastUpdateTime >= 1 ) {
            this.doMovesAI();
            this.lastUpdateTime = elapsedTime;
        }
        this.checkIfAIneedStop();
        this.paddle.move();
    }

    getTimeToTopBottom(yspeed, y) {
        if (yspeed > 0) {
            // Ball is moving up → Time to reach the top wall (15)
            return (this.limits.x - y - this.target.radius) / yspeed;
        } else {
            // Ball is moving down → Time to reach the bottom wall (-15)
            return (y + this.limits.x - this.target.radius) / -yspeed;
        }
    }
    
    // when the ball will hit the left or right walls
    getTimeToLeftRight(xspeed, x) {
        if (xspeed > 0) {
            // Ball is moving right → Time to reach the right wall
            return (this.limits.y - 2 - x - this.target.radius) / xspeed; // right wall
        } else {
            // Ball is moving left → Time to reach the left wall
            return (x + this.limits.y - 2 - this.target.radius) / -xspeed; // left wall
        }             
    }
    
    // ball.zspeed > 0 => right, < 0 => left
    // ball.xspeed > 0 => down, < 0 => up
    predictBallX() {
        let tempZ = this.target.mesh.position.z;
        let tempX = this.target.mesh.position.x;
        let tempZspeed = this.target.velocity.z;
        let tempXspeed = this.target.velocity.x;

        // if the ball is going toward opposite wall => return random just for moving & replicating human behaviour
        if (tempZspeed > 0)
            return Math.floor(Math.random() * (this.limits.x * 2 + 1)); //null;

        let timeToTopBottom = this.getTimeToTopBottom(tempXspeed, tempX);
        let timeToLeftRight = this.getTimeToLeftRight(tempZspeed, tempZ);

        while (timeToTopBottom < timeToLeftRight) {
            tempZ = tempZ + tempZspeed * timeToTopBottom;
            if (tempXspeed < 0) {
                tempX = -Math.abs(this.limits.x) + this.target.radius;
            } else {
                tempX = Math.abs(this.limits.x) - this.target.radius;
            }
            tempXspeed = -tempXspeed;
    
            timeToTopBottom = this.getTimeToTopBottom(tempXspeed, tempX);
            timeToLeftRight = this.getTimeToLeftRight(tempZspeed, tempZ);
        }
    
        tempX = tempX + tempXspeed * timeToLeftRight;
    
        let error = Math.random() * this.errorRange - this.errorRange ;/// 2;  // Random error between ±errorRange/2
        return Math.max(-this.limits.x, Math.min(this.limits.x, tempX + error));
    }

    doMovesAI() {
        this.targetX = this.predictBallX();
        if (this.targetX === null)   return;

        if (this.targetX  < this.paddle.mesh.position.x - paddle.length / 2) {
            this.paddle.up = false;
            this.paddle.down = true;
        } else if (this.targetX  > this.paddle.mesh.position.x + paddle.length / 2) {
            this.paddle.down = false;
            this.paddle.up = true;
        } else {
            this.paddle.up = false;
            this.paddle.down = false;
        }
    }
    
    checkIfAIneedStop() {
        if (this.targetX) {
            if (this.paddle.up && this.paddle.mesh.position.x + (paddle.length / 2) >= this.targetX) {
                this.paddle.up = false;
            } else if (this.paddle.down && this.paddle.mesh.position.x - (paddle.length / 2) <= this.targetX) {
                this.paddle.down = false;
            }
        }
    }
}

export class OnlinePlayer extends BasicPlayer {
    constructor(data, dict, limits, scene, role, name, position, rotationX = 0, rotationY = 0, rotationZ = 0) {
        super(dict, limits, scene, role, name, position, rotationX, rotationY, rotationZ);
        this.backY = (limits.x * 2) / data.canvasY / 10;
        this.width = limits.y * 2 * data.padW / data.canvasX;
        this.height = limits.x * 2 * data.padH / data.canvasY;
        this.initial.z = position.z - (this.role * this.width / 2);
        this.speed = data.padS * limits.x * 2;
        this.backendRole = name;
        this.drawGeometry();
        this.drawPaddle();
        // console.log(`Creating paddles, position x ${this.mesh.position.z}, y ${this.mesh.position.x}`)
        
    }

    setupText() {
        const textGeo = this.createTextGeometry(this.text, text.fonts['roboto'], TEXT_PARAMS);
        this.textMesh = new THREE.Mesh(textGeo, new THREE.MeshStandardMaterial({ color: paddle.color }));
        const geoName = this.createTextGeometry(this.name, text.fonts['roboto'], TEXT_PARAMS_NAME);
        this.textName = new THREE.Mesh(geoName, new THREE.MeshStandardMaterial({ color: paddle.color }));
        this.textMesh.castShadow = true;
        this.textMesh.receiveShadow = true;
        this.textMesh.position.set(field.x + 3, 8, (this.limits.y - 5) * this.role);
        this.textName.castShadow = true;
        this.textName.receiveShadow = true;
        this.textMesh.visible = false;
        this.textName.visible = false;
        this.textName.position.set(field.x + 3, 12, (this.limits.y - 7) * this.role);
        // console.log("GEOMETRY TEXT CREATED");
        this.scene.add(this.textMesh, this.textName);
    }

    setName(name) {
        this.name = name;
        this.updateName();
    }

    updateName() {
        this.textName.geometry.dispose();
        this.textName.geometry = this.createTextGeometry(this.name, text.fonts['roboto'], TEXT_PARAMS);
        
        this.textName.castShadow = true;
        this.textName.receiveShadow = true;
        this.textName.geometry.getAttribute('position').needsUpdate = true;
    }

    update(newY, newScore) {
		this.mesh.position.x = this.convertXFromBack(newY);
        // console.log(`Update position: ${this.mesh.position.x}, from back newY: ${newY}`);
        if (this.score != newScore) {
		    this.score = newScore;
            this.updateGeo(this.setText());
        }

	}

    resetAll() {
        this.score = 0;
        this.name = "";
        this.setText();1
        this.updateGeo();
        this.updateName();
        this.resetPos();
        this.hide();
    }

    move(socket) {
		const oldY = this.mesh.position.x;
        // console.log(` ${this.down}, mesh pos is ${this.mesh.position.x - paddle.length / 2}, limits are ${this.limits.x * -1 + 0.5}`)
        if (this.down && ((this.mesh.position.x - this.height / 2) > (this.limits.x * -1 + 0.25))) {
            // console.log(`${this.name} ${this.backendRole} ${this.mesh.position.z} Move down position: ${this.mesh.position.x}`);
            this.mesh.position.x -= this.speed;
        }
        if (this.up && (this.mesh.position.x + this.height / 2) < this.limits.x - 0.25) {
            // console.log(`${this.name} ${this.backendRole} ${this.mesh.position.z} Move up position: ${this.mesh.position.x}`);
            this.mesh.position.x += this.speed;
        }
		if (socket.readyState === WebSocket.OPEN && this.mesh.position.x != oldY) {
			// console.log(`sending position after move: ${this.mesh.position.x}`);
            this.send(socket);
        }
	}

    send(socket) {
		if (socket.readyState === WebSocket.OPEN)
		{
            
            //console.log("front y: " + this.y + " backFactor: " + this.backFactor);
			// console.log(`${this.backendRole}'s paddle: ${this.mesh.position.x} converted: ${this.convertXToBack(this.mesh.position.x)}`);
            // console.log(`sending: ${this.backendRole}, ${this.name}, ${this.convertXToBack(this.mesh.position.x) }`);
			const data = {
				"type": "update",
				"role": this.backendRole,
				"y": this.convertXToBack(this.mesh.position.x),
				"score": this.score,
			};
			socket.send(JSON.stringify(data));
		}
	}

    convertXFromBack(backY) {
        return (this.limits.x  - backY * this.limits.x * 2);
    }
    convertXToBack(frontY) {
        return ((this.limits.x - frontY) / (this.limits.x * 2));
    }

    drawGeometry() {
        this.geometry =  new RoundedBoxGeometry(this.height, this.width, this.width, 1);
        this.helperGeo = new RoundedBoxGeometry(this.height + 0.1, this.width, this.width + ballParams.radius, 1)
    } 
}
