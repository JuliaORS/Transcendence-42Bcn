import * as THREE from "three";

import { TextGeometry } from '../three/examples/jsm/geometries/TextGeometry.js';
import { FontLoader } from '../three/examples/jsm/loaders/FontLoader.js';
import { params, field, textCount } from "./3DGame.js";
import { RoundedBoxGeometry } from '../three/examples/jsm/geometries/RoundedBoxGeometry.js'


export const textParams = {
    size: 1.5,
    depth: 0.5,
    curveSegments: 12,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 3
}

export const textWinner = {
    size: 1.7,
    depth: 0.5,
    curveSegments: 30,
}

export const fontPaths = {
    robotoThin: "../fonts/Roboto_Thin_Regular.json",
    robotoLight: "../fonts/Roboto_Light_Regular.json",
    roboto: "../fonts/Roboto_Regular.json",
    helvetica: "../three/examples/fonts/helvetiker_regular.typeface.json",

}

export class SceneText {

    constructor(scene, dict, tour, rotationX = 0, rotationY = 0, rotationZ = 0) {
        this.scene = scene;
        this.loader = new FontLoader();
        this.loadedBoldFont = null;
        this.fonts = null;
        this.dict = dict;
        this.tour = tour;
        this.rotationX = rotationX;
        this.rotationZ = rotationZ;
        this.rotationY = rotationY;
        this.group = new THREE.Group();
        scene.add(this.group);
        this.button = this.createButton();
        this.start = null;
        this.tryAgain = null;
        this.winnerMessage = null;
        this.countdownText = null;
        this.waiting = null;
        this.enemy = null;
        
        this.group.add(this.button);
        this.group.setRotationFromEuler(new THREE.Euler(this.rotationX, this.rotationY, this.rotationZ, "ZYX"));
    }

    createButton() {
        const buttonGeo = new RoundedBoxGeometry(15, 5, 3, field.radius, field.seg * 3); // Button size
        const buttonMat = new THREE.MeshPhongMaterial({ 
            color: params.buttonColor,
            specular: 0xFFFFFF, 
            shininess: 100,
            });
        const button = new THREE.Mesh(buttonGeo, buttonMat);
        if (this.tour)
            button.visible = false;
        button.position.set(0, params.textY, 0); // Adjust position in the scene
        return button;
    }

    async createText() {
        this.fonts = await this.loadFonts();
        this.start = this.createButtonText(this.dict['start'], this.fonts['robotoLight']);
        this.tryAgain = this.createButtonText(this.dict['try_again'], this.fonts['robotoLight']);
        this.tryAgain.visible = false;
        const textGeo = this.createTextGeometry("3", this.fonts['roboto'], textWinner);
        this.countdownText = new THREE.Mesh(textGeo, new THREE.MeshNormalMaterial());
        this.countdownText.position.set(0, params.textY, 0);
        this.countdownText.visible = false;
        const waitingGeo = this.createTextGeometry(this.dict['waiting_enemy'], this.fonts['robotoLight'], textWinner);
        this.waiting = new THREE.Mesh(waitingGeo, new THREE.MeshNormalMaterial());
        this.waiting.position.set(0, params.textY, 1.5);
        this.waiting.visible = false;
        const enemyGeo = this.createTextGeometry(this.dict['enemy_connected'], this.fonts['robotoLight'], textWinner);
        this.enemy = new THREE.Mesh(enemyGeo, new THREE.MeshNormalMaterial());
        this.enemy.position.set(0, params.textY, 1.5);
        this.enemy.visible = false;
        if (this.tour)
            this.start.visible = false;
        this.winnerMessage = this.createWinnerMessage("winner", this.fonts['robotoLight'])
        this.winnerMessage.visible = false;
        this.group.add(this.start, this.tryAgain, this.enemy, this.waiting, this.countdownText, this.winnerMessage);

    }

    async loadFonts() {
        const fonts = {};
        // Loop through each key/path and load the font
        await Promise.all(
          Object.entries(fontPaths).map(async ([fontName, path]) => {
            const font = await this.loadFont(path);
            fonts[fontName] = font;
          })
        );
        return fonts;
      }
    
    loadFont(path) {
        return new Promise((resolve, reject) => {
            this.loader.load(path, (font) => {
                // console.log("Font loaded");
                resolve(font);  // Resolve with the loaded font
            }, undefined, (error) => {
                console.error("Font loading failed", error);
                reject(error);  // Reject if there's an error
            });
        });
    }

    createButtonText(text, font) {
        const textGeo = this.createTextGeometry(text, font, textParams);
        const textMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const textMesh = new THREE.Mesh(textGeo, textMat);
        textMesh.position.set(0, params.textY, 1.5); // Center the text
        return textMesh;
    }

    createTextGeometry(msg, font, textParams) {
        const textGeo = new TextGeometry(msg, {
                font: font,
                ...textParams
        })
        textGeo.center();
        return textGeo;
    }

    createWinnerMessage(msg, font) {
        const textGeo = this.createTextGeometry(msg, font, textWinner);
        const textMat = new THREE.MeshNormalMaterial();
        const textMesh = new THREE.Mesh(textGeo, textMat);
        // textMesh.position.set(0, 3, (field.y + 10) );
        textMesh.position.set(0, params.textY + 5, 1.5); // Center the text
        return textMesh;

    }

    updateGeometry(mesh, msg, params) {
        mesh.geometry = this.createTextGeometry(msg, this.fonts['roboto'], params);
        mesh.geometry.getAttribute('position').needsUpdate = true;
    }
}
