import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Variables globales
let scene, camera, renderer;
let surfboard, surfer;
let water, sky;
let mouseX = 0, mouseY = 0;
let targetX = 0, targetY = 0;
let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;
let obstacles = [];
let gameOver = false;

// Inicialización
init();
animate();

function init() {
    // Crear escena
    scene = new THREE.Scene();
    
    // Crear cámara
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 10);
    
    // Crear renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    document.body.appendChild(renderer.domElement);
    
    // Luces
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    
    // Crear agua
    createWater();
    
    // Crear cielo
    createSky();
    
    // Crear surfista y tabla
    createSurferAndBoard();
    
    // Crear obstáculos
    createObstacles();
    
    // Event listeners
    document.addEventListener('mousemove', onDocumentMouseMove);
    window.addEventListener('resize', onWindowResize);
}

function createObstacles() {
    // Limpiar obstáculos existentes
    obstacles.forEach(obstacle => scene.remove(obstacle));
    obstacles = [];
    
    // Crear varios obstáculos
    const numObstacles = 15;
    
    for (let i = 0; i < numObstacles; i++) {
        // Geometría y material para los obstáculos (rocas)
        const obstacleGeometry = new THREE.IcosahedronGeometry(Math.random() * 0.5 + 0.5, 0);
        const obstacleMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x555555,
            roughness: 0.8,
            metalness: 0.2
        });
        
        const obstacle = new THREE.Mesh(obstacleGeometry, obstacleMaterial);
        
        // Posicionar aleatoriamente en el agua
        obstacle.position.x = Math.random() * 40 - 20;
        obstacle.position.y = 0;
        obstacle.position.z = Math.random() * 100 - 50;
        
        // Añadir a la escena y al array de obstáculos
        scene.add(obstacle);
        obstacles.push(obstacle);
    }
}

function createWater() {
    // Geometría plana para el agua
    const waterGeometry = new THREE.PlaneGeometry(100, 100, 32, 32);
    
    // Material para el agua con efecto de ondas
    const waterMaterial = new THREE.MeshStandardMaterial({
        color: 0x0077be,
        metalness: 0.1,
        roughness: 0.3,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
    });
    
    water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.5;
    scene.add(water);
    
    // Animación de ondas para el agua
    const vertices = water.geometry.attributes.position.array;
    const waves = [];
    
    for (let i = 0; i < vertices.length / 3; i++) {
        waves.push({
            x: vertices[i * 3],
            y: vertices[i * 3 + 1],
            z: vertices[i * 3 + 2],
            ang: Math.random() * Math.PI * 2,
            amp: 0.1 + Math.random() * 0.1,
            speed: 0.05 + Math.random() * 0.05
        });
    }
    
    water.userData.waves = waves;
}

function createSky() {
    // Fondo de cielo simple
    scene.background = new THREE.Color(0x87ceeb);
    
    // Geometría para el horizonte
    const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
    const skyMaterial = new THREE.MeshBasicMaterial({
        color: 0x87ceeb,
        side: THREE.BackSide
    });
    
    sky = new THREE.Mesh(skyGeometry, skyMaterial);
    scene.add(sky);
}

function createSurferAndBoard() {
    // Crear tabla de surf
    const boardGeometry = new THREE.BoxGeometry(1, 0.1, 3);
    const boardMaterial = new THREE.MeshStandardMaterial({ color: 0xf7e26b });
    surfboard = new THREE.Mesh(boardGeometry, boardMaterial);
    surfboard.position.y = 0;
    scene.add(surfboard);
    
    // Crear surfista (representación simple) - Color verde
    const bodyGeometry = new THREE.CapsuleGeometry(0.3, 1, 4, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x00FF00 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.8;
    
    const headGeometry = new THREE.SphereGeometry(0.25, 16, 16);
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0x00FF00 });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.5;
    
    // Brazos
    const armGeometry = new THREE.CapsuleGeometry(0.1, 0.6, 4, 8);
    const armMaterial = new THREE.MeshStandardMaterial({ color: 0x00FF00 });
    
    const leftArm = new THREE.Mesh(armGeometry, armMaterial);
    leftArm.position.set(-0.4, 0.8, 0);
    leftArm.rotation.z = -Math.PI / 4;
    
    const rightArm = new THREE.Mesh(armGeometry, armMaterial);
    rightArm.position.set(0.4, 0.8, 0);
    rightArm.rotation.z = Math.PI / 4;
    
    // Piernas
    const legGeometry = new THREE.CapsuleGeometry(0.12, 0.7, 4, 8);
    const legMaterial = new THREE.MeshStandardMaterial({ color: 0x00FF00 });
    
    const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
    leftLeg.position.set(-0.2, 0.2, 0);
    
    const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
    rightLeg.position.set(0.2, 0.2, 0);
    
    // Traje de baño
    const trunksGeometry = new THREE.BoxGeometry(0.6, 0.2, 0.3);
    const trunksMaterial = new THREE.MeshStandardMaterial({ color: 0x0000ff });
    const trunks = new THREE.Mesh(trunksGeometry, trunksMaterial);
    trunks.position.y = 0.4;
    
    // Agrupar todo el surfista
    surfer = new THREE.Group();
    surfer.add(body);
    surfer.add(head);
    surfer.add(leftArm);
    surfer.add(rightArm);
    surfer.add(leftLeg);
    surfer.add(rightLeg);
    surfer.add(trunks);
    
    // Posicionar el surfista sobre la tabla
    surfer.position.y = 0.1;
    surfboard.add(surfer);
}

