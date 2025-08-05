// player.js
const PLAYER_HEIGHT = 1.8;
const PLAYER_WIDTH = 0.6;
const GRAVITY = 30.0; // Gravidade mais forte para uma sensação mais "Minecraft"
const JUMP_VELOCITY = 9.0;
const LERP_SPEED = 15.0; // Velocidade para suavizar a subida

let playerObject = null;
let velocity = new THREE.Vector3();
let onGround = false;
let verticalOffset = 0; // Para a subida suave

export function createPlayer(scene, camera) {
    const player = new THREE.Object3D();
    player.position.set(0, 10, 0); // Começa um pouco mais alto para cair no mundo
    scene.add(player);
    player.add(camera);
    camera.position.set(0, PLAYER_HEIGHT / 2, 0);

    playerObject = {
        model: player,
        velocity: velocity,
        canJump: true,
        isSprinting: false,
        lastWPressTime: 0,
    };
    return playerObject;
}

export function updatePlayer(gameState, deltaTime) {
    const { player, world, controls } = gameState;
    
    // Aplica gravidade
    velocity.y -= GRAVITY * deltaTime;

    // Movimento
    handleMovement(gameState, deltaTime);

    // Interpolação suave para a subida de bloco
    if (verticalOffset > 0) {
        const step = LERP_SPEED * deltaTime;
        const amount = Math.min(step, verticalOffset);
        player.model.position.y += amount;
        verticalOffset -= amount;
    }
    
    // Aplica a velocidade calculada
    player.model.position.x += velocity.x * deltaTime;
    player.model.position.y += velocity.y * deltaTime;
    player.model.position.z += velocity.z * deltaTime;

    // Colisão
    checkCollision(gameState);

    // Queda no vácuo
    if (player.model.position.y < -30) {
        player.model.position.set(0, 10, 0);
        velocity.set(0, 0, 0);
    }
}

function handleMovement(gameState, deltaTime) {
    const { player, controls, settings } = gameState;
    const speed = player.isSprinting ? 8.0 : 5.0;
    
    const moveDirection = new THREE.Vector3(
        (controls.moveRight ? 1 : 0) - (controls.moveLeft ? 1 : 0),
        0,
        (controls.moveBackward ? 1 : 0) - (controls.moveForward ? 1 : 0)
    );
    moveDirection.normalize().applyQuaternion(player.model.quaternion);

    velocity.x = moveDirection.x * speed;
    velocity.z = moveDirection.z * speed;
    
    if (controls.jump && player.canJump) {
        velocity.y = JUMP_VELOCITY;
        player.canJump = false;
    }
    controls.jump = false; // Consome o pulo
}

function checkCollision(gameState) {
    const { player, world } = gameState;
    const playerBox = new THREE.Box3().setFromCenterAndSize(
        player.model.position,
        new THREE.Vector3(PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_WIDTH)
    );
    playerBox.min.y = player.model.position.y;
    playerBox.max.y = player.model.position.y + PLAYER_HEIGHT;
    
    onGround = false;

    // Obtém blocos próximos para verificar a colisão
    const nearbyBlocks = world.getNearbyBlocks(player.model.position);

    for (const block of nearbyBlocks) {
        const blockBox = new THREE.Box3().setFromObject(block.mesh);
        
        // Colisão no eixo Y
        if (playerBox.intersectsBox(blockBox)) {
            const overlapY = playerBox.max.y - blockBox.min.y;
            
            if (velocity.y <= 0 && overlapY > 0 && player.model.position.y >= blockBox.max.y - 0.1) {
                 player.model.position.y = blockBox.max.y;
                 velocity.y = 0;
                 onGround = true;
                 player.canJump = true;
            } else if (velocity.y > 0 && playerBox.min.y < blockBox.max.y) {
                 player.model.position.y = blockBox.min.y - PLAYER_HEIGHT;
                 velocity.y = 0;
            }
        }
    }
    
    for (const block of nearbyBlocks) {
        const blockBox = new THREE.Box3().setFromObject(block.mesh);

        // Colisão nos eixos X e Z
        if (playerBox.intersectsBox(blockBox)) {
             // Lógica de Subida Suave (Auto-Climb)
             const headLevel = player.model.position.y + PLAYER_HEIGHT - 0.1;
             const stepHeight = blockBox.max.y - player.model.position.y;
            
             if (onGround && stepHeight > 0 && stepHeight <= 1.05 && headLevel > blockBox.max.y) {
                 verticalOffset += stepHeight; // Aciona a interpolação suave
                 player.model.position.y += 0.01; // Pequeno empurrão para evitar ficar preso
                 continue; // Pula para o próximo bloco para não tratar como parede
             }

            // Resolução de colisão horizontal
            const dir = new THREE.Vector3().subVectors(player.model.position, block.mesh.position).normalize();
            if (Math.abs(dir.x) > Math.abs(dir.z)) {
                player.model.position.x = block.mesh.position.x + (Math.sign(dir.x) * (0.5 + PLAYER_WIDTH / 2));
            } else {
                player.model.position.z = block.mesh.position.z + (Math.sign(dir.z) * (0.5 + PLAYER_WIDTH / 2));
            }
            velocity.x = 0;
            velocity.z = 0;
        }
    }
}
