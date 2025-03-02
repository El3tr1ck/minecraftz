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
const MIN_FRAME_TIME = 1000 / 60;

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
let hudUpdateCounter = 0;

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
            blocks[key] = { x, y: 0, z, material: floorMaterial };
        }
    }
    updateBlockMeshes(); // Inicializa os blocos com faces otimizadas

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

    animate(performance.now());
}

function createBodyPart(geometry, material, x, y, z) {
    const part = new THREE.Mesh(geometry, material);
    part.position.set(x, y, z);
    part.castShadow = true;
    part.receiveShadow = true;
    player.add(part);
    return part;
}

function getNeighbors(x, y, z) {
    return [
        { key: `${x + 1},${y},${z}`, dir: 'right' },
        { key: `${x - 1},${y},${z}`, dir: 'left' },
        { key: `${x},${y + 1},${z}`, dir: 'top' },
        { key: `${x},${y - 1},${z}`, dir: 'bottom' },
        { key: `${x},${y},${z + 1}`, dir: 'front' },
        { key: `${x},${y},${z - 1}`, dir: 'back' }
    ];
}

function createBlockGeometry(x, y, z) {
    const vertices = [
        // Frente (0-3)
        -0.5, -0.5,  0.5,  0.5, -0.5,  0.5,  0.5,  0.5,  0.5, -0.5,  0.5,  0.5,
        // Trás (4-7)
        -0.5, -0.5, -0.5,  0.5, -0.5, -0.5,  0.5,  0.5, -0.5, -0.5,  0.5, -0.5,
        // Esquerda (8-11)
        -0.5, -0.5, -0.5, -0.5, -0.5,  0.5, -0.5,  0.5,  0.5, -0.5,  0.5, -0.5,
        // Direita (12-15)
         0.5, -0.5, -0.5,  0.5, -0.5,  0.5,  0.5,  0.5,  0.5,  0.5,  0.5, -0.5,
        // Topo (16-19)
        -0.5,  0.5, -0.5,  0.5,  0.5, -0.5,  0.5,  0.5,  0.5, -0.5,  0.5,  0.5,
        // Fundo (20-23)
        -0.5, -0.5, -0.5,  0.5, -0.5, -0.5,  0.5, -0.5,  0.5, -0.5, -0.5,  0.5
    ];

    const indices = [
        0, 1, 2, 0, 2, 3,       // Frente
        4, 7, 6, 4, 6, 5,       // Trás
        8, 9, 10, 8, 10, 11,    // Esquerda
        12, 15, 14, 12, 14, 13, // Direita
        16, 17, 18, 16, 18, 19, // Topo
        20, 21, 22, 20, 22, 23  // Fundo
    ];

    const uvs = [
        0, 0, 1, 0, 1, 1, 0, 1, // Frente
        0, 0, 1, 0, 1, 1, 0, 1, // Trás
        0, 0, 1, 0, 1, 1, 0, 1, // Esquerda
        0, 0, 1, 0, 1, 1, 0, 1, // Direita
        0, 0, 1, 0, 1, 1, 0, 1, // Topo
        0, 0, 1, 0, 1, 1, 0, 1  // Fundo
    ];

    const normals = [
        // Frente
        0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1,
        // Trás
        0, 0, -1,  0, 0, -1,  0, 0, -1,  0, 0, -1,
        // Esquerda
        -1, 0, 0,  -1, 0, 0,  -1, 0, 0,  -1, 0, 0,
        // Direita
        1, 0, 0,  1, 0, 0,  1, 0, 0,  1, 0, 0,
        // Topo
        0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,
        // Fundo
        0, -1, 0,  0, -1, 0,  0, -1, 0,  0, -1, 0
    ];

    const neighbors = getNeighbors(x, y, z);
    const visibleFaces = {
        front: !blocks[neighbors[4].key], // z + 1
        back: !blocks[neighbors[5].key],  // z - 1
        left: !blocks[neighbors[1].key],  // x - 1
        right: !blocks[neighbors[0].key], // x + 1
        top: !blocks[neighbors[2].key],   // y + 1
        bottom: !blocks[neighbors[3].key] // y - 1
    };

    const newVertices = [];
    const newIndices = [];
    const newUVs = [];
    const newNormals = [];
    let indexOffset = 0;

    const faceOrder = ['front', 'back', 'left', 'right', 'top', 'bottom'];
    for (let i = 0; i < 6; i++) {
        if (visibleFaces[faceOrder[i]]) {
            for (let j = 0; j < 4; j++) {
                const vertIdx = i * 4 + j;
                newVertices.push(vertices[vertIdx * 3], vertices[vertIdx * 3 + 1], vertices[vertIdx * 3 + 2]);
                newUVs.push(uvs[vertIdx * 2], uvs[vertIdx * 2 + 1]);
                newNormals.push(normals[vertIdx * 3], normals[vertIdx * 3 + 1], normals[vertIdx * 3 + 2]);
            }
            for (let j = 0; j < 6; j++) {
                newIndices.push(indices[i * 6 + j] % 4 + indexOffset);
            }
            indexOffset += 4;
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(newVertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(newUVs, 2));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(newNormals, 3));
    geometry.setIndex(newIndices);
    geometry.computeVertexNormals(); // Garante normais corretas para iluminação
    return geometry;
}

function updateBlockMeshes() {
    Object.keys(blocks).forEach(key => {
        const block = blocks[key];
        if (block.mesh) {
            scene.remove(block.mesh);
            block.mesh.geometry.dispose();
        }
        const geometry = createBlockGeometry(block.x, block.y, block.z);
        block.mesh = new THREE.Mesh(geometry, block.material);
        block.mesh.position.set(block.x * BLOCK_SIZE, block.y * BLOCK_SIZE, block.z * BLOCK_SIZE);
        block.mesh.castShadow = true;
        block.mesh.receiveShadow = true;
        scene.add(block.mesh);
    });
}

function updateNeighborBlocks(x, y, z) {
    const neighbors = getNeighbors(x, y, z);
    neighbors.forEach(neighbor => {
        if (blocks[neighbor.key]) {
            scene.remove(blocks[neighbor.key].mesh);
            blocks[neighbor.key].mesh.geometry.dispose();
            const geometry = createBlockGeometry(blocks[neighbor.key].x, blocks[neighbor.key].y, blocks[neighbor.key].z);
            blocks[neighbor.key].mesh = new THREE.Mesh(geometry, blocks[neighbor.key].material);
            blocks[neighbor.key].mesh.position.set(
                blocks[neighbor.key].x * BLOCK_SIZE,
                blocks[neighbor.key].y * BLOCK_SIZE,
                blocks[neighbor.key].z * BLOCK_SIZE
            );
            blocks[neighbor.key].mesh.castShadow = true;
            blocks[neighbor.key].mesh.receiveShadow = true;
            scene.add(blocks[neighbor.key].mesh);
        }
    });
}

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
            blocks[key] = { x, y: 0, z, material: floorMaterial };
        }
    }
    updateBlockMeshes();

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

    animate(performance.now());
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
        camera.rotation.set(0, 0, 0);
        player.add(camera);
        switchHandItem(selectedItem);
        document.getElementById('crosshair').style.display = 'block';
        if (controlMode === 'keyboard') lockPointer();
    } else {
        scene.add(camera);
        updateCameraOrbit();
        switchHandItem(selectedItem);
        document.getElementById('crosshair').style.display = 'none';
        if (controlMode === 'keyboard') lockPointer();
    }
    updateBodyVisibility();
}

