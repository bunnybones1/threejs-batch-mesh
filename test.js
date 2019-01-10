var THREE = require("three");
var GLTFLoader = require("three-gltf-loader");
// require("./utils/threeSafety");
new (require("./SneakyOptimizations"))();
window.THREE = THREE;
var ManagedView = require("threejs-managed-view");
var BatchMesh = require("./");
var CheckerBoardTexture = require("threejs-texture-checkerboard");
var urlparam = require("urlparam");
var view = new ManagedView.View({
	skipFrames: 10
});

var RandomSeed = require("seed-random");

const seededRandom = new RandomSeed(urlparam("randomSeed", "test"));

var useBatching = urlparam("useBatching", true, true);

var debugOverdraw = false;
//lights
var light = new THREE.SpotLight(0xffffff, 0.7, 50, 45);

light.castShadow = true;

light.shadow = new THREE.LightShadow( new THREE.PerspectiveCamera( 50, 1, 1, 150 ) );
light.shadow.bias = -0.0001;

light.position.x += 100;
light.position.y += 100;
view.scene.add(light);
var hemisphereLight = new THREE.HemisphereLight(0x4f7f8f, 0x4f2f00);
if(urlparam("hemiLight", false)) {
	view.scene.add(hemisphereLight);
}
var checkerSizes = [4, 8, 12];
var colors = [0xff7f7f, 0x7fff7f, 0x7f7fff];
var matParams = {
	color: 0xffffff,
	emissive: 0x000000,
	// color: 0xff4422,
	shininess: 100,
	blending: debugOverdraw ? THREE.AdditiveBlending : THREE.NormalBlending
};

function getCheckerMaterial(color, checkerSize, doubleSided = false, checkerSize2 = undefined) {
	if(checkerSize2 === undefined) checkerSize2 = checkerSize;
	matParams.map = new CheckerBoardTexture(0xffffff, color, checkerSize, checkerSize2);
	matParams.side = doubleSided ? THREE.DoubleSide : THREE.FrontSide;
	// matParams.color = color;
	switch(urlparam("materialLevel", 3)) {
		case 0:
			return new THREE.MeshLambertMaterial(matParams);
		default:
			return new THREE.MeshPhongMaterial(matParams);
	}
}

var floor = new THREE.Mesh(new THREE.PlaneBufferGeometry(30, 30, 1, 1), getCheckerMaterial(0xff7f00, 10));
floor.receiveShadow = true;
floor.position.y = -5;
floor.rotation.x = Math.PI * -0.5;
view.scene.add(floor);

var wall = new THREE.Mesh(new THREE.PlaneBufferGeometry(3, 25, 1, 1), getCheckerMaterial(0x7fff00, 2, true, 12));
wall.receiveShadow = true;
wall.castShadow = true;
wall.position.x = -5;
wall.position.z = 5;
// wall.rotation.z = Math.PI * -0.3;
wall.rotation.x = Math.PI * 0.3;
wall.rotation.y = Math.PI;
wall.rotation.order = "YXZ";
view.scene.add(wall);

var wall2 = wall.clone();
wall2.rotation.order = "YXZ";
wall2.rotation.y += Math.PI;
view.scene.add(wall2);


var mats = colors.map((color, i) => {
	return getCheckerMaterial(color, checkerSizes[i]);
});

view.renderer.shadowMap.enabled = true;
view.renderer.shadowMap.type = THREE.PCFShadowMap;
view.renderer.setClearColor(debugOverdraw ? 0x000000 : 0xdfefef, 1);

var centerOfView = new THREE.Vector3();
var totalGeometry = urlparam("totalGeometry", 20, true);

function rand(scale = 10) { return (seededRandom() - 0.5) * scale; }
function randAngle(scale = 1) { return seededRandom() * Math.PI * 2; }
var euler = new THREE.Euler();
var quat = new THREE.Quaternion();
function randQuat(scale = 0.1) { 
	euler.set(rand(scale), rand(scale), rand(scale));
	quat.setFromEuler(euler);
	return quat;
}




