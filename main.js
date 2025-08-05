import { setupScene } from './scene.js';
import { createPlayer, updatePlayer, getPlayer } from './player.js';
import { createWorld, updateWorld } from './world.js';
import { setupInputListeners } from './controls.js';
import { setupUI, updateHUD } from './ui.js';

// Estado global do jogo
const gameState = {
    scene: null,
    camera: null,
    renderer: null,
    player: null,
    world: null,
    ui: {
        lastFrameTime: performance.now(),
        showFPS: true
    },
    controls: {
        isLocked: false,
        isLeftMouseDown: false,
        isRightMouseDown: false,
    },
    settings: {
        mouseSensitivity: 0.001,
        fov: 75,
        pressDelay: 100,
        fastPressDelay: 100,
        autoClimb: true,
        fastBuild: false,
        buildBelow: false,
    }
};

function init() {
    // Configura a cena, câmera e renderer do Three.js
    const { scene, camera, renderer } = setupScene();
    gameState.scene = scene;
    gameState.camera = camera;
    gameState.renderer = renderer;

    // Cria o jogador e adiciona à cena
    gameState.player = createPlayer(scene, camera);

    // Cria o mundo de blocos
    gameState.world = createWorld(scene);

    // Configura os ouvintes de eventos (teclado, mouse, toque)
    setupInputListeners(document, gameState);

    // Configura a interface do usuário (menus, botões, etc.)
    setupUI(document, gameState);

    // Inicia o loop do jogo
    animate();
}

function animate() {
    requestAnimationFrame(animate);

    const now = performance.now();
    const deltaTime = (now - gameState.ui.lastFrameTime) / 1000.0; // Delta time em segundos

    // Atualiza a lógica do jogador (movimento, física)
    updatePlayer(gameState, deltaTime);
    
    // Atualiza a lógica do mundo (contorno do bloco, etc.)
    updateWorld(gameState);

    // Atualiza a interface (HUD)
    updateHUD(document, gameState);

    gameState.ui.lastFrameTime = now;
    gameState.renderer.render(gameState.scene, gameState.camera);
}

// Redimensionar a janela
window.addEventListener('resize', () => {
    if (gameState.camera && gameState.renderer) {
        gameState.camera.aspect = window.innerWidth / window.innerHeight;
        gameState.camera.updateProjectionMatrix();
        gameState.renderer.setSize(window.innerWidth, window.innerHeight);
    }
});

// Iniciar o jogo quando a página carregar
window.addEventListener('load', init);
