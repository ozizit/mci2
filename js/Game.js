

import * as THREE from '../extern/three.module.js';
import * as USER from './User.js';
import * as GUIVR from './GuiVR.js';
import {GLTFLoader} from '../extern/GLTFLoader.js';


// copy of GUIVr.GuiVRButton with increased width
class MyGuiVRButton extends GUIVR.GuiVRButton {
  constructor(label, initVal, minVal, maxVal, isInt, updateCallback) {
    super(label, initVal, minVal, maxVal, isInt, updateCallback);

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
    this.ctx.canvas.width = 850;
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
}


class GameDoor extends GUIVR.GuiVR {
  constructor(userRig, gunModel, playButton, instructionsTextGroup, width, height, depth, offsetY, offsetZ, userOffsetZ, shootingAnimation) {
    super();
    this.userRig = userRig;
    this.gunModel = gunModel;
    this.playButton = playButton;
    this.instructionsTextGroup = instructionsTextGroup
    this.offsetY = offsetY;
    this.userOffsetZ = userOffsetZ;
    this.shootingAnimation = shootingAnimation;
    
    let door = new THREE.Mesh(
        new THREE.CubeGeometry(width, height, depth),
        new THREE.MeshPhongMaterial({color: 0x8b4513}));

    door.translateY(height / 2 + this.offsetY);
    door.translateZ(offsetZ);
    this.add(door);
    this.collider = door;
  }

  collide(uv, pt){
    // When the user clicks on this platform, move the user to it.
    let parent = this.userRig.parent;
    let controller = this.userRig.getController(0);
    if (parent !== this) {
      // on land
      if (parent instanceof USER.UserPlatform) {
        // call parent's onLeave()
        if (parent.onLeave != undefined) {
          parent.onLeave();
        }
      }

      this.prevParent = parent;
      this.prevPos = new THREE.Matrix4().copyPosition(this.userRig.matrixWorld);
      
      // reset relative position
      this.userRig.position.copy(new THREE.Vector3(0, 0, 0));
      
      // apply offsetZ
      this.userRig.translateZ(this.userOffsetZ);
      this.userRig.translateY(this.offsetY);
      
      this.add(this.userRig);

      // add gun model & animation
      controller.add(this.gunModel);
      controller.setAnimation(this.shootingAnimation);

      
    } else {
      // on leave
      this.playButton.val = 0;
      this.playButton.updateTexture();
      this.playButton.updateCallback(0);
      this.parent.add(this.instructionsTextGroup);

      // hide score
      this.parent.remove(this.parent.scoreTextGroup);

      // remove gun model & animation
      controller.remove(this.gunModel);
      controller.setAnimation(undefined);

      // move user back to previous position
      this.userRig.position.setFromMatrixPosition(this.prevPos)
      this.prevParent.add(this.userRig);
    }
  }
}

class Duck extends THREE.Group {
  constructor(triggerRadius, baseSpeed) {
    super();
    this.triggerRadius = triggerRadius;
    let speedMultiplier = 0.75 + 0.5 * Math.random();
    this.speed = speedMultiplier * baseSpeed;

    let loader = new GLTFLoader().setPath('extern/models/duck/');

    // Load a glTF resource
    loader.load(
      // resource URL
      'Duck.gltf',
      // called when the resource is loaded
      (gltf) => {
        gltf.scene.scale.set(0.1, 0.1, 0.1);
        const box = new THREE.Box3().setFromObject( gltf.scene );
        const center = box.getCenter( new THREE.Vector3() );
        gltf.scene.position.x += ( gltf.scene.position.x - center.x );
        gltf.scene.position.y += ( gltf.scene.position.y - center.y );
        gltf.scene.position.z += ( gltf.scene.position.z - center.z );

        this.add(gltf.scene);
      },
      // called while loading is progressing
      (xhr) => {
        console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );
      },
      // called when loading has errors
      (error) => {
        console.log( 'An error happened' );
        console.log(error);
      }
    );

    // create trigger
    let geometry = new THREE.SphereGeometry(this.triggerRadius, 32, 32);
    let material = new THREE.MeshPhongMaterial({color: 0xff0000});
    this.trigger = new THREE.Mesh(geometry, material);
    material.transparent = true;
    material.opacity = 0.0;
    this.add(this.trigger);
  }

