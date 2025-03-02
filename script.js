// Configurações globais
const SPRINT_SPEED = 0.2;
const NORMAL_SPEED = 0.1;
const DOUBLE_CLICK_TIME = 300;
const GRAVITY = 0.015;
const BLOCK_SIZE = 1;
const GRID_SIZE = 20;
const CAMERA_DISTANCE = 5;
const PLAYER_HEIGHT = 1.8;
const PLAYER_WIDTH = 0.6;
const JUMP_HEIGHT = BLOCK_SIZE;
const MAX_FPS = 60; // Novo: limite de FPS

// Estado do jogo
let scene, camera, renderer;
let player, arm, torso, leftLeg, rightLeg, currentHandItem;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let velocity = { x: 0, y: 0, z: 0 };
let canJump = false;
let isSprinting = false;
let lastWPressTime = 0;
let showFPS = true;
let blocks = {};
let inventoryOpen = false;
let optionsOpen = false;
let sensitivityOpen = false;
let fovOpen = false;
let controlsOpen = false;
let outline = null;
let mouseSensitivity = 0.001;
let cameraMode = 0;
let cameraAngleY = 0;
let cameraAngleX = 0;
let selectedItem = 'arm';
let controlMode = 'keyboard';
let controls = {
    moveForward: 'KeyW',
    moveBackward: 'KeyS',
    moveLeft: 'KeyA',
    moveRight: 'KeyD',
    jump: 'Space',
    inventory: 'KeyE',
    cameraMode: 'F5'
};
let awaitingKey = null;
let touchStartX = null, touchStartY = null;
let lastFrameTime = performance.now();
let hudUpdateCounter = 0; // Novo: contador para atualização do HUD

const textureLoader = new THREE.TextureLoader();
const grassTexture = textureLoader.load('img/bloco_de_grama.png', 
    () => console.log('Textura bloco_de_grama.png carregada!'), 
    undefined, 
    (error) => console.error('Erro ao carregar bloco_de_grama.png:', error)
);
grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
grassTexture.repeat.set(1, 1);

const stoneTexture = textureLoader.load('img/bloco_de_pedra.png', 
    () => console.log('Textura bloco_de_pedra.png carregada!'), 
    undefined, 
    (error) => console.error('Erro ao carregar bloco_de_pedra.png:', error)
);
stoneTexture.wrapS = stoneTexture.wrapT = THREE.RepeatWrapping;
stoneTexture.repeat.set(1, 1);

const lampblockTexture = textureLoader.load('img/bloco_de_lampada_ativa.png', 
    () => console.log('Textura bloco_de_lampada_ativa.png carregada!'), 
    undefined, 
    (error) => console.error('Erro ao carregar bloco_de_lampada_ativa.png:', error)
);
lampblockTexture.wrapS = lampblockTexture.wrapT = THREE.RepeatWrapping;
lampblockTexture.repeat.set(1, 1);

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, PLAYER_HEIGHT / 2, 0);

    const canvas = document.getElementById('game-canvas');
    renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    sunLight.position.set(20, 30, 20);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 100;
    sunLight.shadow.camera.left = -20;
    sunLight.shadow.camera.right = 20;
    sunLight.shadow.camera.top = 20;
    sunLight.shadow.camera.bottom = -20;
    scene.add(sunLight);

    const sunGeometry = new THREE.PlaneGeometry(5, 5);
    const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffffaa, side: THREE.DoubleSide });
    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    sun.position.set(20, 30, 20);
    sun.lookAt(0, 0, 0);
    scene.add(sun);

    player = new THREE.Object3D();
    player.position.set(0, BLOCK_SIZE, 0);
    scene.add(player);
    player.add(camera);

    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xE5C39A });
    torso = createBodyPart(new THREE.BoxGeometry(0.6, 0.8, 0.3), bodyMaterial, 0, 0.4, 0);
    leftLeg = createBodyPart(new THREE.BoxGeometry(0.25, 0.8, 0.25), bodyMaterial, -0.175, 0, 0);
    rightLeg = createBodyPart(new THREE.BoxGeometry(0.25, 0.8, 0.25), bodyMaterial, 0.175, 0, 0);
    torso.visible = false;
    leftLeg.visible = false;
    rightLeg.visible = false;
    torso.castShadow = true;
    leftLeg.castShadow = true;
    rightLeg.castShadow = true;

    const armGeometry = new THREE.BoxGeometry(0.8, 0.2, 0.2);
    const armMaterial = new THREE.MeshStandardMaterial({ color: 0xE5C39A });
    arm = new THREE.Mesh(armGeometry, armMaterial);
    arm.position.set(0.4, -0.3, -0.2);
    arm.rotation.y = -Math.PI / 2;
    arm.castShadow = true;
    arm.receiveShadow = true;
    camera.add(arm);
    currentHandItem = arm;

    const floorMaterial = new THREE.MeshStandardMaterial({ map: grassTexture });
    for (let x = -GRID_SIZE / 2; x < GRID_SIZE / 2; x++) {
        for (let z = -GRID_SIZE / 2; z < GRID_SIZE / 2; z++) {
            const key = `${x},${0},${z}`;
            blocks[key] = { x, y: 0, z };
        }
    }
    createOptimizedBlocks(blocks, floorMaterial);

    setupEventListeners();
    setupTouchControls();

    document.getElementById('mode-button').addEventListener('click', toggleControlMode);
    document.getElementById('mode-button').addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleControlMode();
    });

    document.getElementById('camera-mode-button').addEventListener('click', toggleCameraMode);
    document.getElementById('camera-mode-button').addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleCameraMode();
    });

    animate();
}

