import * as THREE from 'three';
import * as Tone from 'tone';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Variables globales
let scene, camera, renderer;
let surfboard, surfer;
let water, sky;
let island;
let stars;
let mouseX = 0, mouseY = 0;
let targetX = 0, targetY = 0;
let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;
let obstacles = [];
let gameOver = false;

// Audio
let audioStarted = false;
let bgLoop = null;
let bgGain = null;
let hitSynth = null;
let collisionCooldown = false;

// Partículas de explosión de rocas
let rockExplosions = [];

// Velocidad y aceleración hacia adelante
let forwardSpeed = 0.06;
let maxForwardSpeed = 0.24;
let forwardAcceleration = 0.0002; // incremento por frame aprox 60fps

// Puntuación
let score = 0;
let scoreEl = null;
let winEl = null;

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
    
    // Crear isla en el horizonte
    createIsland();

    // Crear surfista y tabla
    createSurferAndBoard();
    
    // Crear obstáculos
    createObstacles();
    // Ajustar materiales de rocas actuales para que brillen
    makeObstaclesShiny();
    
    // Event listeners
    document.addEventListener('mousemove', onDocumentMouseMove);
    window.addEventListener('resize', onWindowResize);
    // Iniciar audio tras primera interacción del usuario (móvil/desktop)
    const startOnce = () => { startAudioOnce(); cleanupAudioStarters(); };
    document.addEventListener('pointerdown', startOnce);
    document.addEventListener('touchstart', startOnce, { passive: true });
    document.addEventListener('keydown', startOnce);
}

function createObstacles() {
    // Limpiar obstáculos existentes
    obstacles.forEach(obstacle => scene.remove(obstacle));
    obstacles = [];
    
    // Crear varios obstáculos
    const numObstacles = 80;
    
    for (let i = 0; i < numObstacles; i++) {
        // Geometría y material para los obstáculos (rocas)
        const obstacleGeometry = new THREE.IcosahedronGeometry(Math.random() * 0.5 + 0.5, 0);
        const obstacleMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xE6EEF7, // casi blanco azulado
            roughness: 0.25,
            metalness: 0.5,
            envMapIntensity: 0.8
        });
        
        const obstacle = new THREE.Mesh(obstacleGeometry, obstacleMaterial);
        
        // Posicionar por delante del jugador en dirección de avance (z decreciente)
        // Expandir en todo el ancho visible
        obstacle.position.x = (Math.random() * 44) - 22; // ~pantalla completa, coincide con límites de movimiento
        obstacle.position.y = 0;
        const baseZ = surfboard ? surfboard.position.z : 0;
        obstacle.position.z = baseZ - (Math.random() * 1000 + 80); // campo largo: 80 a 1080 por delante (más negativo)
        
        // Añadir a la escena y al array de obstáculos
        scene.add(obstacle);
        obstacles.push(obstacle);
    }
    // UI
    scoreEl = document.getElementById('score');
    winEl = document.getElementById('win');
}