  hit() {
    this.parent.remove(this);
  }
}


class DuckRig extends THREE.Group {
  constructor(triggerRadius, duckBaseSpeed, ducksAmt) {
    super();
    this.triggerRadius = triggerRadius;
    this.duckBaseSpeed = duckBaseSpeed;
    this.ducksAmt = ducksAmt;

    this.ducks = [];

    this.START_X = -1;
    this.END_X = 1;

    this.boundaries = new THREE.Group();

    this.reset();
  }

  start() {
    for (let i = 0; i < this.ducks.length; ++i) {
      let duck = this.ducks[i];
      duck.setAnimation((dt) => {
        duck.translateX(duck.speed);
        if (duck.position.x >= this.END_X) {
          duck.position.set(this.START_X, (4 * i + 1) * this.triggerRadius, 0);
        }
      });
    }
  }

  reset() {
    this.BOUNDARY_HEIGHT = 4 * this.triggerRadius * this.ducksAmt;

    this.BOUNDARY_HEIGHT = 4 * this.triggerRadius * this.ducksAmt;
    this.BOUNDARY_DIM = 0.05

    this.remove(this.boundaries);
    this.boundaries = new THREE.Group();

    let leftBoundary = new THREE.Mesh(
      new THREE.CubeGeometry(this.BOUNDARY_DIM, this.BOUNDARY_HEIGHT, this.BOUNDARY_DIM),
      new THREE.MeshPhongMaterial({color: 0x424242})
    );
    leftBoundary.translateX(this.START_X - this.triggerRadius);
    leftBoundary.translateY(this.BOUNDARY_HEIGHT / 2)

    let rightBoundary = new THREE.Mesh(
      new THREE.CubeGeometry(this.BOUNDARY_DIM, this.BOUNDARY_HEIGHT, this.BOUNDARY_DIM),
      new THREE.MeshPhongMaterial({color: 0x424242})
    );
    rightBoundary.translateX(this.END_X + this.triggerRadius);
    rightBoundary.translateY(this.BOUNDARY_HEIGHT / 2)

    let topBoundary = new THREE.Mesh(
      new THREE.CubeGeometry(this.END_X - this.START_X + 2 * this.triggerRadius + this.BOUNDARY_DIM, this.BOUNDARY_DIM, this.BOUNDARY_DIM),
      new THREE.MeshPhongMaterial({color: 0x424242})
    );
    topBoundary.translateY(this.BOUNDARY_DIM / 2 + this.BOUNDARY_HEIGHT)

    this.boundaries.add(leftBoundary);
    this.boundaries.add(rightBoundary);
    this.boundaries.add(topBoundary);
    this.add(this.boundaries);

    let tmpDucks = Array.from(this.ducks);
    this.ducks = [];
    for (let i = 0; i < tmpDucks.length; ++i) {
      let duck = tmpDucks[i];
      this.remove(duck)
    }

    for (let i = 0; i < this.ducksAmt; ++i) {
      let d = new Duck(this.triggerRadius, this.duckBaseSpeed);
      this.ducks.push(d);
      d.position.set(this.START_X, (4 * i + 1) * this.triggerRadius, 0);
      this.add(d);
    }
  }
}