function updateCameraOrbit() {
    const offsetX = CAMERA_DISTANCE * Math.sin(cameraAngleY) * Math.cos(cameraAngleX);
    const offsetZ = CAMERA_DISTANCE * Math.cos(cameraAngleY) * Math.cos(cameraAngleX);
    const offsetY = CAMERA_DISTANCE * Math.sin(cameraAngleX);

    camera.position.set(
        player.position.x + offsetX,
        player.position.y + PLAYER_HEIGHT / 2 + offsetY,
        player.position.z + offsetZ
    );
    camera.lookAt(player.position.x, player.position.y + PLAYER_HEIGHT / 2, player.position.z);
}

function updateBodyVisibility() {
    const isFirstPerson = cameraMode === 0;
    torso.visible = !isFirstPerson;
    leftLeg.visible = !isFirstPerson;
    rightLeg.visible = !isFirstPerson;
    torso.castShadow = !isFirstPerson;
    leftLeg.castShadow = !isFirstPerson;
    rightLeg.castShadow = !isFirstPerson;
}

function getTargetBlock(action) {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObjects(Object.values(blocks).map(b => b.mesh).filter(Boolean));
    if (intersects.length > 0) {
        const intersect = intersects[0];
        const blockPos = intersect.object.position.clone();
        const normal = intersect.face.normal.clone().applyQuaternion(intersect.object.quaternion);

        if (action === 'place') {
            const newPos = blockPos.add(normal.multiplyScalar(BLOCK_SIZE));
            return { x: Math.round(newPos.x / BLOCK_SIZE), y: Math.round(newPos.y / BLOCK_SIZE), z: Math.round(newPos.z / BLOCK_SIZE) };
        } else if (action === 'break' || action === 'outline' || action === 'pick') {
            return {
                x: Math.round(blockPos.x / BLOCK_SIZE),
                y: Math.round(blockPos.y / BLOCK_SIZE),
                z: Math.round(blockPos.z / BLOCK_SIZE),
                faceNormal: normal,
                material: intersect.object.material
            };
        }
    }
    return null;
}