function BatchCandidate(scene, material) {
    this.scene = scene;
    this.material = material;
    this.meshes = [];
    this.batch = null;
}

BatchCandidate.prototype.addMesh = function addMesh(mesh) {
    this.meshes.push(mesh);
    if(this.meshes.length > 1) {
        if(!this.batch) {
			this.batch = new BatchMesh(this.scene, this.material);
			this.batch.castShadow = true;
			this.batch.receiveShadow = true;
			this.batch.addToBatch(this.meshes[0]);
            _batches.push(this.batch);
            this.scene.add(this.batch);
        }
        this.batch.addToBatch(mesh);
    }
}


const _trackedMaterials = {};
const _batchCandidates = {};

const _batches = [];

function tryToBatch(child) {
	if(child instanceof THREE.Mesh && !(child instanceof BatchMesh)) {
		var key = child.material.id + ":" + Object.keys(child.geometry.attributes).join(",");
		if(!_trackedMaterials[key]) {
			_trackedMaterials[key] = child.material;
			_batchCandidates[key] = new BatchCandidate(view.scene, child.material);
		}
		_batchCandidates[key].addMesh(child);
	}
}

var balls = [];
function makeGeometry() {
	var geoms = [1, 2, 3, 1, 1, 2, 3].map(s => new THREE.SphereBufferGeometry(1, 4 * s, 3 * s)); //for variety
	var last = null;
	for(var i = 0; i < totalGeometry; i++) {
		var j = i % mats.length;

		var ball = (i != 0 && seededRandom() > 0.25) ? new THREE.Mesh(geoms[i%geoms.length], mats[j]) : helmet.clone();
		ball.castShadow = true;
		ball.receiveShadow = true;
		
		if(last && seededRandom() > 0.4) {
			last.add(ball);
			ball.position.set(0, 0.5, 0);
			ball.scale.set(0.8, 0.8, 0.8);
		} else if(i != 0){
			balls.push(ball);
			ball.position.set(rand(), rand(), rand());
			ball.rotation.set(randAngle(), randAngle(), randAngle());
			view.scene.add(ball);
		} else {
			balls.push(ball);
			view.scene.add(ball);
		}
		last = ball;
		if(useBatching) {
			ball.traverse(tryToBatch);
		}
	}
}

var urls = [ "posx.jpg", "negx.jpg", "posy.jpg", "negy.jpg", "posz.jpg", "negz.jpg" ];
var loader = new THREE.CubeTextureLoader().setPath( "https://threejs.org/examples/textures/cube/Bridge2/" );
var background = loader.load( urls );

view.scene.background = background;


// model
var helmet = new THREE.Object3D();
var modelFullFile = urlparam("model","https://threejs.org/examples/models/gltf/DamagedHelmet/glTF/DamagedHelmet.gltf", true);
var modelPath = modelFullFile.substr(0, modelFullFile.lastIndexOf("/")+1);
var modelPrescale = urlparam("prescale", 2, true);
var modelFile = modelFullFile.substr(modelPath.length, modelFullFile.length - modelPath.length);
var loader = new GLTFLoader().setPath( modelPath );
var lambertPool = {};