function onDocumentMouseMove(event) {
    mouseX = (event.clientX - windowHalfX) / 100;
    mouseY = (event.clientY - windowHalfY) / 100;
}

function onWindowResize() {
    windowHalfX = window.innerWidth / 2;
    windowHalfY = window.innerHeight / 2;
    
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    
    // Si el juego terminó, no actualizar
    if (gameOver) {
        return;
    }
    
    // Suavizar el movimiento
    targetX = mouseX * 0.5;
    targetY = mouseY * 0.2;
    
    // Mover el surfista y la tabla
    if (surfboard) {
        surfboard.rotation.z = -targetX * 0.2; // Inclinación lateral
        surfboard.rotation.x = -targetY * 0.1; // Inclinación frontal
        
        // Avanzar en la dirección del mouse
        surfboard.position.x += targetX * 0.05;
        
        // Limitar el movimiento para que no se salga demasiado
        surfboard.position.x = Math.max(-20, Math.min(20, surfboard.position.x));
        
        // Movimiento hacia adelante constante
        surfboard.position.z -= 0.05;
        
        // Reiniciar posición cuando se aleja demasiado
        if (surfboard.position.z < -50) {
            surfboard.position.z = 50;
            // Regenerar obstáculos cuando se reinicia la posición
            createObstacles();
        }
        
        // Detectar colisiones con obstáculos
        checkCollisions();
    }
    
    // Animar las olas
    if (water && water.userData.waves) {
        const waves = water.userData.waves;
        const vertices = water.geometry.attributes.position.array;
        
        for (let i = 0; i < waves.length; i++) {
            const wave = waves[i];
            wave.ang += wave.speed;
            vertices[i * 3 + 2] = wave.z + Math.sin(wave.ang) * wave.amp;
        }
        
        water.geometry.attributes.position.needsUpdate = true;
    }
    
    // Actualizar la cámara para seguir al surfista
    if (surfboard) {
        camera.position.x = surfboard.position.x;
        camera.position.z = surfboard.position.z + 10;
        camera.lookAt(surfboard.position);
    }
    
    renderer.render(scene, camera);
}

function checkCollisions() {
    // Radio de colisión para el surfista
    const surferRadius = 0.8;
    
    // Verificar colisiones con cada obstáculo
    for (let i = 0; i < obstacles.length; i++) {
        const obstacle = obstacles[i];
        const obstacleRadius = obstacle.geometry.parameters.radius;
        
        // Calcular distancia entre surfista y obstáculo
        const dx = surfboard.position.x - obstacle.position.x;
        const dz = surfboard.position.z - obstacle.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        // Si hay colisión
        if (distance < (surferRadius + obstacleRadius)) {
            // Cambiar color del surfista a rojo para indicar colisión
            surfer.children.forEach(part => {
                if (part.material && part.material.color) {
                    part.material.color.set(0xFF0000);
                }
            });
            
            // Hacer que el surfista rebote
            surfboard.position.x += dx * 0.1;
            surfboard.position.z += dz * 0.1;
            
            // Opcional: Agregar más efectos de colisión aquí
            
            // Después de 1 segundo, volver al color verde
            setTimeout(() => {
                surfer.children.forEach(part => {
                    if (part.material && part.material.color && part.name !== 'trunks') {
                        part.material.color.set(0x00FF00);
                    }
                });
            }, 1000);
            
            break;
        }
    }
}