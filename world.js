// world.js
const BLOCK_SIZE = 1;
const GRID_SIZE = 20;
let blocks = {};
let outlineMesh = null;
let sceneRef = null;

const textureLoader = new THREE.TextureLoader();
const textures = {
    grass: textureLoader.load('img/bloco_de_grama.png'),
    stone: textureLoader.load('img/bloco_de_pedra.png'),
    lampblock: textureLoader.load('img/bloco_de_lampada_ativa.png'),
};
for(let key in textures) {
    textures[key].magFilter = THREE.NearestFilter; // Para o visual pixelado
}

export function createWorld(scene) {
    sceneRef = scene;
    const floorMaterial = new THREE.MeshStandardMaterial({ map: textures.grass });
    for (let x = -GRID_SIZE / 2; x < GRID_SIZE / 2; x++) {
        for (let z = -GRID_SIZE / 2; z < GRID_SIZE / 2; z++) {
            addBlock(x, 0, z, 'grass', floorMaterial);
        }
    }
    
    // Adiciona a malha de contorno à cena
    const outlineGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    const outlineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    outlineMesh = new THREE.LineSegments(outlineGeometry, outlineMaterial);
    outlineMesh.scale.set(1.01, 1.01, 1.01);
    outlineMesh.visible = false;
    scene.add(outlineMesh);
    
    return { blocks, getNearbyBlocks, placeBlock, breakBlock };
}

function addBlock(x, y, z, type, material) {
    const key = `${x},${y},${z}`;
    const geometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    const block = new THREE.Mesh(geometry, material);
    block.position.set(x, y, z);
    block.castShadow = true;
    block.receiveShadow = true;
    sceneRef.add(block);
    blocks[key] = { x, y, z, type, mesh: block };
}

function getTargetBlock(camera, forPlacing = false) {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const intersects = raycaster.intersectObjects(Object.values(blocks).map(b => b.mesh));

    if (intersects.length > 0 && intersects[0].distance < 8) {
        const intersect = intersects[0];
        const position = new THREE.Vector3().copy(intersect.object.position);
        if (forPlacing) {
            position.add(intersect.face.normal);
        }
        return {
            position: position,
            object: intersect.object
        };
    }
    return null;
}

export function updateWorld(gameState) {
    const target = getTargetBlock(gameState.camera);
    if (target) {
        outlineMesh.position.copy(target.object.position);
        outlineMesh.visible = true;
    } else {
        outlineMesh.visible = false;
    }
}

export function placeBlock(gameState) {
    const { camera, player, settings, ui } = gameState;
    const target = getTargetBlock(camera, true);
    if (target && ui.selectedItem !== 'arm') {
        const { x, y, z } = target.position;
        const key = `${x},${y},${z}`;

        // Checa se o jogador está no caminho do novo bloco
        const playerBox = new THREE.Box3().setFromCenterAndSize(
            player.model.position,
            new THREE.Vector3(0.6, 1.8, 0.6)
        );
        const newBlockBox = new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(x, y, z),
            new THREE.Vector3(1, 1, 1)
        );

        // LÓGICA MELHORADA PARA "CONSTRUIR ABAIXO"
        const isBuildingBelow = Math.abs(x - Math.round(player.model.position.x)) < 1 &&
                                Math.abs(z - Math.round(player.model.position.z)) < 1 &&
                                y < player.model.position.y;

        if (playerBox.intersectsBox(newBlockBox) && !(settings.buildBelow && isBuildingBelow)) {
            return; // Impede a construção se colidir com o jogador, a menos que a opção especial esteja ativa
        }
        
        if (!blocks[key]) {
            const material = new THREE.MeshStandardMaterial({ map: textures[ui.selectedItem] });
            addBlock(x, y, z, ui.selectedItem, material);

            // Se construiu abaixo com a opção ativa, move o jogador para cima
            if (settings.buildBelow && isBuildingBelow) {
                player.model.position.y += 1.0;
                player.velocity.y = 0; // Impede que a gravidade puxe para baixo imediatamente
            }
        }
    }
}

export function breakBlock(gameState) {
    const target = getTargetBlock(gameState.camera);
    if(target) {
        const {x, y, z} = target.object.position;
        const key = `${x},${y},${z}`;
        if(blocks[key]) {
            sceneRef.remove(blocks[key].mesh);
            delete blocks[key];
        }
    }
}

function getNearbyBlocks(position, radius = 2) {
    const nearby = [];
    for (let key in blocks) {
        const block = blocks[key];
        if (Math.abs(block.x - position.x) < radius &&
            Math.abs(block.y - position.y) < radius + 1 && // Checa um pouco mais na vertical
            Math.abs(block.z - position.z) < radius) {
            nearby.push(block);
        }
    }
    return nearby;
}