export class Game extends THREE.Group {
  constructor(userRig, relPos = new THREE.Vector3(0, 0, 0), relRot = new THREE.Vector3(0, 0, 0), ducksAmt = 5, duckBaseSpeed = 5, projRadius = 3, projSpeed = 1, projRateOfFire = 3) {
    super();
    this.userRig = userRig;
    this.relPos = relPos;
    this.relRot = relRot;
    this.ducksAmt = ducksAmt;
    this.duckBaseSpeed = duckBaseSpeed;
    this.projRadius = projRadius;
    this.projSpeed = projSpeed;
    this.projRateOfFire = projRateOfFire;
    
    this.FLOOR_WIDTH = 5;
    this.FLOOR_HEIGHT = 0.2;
    this.FLOOR_DEPTH  = 5;

    this.DOOR_WIDTH = 1;
    this.DOOR_HEIGHT = 2;
    this.DOOR_DEPTH = 0.1;

    this.WALL_HEIGHT = 4.5;
    this.WALL_DEPTH = 0.2
    
    this.STEP_DEPTH = 0.4;

    this.GAME_PLATFORM_DEPTH = 6.5;

    this.FRONT_WALL_COLOR = 0xc2c2c2; 
    
    this.WINDOW_WIDTH = 2;
    this.WINDOW_HEIGHT = 1;
    this.WINDOW_DEPTH = this.WALL_DEPTH;
    
    this.WINDOW_HEIGHT_BEGIN = 0.8 + this.FLOOR_HEIGHT;
    this.WINDOW_HEIGHT_END = this.WINDOW_HEIGHT_BEGIN + this.WINDOW_HEIGHT;
    this.WINDOW_DEPTH_BEGIN = -this.FLOOR_DEPTH + this.WINDOW_DEPTH;
    this.WINDOW_DEPTH_END = this.WINDOW_DEPTH_BEGIN - this.WINDOW_DEPTH;

    this.DUCK_TRIGGER_RADIUS = 0.1;

    this.DUCKS_AMT = ducksAmt;
    this.DUCK_BASE_SPEED = duckBaseSpeed;
    this.PROJ_RADIUS = projRadius;
    this.PROJ_SPEED = projSpeed;
    this.PROJ_RATE_OF_FIRE = projRateOfFire;

    this.projectiles = [];
    this.backWall = new THREE.Group();
    this.scoreTextGroup = new THREE.Group();
    this.score = 0;
    this.clock = new THREE.Clock();

    this.rotateX(this.relRot.x);
    this.rotateY(this.relRot.y);
    this.rotateZ(this.relRot.z);

    this.translateX(this.relPos.x);
    this.translateY(this.relPos.y);
    this.translateZ(this.relPos.z);

    this.gunModel = new THREE.Group();
    let loader = new GLTFLoader().setPath('extern/models/gun/');

    // Load a glTF resource
    loader.load(
      // resource URL
      'scene.gltf',
      // called when the resource is loaded
      (gltf) => {
        gltf.scene.scale.set(0.003, 0.003, 0.003);
        const box = new THREE.Box3().setFromObject( gltf.scene );
        const center = box.getCenter( new THREE.Vector3() );
        gltf.scene.position.x += ( gltf.scene.position.x - center.x );
        gltf.scene.position.y += ( gltf.scene.position.y - center.y );
        gltf.scene.position.z += ( gltf.scene.position.z - center.z );

        this.gunModel.add(gltf.scene);
        this.gunModel.translateX(-0.01);
        this.gunModel.translateY(0.08);
        this.gunModel.translateZ(-0.13);
        this.gunModel.rotateY(-Math.PI / 2);
      },
      // called while loading is progressing
      (xhr) => {
        console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );
      },
      // called when loading has errors
      (error) => {
        console.log( 'An error happened' );
        console.log(error);
      }
    );

    this.buildGame();

    // Make GUI sign.
    this.signRig = new THREE.Group();
    let buttons = [
      new MyGuiVRButton('Fenster Groesse', this.WINDOW_HEIGHT, 0, 1.95, false, (x) => {
        this.WINDOW_HEIGHT = x;
        this.WINDOW_HEIGHT_END = this.WINDOW_HEIGHT_BEGIN + this.WINDOW_HEIGHT;
        this.buildBackWall();
      }),
      new MyGuiVRButton('Anzahl der Enten', this.DUCKS_AMT, 1, 10, true, (x) => {
          this.duckRig.ducksAmt = x;
          this.duckRig.reset();
      }),
      new MyGuiVRButton('Enten Geschw.', this.DUCK_BASE_SPEED, 1, 10, true, (x) => {
        this.duckRig.duckBaseSpeed = x / 200;
        this.duckRig.reset();
      }),
      new MyGuiVRButton('Projektil Radius', this.PROJ_RADIUS, 1, 5, true, (x) => {
          this.PROJ_RADIUS = x**2 / 100;
      }),
      new MyGuiVRButton('Projektil Geschw.', this.PROJ_SPEED, 1, 5, true, (x) => {
          this.PROJ_SPEED = 3 * x / 4;
      }),
      new MyGuiVRButton('Schussrate', this.PROJ_RATE_OF_FIRE, 1, 5, true, (x) => {
        this.PROJ_RATE_OF_FIRE = (210 - (35 + 25 * 1.1 * x)) / 10;
      }),
    ];