function updateOutline() {
    if (outline) scene.remove(outline);

    const target = getTargetBlock('outline');
    if (target) {
        const block = blocks[`${target.x},${target.y},${target.z}`];
        if (block && block.mesh) {
            const geometry = new THREE.EdgesGeometry(createBlockGeometry(block.x, block.y, block.z));
            const material = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
            outline = new THREE.LineSegments(geometry, material);
            outline.position.copy(block.mesh.position);
            outline.scale.set(1.01, 1.01, 1.01);
            scene.add(outline);
        }
    }
}

function placeBlock() {
    const target = getTargetBlock('place');
    if (target && selectedItem !== 'arm') {
        const key = `${target.x},${target.y},${target.z}`;
        if (!blocks[key]) {
            let blockMaterial;
            if (selectedItem === 'grass') {
                blockMaterial = new THREE.MeshStandardMaterial({ map: grassTexture });
            } else if (selectedItem === 'stone') {
                blockMaterial = new THREE.MeshStandardMaterial({ map: stoneTexture });
            } else if (selectedItem === 'lampblock') {
                blockMaterial = new THREE.MeshStandardMaterial({ map: lampblockTexture });
            }

            blocks[key] = { x: target.x, y: target.y, z: target.z, material: blockMaterial };
            updateBlockMeshes();
            updateNeighborBlocks(target.x, target.y, target.z);
        }
    }
}

function breakBlock() {
    const target = getTargetBlock('break');
    if (target) {
        const key = `${target.x},${target.y},${target.z}`;
        if (blocks[key] && blocks[key].mesh) {
            scene.remove(blocks[key].mesh);
            blocks[key].mesh.geometry.dispose();
            delete blocks[key];
            updateNeighborBlocks(target.x, target.y, target.z);
        }
    }
}

function pickBlock() {
    const target = getTargetBlock('pick');
    if (target) {
        const key = `${target.x},${target.y},${target.z}`;
        if (blocks[key] && blocks[key].mesh) {
            const materialMap = blocks[key].mesh.material.map;
            let newItem;
            if (materialMap === grassTexture) newItem = 'grass';
            else if (materialMap === stoneTexture) newItem = 'stone';
            else if (materialMap === lampblockTexture) newItem = 'lampblock';
            
            if (newItem) {
                switchHandItem(newItem);
                document.querySelectorAll('.inventory-slot').forEach(s => {
                    s.classList.remove('selected');
                    if (s.dataset.item === newItem) s.classList.add('selected');
                });
            }
        }
    }
}