function createWater() {
    // Geometría para el agua (alta resolución para desplazamiento suave)
    const waterGeometry = new THREE.PlaneGeometry(400, 400, 200, 200);

    // Paleta inspirada en Hokusai: azul profundo, azul claro, espuma marfil
    const baseDeep = new THREE.Color(0x2d6fa3); // azul medio claro
    const baseLight = new THREE.Color(0x6fb3e6); // azul claro luminoso
    const foam = new THREE.Color(0xf4f1e6); // marfil suave

    const uniforms = {
        uTime: { value: 0 },
        uBaseDeep: { value: baseDeep },
        uBaseLight: { value: baseLight },
        uFoam: { value: foam },
        uScale: { value: 0.8 },
        uSpeed: { value: 0.25 }
    };

    const vertexShader = `
        uniform float uTime;
        uniform float uScale;
        uniform float uSpeed;
        varying float vHeight;
        varying vec2 vUv;
        
        // ondas combinadas tipo ukiyo-e
        float wave(vec2 p, float f, float a) {
            return sin(p.x * f + uTime * uSpeed) * a + cos(p.y * f * 0.7 + uTime * uSpeed * 1.2) * a * 0.7;
        }
        
        void main() {
            vUv = uv;
            vec3 pos = position;
            vec2 p = position.xz * uScale * 0.6;
            float h = 0.0;
            h += wave(p, 0.7, 0.15);
            h += wave(p * 1.7, 1.8, 0.06);
            h += wave(p * 3.1, 3.2, 0.02);
            pos.z += h; // pequeña elevación vertical en el plano XZ (plano está rotado posteriormente)
            vHeight = h;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `;

    const fragmentShader = `
        precision highp float;
        varying float vHeight;
        varying vec2 vUv;
        uniform vec3 uBaseDeep;
        uniform vec3 uBaseLight;
        uniform vec3 uFoam;
        
        void main() {
            // Mezcla por altura con menor contraste
            float h = clamp((vHeight + 0.18) * 1.3, 0.0, 1.0);
            vec3 base = mix(uBaseDeep, uBaseLight, h);
            
            // Espuma más sutil
            float stripes = smoothstep(0.88, 0.96, h) * 0.6 + smoothstep(0.58, 0.64, h) * 0.3;
            stripes = clamp(stripes, 0.0, 0.6);
            vec3 color = mix(base, uFoam, stripes * 0.35);
            
            // Grano muy leve
            float grain = fract(sin(dot(vUv * 320.0, vec2(12.9898,78.233))) * 43758.5453);
            color *= (0.99 + grain * 0.01);
            
            gl_FragColor = vec4(color, 1.0);
        }
    `;

    const waterMaterial = new THREE.ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader,
        side: THREE.DoubleSide
    });

    water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.5;
    scene.add(water);
    water.userData.uniforms = uniforms;
}

function createSky() {
    // Cielo nocturno oscuro
    scene.background = new THREE.Color(0x02060d);
    
    // Geometría para el horizonte
    const skyGeometry = new THREE.SphereGeometry(1000, 32, 32);
    const skyMaterial = new THREE.MeshBasicMaterial({ color: 0x02060d, side: THREE.BackSide });
    
    sky = new THREE.Mesh(skyGeometry, skyMaterial);
    scene.add(sky);

    // Estrellas
    const starCount = 1500;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
        // puntos aleatorios en una cúpula amplia
        const r = 900;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(THREE.MathUtils.randFloat(-0.1, 1)); // favorecer cúpula superior
        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.cos(phi);
        const z = r * Math.sin(phi) * Math.sin(theta);
        starPositions[i * 3] = x;
        starPositions[i * 3 + 1] = y;
        starPositions[i * 3 + 2] = z;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.0, sizeAttenuation: true, depthWrite: false });
    stars = new THREE.Points(starGeo, starMat);
    sky.add(stars);
}