    let sign = new GUIVR.GuiVRMenu(buttons);
    sign.translateY(1);
    sign.translateZ(-this.FLOOR_DEPTH / 2)
    sign.rotateY(-Math.PI / 4);
    sign.translateZ(-2 * Math.sqrt(((this.FLOOR_DEPTH / 2)**2) + ((this.FLOOR_WIDTH / 2)**2)) / 3);
    sign.rotateY(-Math.PI / 4);
    sign.translateZ(-0.5);
    this.signRig.add(sign);

    this.playButton = new MyGuiVRButton('START/STOP', 0, 0, 1, true, (x) => {
      let controller = this.userRig.getController(0);
      if (this.pointer === undefined) {
        for (let child of controller.children) {
          if (child.name == 'pointer') {
            this.pointer = child;
            break;
          }
        }
      }

      if (x == 0) {
        this.add(this.signRig);
        controller.add(this.pointer);
        this.duckRig.reset();
        this.setAnimation(undefined);
      } else {
        this.clock.getDelta();
        this.remove(this.signRig);
        controller.remove(this.pointer);
        this.remove(this.instructionsTextGroup);
        this.duckRig.start();

        // hide score
        this.remove(this.scoreTextGroup);

        // collision detection
        this.setAnimation((dt) => {
          if (this.duckRig.ducks.length === 0) {
            let time = this.clock.getDelta();
            this.score = time.toFixed(0)

            this.playButton.val = 0;
            this.playButton.updateTexture();
            this.playButton.updateCallback(0);

            // show score
            this.showScore();
          }

          let tmpDucks = Array.from(this.duckRig.ducks);
          for (let i = 0; i < tmpDucks.length; ++i) {
            for (let j = 0; j < this.projectiles.length; ++j) {
              let duck = tmpDucks[i];
              let proj = this.projectiles[j];
              let duckPos = new THREE.Vector3().setFromMatrixPosition(duck.matrixWorld);
              let projPos = new THREE.Vector3().setFromMatrixPosition(proj.matrixWorld);

              if (duckPos.distanceTo(projPos) < this.DUCK_TRIGGER_RADIUS + this.PROJ_RADIUS) {
                duck.hit();
                this.duckRig.ducks.splice(this.duckRig.ducks.indexOf(duck), 1);
              }
            }
          }
        });
      }
    });

    this.playSignRig = new THREE.Group();
    let playSign = new GUIVR.GuiVRMenu([this.playButton]
    );

    playSign.translateY(1);
    playSign.translateZ(-this.FLOOR_DEPTH / 2)
    playSign.rotateY(Math.PI / 4);
    playSign.translateZ(-2 * Math.sqrt(((this.FLOOR_DEPTH / 2)**2) + ((this.FLOOR_WIDTH / 2)**2)) / 3);
    playSign.rotateY(Math.PI / 4);
    playSign.translateZ(-0.5);
    this.playSignRig.add(playSign);
    this.add(this.playSignRig);

