

// Initializes scene, VR system, and event handlers.

import * as THREE from '../extern/three.module.js';
import { VRButton } from '../extern/VRButton.js';
import * as GUIVR from './GuiVR.js';
import * as ANIMATOR from './Animator.js';
import * as USER from './User.js';
import {Game} from './Game.js';

// Global variables for high-level program state.
let camera, scene, renderer;
let userRig; // rig to move the user
let animatedObjects = []; // List of objects whose animation function needs to be called each frame.

// Initialize THREE objects in the scene.
function initScene(userRig) {
  // Use canvas to create texture for holodeck-inspired walls.
  let ctx = document.createElement('canvas').getContext('2d');
  ctx.canvas.width = 512;
  ctx.canvas.height = 512;
  ctx.fillStyle = '#EDD400';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = '#000000';
  ctx.fillRect(3, 3, ctx.canvas.width-6, ctx.canvas.height-6);
  let wallTexture = new THREE.CanvasTexture(ctx.canvas);
  wallTexture.wrapS = THREE.RepeatWrapping;
  wallTexture.wrapT = THREE.RepeatWrapping;
  wallTexture.magFilter = THREE.LinearFilter;
  wallTexture.minFilter = THREE.LinearMipmapNearestFilter;
  wallTexture.repeat.set(100, 100);
  let wallMaterial = new THREE.MeshPhongMaterial();
  wallMaterial.map = wallTexture;

  // Create the floor.
  let floor = new THREE.Mesh(new THREE.PlaneBufferGeometry(100, 100), wallMaterial);
  floor.geometry.rotateX(THREE.Math.degToRad(-90));
  floor.geometry.translate(0,0,0);
  scene.add(floor)

  // Create a light in the room.
  let light = new THREE.PointLight(0xffffff, 0.5);
  light.position.y = 20;
  scene.add(light);
  scene.add(new THREE.AmbientLight(0xFFFFFF, 0.3));

  // Duckshooter settings
  let relativePosition = new THREE.Vector3(0, 0, -5);
  let relativeRotation = new THREE.Vector3(0, 0, 0);
  let amountOfDucks = 5;
  let duckBaseSpeed = 5;
  let projectileRadius = 3;
  let projectileSpeed = 2;
  let rateOfFire = 3;

  // Initialize Duckshooter
  let myGame = new Game(
    userRig,
    relativePosition,
    relativeRotation,
    amountOfDucks,
    duckBaseSpeed,
    projectileRadius,
    projectileSpeed,
    rateOfFire,
  );
  animatedObjects.push(myGame);
  scene.add(myGame);
}

function init() {
  // Set up renderer
  renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.setPixelRatio( window.devicePixelRatio );
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);
  renderer.setClearColor(0x00BFFF, 1);

  // Extra settings to enable shadows.
  renderer.shadowMap.enabled = true;
  renderer.shadowMapSoft = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Create a scene
  scene = new THREE.Scene();

  // Create the main camera.
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight,
           0.1, 50);
  camera.position.set(0, 1.6, 1);

  // Encapsulate user camera and controllers into a rig.
  userRig = new USER.UserRig(camera, renderer.xr);
  scene.add(userRig);

  // Create the contents of the room.
  initScene(userRig);

  // Add VR button.
  document.body.appendChild(VRButton.createButton(renderer));
  window.addEventListener('resize', onWindowResize, false);

  // Set handler for mouse clicks.
  window.onclick = onSelectStart;

  // Starts main rendering loop.
  renderer.setAnimationLoop(render);
}

// Event handler for controller clicks when in VR mode, and for mouse
// clicks outside of VR mode.
function onSelectStart(event) {
  if (event instanceof MouseEvent && !renderer.xr.isPresenting()) {
    // Handle mouse click outside of VR.
    // Determine screen coordinates of click.
    let mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
    // Create raycaster from the camera through the click into the scene.
    let raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    // Register the click into the GUI.
    GUIVR.intersectObjects(raycaster);
  }

}

// Update the camera aspect ratio when the window size changes.
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Updates world and renders one frame.
// Is repeatedly called by main rendering loop.
function render() {
  let dt = 0.1;
  // Force the gui to appear as heads up display tracking headset
  // position.
  for (let i = 0; i < animatedObjects.length; i++) {
    animatedObjects[i].animate(dt);
  }
  userRig.animate(dt);

  renderer.render(scene, camera);
}

// Main program.
// Sets up everything.
init();