function checkCollision() {
    const playerBox = {
        minX: player.position.x - PLAYER_WIDTH / 2,
        maxX: player.position.x + PLAYER_WIDTH / 2,
        minY: player.position.y,
        maxY: player.position.y + PLAYER_HEIGHT,
        minZ: player.position.z - PLAYER_WIDTH / 2,
        maxZ: player.position.z + PLAYER_WIDTH / 2
    };

    let onGround = false;
    const nearbyBlocks = Object.keys(blocks).filter(key => {
        const [x, y, z] = key.split(',').map(Number);
        return Math.abs(x - player.position.x / BLOCK_SIZE) <= 2 &&
               Math.abs(y - player.position.y / BLOCK_SIZE) <= 2 &&
               Math.abs(z - player.position.z / BLOCK_SIZE) <= 2;
    });

    for (const key of nearbyBlocks) {
        const block = blocks[key];
        const blockBox = {
            minX: block.x * BLOCK_SIZE - BLOCK_SIZE / 2,
            maxX: block.x * BLOCK_SIZE + BLOCK_SIZE / 2,
            minY: block.y * BLOCK_SIZE - BLOCK_SIZE / 2,
            maxY: block.y * BLOCK_SIZE + BLOCK_SIZE / 2,
            minZ: block.z * BLOCK_SIZE - BLOCK_SIZE / 2,
            maxZ: block.z * BLOCK_SIZE + BLOCK_SIZE / 2
        };

        if (playerBox.minX < blockBox.maxX && playerBox.maxX > blockBox.minX &&
            playerBox.minZ < blockBox.maxZ && playerBox.maxZ > blockBox.minZ) {
            if (velocity.y <= 0 && playerBox.minY <= blockBox.maxY && playerBox.maxY > blockBox.minY) {
                player.position.y = blockBox.maxY;
                velocity.y = 0;
                canJump = true;
                onGround = true;
            } else if (velocity.y > 0 && playerBox.maxY >= blockBox.minY && playerBox.minY < blockBox.maxY) {
                player.position.y = blockBox.minY - PLAYER_HEIGHT;
                velocity.y = 0;
            }
        }

        if (playerBox.minY < blockBox.maxY && playerBox.maxY > blockBox.minY) {
            if (moveForward || moveBackward || moveLeft || moveRight) {
                if (playerBox.minX < blockBox.maxX && playerBox.maxX > blockBox.minX &&
                    playerBox.minZ < blockBox.maxZ && playerBox.maxZ > blockBox.minZ) {
                    const nextX = player.position.x + velocity.x;
                    const nextZ = player.position.z + velocity.z;

                    if (nextX - PLAYER_WIDTH / 2 < blockBox.maxX && nextX + PLAYER_WIDTH / 2 > blockBox.minX &&
                        nextZ - PLAYER_WIDTH / 2 < blockBox.maxZ && nextZ + PLAYER_WIDTH / 2 > blockBox.minZ) {
                        velocity.x = 0;
                        velocity.z = 0;
                    }
                }
            }
        }
    }

    if (!onGround && player.position.y <= BLOCK_SIZE) {
        player.position.y = BLOCK_SIZE;
        velocity.y = 0;
        canJump = true;
    }
}

function lockPointer() {
    if (!inventoryOpen && !optionsOpen && !sensitivityOpen && !fovOpen && !controlsOpen && controlMode === 'keyboard') {
        document.body.requestPointerLock();
    }
}

function unlockPointer() {
    document.exitPointerLock();
    document.body.style.cursor = 'default';
}

function toggleInventory() {
    inventoryOpen = !inventoryOpen;
    document.getElementById('inventory').style.display = inventoryOpen ? 'block' : 'none';
    if (inventoryOpen) {
        unlockPointer();
    } else {
        lockPointer();
    }
}