    this.door = new GameDoor(this.userRig, this.gunModel, this.playButton, this.instructionsTextGroup, this.DOOR_WIDTH, this.DOOR_HEIGHT, this.DOOR_DEPTH, this.FLOOR_HEIGHT, -this.WALL_DEPTH / 2, -this.FLOOR_DEPTH + this.WALL_DEPTH + 0.5, (dt) => {
      let controller = this.userRig.getController(0);
      if (controller.t == undefined){
        controller.t = 0;
      }
      controller.t += dt;
      // Decide to fire.
      if (controller.triggered && (controller.t - controller.lastFire >= this.PROJ_RATE_OF_FIRE || controller.lastFire == undefined)){
        controller.lastFire = controller.t;
      
        // Create new projectile and set up motion.
        let proj = new THREE.Mesh(
          new THREE.SphereGeometry(this.PROJ_RADIUS, 20, 20),
          new THREE.MeshPhongMaterial({color: 0x00ff00})
        );
  

        proj.position.copy(this.userRig.position);
        proj.position.add(controller.position);
        controller.getWorldQuaternion(proj.quaternion);

        proj.translateY(0.12);
        proj.translateZ(-0.31);

        this.add(proj);
        this.projectiles.push(proj);

        proj.setAnimation(
          (dt) => {
            if (proj.t == undefined) {
              proj.t = 0;
            }
    
            proj.t += dt;
            proj.translateZ(-dt * this.PROJ_SPEED);
            // Cause the projectile to disappear after t is 20.
            if (proj.t > 20){
              this.remove(proj);
              this.projectiles.splice(this.projectiles.indexOf(proj), 1);
            }

            // detect backWall collision
            if ((proj.position.y - this.PROJ_RADIUS <= this.WINDOW_HEIGHT_BEGIN || proj.position.y + this.PROJ_RADIUS >= this.WINDOW_HEIGHT_END) && proj.position.z - this.PROJ_RADIUS <= this.WINDOW_DEPTH_BEGIN && proj.position.z + this.PROJ_RADIUS >= this.WINDOW_DEPTH_END) {
              this.remove(proj);
              this.projectiles.splice(this.projectiles.indexOf(proj), 1);
            }
          }
        );
      }
    });
    this.add(this.door);
  }

  buildGame() {
    // Build floor
    let platform = new THREE.Mesh(
        new THREE.CubeGeometry(this.FLOOR_WIDTH, this.FLOOR_HEIGHT, this.FLOOR_DEPTH),
        new THREE.MeshPhongMaterial({color: 0xd2d2d2}));

    platform.translateY(this.FLOOR_HEIGHT / 2);
    platform.translateZ(-this.FLOOR_DEPTH / 2);

    this.add(platform);

    // build front wall
    let frontWall = new THREE.Group();
    
    let leftFrontWall = new THREE.Mesh(
      new THREE.CubeGeometry(this.FLOOR_WIDTH / 2 - this.DOOR_WIDTH / 2, this.WALL_HEIGHT, this.WALL_DEPTH),
      new THREE.MeshPhongMaterial({color: this.FRONT_WALL_COLOR})
    );
    leftFrontWall.translateY(this.WALL_HEIGHT / 2);
    leftFrontWall.translateX(-this.FLOOR_WIDTH / 4 - this.DOOR_WIDTH / 4);
    
    let rightFrontWall = new THREE.Mesh(
      new THREE.CubeGeometry(this.FLOOR_WIDTH / 2 - this.DOOR_WIDTH / 2, this.WALL_HEIGHT, this.WALL_DEPTH),
      new THREE.MeshPhongMaterial({color: this.FRONT_WALL_COLOR})
    );
    rightFrontWall.translateY(this.WALL_HEIGHT / 2);
    rightFrontWall.translateX(this.FLOOR_WIDTH / 4 + this.DOOR_WIDTH / 4);

    let frontWallFill = new THREE.Mesh(
      new THREE.CubeGeometry(this.DOOR_WIDTH, this.WALL_HEIGHT - this.DOOR_HEIGHT, this.WALL_DEPTH),
      new THREE.MeshPhongMaterial({color: this.FRONT_WALL_COLOR})
    );
    frontWallFill.translateY((this.WALL_HEIGHT - this.DOOR_HEIGHT) / 2 + this.DOOR_HEIGHT);

    let step = new THREE.Mesh(
      new THREE.CubeGeometry(this.DOOR_WIDTH, this.FLOOR_HEIGHT, this.STEP_DEPTH),
      new THREE.MeshPhongMaterial({color: 0x999999})
    )
    step.translateY(this.FLOOR_HEIGHT / 2);
    step.translateZ(this.STEP_DEPTH / 2);

    frontWall.add(leftFrontWall);
    frontWall.add(rightFrontWall);
    frontWall.add(frontWallFill);
    frontWall.translateY(this.FLOOR_HEIGHT);
    frontWall.translateZ(-this.WALL_DEPTH / 2);
    this.add(frontWall);

    this.add(step);

    // build side walls
    for (let i = 0; i < 2; ++i) {
      let sideWall = new THREE.Mesh(
        new THREE.CubeGeometry(this.FLOOR_DEPTH - 2 * this.WALL_DEPTH + this.WALL_DEPTH, this.WALL_HEIGHT, this.WALL_DEPTH),
        new THREE.MeshPhongMaterial({color: 0xc2c2c2})
      );
      sideWall.translateY(this.WALL_HEIGHT / 2 + this.FLOOR_HEIGHT);
      sideWall.rotateY((-1)**i * Math.PI / 2);
      sideWall.translateZ(-this.FLOOR_WIDTH / 2 + this.WALL_DEPTH / 2);
      sideWall.translateX((-1)**i * (this.FLOOR_DEPTH / 2 + this.WALL_DEPTH / 2));
  
      this.add(sideWall);
    }

    this.buildBackWall();
    
    this.duckRig = new DuckRig(this.DUCK_TRIGGER_RADIUS, this.DUCK_BASE_SPEED, this.DUCKS_AMT);
    this.duckRig.translateY(this.FLOOR_HEIGHT);
    this.duckRig.translateZ(-10);
    this.add(this.duckRig);

    let topWall = new THREE.Mesh(
      new THREE.CubeGeometry(this.FLOOR_WIDTH, this.FLOOR_HEIGHT, this.FLOOR_DEPTH),
      new THREE.MeshPhongMaterial({color: 0xd2d2d2})
    )
    topWall.translateY(3 * this.FLOOR_HEIGHT / 2 + this.WALL_HEIGHT);
    topWall.translateZ(-this.FLOOR_DEPTH / 2);
    this.add(topWall);

    let gameBottomPlatform = new THREE.Mesh(
      new THREE.CubeGeometry(this.FLOOR_WIDTH, this.FLOOR_HEIGHT, this.GAME_PLATFORM_DEPTH),
      new THREE.MeshPhongMaterial({color: 0xd2d2d2})
    )
    gameBottomPlatform.translateY(this.FLOOR_HEIGHT / 2);
    gameBottomPlatform.translateZ(-this.GAME_PLATFORM_DEPTH / 2 - this.FLOOR_DEPTH);
    this.add(gameBottomPlatform);

    let gameTopPlatform = new THREE.Mesh(
      new THREE.CubeGeometry(this.FLOOR_WIDTH, this.FLOOR_HEIGHT, this.GAME_PLATFORM_DEPTH),
      new THREE.MeshPhongMaterial({color: 0xd2d2d2})
    )
    gameTopPlatform.translateY(3 * this.FLOOR_HEIGHT / 2 + this.WALL_HEIGHT);
    gameTopPlatform.translateZ(-this.GAME_PLATFORM_DEPTH / 2 - this.FLOOR_DEPTH);
    this.add(gameTopPlatform);

    for (let i = 0; i < 2; ++i) {
      let gameSideWall = new THREE.Mesh(
        new THREE.CubeGeometry(this.GAME_PLATFORM_DEPTH - this.WALL_DEPTH, this.WALL_HEIGHT, this.WALL_DEPTH),
        new THREE.MeshPhongMaterial({color: 0xd2d2d2})
      );
      gameSideWall.translateY(this.WALL_HEIGHT / 2 + this.FLOOR_HEIGHT);
      gameSideWall.rotateY((-1)**i * Math.PI / 2);
      gameSideWall.translateZ(-this.FLOOR_WIDTH / 2 + this.WALL_DEPTH / 2);
      gameSideWall.translateX((-1)**i * ((this.GAME_PLATFORM_DEPTH - this.WALL_DEPTH) / 2 + this.FLOOR_DEPTH));
  
      this.add(gameSideWall);
    }

    let gameBackWall = new THREE.Mesh(
      new THREE.CubeGeometry(this.FLOOR_WIDTH, this.WALL_HEIGHT, this.WALL_DEPTH),
      new THREE.MeshPhongMaterial({color: 0xa2a2a2})
    )
    gameBackWall.translateY((this.WALL_HEIGHT) / 2 + this.FLOOR_HEIGHT);
    gameBackWall.translateZ(-this.WALL_DEPTH / 2 - this.FLOOR_DEPTH - this.GAME_PLATFORM_DEPTH + this.WALL_DEPTH);
    this.add(gameBackWall);

    // door tip text
    let doorTipTextGroup = new THREE.Group();
    doorTipTextGroup.add(new THREE.Mesh(
      new THREE.CubeGeometry(1.4, 0.7, 0.01),
      new THREE.MeshBasicMaterial({color: 0xffffff})
    ));
    doorTipTextGroup.translateZ(0.02);
    doorTipTextGroup.translateY(1.3);
    doorTipTextGroup.translateX(-1.5);
    this.add(doorTipTextGroup);

    // instructions text
    this.instructionsTextGroup = new THREE.Group();
    this.instructionsTextGroup.add(new THREE.Mesh(
      new THREE.CubeGeometry(this.FLOOR_WIDTH - 10 * this.WALL_DEPTH, this.WALL_HEIGHT - 17 * this.FLOOR_HEIGHT, 0.01),
      new THREE.MeshBasicMaterial({color: 0xffffff})
    ));
    this.instructionsTextGroup.translateZ(-9);
    this.instructionsTextGroup.translateY(this.FLOOR_HEIGHT + this.WALL_HEIGHT / 2);
    this.add(this.instructionsTextGroup);

    let fontLoader = new THREE.FontLoader();
    fontLoader.load('extern/fonts/helvetiker_bold.typeface.json', (font) => {
        let geometry = new THREE.TextBufferGeometry('Klicke auf die braune Tuer,\num Entenjagd VR zu starten.\nViel Spass!', {
            font: font,
            size: 0.06,
            height: 0.001,
            curveSegments: 3,
        });
        geometry.center();
        let material = new THREE.MeshBasicMaterial({color: 0x000000});
        let text = new THREE.Mesh(geometry, material);
        text.translateZ(0.02);
        doorTipTextGroup.add(text);

      geometry = new THREE.TextBufferGeometry('Willkommen!\nEs gibt 2 Menues - Links von dir: Start/Stoppe das Spiel\nRechts von dir: aendere die Spieleinstellungen.\nZiel: treffe alle sich bewegenden Enten! \nMit dem rechten Controller wird geschossen\nund deine Zeit wird am Ende angezeigt.\nReminder: du kannst das Spiel jederzeit mit der Tuere hinter dir verlassen.', {
          font: font,
          size: 0.06,
          height: 0.001,
          curveSegments: 3,
      });
      geometry.center();
      material = new THREE.MeshBasicMaterial({color: 0x000000});
      text = new THREE.Mesh(geometry, material);
      text.translateZ(0.02);
      this.instructionsTextGroup.add(text);
    });
  }

  buildBackWall() {
    // build back wall
    this.remove(this.backWall);
    this.backWall = new THREE.Group();

    let backWallUnder = new THREE.Mesh(
      new THREE.CubeGeometry(this.FLOOR_WIDTH - 2 * this.WALL_DEPTH, this.WINDOW_HEIGHT_BEGIN - this.FLOOR_HEIGHT, this.WINDOW_DEPTH),
      new THREE.MeshPhongMaterial({color: 0xb2b2b2})
    );
    backWallUnder.translateY((this.WINDOW_HEIGHT_BEGIN - this.FLOOR_HEIGHT) / 2 + this.FLOOR_HEIGHT);

    let backWallAbove = new THREE.Mesh(
      new THREE.CubeGeometry(this.FLOOR_WIDTH - 2 * this.WALL_DEPTH, this.WALL_HEIGHT - this.WINDOW_HEIGHT - this.WINDOW_HEIGHT_BEGIN + this.FLOOR_HEIGHT, this.WINDOW_DEPTH),
      new THREE.MeshPhongMaterial({color: 0xb2b2b2})
    );
    backWallAbove.translateY((this.WALL_HEIGHT - this.WINDOW_HEIGHT - this.WINDOW_HEIGHT_BEGIN + this.FLOOR_HEIGHT) / 2 + this.WINDOW_HEIGHT_END);

    this.backWall.add(backWallUnder);
    this.backWall.add(backWallAbove);
    this.backWall.translateZ(-this.FLOOR_DEPTH + this.WINDOW_DEPTH / 2);
    this.add(this.backWall);
  }

  showScore() {
    // score text
    this.scoreTextGroup = new THREE.Group();
    this.scoreTextGroup.translateZ(-4.9);
    this.scoreTextGroup.translateY(1);
    this.scoreTextGroup.rotateX(-Math.PI / 2);
    this.add(this.scoreTextGroup);

    let fontLoader = new THREE.FontLoader();
    fontLoader.load('extern/fonts/helvetiker_bold.typeface.json', (font) => {
      let geometry = new THREE.TextBufferGeometry('Ergebnis in Sekunden: ' + this.score, {
          font: font,
          size: 0.06,
          height: 0.001,
          curveSegments: 3,
      });
      geometry.center();
      let material = new THREE.MeshBasicMaterial({color: 0xffffff});
      let text = new THREE.Mesh(geometry, material);
      text.translateZ(0.02);
      this.scoreTextGroup.add(text);
    });
  }
}