function createSurferAndBoard() {
    // Crear tabla de surf con forma redondeada
    const boardGeometry = createSurfboardGeometry({ length: 3, width: 1, thickness: 0.12 });
    const boardMaterial = new THREE.MeshStandardMaterial({ color: 0xf7e26b, roughness: 0.6, metalness: 0.1 });
    surfboard = new THREE.Mesh(boardGeometry, boardMaterial);
    surfboard.rotation.x = -Math.PI / 2; // Acostar la tabla sobre el agua
    surfboard.position.y = 0;
    scene.add(surfboard);
    
    // Surfer humano low-poly
    const skinColor = 0xC68642; // piel marrón clara
    const shirtColor = 0xFF69B4; // rosa
    const shortColor = 0x2c5f92; // azul del mar
    const hairColor = 0x3a2f2f;

    surfer = new THREE.Group();

    // Torso
    const torso = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.22, 0.6, 8, 12),
        new THREE.MeshStandardMaterial({ color: shirtColor })
    );
    torso.position.set(0, 0.6, 0);
    surfer.add(torso);

    // Cabeza
    const humanHead = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 16, 16),
        new THREE.MeshStandardMaterial({ color: skinColor })
    );
    humanHead.position.set(0, 1.05, 0.05);
    surfer.add(humanHead);

    // Pelo
    const hair = new THREE.Mesh(
        new THREE.SphereGeometry(0.19, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: hairColor })
    );
    hair.position.copy(humanHead.position);
    surfer.add(hair);

    // Brazos
    const armGeo = new THREE.CapsuleGeometry(0.07, 0.35, 6, 10);
    const armMat = new THREE.MeshStandardMaterial({ color: skinColor });
    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-0.28, 0.75, 0);
    leftArm.rotation.z = Math.PI / 2; // T-pose: brazo horizontal
    surfer.add(leftArm);
    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.set(0.28, 0.75, 0);
    rightArm.rotation.z = -Math.PI / 2; // T-pose: brazo horizontal
    surfer.add(rightArm);

    // Cintura/shorts
    const hips = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.2, 0.2),
        new THREE.MeshStandardMaterial({ color: shortColor })
    );
    hips.position.set(0, 0.38, 0);
    surfer.add(hips);

    // Piernas
    const legGeo = new THREE.CapsuleGeometry(0.09, 0.4, 6, 10);
    const legMat = new THREE.MeshStandardMaterial({ color: skinColor });
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.11, 0.15, 0);
    leftLeg.rotation.x = 0;
    surfer.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.11, 0.15, 0);
    rightLeg.rotation.x = 0;
    surfer.add(rightLeg);

    // Ojos
    const eyeGeometry = new THREE.SphereGeometry(0.03, 8, 8);
    const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x2b2b2b });
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.06, 1.08, 0.16);
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.06, 1.08, 0.16);
    surfer.add(leftEye);
    surfer.add(rightEye);

    // Guardar referencias para animación sutil de la pose
    surfer.userData.parts = { torso, leftArm, rightArm, leftLeg, rightLeg };
    
    // Posicionar el surfer sobre la tabla y mantenerlo vertical
    surfer.position.y = 0.2;
    surfer.position.z = 0.15;
    surfer.rotation.x = Math.PI / 2; // contrarrestar la rotación de la tabla
    surfer.scale.set(0.95, 0.95, 0.95);
    surfboard.add(surfer);
}

