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
let advancedOpen = false;
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
let isLeftMouseDown = false;
let isRightMouseDown = false;
let pressDelay = 100;
let fastPressDelay = 100;
let autoClimb = true;
let fastBuild = false;
let buildBelow = false;
let lastBreakTime = 0;
let lastPlaceTime = 0;

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

    document.getElementById('options-button').addEventListener('click', toggleOptions);
    document.getElementById('options-button').addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleOptions();
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
    raycaster.setFromCamera(new THREE.Vector2(0, 0 RosTHREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObjects(Object.values(blocks).map(b => b.mesh).filter(Boolean));
    if (intersects.length > 0) {
        const intersect = intersects[0];
        const blockPos = intersect.object.position.clone();
        const normal = intersect.face.normal.clone().applyQuaternion(intersect.object.quaternion);

        if (action === 'place') {
            const newPos = blockPos.add(normal.multiplyScalar(BLOCK_SIZE));
            return { x: Math.round(newPos.x), y: Math.round(newPos.y), z: Math.round(newPos.z) };
        } else if (action === 'break' || action === 'outline' || action === 'pick') {
            return {
                x: Math.round(blockPos.x),
                y: Math.round(blockPos.y),
                z: Math.round(blockPos.z),
                faceNormal: normal,
                material: intersect.object.material,
                position: blockPos
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
            const geometry = new THREE.EdgesGeometry(block.mesh.geometry);
            const material = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
            outline = new THREE.LineSegments(geometry, material);
            outline.position.copy(block.mesh.position);
            outline.scale.set(1.01, 1.01, 1.01);
            scene.add(outline);
        }
    }
}

function placeBlock() {
    const currentTime = performance.now();
    const delay = fastBuild ? fastPressDelay : pressDelay;
    if (currentTime - lastPlaceTime < delay) return;

    const target = getTargetBlock('place');
    if (target && selectedItem !== 'arm') {
        const key = `${target.x},${target.y},${target.z}`;
        if (!blocks[key]) {
            let blockMaterial;
            if (selectedItem === 'grass') blockMaterial = new THREE.MeshStandardMaterial({ map: grassTexture });
            else if (selectedItem === 'stone') blockMaterial = new THREE.MeshStandardMaterial({ map: stoneTexture });
            else if (selectedItem === 'lampblock') blockMaterial = new THREE.MeshStandardMaterial({ map: lampblockTexture });

            blocks[key] = { x: target.x, y: target.y, z: target.z };
            createOptimizedBlocks(blocks, blockMaterial);

            if (fastBuild && buildBelow) {
                const playerFeetY = Math.round(player.position.y - BLOCK_SIZE);
                if (target.y === playerFeetY && Math.abs(target.x - player.position.x) < PLAYER_WIDTH / 2 && Math.abs(target.z - player.position.z) < PLAYER_WIDTH / 2) {
                    player.position.y += BLOCK_SIZE;
                    velocity.y = 0;
                    canJump = true;
                }
            }
        }
    }
    lastPlaceTime = currentTime;
}

function breakBlock() {
    const currentTime = performance.now();
    const delay = fastBuild ? fastPressDelay : pressDelay;
    if (currentTime - lastBreakTime < delay) return;

    const target = getTargetBlock('break');
    if (target) {
        const key = `${target.x},${target.y},${target.z}`;
        if (blocks[key] && blocks[key].mesh) {
            scene.remove(blocks[key].mesh);
            delete blocks[key];
        }
    }
    lastBreakTime = currentTime;
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

    for (const key in blocks) {
        const block = blocks[key];
        const blockBox = {
            minX: block.x * BLOCK_SIZE - BLOCK_SIZE / 2,
            maxX: block.x * BLOCK_SIZE + BLOCK_SIZE / 2,
            minY: block.y * BLOCK_SIZE - BLOCK_SIZE / 2,
            maxY: block.y * BLOCK_SIZE + BLOCK_SIZE / 2,
            minZ: block.z * BLOCK_SIZE - BLOCK_SIZE / 2,
            maxZ: block.z * BLOCK_SIZE + BLOCK_SIZE / 2
        };

        // Colisão vertical
        if (playerBox.minX < blockBox.maxX && playerBox.maxX > blockBox.minX &&
            playerBox.minZ < blockBox.maxZ && playerBox.maxZ > blockBox.minZ) {
            if (velocity.y <= 0 && playerBox.minY <= blockBox.maxY && playerBox.maxY > blockBox.minY) {
                // Verifica se o jogador está diretamente acima do bloco
                const isAboveBlock = playerBox.minX < blockBox.maxX && playerBox.maxX > blockBox.minX &&
                                    playerBox.minZ < blockBox.maxZ && playerBox.maxZ > blockBox.minZ &&
                                    playerBox.minY >= blockBox.maxY - 0.1; // Pequena tolerância

                if (autoClimb && isAboveBlock && (blockBox.maxY - (player.position.y - PLAYER_HEIGHT)) <= BLOCK_SIZE) {
                    player.position.y = blockBox.maxY;
                    velocity.y = 0;
                    canJump = true;
                    onGround = true;
                } else if (!autoClimb) {
                    player.position.y = blockBox.maxY;
                    velocity.y = 0;
                    canJump = true;
                    onGround = true;
                }
            } else if (velocity.y > 0 && playerBox.maxY >= blockBox.minY && playerBox.minY < blockBox.maxY) {
                player.position.y = blockBox.minY - PLAYER_HEIGHT;
                velocity.y = 0;
            }
        }

        // Colisão horizontal
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
    if (!inventoryOpen && !optionsOpen && !advancedOpen && !controlsOpen && controlMode === 'keyboard') {
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
        advancedOpen = false;
        controlsOpen = false;
        document.getElementById('advanced-panel').style.display = 'none';
        document.getElementById('controls-panel').style.display = 'none';
    } else {
        lockPointer();
    }
}

function toggleAdvanced() {
    advancedOpen = !advancedOpen;
    document.getElementById('advanced-panel').style.display = advancedOpen ? 'block' : 'none';
    if (advancedOpen) {
        unlockPointer();
        optionsOpen = false;
        document.getElementById('options').style.display = 'none';
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
        } else ifa class="option-button" data-action="advanced"><i class="fas fa-tools"></i> Configurações Avançadas</button>
            document.getElementById('options').style.display = 'none';
            document.getElementById('advanced-panel').style.display = 'block';
            advancedOpen = true;
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
        document.getElementById('advanced-panel').style.display = 'none';
        document.getElementById('controls-panel').style.display = 'none';
        document.getElementById('options').style.display = 'block';
        advancedOpen = false;
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

    document.addEventListener('touchstart', (event) => {
        if (controlMode === 'mobile' && !inventoryOpen && !optionsOpen && !advancedOpen && !controlsOpen) {
            const touch = event.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
        }
    });

    document.addEventListener('touchmove', (event) => {
        if (controlMode === 'mobile' && !inventoryOpen && !optionsOpen && !advancedOpen && !controlsOpen) {
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
        if (controlMode === 'mobile' && !inventoryOpen && !optionsOpen && !advancedOpen && !controlsOpen) {
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

function updatePressDelay(event) {
    pressDelay = parseInt(event.target.value);
    document.getElementById('press-delay-value').innerText = pressDelay;
}

function updateResolution(event) {
    const resolution = event.target.value;
    if (resolution === 'auto') {
        renderer.setSize(window.innerWidth, window.innerHeight);
    } else {
        const [width, height] = resolution.split('x').map(Number);
        renderer.setSize(width, height);
    }
}

function updateAutoClimb(event) {
    autoClimb = event.target.checked;
}

function updateFastBuild(event) {
    fastBuild = event.target.checked;
    const fastOptions = document.querySelectorAll('.fast-build-option');
    fastOptions.forEach(option => {
        option.classList.toggle('active', fastBuild);
        const input = option.querySelector('input');
        if (input) input.disabled = !fastBuild;
    });
}

function updateBuildBelow(event) {
    buildBelow = event.target.checked;
}

function updateFastPressDelay(event) {
    fastPressDelay = parseInt(event.target.value);
    document.getElementById('fast-press-delay-value').innerText = fastPressDelay;
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
            if (advancedOpen || controlsOpen) {
                advancedOpen = false;
                controlsOpen = false;
                document.getElementById('advanced-panel').style.display = 'none';
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
            if (!optionsOpen && !advancedOpen && !controlsOpen) {
                toggleInventory();
            }
            return;
        }
        if (event.code === controls.cameraMode) {
            event.preventDefault();
            if (!inventoryOpen && !optionsOpen && !advancedOpen && !controlsOpen) {
                toggleCameraMode();
            }
            return;
        }
        if (inventoryOpen || optionsOpen || advancedOpen || controlsOpen) return;

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
        if (inventoryOpen || optionsOpen || advancedOpen || controlsOpen) return;

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
        if (controlMode === 'keyboard' && !inventoryOpen && !optionsOpen && !advancedOpen && !controlsOpen) {
            if (event.button === 0) {
                isLeftMouseDown = true;
                breakBlock();
            } else if (event.button === 1) {
                pickBlock();
            } else if (event.button === 2) {
                isRightMouseDown = true;
                placeBlock();
            }
        }
    });
    document.addEventListener('mouseup', (event) => {
        if (controlMode === 'keyboard') {
            if (event.button === 0) {
                isLeftMouseDown = false;
            } else if (event.button === 2) {
                isRightMouseDown = false;
            }
        }
    });
    document.addEventListener('mousemove', (event) => {
        if (controlMode === 'keyboard' && !inventoryOpen && !optionsOpen && !advancedOpen && !controlsOpen && document.pointerLockElement === document.body) {
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
    document.getElementById('advanced-panel').addEventListener('click', onPanelClick);
    document.getElementById('controls-panel').addEventListener('click', (e) => {
        onControlsClick(e);
        onPanelClick(e);
    });
    document.getElementById('sensitivity-slider').addEventListener('input', updateSensitivity);
    document.getElementById('fov-slider').addEventListener('input', updateFOV);
    document.getElementById('press-delay-slider').addEventListener('input', updatePressDelay);
    document.getElementById('resolution-select').addEventListener('change', updateResolution);
    document.getElementById('auto-climb-checkbox').addEventListener('change', updateAutoClimb);
    document.getElementById('fast-build-checkbox').addEventListener('change', updateFastBuild);
    document.getElementById('build-below-checkbox').addEventListener('change', updateBuildBelow);
    document.getElementById('fast-press-delay-slider').addEventListener('input', updateFastPressDelay);
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

function animate() {
    requestAnimationFrame(animate);

    if (cameraMode === 0) {
        // Modo primeira pessoa
    } else {
        player.rotation.y = cameraAngleY;
    }

    velocity.y -= GRAVITY;
    player.position.y += velocity.y;

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

    player.position.x += velocity.x * Math.cos(player.rotation.y) + velocity.z * Math.sin(player.rotation.y);
    player.position.z += velocity.z * Math.cos(player.rotation.y) - velocity.x * Math.sin(player.rotation.y);

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

    if (!inventoryOpen && !optionsOpen && !advancedOpen && !controlsOpen) {
        updateOutline();
        if (controlMode === 'keyboard') {
            if (isLeftMouseDown) breakBlock();
            if (isRightMouseDown) placeBlock();
        } else if (controlMode === 'mobile') {
            if (touchStartX !== null && touchStartY !== null) {
                breakBlock();
            }
        }
    }

    if (showFPS) {
        document.getElementById('fpsCounter').innerText = `FPS: ${Math.round(1000 / (performance.now() - lastFrameTime))}`;
        const dir = getDirection();
        document.getElementById('direction').innerHTML = `<span style="color: ${dir.color}">${dir.text}</span>`;
        document.getElementById('positionX').innerText = `X: ${player.position.x.toFixed(2)}`;
        document.getElementById('positionY').innerText = `Y: ${player.position.y.toFixed(2)}`;
        document.getElementById('positionZ').innerText = `Z: ${player.position.z.toFixed(2)}`;
    }
    lastFrameTime = performance.now();

    renderer.render(scene, camera);
}

let lastFrameTime = performance.now();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.inner pawHeight);
});

init();