function toggleOptions() {
    optionsOpen = !optionsOpen;
    document.getElementById('options').style.display = optionsOpen ? 'block' : 'none';
    if (optionsOpen) {
        unlockPointer();
        inventoryOpen = false;
        document.getElementById('inventory').style.display = 'none';
        sensitivityOpen = false;
        fovOpen = false;
        controlsOpen = false;
        document.getElementById('sensitivity-panel').style.display = 'none';
        document.getElementById('fov-panel').style.display = 'none';
        document.getElementById('controls-panel').style.display = 'none';
    } else {
        lockPointer();
    }
}

function toggleControlMode() {
    controlMode = controlMode === 'keyboard' ? 'mobile' : 'keyboard';
    const modeButton = document.getElementById('mode-button');
    modeButton.innerHTML = controlMode === 'keyboard' ? '<i class="fas fa-keyboard"></i>' : '<i class="fas fa-mobile-alt"></i>';
    const touchControls = document.getElementById('touch-controls');
    const cameraModeButton = document.getElementById('camera-mode-button');
    
    touchControls.style.display = controlMode === 'mobile' ? 'block' : 'none';
    
    if (controlMode === 'mobile') {
        cameraModeButton.classList.add('active');
    } else {
        cameraModeButton.classList.remove('active');
    }
    
    moveForward = false;
    moveBackward = false;
    moveLeft = false;
    moveRight = false;
    
    if (controlMode === 'keyboard') {
        lockPointer();
    } else {
        unlockPointer();
    }
}

function onInventoryClick(event) {
    const slot = event.target.closest('.inventory-slot');
    if (slot) {
        const item = slot.dataset.item;
        const wasSelected = slot.classList.contains('selected');
        document.querySelectorAll('.inventory-slot').forEach(s => s.classList.remove('selected'));
        
        if (!wasSelected) {
            slot.classList.add('selected');
            switchHandItem(item);
        } else {
            switchHandItem('arm');
        }
    }
}

function onOptionsClick(event) {
    const button = event.target.closest('.option-button');
    if (button) {
        const action = button.dataset.action;
        if (action === 'resume') {
            optionsOpen = false;
            document.getElementById('options').style.display = 'none';
            lockPointer();
        } else if (action === 'sensitivity') {
            document.getElementById('options').style.display = 'none';
            document.getElementById('sensitivity-panel').style.display = 'block';
            sensitivityOpen = true;
            optionsOpen = false;
        } else if (action === 'fov') {
            document.getElementById('options').style.display = 'none';
            document.getElementById('fov-panel').style.display = 'block';
            fovOpen = true;
            optionsOpen = false;
        } else if (action === 'controls') {
            document.getElementById('options').style.display = 'none';
            document.getElementById('controls-panel').style.display = 'block';
            controlsOpen = true;
            optionsOpen = false;
        }
    }
}

function onPanelClick(event) {
    const button = event.target.closest('.back-button');
    if (button) {
        document.getElementById('sensitivity-panel').style.display = 'none';
        document.getElementById('fov-panel').style.display = 'none';
        document.getElementById('controls-panel').style.display = 'none';
        document.getElementById('options').style.display = 'block';
        sensitivityOpen = false;
        fovOpen = false;
        controlsOpen = false;
        optionsOpen = true;
        awaitingKey = null;
    }
}

function onControlsClick(event) {
    const item = event.target.closest('.control-item');
    if (item && controlMode === 'keyboard' && controlsOpen) {
        const control = item.dataset.control;
        awaitingKey = control;
        document.querySelectorAll('.control-item').forEach(i => i.style.background = '');
        item.style.background = '#777';
    }
}