function createBodyPart(geometry, material, x, y, z) {
    const part = new THREE.Mesh(geometry, material);
    part.position.set(x, y, z);
    part.castShadow = true;
    part.receiveShadow = true;
    player.add(part);
    return part;
}

function createOptimizedBlocks(blocks, material) {
    Object.keys(blocks).forEach(key => {
        if (!blocks[key].mesh) {
            const { x, y, z } = blocks[key];
            const geometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
            const block = new THREE.Mesh(geometry, material);
            block.position.set(x * BLOCK_SIZE, y * BLOCK_SIZE, z * BLOCK_SIZE);
            block.castShadow = true;
            block.receiveShadow = true;
            scene.add(block);
            blocks[key].mesh = block;
        }
    });
}

function switchHandItem(itemType) {
    if (currentHandItem.parent === camera) {
        camera.remove(currentHandItem);
    } else if (currentHandItem.parent === player) {
        player.remove(currentHandItem);
    }

    if (itemType === 'arm') {
        const armGeometry = new THREE.BoxGeometry(0.8, 0.2, 0.2);
        const armMaterial = new THREE.MeshStandardMaterial({ color: 0xE5C39A });
        arm = new THREE.Mesh(armGeometry, armMaterial);
        if (cameraMode === 0) {
            arm.position.set(0.4, -0.3, -0.2);
            arm.rotation.y = -Math.PI / 2;
        } else {
            arm.position.set(0.6, 0.7, 0);
            arm.rotation.y = 0;
        }
        arm.castShadow = true;
        arm.receiveShadow = true;
        currentHandItem = arm;
    } else if (itemType === 'grass') {
        const blockGeometry = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const blockMaterial = new THREE.MeshStandardMaterial({ map: grassTexture });
        arm = new THREE.Mesh(blockGeometry, blockMaterial);
        if (cameraMode === 0) {
            arm.position.set(0.4, -0.3, -0.2);
            arm.rotation.y = -Math.PI / 2;
        } else {
            arm.position.set(0.6, 0.7, 0);
            arm.rotation.y = 0;
        }
        arm.castShadow = true;
        arm.receiveShadow = true;
        currentHandItem = arm;
    } else if (itemType === 'stone') {
        const blockGeometry = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const blockMaterial = new THREE.MeshStandardMaterial({ map: stoneTexture });
        arm = new THREE.Mesh(blockGeometry, blockMaterial);
        if (cameraMode === 0) {
            arm.position.set(0.4, -0.3, -0.2);
            arm.rotation.y = -Math.PI / 2;
        } else {
            arm.position.set(0.6, 0.7, 0);
            arm.rotation.y = 0;
        }
        arm.castShadow = true;
        arm.receiveShadow = true;
        currentHandItem = arm;
    } else if (itemType === 'lampblock') {
        const blockGeometry = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const blockMaterial = new THREE.MeshStandardMaterial({ map: lampblockTexture });
        arm = new THREE.Mesh(blockGeometry, blockMaterial);
        if (cameraMode === 0) {
            arm.position.set(0.4, -0.3, -0.2);
            arm.rotation.y = -Math.PI / 2;
        } else {
            arm.position.set(0.6, 0.7, 0);
            arm.rotation.y = 0;
        }
        arm.castShadow = true;
        arm.receiveShadow = true;
        currentHandItem = arm;
    }

    if (cameraMode === 0) {
        camera.add(currentHandItem);
    } else {
        player.add(currentHandItem);
    }
    selectedItem = itemType;
    updateBodyVisibility();
}

function toggleCameraMode() {
    cameraMode = (cameraMode + 1) % 2;

    if (currentHandItem.parent === camera) {
        camera.remove(currentHandItem);
    } else if (currentHandItem.parent === player) {
        player.remove(currentHandItem);
    }

    if (cameraMode === 0) {
        camera.position.set(0, PLAYER_HEIGHT / 2, 0);
        camera.rotatio
