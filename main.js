import * as THREE from 'three';
import * as Tone from 'tone';
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

// Audio
let audioStarted = false;
let bgLoop = null;
let bgGain = null;
let hitSynth = null;
let collisionCooldown = false;

// Partículas de explosión de rocas
let rockExplosions = [];

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
    const waterGeometry = new THREE.PlaneGeometry(400, 400, 64, 64);
    
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
    // Crear tabla de surf con forma redondeada
    const boardGeometry = createSurfboardGeometry({ length: 3, width: 1, thickness: 0.12 });
    const boardMaterial = new THREE.MeshStandardMaterial({ color: 0xf7e26b, roughness: 0.6, metalness: 0.1 });
    surfboard = new THREE.Mesh(boardGeometry, boardMaterial);
    surfboard.rotation.x = -Math.PI / 2; // Acostar la tabla sobre el agua
    surfboard.position.y = 0;
    scene.add(surfboard);
    
    // Crear delfín (en lugar del surfista) - Color rosa
    const dolphinColor = 0xFF69B4; // Rosa (Hot Pink)
    
    // Cuerpo principal del delfín
    const bodyGeometry = new THREE.CapsuleGeometry(0.3, 1.2, 8, 16);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: dolphinColor });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.6;
    body.rotation.x = Math.PI / 8; // Inclinar ligeramente el cuerpo
    
    // Cabeza del delfín
    const headGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const headMaterial = new THREE.MeshStandardMaterial({ color: dolphinColor });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.set(0, 0.9, 0.4);
    head.scale.set(1, 0.8, 1.2); // Estirar para forma de delfín
    
    // Hocico del delfín
    const snoutGeometry = new THREE.ConeGeometry(0.15, 0.5, 16);
    const snoutMaterial = new THREE.MeshStandardMaterial({ color: dolphinColor });
    const snout = new THREE.Mesh(snoutGeometry, snoutMaterial);
    snout.position.set(0, 0.8, 0.8);
    snout.rotation.x = -Math.PI / 2; // Rotar para que apunte hacia adelante
    
    // Aleta dorsal
    const finGeometry = new THREE.ConeGeometry(0.2, 0.4, 4);
    const finMaterial = new THREE.MeshStandardMaterial({ color: dolphinColor });
    const dorsalFin = new THREE.Mesh(finGeometry, finMaterial);
    dorsalFin.position.set(0, 0.9, 0);
    dorsalFin.rotation.x = Math.PI / 8; // Inclinar ligeramente
    
    // Aletas laterales
    const sideFinsGeometry = new THREE.ConeGeometry(0.1, 0.4, 8);
    const sideFinsMaterial = new THREE.MeshStandardMaterial({ color: dolphinColor });
    
    const leftFin = new THREE.Mesh(sideFinsGeometry, sideFinsMaterial);
    leftFin.position.set(-0.3, 0.5, 0);
    leftFin.rotation.z = -Math.PI / 2;
    leftFin.rotation.y = -Math.PI / 8;
    
    const rightFin = new THREE.Mesh(sideFinsGeometry, sideFinsMaterial);
    rightFin.position.set(0.3, 0.5, 0);
    rightFin.rotation.z = Math.PI / 2;
    rightFin.rotation.y = Math.PI / 8;
    
    // Cola del delfín
    const tailGeometry = new THREE.BoxGeometry(0.6, 0.1, 0.3);
    const tailMaterial = new THREE.MeshStandardMaterial({ color: dolphinColor });
    const tail = new THREE.Mesh(tailGeometry, tailMaterial);
    tail.position.set(0, 0.5, -0.6);
    tail.rotation.x = -Math.PI / 8;
    
    // Ojos
    const eyeGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
    
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.15, 0.9, 0.6);
    
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.15, 0.9, 0.6);
    
    // Agrupar todo el delfín
    surfer = new THREE.Group();
    surfer.add(body);
    surfer.add(head);
    surfer.add(snout);
    surfer.add(dorsalFin);
    surfer.add(leftFin);
    surfer.add(rightFin);
    surfer.add(tail);
    surfer.add(leftEye);
    surfer.add(rightEye);
    
    // Posicionar el delfín sobre la tabla
    surfer.position.y = 0.2;
    surfer.position.z = 0.3;
    surfer.scale.set(0.8, 0.8, 0.8); // Ajustar tamaño para que se vea mejor en la tabla
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
        surfboard.rotation.z = -targetX * 0.2; // Inclinación lateral
        // Mantener la tabla acostada (base -PI/2) y sumar inclinación suave
        surfboard.rotation.x = -Math.PI / 2 - targetY * 0.1; // Inclinación frontal
        
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
        // Mantener el agua centrada bajo la tabla para efecto de mar infinito
        if (water) {
            water.position.x = surfboard.position.x;
            water.position.z = surfboard.position.z;
        }

        camera.position.x = surfboard.position.x;
        camera.position.z = surfboard.position.z + 10;
        camera.lookAt(surfboard.position);
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
            break;
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