function setupTouchControls() {
    const forwardButton = document.getElementById('touch-forward');
    const backwardButton = document.getElementById('touch-backward');
    const leftButton = document.getElementById('touch-left');
    const rightButton = document.getElementById('touch-right');
    const jumpButton = document.getElementById('touch-jump');
    const optionsButton = document.getElementById('touch-options');
    const inventoryButton = document.getElementById('touch-inventory');
    const cameraButton = document.getElementById('touch-camera');

    forwardButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (controlMode === 'mobile') moveForward = true;
    });
    forwardButton.addEventListener('touchend', (e) => {
        e.preventDefault();
        moveForward = false;
    });
    forwardButton.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (controlMode === 'mobile') moveForward = true;
    });
    forwardButton.addEventListener('mouseup', (e) => {
        e.preventDefault();
        moveForward = false;
    });

    backwardButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (controlMode === 'mobile') moveBackward = true;
    });
    backwardButton.addEventListener('touchend', (e) => {
        e.preventDefault();
        moveBackward = false;
    });
    backwardButton.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (controlMode === 'mobile') moveBackward = true;
    });
    backwardButton.addEventListener('mouseup', (e) => {
        e.preventDefault();
        moveBackward = false;
    });

    leftButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (controlMode === 'mobile') moveLeft = true;
    });
    leftButton.addEventListener('touchend', (e) => {
        e.preventDefault();
        moveLeft = false;
    });
    leftButton.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (controlMode === 'mobile') moveLeft = true;
    });
    leftButton.addEventListener('mouseup', (e) => {
        e.preventDefault();
        moveLeft = false;
    });

    rightButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (controlMode === 'mobile') moveRight = true;
    });
    rightButton.addEventListener('touchend', (e) => {
        e.preventDefault();
        moveRight = false;
    });
    rightButton.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (controlMode === 'mobile') moveRight = true;
    });
    rightButton.addEventListener('mouseup', (e) => {
        e.preventDefault();
        moveRight = false;
    });

    jumpButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (controlMode === 'mobile' && canJump) {
            velocity.y = Math.sqrt(2 * GRAVITY * JUMP_HEIGHT);
            canJump = false;
        }
    });
    jumpButton.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (controlMode === 'mobile' && canJump) {
            velocity.y = Math.sqrt(2 * GRAVITY * JUMP_HEIGHT);
            canJump = false;
        }
    });

    optionsButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (controlMode === 'mobile') toggleOptions();
    });
    optionsButton.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (controlMode === 'mobile') toggleOptions();
    });

    inventoryButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (controlMode === 'mobile') toggleInventory();
    });
    inventoryButton.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (controlMode === 'mobile') toggleInventory();
    });

    cameraButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (controlMode === 'mobile') toggleCameraMode();
    });
    cameraButton.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (controlMode === 'mobile') toggleCameraMode();
    });

    document.getElementById('close-inventory').addEventListener('click', toggleInventory);
    document.getElementById('close-inventory').addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleInventory();
    });

    let lastTouchTime = 0;
    document.addEventListener('touchstart', (event) => {
        if (controlMode === 'mobile' && !inventoryOpen && !optionsOpen && !sensitivityOpen && !fovOpen && !controlsOpen) {
            const touch = event.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            setTimeout(() => {
                if (touchStartX === touch.clientX && touchStartY === touch.clientY) {
                    breakBlock();
                }
            }, 200);
        }
    });

    document.addEventListener('touchmove', (event) => {
        if (controlMode === 'mobile' && !inventoryOpen && !optionsOpen && !sensitivityOpen && !fovOpen && !controlsOpen) {
            const now = performance.now();
            if (now - lastTouchTime < 16) return;
            lastTouchTime = now;
            const touch = event.touches[0];
            const movementX = (touch.clientX - touchStartX) * mouseSensitivity;
            const movementY = (touch.clientY - touchStartY) * mouseSensitivity;
            if (cameraMode === 0) {
                player.rotation.y -= movementX;
                camera.rotation.x -= movementY;
                camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
            } else {
                cameraAngleY += movementX;
                cameraAngleX -= movementY;
                cameraAngleX = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, cameraAngleX));
                player.rotation.y = cameraAngleY;
                updateCameraOrbit();
            }
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
        }
    });

    document.addEventListener('touchend', (event) => {
        if (controlMode === 'mobile' && !inventoryOpen && !optionsOpen && !sensitivityOpen && !fovOpen && !controlsOpen) {
            placeBlock();
        }
    });
}

function updateSensitivity(event) {
    mouseSensitivity = parseFloat(event.target.value);
    document.getElementById('sensitivity-value').innerText = mouseSensitivity.toFixed(4);
}

