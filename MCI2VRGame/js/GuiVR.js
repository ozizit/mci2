

// Simple graphical user interface for VR.

import * as THREE from '../extern/three.module.js';

// List of active gui_elements to test interaction against.
const guiElements = [];


// Takes a THREE.Raycaster and determines the first GuiVR element that
// intersets with the ray.  The collide function of that element is
// called with the uv and world coordinates of the intersection point.
export function intersectObjects(raycaster){

    // Determine all the colliders for all elements.
    var colliders = [];
    for (var i = 0; i < guiElements.length; i++){
	colliders.push(guiElements[i].collider);
    }

    // Determine the elements hit by the ray.
    var intersections = raycaster.intersectObjects(colliders);

    // Call the collide function of the first element hit.
    if (intersections.length > 0) {
	var intersection = intersections[0];
	var object = intersection.object;
	for (var i = 0; i < guiElements.length; i++){ 
	    if (guiElements[i].collider == object){
		guiElements[i].collide(intersection.uv, intersection.point);
		return guiElements[i];
	    }
	}
    }
}


// Abstract class for GuiVR 
export class GuiVR extends THREE.Group {

    constructor(){
	super();
	if (new.target === GuiVR) {
	    throw new TypeError("GuiVR is abstract class and cannot be instantiated.");
	}
	this.collider = undefined;
	guiElements.push(this);
    }
    
}

const epsilon = 0.03;

// Class for VR representation of sliding menu button, not intended to
// used outside of a GuiVRMenu.
export class GuiVRButton extends THREE.Group {

    // Creates a new menu button with the provided string label Has an
    // initial value initVal and ranges between minVal and maxVal.
    // isInt should be set to true of the value is integer.
    // updateCallback is called to report a value entered.
    // updateCallback is called once by this constructor and then each
    // time the value changes.
    constructor(label, initVal, minVal, maxVal, isInt, updateCallback){
	super();

	this.label = label;
	this.val = initVal;
	this.minVal = minVal;
	this.maxVal = maxVal;
	this.isInt = isInt;
	this.updateCallback = updateCallback;

	this.updateCallback(this.val);
	
	this.w = 1;
	this.h = 0.2;
	// Create canvas that will display the button.
	this.ctx = document.createElement('canvas').getContext('2d');
	this.ctx.canvas.width = 512;
	this.ctx.canvas.height = Math.floor(this.ctx.canvas.width * this.h / this.w);
	// Create texture from canvas.
	this.texture = new THREE.CanvasTexture(this.ctx.canvas);
	this.texture.magFilter = THREE.LinearFilter;
	this.texture.minFilter = THREE.LinearFilter;
	this.updateTexture();
	this.meshMaterial = new THREE.MeshBasicMaterial({color: 0xAAAAAA});
	this.meshMaterial.map = this.texture;
	// Create rectangular mesh textured with the button that is displayed.
	this.mesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(this.w, this.h), this.meshMaterial);
	this.add(this.mesh);
    }

    // Update the display of the button according to the current value.
    updateTexture(){
	var ctx = this.ctx;
	// Clear canvas.
	ctx.fillStyle = '#000000';
	ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
	ctx.fillStyle = '#555753';
	ctx.fillRect(3, 3, ctx.canvas.width-6, ctx.canvas.height-6);
	// Display label.
	ctx.font = "50px Arial";
	ctx.fillStyle = '#729FCF';
	ctx.textAlign = "left";
	ctx.strokeText(this.label, 15, ctx.canvas.height/1.5);
	ctx.fillText(this.label, 15, ctx.canvas.height/1.5);
	// Display slider at current value.
	var intervalWidth = 1 / (this.maxVal - this.minVal);
	var width = Math.floor((this.val - this.minVal) * intervalWidth * (Math.floor(ctx.canvas.width/2) - 3));
	ctx.fillStyle = '#729FCF';
	ctx.fillRect(Math.floor(ctx.canvas.width/2), 3, width, ctx.canvas.height - 6);
	ctx.fillStyle = '#000000';
	ctx.fillRect(Math.floor(ctx.canvas.width/2)-6, 3, 6, ctx.canvas.height - 6);
	// Display current value.
	ctx.fillStyle = '#FFFFFF';
	ctx.textAlign = "right";
	if (this.isInt) {
	    ctx.fillText(this.val, ctx.canvas.width - 15, ctx.canvas.height/1.5);
	} else {
	    ctx.fillText(this.val.toFixed(2), ctx.canvas.width - 15, ctx.canvas.height/1.5);
	}
	this.texture.needsUpdate = true;

    }

    // Click handler.  Determines whether slider is hit and if so
    // computes new value.  The updateCallback is called to report the
    // value is modified.
    collide(uv, pt){
	val = 0;
	if (uv.x < 0.50 - epsilon)
	    // Doesn't hit slider.
	    return;
	if (uv.x < 0.5) {
	    // Extra space to select minVal.
	    val = this.minVal;
	} else if (uv.x > 1 - epsilon){
	    // Extra space to select maxVal.
	    val = this.maxVal;
	} else {
	    // Hit slider.
	    
	    // Determine amount selected.
	    var alpha = Math.min((uv.x - 0.5)/(0.5 - epsilon/2), 1);

	    // Compute value at selection.
	    var val = 0;
	    if (this.isInt){
		var intervalWidth = 1 / (this.maxVal - this.minVal + 1);
		val = Math.floor(alpha / intervalWidth) + this.minVal;
	    } else {
		val = alpha * (this.maxVal - this.minVal) + this.minVal;
	    }
	}

	// Update value and call updateCallback if necessary.
	if (val != this.val){
	    this.val = val;
	    this.updateCallback(this.val);
	    this.updateTexture();
	}
    }
}