function createSurfboardGeometry(options) {
    const length = options.length || 3;
    const width = options.width || 1;
    const thickness = options.thickness || 0.12;

    const halfLength = length / 2;
    const halfWidth = width / 2;

    const shape = new THREE.Shape();

    // Empezar en la esquina izquierda del tail
    shape.moveTo(-halfWidth, -halfLength);

    // Cola redondeada (semicírculo)
    shape.absarc(0, -halfLength, halfWidth, Math.PI, 0, false);

    // Borde derecho hacia la nariz (curvas suaves tipo surfboard)
    shape.bezierCurveTo(
        halfWidth, -halfLength + length * 0.35,
        halfWidth * 0.55, halfLength * 0.6,
        0, halfLength
    );

    // Borde izquierdo de vuelta al tail
    shape.bezierCurveTo(
        -halfWidth * 0.55, halfLength * 0.6,
        -halfWidth, -halfLength + length * 0.35,
        -halfWidth, -halfLength
    );

    const extrudeSettings = {
        depth: thickness,
        bevelEnabled: true,
        bevelThickness: Math.min(0.04, thickness * 0.5),
        bevelSize: Math.min(0.04, halfWidth * 0.15),
        bevelSegments: 2,
        steps: 80,
        curveSegments: 64
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    // Centrar la geometría para facilitar transformaciones y posicionamiento
    geometry.center();

    return geometry;
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
        // Acelerar suavemente hasta un máximo
        forwardSpeed = Math.min(maxForwardSpeed, forwardSpeed + forwardAcceleration);
        surfboard.rotation.z = -targetX * 0.2; // Inclinación lateral
        // Mantener la tabla acostada (base -PI/2) y sumar inclinación suave
        surfboard.rotation.x = -Math.PI / 2 - targetY * 0.1; // Inclinación frontal
        
        // Avanzar en la dirección del mouse
        surfboard.position.x += targetX * 0.05;
        
        // Limitar el movimiento para que no se salga demasiado
        surfboard.position.x = Math.max(-20, Math.min(20, surfboard.position.x));
        
        // Movimiento hacia adelante con aceleración
        surfboard.position.z -= forwardSpeed;
        
        // Ya no reiniciamos la posición: el campo de rocas es largo y reciclable
        
        // Detectar colisiones con obstáculos
        checkCollisions();

        // Animación sutil del cuerpo según inclinación
        if (surfer && surfer.userData.parts) {
            const { torso, leftArm, rightArm, leftLeg, rightLeg } = surfer.userData.parts;
            const lean = THREE.MathUtils.clamp(surfboard.rotation.z, -0.4, 0.4);
            const kneeBend = Math.abs(lean) * 0.15; // doblar rodillas según giro
            const armCounter = -lean * 0.5; // contrapeso de brazos

            torso.rotation.z = lean * 0.3;
            leftLeg.rotation.x = kneeBend;
            rightLeg.rotation.x = kneeBend;
            leftArm.rotation.y = armCounter;
            rightArm.rotation.y = armCounter;
        }
    }
    
    // Animar el shader del agua
    if (water && water.userData.uniforms) {
        water.userData.uniforms.uTime.value += 0.016;
    }
    
    // Mantener la isla en el horizonte por delante del jugador
    if (island && surfboard) {
        island.position.x = 0; // centrada
        island.position.z = surfboard.position.z - 220; // horizonte lejano
        island.position.y = -0.35; // casi a nivel del agua
    }
    
    // Actualizar la cámara para seguir al surfista
    if (surfboard) {
        // Mantener el agua centrada bajo la tabla para efecto de mar infinito
        if (water) {
            water.position.x = surfboard.position.x;
            water.position.z = surfboard.position.z;
        }

        camera.position.x = surfboard.position.x;
        camera.position.z = surfboard.position.z + 10;
        camera.lookAt(surfboard.position);

        // Mantener el cielo alrededor de la cámara para que las estrellas parezcan lejanas
        if (sky) {
            sky.position.copy(camera.position);
        }
    }

    // Actualizar explosiones de rocas
    if (rockExplosions.length > 0) {
        for (let i = rockExplosions.length - 1; i >= 0; i--) {
            const exp = rockExplosions[i];
            exp.life -= 0.016; // aprox 60 FPS
            const alpha = Math.max(0, exp.life / exp.maxLife);
            for (let j = 0; j < exp.particles.length; j++) {
                const p = exp.particles[j];
                p.velocity.y -= 0.005; // gravedad ligera
                p.mesh.position.add(p.velocity);
                p.mesh.rotation.x += 0.05;
                p.mesh.rotation.y += 0.03;
                p.mesh.scale.multiplyScalar(0.98);
                p.mesh.material.opacity = alpha;
            }
            if (exp.life <= 0) {
                // limpiar
                exp.particles.forEach(p => scene.remove(p.mesh));
                rockExplosions.splice(i, 1);
            }
        }
    }

    // Reposicionar obstáculos que queden demasiado atrás (más positivos) moviéndolos muy adelante (más negativos)
    for (let i = 0; i < obstacles.length; i++) {
        const obstacle = obstacles[i];
        if (obstacle.position.z > surfboard.position.z + 60) {
            // Reaparecer muy adelante y en todo el ancho
            obstacle.position.x = (Math.random() * 44) - 22;
            obstacle.position.z = surfboard.position.z - (Math.random() * 900 + 200);
        }
    }
    
    renderer.render(scene, camera);
}