function updateFOV(event) {
    const fov = parseInt(event.target.value);
    camera.fov = fov;
    camera.updateProjectionMatrix();
    document.getElementById('fov-value').innerText = fov;
}

function setupEventListeners() {
    document.addEventListener('keydown', (event) => {
        if (controlMode !== 'keyboard') return;

        if (awaitingKey && controlsOpen) {
            event.preventDefault();
            controls[awaitingKey] = event.code;
            const controlItem = document.querySelector(`[data-control="${awaitingKey}"]`);
            controlItem.querySelector('span:last-child').innerText = event.code.replace('Key', '');
            controlItem.style.background = '';
            awaitingKey = null;
            return;
        }

        if (event.code === 'Escape') {
            event.preventDefault();
            if (sensitivityOpen || fovOpen || controlsOpen) {
                sensitivityOpen = false;
                fovOpen = false;
                controlsOpen = false;
                document.getElementById('sensitivity-panel').style.display = 'none';
                document.getElementById('fov-panel').style.display = 'none';
                document.getElementById('controls-panel').style.display = 'none';
                document.getElementById('options').style.display = 'block';
                optionsOpen = true;
            } else if (optionsOpen) {
                optionsOpen = false;
                document.getElementById('options').style.display = 'none';
                lockPointer();
            } else if (inventoryOpen) {
                inventoryOpen = false;
                document.getElementById('inventory').style.display = 'none';
                lockPointer();
            } else {
                toggleOptions();
            }
            return;
        }

        if (event.code === controls.inventory) {
            event.preventDefault();
            if (!optionsOpen && !sensitivityOpen && !fovOpen && !controlsOpen) {
                toggleInventory();
            }
            return;
        }
        if (event.code === controls.cameraMode) {
            event.preventDefault();
            if (!inventoryOpen && !optionsOpen && !sensitivityOpen && !fovOpen && !controlsOpen) {
                toggleCameraMode();
            }
            return;
        }
        if (inventoryOpen || optionsOpen || sensitivityOpen || fovOpen || controlsOpen) return;

        switch (event.code) {
            case controls.moveForward:
                if (!moveForward) {
                    const currentTime = performance.now();
                    if (currentTime - lastWPressTime < DOUBLE_CLICK_TIME) {
                        isSprinting = true;
                    }
                    lastWPressTime = currentTime;
                }
                moveForward = true;
                break;
            case controls.moveBackward:
                moveBackward = true;
                break;
            case controls.moveLeft:
                moveLeft = true;
                break;
            case controls.moveRight:
                moveRight = true;
                break;
            case controls.jump:
                if (canJump) {
                    velocity.y = Math.sqrt(2 * GRAVITY * JUMP_HEIGHT);
                    canJump = false;
                }
                break;
        }
    });

    document.addEventListener('keyup', (event) => {
        if (controlMode !== 'keyboard') return;
        if (inventoryOpen || optionsOpen || sensitivityOpen || fovOpen || controlsOpen) return;

        switch (event.code) {
            case controls.moveForward:
                moveForward = false;
                isSprinting = false;
                break;
            case controls.moveBackward:
                moveBackward = false;
                break;
            case controls.moveLeft:
                moveLeft = false;
                break;
            case controls.moveRight:
                moveRight = false;
                break;
        }
    });

    document.addEventListener('click', lockPointer);
    document.addEventListener('mousedown', (event) => {
        if (controlMode === 'keyboard' && !inventoryOpen && !optionsOpen && !sensitivityOpen && !fovOpen && !controlsOpen) {
            if (event.button === 0) {
                breakBlock();
            } else if (event.button === 1) {
                pickBlock();
            } else if (event.button === 2) {
                placeBlock();
            }
        }
    });
    document.addEventListener('mousemove', (event) => {
        if (controlMode === 'keyboard' && !inventoryOpen && !optionsOpen && !sensitivityOpen && !fovOpen && !controlsOpen && document.pointerLockElement === document.body) {
            const movementX = event.movementX * mouseSensitivity;
            const movementY = event.movementY * mouseSensitivity;
            if (cameraMode === 0) {
                player.rotation.y -= movementX;
                camera.rotation.x -= movementY;
                camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
            } else {
                cameraAngleY += movementX;
                cameraAngleX -= movementY;
                cameraAngleX = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, cameraAngleX));
                player.rotation.y = cameraAngleY;
                updateCameraOrbit();
            }
        }
    });

    document.getElementById('inventory-grid').addEventListener('click', onInventoryClick);
    document.getElementById('options-grid').addEventListener('click', onOptionsClick);
    document.getElementById('sensitivity-panel').addEventListener('click', onPanelClick);
    document.getElementById('fov-panel').addEventListener('click', onPanelClick);
    document.getElementById('controls-panel').addEventListener('click', (e) => {
        onControlsClick(e);
        onPanelClick(e);
    });
    document.getElementById('sensitivity-slider').addEventListener('input', updateSensitivity);
    document.getElementById('fov-slider').addEventListener('input', updateFOV);
}