function getPooledLambert(map, color, emissive) {
	var key = map ? map.id : "null" + color.getHexString() + emissive.getHexString();
	if(!lambertPool[key]) {
		lambertPool[key] = new THREE.MeshLambertMaterial({
			map: map,
			color: color,
			emissive: null,
			wireframe: urlparam("wireframe", false)
		});
	}
	return lambertPool[key];
}
loader.load( modelFile, function ( gltf ) {
	var prescaled = [];
	gltf.scene.traverse( function ( child ) {
		if ( child.isMesh ) {
			if(prescaled.indexOf(child.geometry === -1)) {
				var pos = child.geometry.attributes.position.array;
				for(var i = 0; i < pos.length; i++) {
					pos[i] *= modelPrescale;
				}
			}
			switch(urlparam("materialLevel", 2)) {
				case 1:
					// child.material.map = null;
					child.material.roughnessMap = null;
					child.material.emissiveMap = null;
					child.material.emissive.set(0, 0, 0);
					child.material.normalMap = null;
					child.material.aoMap = null;
					child.material.metalnessMap = null;
					child.material.metalness = 0;
					child.material.envMap = null;
					break;
				case 0:
					child.material = getPooledLambert(child.material.map, child.material.color, child.material.emissive);
					break;
				default:
					child.material.envMap = background;
			}
			// child.castShadow = true;
			// child.receiveShadow = true;
		}
	} );
	for(var i = gltf.scene.children.length-1; i >= 0; i--) {
		helmet.add(gltf.scene.children[i]);
	}
	// view.scene.add( helmet );
	makeGeometry();
	lambertPool;
	_batchCandidates;
	_batches;
}, undefined, function ( e ) {
	console.error( e );
} );

view.renderer.gammaOutput = true;
var camera = view.camera;

camera.position.x += 13;
camera.position.y += 2;
camera.position.z += 15;
camera.fov = 70;
camera.updateProjectionMatrix();
// var first = true;
var tasks = [];

var animate = urlparam("animate", true);

function onEnterFrame() {
	if(tasks.length > 0) {
		for(var i = 0; i < tasks.length; i++) {
			tasks[i]();
		}
		tasks.length = 0;
	}

	centerOfView.set(0, 0, 0);
	var now = Date.now();
	for(var i = 0; i < balls.length * 0.1; i++) {
		var ball = balls[i];
		if(animate && ((now * 0.001) % 4) > 2) {
			ball.position.multiplyScalar(0.99);
			if(i > 0) {
			ball.translateZ(0.1);
				ball.applyQuaternion(randQuat(0.1));
			}
		}
		// ball.position.set(rand(), rand(), rand());
		centerOfView.add(ball.position);
	}
	if(balls.length > 0) {
		centerOfView.multiplyScalar(1 / balls.length);
	}
	
	//put light and camera focus in the center of gravity
	light.position.copy(centerOfView);
	light.position.y += 30;
	var delta = camera.position.clone().sub(centerOfView);
	var angle = Math.atan2(delta.z, delta.x);
	angle += 0.002;
	var distance = Math.sqrt(delta.x*delta.x + delta.z*delta.z);
	var delta2 = delta.clone();
	delta2.x = Math.cos(angle) * distance;
	delta2.z = Math.sin(angle) * distance;
    camera.lookAt(centerOfView);
}
view.renderManager.onEnterFrame.add(onEnterFrame);

var RafTweener = require("raf-tweener");
var Pointers = require("input-unified-pointers");
var MouseWheel = require("input-mousewheel");
var CameraController = require("threejs-camera-controller-pan-zoom-unified-pointer");

var pointers = new Pointers(view.canvas);
var mouseWheel = new MouseWheel(view.canvas);
var rafTweener = new RafTweener();
rafTweener.start();
var camController = new CameraController({
	camera: camera,
	tweener: rafTweener,
	pointers: pointers,
	mouseWheel: mouseWheel,
	panSpeed: 0.02,
	fovMin: 50,
	fovMax: 70,
	zoomMax: 0.25,
	singleFingerPanEnabled: true
});
camController.setState(true);
camController.setSize(window.innerWidth, window.innerHeight);

var otherCamera = new THREE.PerspectiveCamera();
otherCamera.updateProjectionMatrix();

function setOtherCameraSize(w, h) {
	otherCamera.setViewOffset(
		w, 
		h, 
		w * 0.25, 
		h * 0.25, 
		w * 0.5, 
		h * 0.5
	);
}

setOtherCameraSize(window.innerWidth, window.innerHeight);
view.onResizeSignal.add(setOtherCameraSize);

view.renderManager.onEnterFrame.add(function(){
	_batches.forEach(bm => bm.onEnterFrame());
	camController.precomposeViewport(otherCamera);
});
view.renderManager.skipFrames = urlparam("skipFrames", 0);