function checkCollisions() {
    // Radio de colisión para el delfín (ligeramente menor que el surfista original)
    const dolphinRadius = 0.7;
    
    // Verificar colisiones con cada obstáculo
    for (let i = 0; i < obstacles.length; i++) {
        const obstacle = obstacles[i];
        const obstacleRadius = obstacle.geometry.parameters.radius;
        
        // Calcular distancia entre delfín y obstáculo
        const dx = surfboard.position.x - obstacle.position.x;
        const dz = surfboard.position.z - obstacle.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        // Si hay colisión
        if (distance < (dolphinRadius + obstacleRadius)) {
            // Destruir roca en partículas
            spawnRockExplosion(obstacle.position, obstacle.material.color.getHex());
            scene.remove(obstacle);
            obstacles.splice(i, 1);

            // Audio de colisión: tono grave y ducking temporal del loop
            if (hitSynth && !collisionCooldown) {
                collisionCooldown = true;
                const now = Tone.now();
                hitSynth.triggerAttackRelease('C2', 0.2, now);
                if (bgGain) {
                    bgGain.gain.cancelAndHoldAtTime(now);
                    bgGain.gain.linearRampToValueAtTime(0.1, now + 0.03);
                    bgGain.gain.linearRampToValueAtTime(0.6, now + 0.3);
                }
                setTimeout(() => { collisionCooldown = false; }, 250);
            }

            // Puntuación y victoria
            score += 1;
            if (scoreEl) {
                scoreEl.textContent = `Puntos: ${score} / 100`;
            }
            if (score >= 100 && !gameOver) {
                gameOver = true;
                if (winEl) winEl.style.display = 'block';
            }

            break;
        }
    }
}

function createIsland() {
    island = new THREE.Group();

    // Arena: montículo bajo y ancho
    const sandMat = new THREE.MeshStandardMaterial({ color: 0xEED6A4, roughness: 1.0, metalness: 0.0 });
    const sand = new THREE.Mesh(new THREE.CylinderGeometry(10, 14, 0.6, 32), sandMat);
    sand.rotation.x = 0;
    sand.position.set(0, -0.3, 0);
    island.add(sand);

    // Palmas: varias con alturas y orientaciones ligeramente distintas
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B5A2B, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2F8F2F, roughness: 0.8 });

    function addPalm(px, pz, height) {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, height, 8), trunkMat);
        trunk.position.set(px, -0.3 + height / 2, pz);
        trunk.rotation.z = (Math.random() - 0.5) * 0.15; // leve inclinación
        island.add(trunk);

        const crownY = trunk.position.y + height / 2;
        // Hojas: conos planos alrededor
        const leafGeo = new THREE.ConeGeometry(1.6, 0.3, 10);
        for (let i = 0; i < 6; i++) {
            const leaf = new THREE.Mesh(leafGeo, leafMat);
            leaf.position.set(px, crownY, pz);
            leaf.rotation.x = -Math.PI / 2;
            leaf.rotation.z = (i / 6) * Math.PI * 2;
            island.add(leaf);
        }
    }

    // Palmar extendido izquierda a derecha
    const rows = 2;
    const cols = 9;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const t = c / (cols - 1);
            const x = -6 + t * 12 + (Math.random() - 0.5) * 0.8; // de -6 a 6 aprox
            const z = (r === 0 ? 0.8 : -0.6) + (Math.random() - 0.5) * 0.6;
            const h = 2.4 + Math.random() * 2.0;
            addPalm(x, z, h);
        }
    }

    scene.add(island);
}

function makeObstaclesShiny() {
    for (let i = 0; i < obstacles.length; i++) {
        const o = obstacles[i];
        if (o.material && o.material.isMeshStandardMaterial) {
            o.material.color.set(0xE6EEF7);
            o.material.roughness = 0.25;
            o.material.metalness = 0.5;
            o.material.envMapIntensity = 0.8;
        }
    }
}

function spawnRockExplosion(position, colorHex) {
    const particles = [];
    const count = 40;
    for (let i = 0; i < count; i++) {
        const size = 0.06 + Math.random() * 0.06;
        const mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 1 });
        const geo = new THREE.DodecahedronGeometry(size, 0);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(position.x, position.y + 0.2, position.z);
        scene.add(mesh);
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.3,
            Math.random() * 0.25 + 0.05,
            (Math.random() - 0.5) * 0.3
        );
        particles.push({ mesh, velocity });
    }
    rockExplosions.push({ particles, life: 0.8, maxLife: 0.8 });
}