function getDirection() {
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    const angle = Math.atan2(direction.x, direction.z) * (180 / Math.PI);
    if (angle >= -45 && angle < 45) return { text: 'Norte', color: 'blue' };
    if (angle >= 45 && angle < 135) return { text: 'Leste', color: 'yellow' };
    if (angle >= 135 || angle < -135) return { text: 'Sul', color: 'red' };
    if (angle >= -135 && angle < -45) return { text: 'Oeste', color: 'green' };
}

function animate(timestamp) {
    const deltaTime = Math.min(timestamp - lastFrameTime, 100);
    if (deltaTime < MIN_FRAME_TIME) {
        requestAnimationFrame(animate);
        return;
    }
    lastFrameTime = timestamp;

    requestAnimationFrame(animate);

    if (cameraMode === 0) {
        // Modo primeira pessoa
    } else {
        player.rotation.y = cameraAngleY;
    }

    velocity.y -= GRAVITY * (deltaTime / 16);
    player.position.y += velocity.y * (deltaTime / 16);

    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion);
    direction.y = 0;
    direction.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();

    const currentSpeed = isSprinting ? SPRINT_SPEED : NORMAL_SPEED;
    if (moveForward) velocity.z = -currentSpeed;
    else if (moveBackward) velocity.z = currentSpeed;
    else velocity.z = 0;

    if (moveRight) velocity.x = currentSpeed;
    else if (moveLeft) velocity.x = -currentSpeed;
    else velocity.x = 0;

    player.position.x += velocity.x * Math.cos(player.rotation.y) * (deltaTime / 16) + velocity.z * Math.sin(player.rotation.y) * (deltaTime / 16);
    player.position.z += velocity.z * Math.cos(player.rotation.y) * (deltaTime / 16) - velocity.x * Math.sin(player.rotation.y) * (deltaTime / 16);

    checkCollision();

    if (player.position.y < -10) {
        setTimeout(() => {
            player.position.set(0, BLOCK_SIZE, 0);
            velocity.y = 0;
            canJump = true;
        }, 2000);
    }

    if (cameraMode === 1) {
        updateCameraOrbit();
    }

    if (!inventoryOpen && !optionsOpen && !sensitivityOpen && !fovOpen && !controlsOpen) updateOutline();

    hudUpdateCounter++;
    if (showFPS && hudUpdateCounter % 15 === 0) {
        document.getElementById('fpsCounter').innerText = `FPS: ${Math.round(1000 / deltaTime)}`;
        const dir = getDirection();
        document.getElementById('direction').innerHTML = `<span style="color: ${dir.color}">${dir.text}</span>`;
        document.getElementById('positionX').innerText = `X: ${player.position.x.toFixed(2)}`;
        document.getElementById('positionY').innerText = `Y: ${player.position.y.toFixed(2)}`;
        document.getElementById('positionZ').innerText = `Z: ${player.position.z.toFixed(2)}`;
        hudUpdateCounter = 0;
    }

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

init();