// Class for VR representation of a menu.
export class GuiVRMenu extends GuiVR {

    // Creates a new menu with the specified buttons.
    constructor(buttonList){
	super();

	this.w = 0;
	this.h = 0;
	this.buttonList = [];
	this.matrixRel = undefined;
	// Determine the total dimensions.
	for (var i = 0; i < buttonList.length; i++){
	    var button = buttonList[i];
	    this.h += button.h;
	    this.w = Math.max(this.w, button.w);
	}

	// Position buttons and add to this group.
	var h = 0;
	for (var i = 0; i < buttonList.length; i++){
	    var button = buttonList[i]
	    this.add(button);
	    this.buttonList.push(button);
	    button.position.y = this.h/2 - h - button.h/2;
	    button.position.z += 0.01;
	    h += button.h;
	}

	// Create a collider.
	this.collider = new THREE.Mesh(new THREE.PlaneBufferGeometry(this.w, this.h),
				       new THREE.MeshBasicMaterial({color: 0x000000}));
	this.add(this.collider);
	
    }

    // Click handler.  Determine which button is hit and then calls
    // that button's collide.
    collide(uv, pt){

	var v = 1;

	// Loop over the button locations.
	for (var i = 0; i < this.buttonList.length; i++){
	    var vNext = v - this.buttonList[i].h / this.h; // uv coords have y inverted.

	    if (uv.y > vNext) {
		var uvNew = {x: uv.x, y: (uv.y - vNext)/this.buttonList[i].h}
		this.buttonList[i].collide(uvNew, pt);
		return;
	    }
	    
	    v = vNext;
	}
	
    }

    // Causes the object to follow the specified matrixWorld relative
    // to the menu's relative position when this function is first
    // called.
    follow(matrixWorld){
	// Compute the current world pose to use as the relative pose
	// for this and future calls to follow.
	if (this.matrixRel == undefined){
	    this.updateMatrixWorld();
	    this.matrixRel = this.matrixWorld.clone();
	}

	// Determine the pose to move to relative to matrixWorld.
	var tempMatrix = new THREE.Matrix4().identity();
	tempMatrix.multiplyMatrices(matrixWorld, this.matrixRel);
	
	var pos = new THREE.Vector3();
	var quat = new THREE.Quaternion();
	var scale = new THREE.Vector3();
	tempMatrix.decompose(pos, quat, scale);

	// Update pose.
	this.position.copy(pos);
	this.quaternion.copy(quat);
	this.updateMatrix();
	
    }

    
}