// -------- AUDIO ---------
function startAudioOnce() {
    if (audioStarted) return;
    audioStarted = true;
    Tone.start().then(() => {
        setupAudio();
    });
}

function cleanupAudioStarters() {
    document.removeEventListener('pointerdown', startAudioOnce);
    document.removeEventListener('touchstart', startAudioOnce);
    document.removeEventListener('keydown', startAudioOnce);
}

function setupAudio() {
    // Ganancia maestra para poder hacer ducking en colisiones
    bgGain = new Tone.Gain(0.4).toDestination();

    // Procesamiento suave
    const reverb = new Tone.Reverb({ decay: 2.8, preDelay: 0.02, wet: 0.18 });
    const lp = new Tone.Filter(1400, 'lowpass', -12);
    lp.connect(reverb);
    reverb.connect(bgGain);

    // Sintetizador principal (timbre amable)
    const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.25, sustain: 0.25, release: 0.4 }
    }).connect(lp);

    // Tempo y swing
    Tone.Transport.bpm.value = 125;
    Tone.Transport.swing = 0.1;
    Tone.Transport.swingSubdivision = '8n';

    // Progresión de acordes (Cmaj7 – Am7 – Fmaj7 – G7)
    const chords = [
        ['C4', 'E4', 'G4', 'B4'],
        ['A3', 'C4', 'E4', 'G4'],
        ['F4', 'A4', 'C5', 'E5'],
        ['G3', 'B3', 'D4', 'F4']
    ];

    // Arpegio suave a corcheas sobre el acorde vigente
    let stepIndex = 0;
    let barIndex = 0;
    bgLoop = new Tone.Loop(time => {
        const chord = chords[barIndex % chords.length];
        const note = chord[stepIndex % chord.length];
        synth.triggerAttackRelease(note, '8n', time);
        stepIndex++;
        if (stepIndex % 8 === 0) {
            barIndex++;
        }
    }, '8n');

    // Percusión muy ligera
    const kick = new Tone.MembraneSynth({
        pitchDecay: 0.02,
        octaves: 2,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.18, sustain: 0.0, release: 0.18 }
    }).connect(new Tone.Gain(0.35).connect(bgGain));

    const hatFilter = new Tone.Filter(9000, 'highpass');
    const hatGain = new Tone.Gain(0.18).connect(bgGain);
    hatFilter.connect(hatGain);
    const hat = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: 0.03, sustain: 0 }
    }).connect(hatFilter);

    const drumLoop = new Tone.Loop(time => {
        // Kick en los tiempos 1 y 3
        kick.triggerAttackRelease('C1', '8n', time);
        kick.triggerAttackRelease('C1', '8n', time + Tone.Time('2n'));
        // Hi-hat sutil en offbeats
        hat.triggerAttackRelease('16n', time + Tone.Time('8n'));
        hat.triggerAttackRelease('16n', time + Tone.Time('8n') + Tone.Time('4n'));
    }, '1n');

    // Sub-bajo suave en la tónica de cada compás
    const bass = new Tone.MonoSynth({
        oscillator: { type: 'sine' },
        filter: { type: 'lowpass', frequency: 400 },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.2 }
    }).connect(new Tone.Gain(0.25).connect(bgGain));

    const bassLoop = new Tone.Loop(time => {
        const root = chords[barIndex % chords.length][0].replace('4', '2').replace('3', '2');
        bass.triggerAttackRelease(root, '4n', time);
    }, '1m');

    // Sintetizador para sonido de error (grave)
    hitSynth = new Tone.MonoSynth({
        oscillator: { type: 'square' },
        filter: { Q: 2, type: 'lowpass', rolloff: -24 },
        envelope: { attack: 0.005, decay: 0.2, sustain: 0.0, release: 0.1 }
    }).toDestination();

    bgLoop.start(0);
    drumLoop.start(0);
    bassLoop.start(0);
    Tone.Transport.start();
}