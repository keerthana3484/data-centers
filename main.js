// AquaShield - Cinematic Animated Opening and Telemetry HUD
// Built with Three.js, GSAP, and Web Audio API

// Global Application State
let scene, camera, renderer, orbitControls;
let waterMaterial, waterPlane, skyDome;
let marineSnow, bubbleSystems = [], godRays;
let dataCenterGroup, scanningGrid;
let fishSchools = [];
let isSchematicMode = false;
let isImpactMode = false;
let isRetrofitMode = false;
let isComparisonMode = false;
let isEcoMode = false;
let isBenefitsMode = false;
let isPrototypeMode = false;
let isConclusionMode = false;
let coldWaterFlow, thermalPlume, heatmapMesh, seagrassGroup, prototypeGroup;
let serverRacksGroup, retrofitGroup, flowSensorTurbine;
let centerPodMesh, classroomLight;

// Audio State
let audioCtx = null;
let soundEnabled = false;
let isMuted = false;
let ambientWaveNoise = null;
let waveFilter = null;
let waveLFOGain = null;
let droneOscs = [];
let droneFilter = null;
let droneGainNode = null;
let masterGain = null;
let sonarInterval = null;

// Telemetry & UI State
let isCinematicRunning = false;
let orbitControlsEnabled = false;
let showGridOverlay = true;
let currentDepth = 0.0;
let currentTemp = 21.5;
let currentCoreTemp = 28.5;
let currentEfficiency = 85.0;
let currentHeatDiss = 0.0;
let currentShield = 0.0;
let currentAcoustics = 0.0;
let logQueue = [
    "System standby. Ready for deployment.",
    "Awaiting cinematic launch authorization...",
    "Telemetry handshake established.",
    "Eco-Dampeners configured at 100% capacity."
];
const marineLifeLogs = [
    "School of Paracanthurus hepatus detected at 15m.",
    "Thermal plume dispersion profile: EXCELLENT.",
    "Acoustic frequency range locked in safe biosafety zone.",
    "Coral reef buffer zone temperature delta: 0.00°C.",
    "School of Pomacanthidae detected in protection grid.",
    "Eco-suction grill velocity check: 0.1 m/s (SAFE).",
    "Auxiliary heat dissipation buffer loop active.",
    "Sonar sweep confirm zero mammal disturbance range."
];

// GSAP Camera Target Animation Object
const camTarget = new THREE.Vector3(0, 5, -250);

// Initialize UI Event Listeners
document.addEventListener("DOMContentLoaded", () => {
    // If buttons or overlays were removed, create dummy fallback elements to prevent crashes in event handlers
    ["btn-conclusion", "conclusion-overlay", "black-out-screen", "btn-restart-presentation"].forEach(id => {
        if (!document.getElementById(id)) {
            const dummy = document.createElement("div");
            dummy.id = id;
            dummy.style.display = "none";
            document.body.appendChild(dummy);
        }
    });

    // Launch buttons
    document.getElementById("btn-launch-audio").addEventListener("click", () => {
        initAudio(true);
        startCinematic();
    });
    document.getElementById("btn-launch-silent").addEventListener("click", () => {
        initAudio(false);
        startCinematic();
    });

    // HUD Interactive controls
    document.getElementById("btn-replay").addEventListener("click", () => {
        replayCinematic();
    });
    document.getElementById("btn-toggle-grid").addEventListener("click", (e) => {
        toggleGridOverlay(e.currentTarget);
    });
    document.getElementById("btn-mute").addEventListener("click", (e) => {
        toggleMute(e.currentTarget);
    });
    document.getElementById("btn-orbit").addEventListener("click", (e) => {
        toggleOrbitControls(e.currentTarget);
    });
    document.getElementById("btn-overview").addEventListener("click", () => {
        toggleOverviewMode();
    });
    document.getElementById("btn-schematic").addEventListener("click", () => {
        toggleSchematicMode();
    });
    document.getElementById("btn-impact").addEventListener("click", () => {
        toggleImpactMode();
    });
    document.getElementById("btn-retrofit").addEventListener("click", () => {
        toggleRetrofitMode();
    });
    document.getElementById("btn-comparison").addEventListener("click", () => {
        toggleComparisonMode();
    });
    document.getElementById("btn-eco").addEventListener("click", () => {
        toggleEcoMode();
    });
    document.getElementById("btn-benefits").addEventListener("click", () => {
        toggleBenefitsMode();
    });
    document.getElementById("btn-prototype").addEventListener("click", () => {
        togglePrototypeMode();
    });
    document.getElementById("btn-conclusion").addEventListener("click", () => {
        playConclusionOutro();
    });
    document.getElementById("btn-restart-presentation").addEventListener("click", () => {
        restartPresentation();
    });

    // Populate initial logs
    const consoleLogs = document.getElementById("hud-marine-logs");
    logQueue.forEach(log => addLogLine(log));
});

// ==========================================
// 1. WEB AUDIO API SYNTHESIZER
// ==========================================
function initAudio(enableSound) {
    if (!enableSound) {
        soundEnabled = false;
        return;
    }
    
    try {
        // Create Audio Context
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
        
        // Master Gain
        masterGain = audioCtx.createGain();
        masterGain.gain.setValueAtTime(0.0, audioCtx.currentTime);
        masterGain.connect(audioCtx.destination);
        
        // --- 1. OCEAN WAVES / DEEP RUMBLE ---
        // Create brown noise buffer
        const bufferSize = 2 * audioCtx.sampleRate;
        const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            // Filter white noise to create brown noise
            output[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = output[i];
            output[i] *= 3.5; // Gain correction
        }
        
        ambientWaveNoise = audioCtx.createBufferSource();
        ambientWaveNoise.buffer = noiseBuffer;
        ambientWaveNoise.loop = true;
        
        // Dynamic Filter for wave sounds
        waveFilter = audioCtx.createBiquadFilter();
        waveFilter.type = 'lowpass';
        waveFilter.frequency.setValueAtTime(450, audioCtx.currentTime); // starting above water
        waveFilter.Q.setValueAtTime(1.0, audioCtx.currentTime);
        
        const waveGain = audioCtx.createGain();
        waveGain.gain.setValueAtTime(0.35, audioCtx.currentTime);
        
        // Connect Wave chain
        ambientWaveNoise.connect(waveFilter);
        waveFilter.connect(waveGain);
        waveGain.connect(masterGain);
        
        // Modulate Wave Filter (LFO)
        const waveLFO = audioCtx.createOscillator();
        waveLFO.frequency.setValueAtTime(0.08, audioCtx.currentTime); // 12.5s wave cycle
        
        waveLFOGain = audioCtx.createGain();
        waveLFOGain.gain.setValueAtTime(150, audioCtx.currentTime); // oscillate filter by +/-150Hz
        
        waveLFO.connect(waveLFOGain);
        waveLFOGain.connect(waveFilter.frequency);
        
        // --- 2. DEEP SUB Drone / SYNTH PAD ---
        // Slow warm C Minor drone (C2, G2, C3, Eb3)
        const notes = [65.41, 98.00, 130.81, 155.56];
        droneFilter = audioCtx.createBiquadFilter();
        droneFilter.type = 'lowpass';
        droneFilter.frequency.setValueAtTime(120, audioCtx.currentTime);
        droneFilter.Q.setValueAtTime(4.0, audioCtx.currentTime);
        
        droneGainNode = audioCtx.createGain();
        droneGainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
        
        droneFilter.connect(droneGainNode);
        droneGainNode.connect(masterGain);
        
        notes.forEach((freq, idx) => {
            const osc = audioCtx.createOscillator();
            osc.type = idx === 0 ? 'sine' : 'triangle';
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
            
            // detune slightly for lushness
            osc.detune.setValueAtTime((idx - 1.5) * 8, audioCtx.currentTime);
            
            osc.connect(droneFilter);
            osc.start();
            droneOscs.push(osc);
        });

        // Start Ambient Loops
        ambientWaveNoise.start();
        waveLFO.start();
        
        // Smoothly fade in master volume
        masterGain.gain.linearRampToValueAtTime(0.8, audioCtx.currentTime + 2.0);
        
        soundEnabled = true;
        isMuted = false;
        
        addLogLine("Spatial audio synthesizer initialized.");
    } catch(e) {
        console.warn("Web Audio API not supported or blocked by security settings", e);
        soundEnabled = false;
    }
}

// Trigger underwater sound profile transition
function transitionAudioToUnderwater() {
    if (!soundEnabled || isMuted || !audioCtx) return;
    
    const now = audioCtx.currentTime;
    
    // Muffle waves (drop frequency base and modulate less)
    waveFilter.frequency.setValueAtTime(waveFilter.frequency.value, now);
    waveFilter.frequency.exponentialRampToValueAtTime(95, now + 1.2);
    waveLFOGain.gain.setValueAtTime(waveLFOGain.gain.value, now);
    waveLFOGain.gain.linearRampToValueAtTime(20, now + 1.5);
    
    // Open drone synth filter to make it richer
    droneFilter.frequency.setValueAtTime(droneFilter.frequency.value, now);
    droneFilter.frequency.exponentialRampToValueAtTime(320, now + 2.0);
    droneGainNode.gain.setValueAtTime(droneGainNode.gain.value, now);
    droneGainNode.gain.linearRampToValueAtTime(0.25, now + 3.0); // swell volume
    
    // Trigger splash crash
    triggerAudioSplash();
    
    // Periodically play submarine sonar ping
    if (sonarInterval) clearInterval(sonarInterval);
    sonarInterval = setInterval(triggerSonarPing, 7000);
    setTimeout(triggerSonarPing, 2200); // First sonar ping
}

// Trigger splash sound
function triggerAudioSplash() {
    if (!soundEnabled || isMuted || !audioCtx) return;
    
    const now = audioCtx.currentTime;
    const bufferSize = audioCtx.sampleRate * 1.5;
    const splashBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = splashBuffer.getChannelData(0);
    
    // Populate white noise
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    
    const splashNoise = audioCtx.createBufferSource();
    splashNoise.buffer = splashBuffer;
    
    const splashFilter = audioCtx.createBiquadFilter();
    splashFilter.type = 'bandpass';
    splashFilter.frequency.setValueAtTime(600, now);
    splashFilter.frequency.exponentialRampToValueAtTime(70, now + 1.2);
    splashFilter.Q.setValueAtTime(3.0, now);
    
    const splashGain = audioCtx.createGain();
    splashGain.gain.setValueAtTime(0.4, now);
    splashGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
    
    splashNoise.connect(splashFilter);
    splashFilter.connect(splashGain);
    splashGain.connect(masterGain);
    
    splashNoise.start(now);
}

// Trigger sonar ping sound
function triggerSonarPing() {
    if (!soundEnabled || isMuted || !audioCtx || isCinematicRunning === false) return;
    
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(920, now); // high clear note
    
    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.00005, now + 2.5);
    
    // Sub sonar echo delay
    const delay = audioCtx.createDelay();
    delay.delayTime.setValueAtTime(0.55, now);
    
    const feedback = audioCtx.createGain();
    feedback.gain.setValueAtTime(0.35, now); // 35% echo repeat
    
    osc.connect(gain);
    gain.connect(masterGain);
    
    // feedback connection
    gain.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    feedback.connect(masterGain);
    
    osc.start(now);
    osc.stop(now + 2.6);
    
    addLogLine("Active Eco-Sonar sweep: SAFE.");
}

// Audio mute toggle
function toggleMute(btn) {
    isMuted = !isMuted;
    
    const onIcon = document.getElementById("svg-volume-on");
    const offIcon = document.getElementById("svg-volume-off");
    
    if (isMuted) {
        if (masterGain) masterGain.gain.setValueAtTime(0.0, audioCtx.currentTime);
        onIcon.classList.add("hidden");
        offIcon.classList.remove("hidden");
        btn.classList.remove("active");
    } else {
        if (audioCtx) {
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            if (masterGain) masterGain.gain.linearRampToValueAtTime(0.8, audioCtx.currentTime + 0.5);
        }
        onIcon.classList.remove("hidden");
        offIcon.classList.add("hidden");
        btn.classList.add("active");
    }
}

// Reset Audio settings to above-water state
function resetAudioToAboveWater() {
    if (sonarInterval) {
        clearInterval(sonarInterval);
        sonarInterval = null;
    }
    if (!soundEnabled || !audioCtx) return;
    
    const now = audioCtx.currentTime;
    waveFilter.frequency.setValueAtTime(waveFilter.frequency.value, now);
    waveFilter.frequency.exponentialRampToValueAtTime(450, now + 1.0);
    waveLFOGain.gain.setValueAtTime(waveLFOGain.gain.value, now);
    waveLFOGain.gain.linearRampToValueAtTime(150, now + 1.0);
    
    droneFilter.frequency.setValueAtTime(droneFilter.frequency.value, now);
    droneFilter.frequency.exponentialRampToValueAtTime(120, now + 1.0);
    droneGainNode.gain.setValueAtTime(droneGainNode.gain.value, now);
    droneGainNode.gain.linearRampToValueAtTime(0.08, now + 1.0);
}

// ==========================================
// 2. THREE.JS 3D SCENE SETUP
// ==========================================
function init3D() {
    const container = document.getElementById("canvas-container");
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    // Scene
    scene = new THREE.Scene();
    // Start with a sunrise background gradient
    scene.background = new THREE.Color(0xfb8c00); // Sunrise orange
    
    // Atmospheric Above Water Fog (warm sunrise glow)
    scene.fog = new THREE.FogExp2(0xfb8c00, 0.002);
    
    // Camera
    camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 16, 120);
    camera.lookAt(camTarget);
    
    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2 for performance
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);
    
    // Orbit Controls (Disabled by default, enabled after cinematic)
    orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.05;
    orbitControls.maxPolarAngle = Math.PI / 2 + 0.1; // Prevent going under mud bottom
    orbitControls.minDistance = 5;
    orbitControls.maxDistance = 150;
    orbitControls.enabled = false;
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffccaa, 0.4); // soft morning ambient
    scene.add(ambientLight);
    
    const sunLight = new THREE.DirectionalLight(0xffaa66, 1.8); // warm sunrise light
    sunLight.position.set(0, 5, -280);
    sunLight.castShadow = true;
    scene.add(sunLight);
    
    // Under-ocean cooling blue fill lights (reveal when submerged)
    const oceanBlueLight = new THREE.DirectionalLight(0x00f0ff, 0.0); // starts black
    oceanBlueLight.position.set(0, 1, 0);
    scene.add(oceanBlueLight);
    
    // Custom Sky Background (half cylinder with glowing sun)
    createSky();
    
    // Custom Shader Ocean Water Surface
    createWater();
    
    // Underwater Elements
    createGodRays();
    createMarineSnow();
    createDataCenter();
    createFishSchools();
    createColdWaterFlow();
    createThermalPlume();
    createHeatmap();
    createRetrofitModule();
    createSeagrass();
    createPrototypeScene();
    
    // Handle Window Resize
    window.addEventListener("resize", onWindowResize);
}

// 2.1 Procedural Sky / Sunrise Dome
function createSky() {
    const skyGeo = new THREE.SphereGeometry(450, 32, 15);
    // Gradient sky shader
    const skyMat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uUnderwater: { value: 0.0 }
        },
        vertexShader: `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPos = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPos.xyz;
                gl_Position = projectionMatrix * viewMatrix * worldPos;
            }
        `,
        fragmentShader: `
            varying vec3 vWorldPosition;
            uniform float uUnderwater;
            void main() {
                vec3 dir = normalize(vWorldPosition);
                // Simple sky gradient from sunrise orange/red (horizon) to dark slate blue (zenith)
                float skyG = clamp(dir.y * 3.0, 0.0, 1.0);
                vec3 skyAbove = mix(vec3(0.04, 0.06, 0.12), vec3(0.98, 0.55, 0.0), 1.0 - skyG);
                
                // Add a glowing sun disk at Z = -350
                float sunWeight = max(0.0, dot(dir, normalize(vec3(0.0, 0.015, -1.0))));
                vec3 sunGlow = vec3(0.99, 0.7, 0.3) * pow(sunWeight, 120.0) * 4.0;
                vec3 sunCorona = vec3(0.98, 0.38, 0.0) * pow(sunWeight, 12.0) * 1.5;
                
                vec3 finalAboveSky = skyAbove + sunGlow + sunCorona;
                vec3 finalUnderSky = vec3(0.005, 0.012, 0.02); // Deep dark sea background
                
                gl_FragColor = vec4(mix(finalAboveSky, finalUnderSky, uUnderwater), 1.0);
            }
        `,
        side: THREE.BackSide
    });
    
    skyDome = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skyDome);
}

// 2.2 Custom Shader Water Mesh
function createWater() {
    const waterGeo = new THREE.PlaneGeometry(800, 800, 128, 128);
    waterGeo.rotateX(-Math.PI / 2); // align horizontally
    
    waterMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uSunColor: { value: new THREE.Color(0xff8822) },
            uWaterColor: { value: new THREE.Color(0x00507a) },
            uSunDirection: { value: new THREE.Vector3(0, 0.02, -1).normalize() },
            uUnderwater: { value: 0.0 }
        },
        vertexShader: `
            uniform float uTime;
            uniform float uUnderwater;
            varying vec3 vWorldPosition;
            varying vec3 vNormal;
            
            // Compound Sine waves
            float getWave(vec2 p) {
                float w = sin(p.x * 0.08 + uTime * 1.6) * 0.55;
                w += cos(p.y * 0.07 - uTime * 1.3) * 0.45;
                w += sin((p.x - p.y) * 0.15 + uTime * 2.2) * 0.2;
                // flatter waves if underwater
                return w * mix(1.0, 0.15, uUnderwater);
            }
            
            void main() {
                vec3 pos = position;
                pos.y = getWave(pos.xz);
                vec4 worldPos = modelMatrix * vec4(pos, 1.0);
                vWorldPosition = worldPos.xyz;
                
                // Compute normal vector numerically
                float eps = 0.4;
                float h = pos.y;
                float hx = getWave(pos.xz + vec2(eps, 0.0));
                float hy = getWave(pos.xz + vec2(0.0, eps));
                vec3 dx = vec3(eps, hx - h, 0.0);
                vec3 dy = vec3(0.0, hy - h, eps);
                vNormal = normalize(cross(dy, dx));
                
                gl_Position = projectionMatrix * viewMatrix * worldPos;
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform vec3 uSunColor;
            uniform vec3 uWaterColor;
            uniform vec3 uSunDirection;
            uniform float uUnderwater;
            varying vec3 vWorldPosition;
            varying vec3 vNormal;
            
            void main() {
                vec3 viewDir = normalize(cameraPosition - vWorldPosition);
                vec3 normal = normalize(vNormal);
                
                // Invert normal when viewing from below
                if (uUnderwater > 0.5) {
                    normal = -normal;
                }
                
                float ndotl = max(dot(normal, uSunDirection), 0.0);
                vec3 waterBase = mix(uWaterColor, vec3(0.005, 0.04, 0.08), uUnderwater);
                
                // Specular highlights (Sunset reflections)
                vec3 halfDir = normalize(uSunDirection + viewDir);
                float spec = pow(max(dot(normal, halfDir), 0.0), 120.0) * (1.0 - uUnderwater);
                vec3 specular = uSunColor * spec * 2.5;
                
                // Ambient water glow
                vec3 ambient = vec3(0.02, 0.09, 0.15) * (1.0 - uUnderwater) + vec3(0.001, 0.015, 0.03) * uUnderwater;
                
                // Fresnel reflectiveness
                float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 5.0);
                vec3 reflectSky = mix(uWaterColor * 0.4, vec3(0.99, 0.65, 0.3), fresnel);
                
                vec3 finalColor = ambient + waterBase * ndotl + specular + reflectSky * fresnel * (1.0 - uUnderwater);
                
                // Underwater mist transparency blend
                float distance = length(cameraPosition - vWorldPosition);
                float fogFactor = exp(-0.0028 * distance);
                vec3 fogCol = mix(vec3(0.98, 0.55, 0.0), vec3(0.004, 0.012, 0.025), uUnderwater);
                
                gl_FragColor = vec4(mix(fogCol, finalColor, clamp(fogFactor, 0.0, 1.0)), mix(0.9, 0.75, uUnderwater));
            }
        `,
        transparent: true,
        side: THREE.DoubleSide
    });
    
    waterPlane = new THREE.Mesh(waterGeo, waterMaterial);
    scene.add(waterPlane);
}

// 2.3 Submerged Volumetric Light Rays (God Rays)
function createGodRays() {
    godRays = new THREE.Group();
    godRays.position.set(0, -1, -110);
    scene.add(godRays);
    
    const rayGeometry = new THREE.CylinderGeometry(0.8, 12, 110, 16, 1, true);
    rayGeometry.translate(0, -55, 0); // anchor top
    
    // 5 separate translucent light cones
    const rayMaterial = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.0, // Fades in when diving
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    
    for (let i = 0; i < 6; i++) {
        const ray = new THREE.Mesh(rayGeometry, rayMaterial);
        // distribute around
        ray.position.set(
            (Math.random() - 0.5) * 80,
            0,
            (Math.random() - 0.5) * 80
        );
        ray.rotation.x = (Math.random() - 0.5) * 0.2;
        ray.rotation.z = (Math.random() - 0.5) * 0.25;
        ray.scale.set(Math.random() * 0.6 + 0.5, Math.random() * 0.4 + 0.8, Math.random() * 0.6 + 0.5);
        godRays.add(ray);
    }
}

// 2.4 Floating Marine Snow Particles
function createMarineSnow() {
    const particleCount = 1200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    
    // Spread particles underwater (y: -100 to 0)
    for (let i = 0; i < particleCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 300;     // X
        positions[i + 1] = -Math.random() * 110;        // Y (underwater)
        positions[i + 2] = (Math.random() - 0.5) * 300; // Z
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    // Create canvas texture programmatically for soft round particles
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 16, 16);
    
    const texture = new THREE.CanvasTexture(canvas);
    
    const material = new THREE.PointsMaterial({
        color: 0x00d2ff,
        size: 0.45,
        transparent: true,
        opacity: 0.0, // starts invisible, fades in on dive
        blending: THREE.AdditiveBlending,
        map: texture,
        depthWrite: false
    });
    
    marineSnow = new THREE.Points(geometry, material);
    scene.add(marineSnow);
}

// 2.5 Procedural AquaShield Retrofitted Data Center Pods
function createDataCenter() {
    dataCenterGroup = new THREE.Group();
    dataCenterGroup.position.set(0, -48, -120); // Deep on seabed
    scene.add(dataCenterGroup);
    
    // 1. Concrete Anchor Bed (Bottom structure)
    const baseGeo = new THREE.BoxGeometry(45, 2, 28);
    const baseMat = new THREE.MeshStandardMaterial({
        color: 0x182430,
        roughness: 0.8,
        metalness: 0.2
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = -1;
    baseMesh.receiveShadow = true;
    dataCenterGroup.add(baseMesh);
    
    // 2. Telemetry Scanner grid overlaying seabed
    const gridHelper = new THREE.GridHelper(200, 40, 0x00f0ff, 0x004050);
    gridHelper.position.set(0, -49.8, -120);
    scanningGrid = gridHelper;
    scene.add(scanningGrid);
    
    // 3. Three Modular Data Pods
    const podLength = 16;
    const podRadius = 3.2;
    const podGeo = new THREE.CylinderGeometry(podRadius, podRadius, podLength, 32);
    podGeo.rotateZ(Math.PI / 2); // Lay horizontal
    
    const podMat = new THREE.MeshStandardMaterial({
        color: 0x2c3b4e,
        roughness: 0.15,
        metalness: 0.85,
        emissive: 0x000c15
    });
    
    // Retrofit Baffles (Sound absorbing rings)
    const baffleGeo = new THREE.TorusGeometry(podRadius + 0.3, 0.2, 8, 32);
    baffleGeo.rotateY(Math.PI / 2);
    const baffleMat = new THREE.MeshStandardMaterial({
        color: 0x0072ff,
        roughness: 0.4,
        metalness: 0.8,
        emissive: 0x001122
    });
    
    // Cooling Conduit Tubes wrapped around pods (The Eco-Cooling retrofit)
    const tubeMat = new THREE.MeshStandardMaterial({
        color: 0x00ffc4,
        roughness: 0.1,
        metalness: 0.9,
        emissive: 0x006644 // Glowing green fluid
    });
    
    const podPositionsX = [-12, 0, 12];
    
    podPositionsX.forEach((posX, podIndex) => {
        let currentPodMat = podMat;
        if (posX === 0) {
            currentPodMat = podMat.clone();
            currentPodMat.transparent = true;
        }
        
        const pod = new THREE.Mesh(podGeo, currentPodMat);
        pod.position.set(posX, podRadius + 0.2, 0);
        pod.castShadow = true;
        pod.receiveShadow = true;
        
        if (posX === 0) {
            centerPodMesh = pod;
            
            // Create server racks inside a dry sealed vessel
            serverRacksGroup = new THREE.Group();
            const rackGeo = new THREE.BoxGeometry(1.6, 3.8, 1.8);
            const rackMat = new THREE.MeshStandardMaterial({
                color: 0x121d28,
                roughness: 0.7,
                metalness: 0.8
            });
            
            for (let r = 0; r < 4; r++) {
                const rack = new THREE.Mesh(rackGeo, rackMat);
                // Space them out along cylinder height (which lies on local X axis due to Z rotation)
                const localX = (r - 1.5) * 2.8;
                rack.position.set(localX, 0, 0);
                
                // Blinking server blade LEDs
                const ledGeom = new THREE.BufferGeometry();
                const ledCount = 20;
                const ledPositions = new Float32Array(ledCount * 3);
                const ledColors = new Float32Array(ledCount * 3);
                for (let l = 0; l < ledCount; l++) {
                    ledPositions[l * 3] = localX + (Math.random() - 0.5) * 1.1;
                    ledPositions[l * 3 + 1] = (Math.random() - 0.5) * 3.0;
                    ledPositions[l * 3 + 2] = 0.91; // front face
                    
                    const isGreen = Math.random() > 0.4;
                    ledColors[l * 3] = isGreen ? 0.0 : 1.0;
                    ledColors[l * 3 + 1] = 1.0;
                    ledColors[l * 3 + 2] = 0.0;
                }
                ledGeom.setAttribute('position', new THREE.BufferAttribute(ledPositions, 3));
                ledGeom.setAttribute('color', new THREE.BufferAttribute(ledColors, 3));
                
                const ledMat = new THREE.PointsMaterial({
                    size: 0.16,
                    vertexColors: true,
                    transparent: true,
                    opacity: 0.95
                });
                const leds = new THREE.Points(ledGeom, ledMat);
                serverRacksGroup.add(leds);
                serverRacksGroup.add(rack);
            }
            pod.add(serverRacksGroup);
        }
        
        // Add Baffles for Acoustic protection
        for (let offsetZ = -6; offsetZ <= 6; offsetZ += 3) {
            const baffle = new THREE.Mesh(baffleGeo, baffleMat);
            baffle.position.set(0, 0, offsetZ);
            pod.add(baffle);
        }
        
        // Add spiral glowing eco-coolant tube
        // We simulate this with small cylindrical segments orbiting the pod
        const tubeSegments = 28;
        const tubeGroup = new THREE.Group();
        for (let i = 0; i < tubeSegments; i++) {
            const fraction = i / tubeSegments;
            const angle = fraction * Math.PI * 4; // 2 wraps
            const offsetZ = (fraction - 0.5) * (podLength - 2);
            
            const radius = podRadius + 0.45;
            const segmentGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.8, 8);
            
            // align cylinder segment tangentially
            segmentGeo.rotateX(Math.PI / 2);
            const segment = new THREE.Mesh(segmentGeo, tubeMat);
            
            segment.position.set(
                Math.sin(angle) * radius,
                Math.cos(angle) * radius,
                offsetZ
            );
            segment.rotation.z = -angle;
            segment.rotation.y = 0.1; // helical skew
            tubeGroup.add(segment);
        }
        pod.add(tubeGroup);
        
        // Add support pillars anchoring to concrete base
        const pillarGeo = new THREE.CylinderGeometry(0.5, 0.7, podRadius, 8);
        const pillarMesh1 = new THREE.Mesh(pillarGeo, baseMat);
        pillarMesh1.position.set(posX, podRadius / 2, -5);
        const pillarMesh2 = new THREE.Mesh(pillarGeo, baseMat);
        pillarMesh2.position.set(posX, podRadius / 2, 5);
        dataCenterGroup.add(pillarMesh1);
        dataCenterGroup.add(pillarMesh2);
        
        dataCenterGroup.add(pod);
        
        // 4. Create Bubble Screen Generator (Safe Marine protection grid)
        // Particle system underneath each pod representing micro-bubble screen warding off marine life safely
        createBubbleShield(posX, 0.5, 0);
    });
}

// 2.5.1 Micro-bubble curtain generator
function createBubbleShield(x, y, z) {
    const bubbleCount = 180;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(bubbleCount * 3);
    const velocities = [];
    
    // Distribute along pod baseline
    for (let i = 0; i < bubbleCount; i++) {
        positions[i * 3] = x + (Math.random() - 0.5) * 8; // spread under pod
        positions[i * 3 + 1] = y + Math.random() * 8;      // random initial height
        positions[i * 3 + 2] = z + (Math.random() - 0.5) * 16;
        
        velocities.push({
            x: (Math.random() - 0.5) * 0.05,
            y: Math.random() * 0.15 + 0.08, // float speed
            z: (Math.random() - 0.5) * 0.05
        });
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    // Bubble material - tiny shining cyan spheres
    const material = new THREE.PointsMaterial({
        color: 0x00ffcc,
        size: 0.18,
        transparent: true,
        opacity: 0.0, // fades in when underwater
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    
    const bubbles = new THREE.Points(geometry, material);
    dataCenterGroup.add(bubbles);
    
    bubbleSystems.push({
        mesh: bubbles,
        positions: positions,
        velocities: velocities,
        count: bubbleCount,
        originX: x,
        originY: y,
        originZ: z
    });
}

// 2.6 Schools of Fish (Boids style procedural animations)
function createFishSchools() {
    // Create two schools with different colors
    const schoolConfigs = [
        { count: 35, color: 0x00ffc4, size: 0.7, centerZ: -100, centerY: -30 }, // cyan school
        { count: 25, color: 0x0072ff, size: 0.5, centerZ: -130, centerY: -42 }  // blue school
    ];
    
    // Simple cone shape with wiggling tail mesh representing a fish
    schoolConfigs.forEach((config) => {
        const schoolGroup = new THREE.Group();
        scene.add(schoolGroup);
        
        const fishList = [];
        
        for (let i = 0; i < config.count; i++) {
            const fish = new THREE.Group();
            
            // Fish Body (Conical shape)
            const bodyGeo = new THREE.ConeGeometry(0.12 * config.size, 0.65 * config.size, 6);
            bodyGeo.rotateX(Math.PI / 2); // face forward in Z
            const bodyMat = new THREE.MeshStandardMaterial({
                color: config.color,
                roughness: 0.2,
                metalness: 0.8,
                emissive: config.color,
                emissiveIntensity: 0.4
            });
            const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
            bodyMesh.castShadow = true;
            fish.add(bodyMesh);
            
            // Fish Tail fin
            const tailGeo = new THREE.BufferGeometry();
            const tailVerts = new Float32Array([
                0, 0, -0.32 * config.size,
                -0.12 * config.size, 0, -0.55 * config.size,
                0.12 * config.size, 0, -0.55 * config.size
            ]);
            tailGeo.setAttribute('position', new THREE.BufferAttribute(tailVerts, 3));
            const tailMat = new THREE.MeshBasicMaterial({
                color: config.color,
                side: THREE.DoubleSide
            });
            const tailMesh = new THREE.Mesh(tailGeo, tailMat);
            fish.add(tailMesh);
            
            // Random offset initial placement within school
            fish.position.set(
                (Math.random() - 0.5) * 20,
                config.centerY + (Math.random() - 0.5) * 8,
                config.centerZ + (Math.random() - 0.5) * 20
            );
            
            schoolGroup.add(fish);
            fishList.push({
                mesh: fish,
                tail: tailMesh,
                wiggleSpeed: 16 + Math.random() * 8,
                wiggleOffset: Math.random() * Math.PI * 2,
                speed: 0.2 + Math.random() * 0.15,
                phase: Math.random() * 100
            });
        }
        
        fishSchools.push({
            group: schoolGroup,
            fish: fishList,
            centerZ: config.centerZ,
            centerY: config.centerY,
            radius: 20
        });
    });
}

// 2.7 Update Fish School movement paths
function updateFish(time) {
    fishSchools.forEach((school) => {
        // Move school center in an infinity figure-eight path over time
        const schoolX = Math.sin(time * 0.35) * 45;
        const schoolY = school.centerY + Math.cos(time * 0.2) * 5;
        const schoolZ = school.centerZ + Math.cos(time * 0.3) * 25;
        
        school.fish.forEach((f) => {
            // Fish wiggles its tail to show active swimming
            f.tail.rotation.y = Math.sin(time * f.wiggleSpeed + f.wiggleOffset) * 0.38;
            
            // Fish flocking: steer fish towards school center with random offset
            const targetPos = new THREE.Vector3(
                schoolX + Math.sin(f.phase + time * 0.4) * 8,
                schoolY + Math.cos(f.phase + time * 0.5) * 4,
                schoolZ + Math.cos(f.phase * 1.5 + time * 0.3) * 8
            );
            
            // Calculate velocity heading
            const dir = new THREE.Vector3().subVectors(targetPos, f.mesh.position);
            
            // Avoid warm thermal plume area if active
            const plumeX = -4.0; // Center exhaust port
            const plumeY = -41.2;
            const plumeZ = -120.0;
            const dxP = f.mesh.position.x - plumeX;
            const dyP = f.mesh.position.y - plumeY;
            const dzP = f.mesh.position.z - plumeZ;
            const distP = Math.sqrt(dxP * dxP + dyP * dyP + dzP * dzP);
            
            let threshold = 15.0;
            if (isImpactMode) threshold = 24.0;
            if (isEcoMode) threshold = 4.5; // low avoidance, fish swim close to pod hull
            
            if (distP < threshold) {
                let multiplier = 1.6;
                if (isImpactMode) multiplier = 2.6;
                if (isEcoMode) multiplier = 0.3; // very gentle push
                
                dir.x += (dxP / distP) * multiplier;
                dir.y += (dyP / distP) * multiplier;
                dir.z += (dzP / distP) * (isEcoMode ? 0.25 : 0.8);
            }
            
            const dist = dir.length();
            
            if (dist > 0.1) {
                dir.normalize();
                
                // Rotate fish to look towards moving direction smoothly
                const targetRotationY = Math.atan2(dir.x, dir.z);
                const targetRotationX = -Math.atan2(dir.y, Math.sqrt(dir.x * dir.x + dir.z * dir.z));
                
                f.mesh.rotation.y += (targetRotationY - f.mesh.rotation.y) * 0.08;
                f.mesh.rotation.x += (targetRotationX - f.mesh.rotation.x) * 0.08;
                
                // Move forward
                f.mesh.translateZ(f.speed);
            }
        });
    });
}

// ==========================================
// 3. CINEMATIC TIMELINE SEQUENCE (GSAP)
// ==========================================
function startCinematic() {
    // Hide intro panel
    const introScreen = document.getElementById("intro-screen");
    introScreen.classList.add("fade-out");
    
    // Reset camera position and system state
    camera.position.set(0, 16, 120);
    camTarget.set(0, 5, -200);
    camera.lookAt(camTarget);
    
    isCinematicRunning = true;
    orbitControlsEnabled = false;
    orbitControls.enabled = false;
    
    // Hide and reset HUD dashboard panels
    const dashboard = document.getElementById("hud-dashboard");
    dashboard.classList.remove("hud-visible");
    dashboard.classList.add("hud-hidden");
    document.getElementById("cinematic-title-overlay").classList.remove("visible");
    document.getElementById("btn-orbit").classList.remove("active");
    document.getElementById("btn-orbit-text").innerText = "FREE ORBIT";
    
    // Reset audio components
    resetAudioToAboveWater();
    
    // GSAP Cinematic timeline
    const timeline = gsap.timeline({
        onComplete: () => {
            completeCinematicSequence();
        }
    });
    
    // 0s - 3.5s: Gentle glide forward above surface looking at sunrise
    timeline.to(camera.position, {
        x: 0,
        y: 8,
        z: 45,
        duration: 3.5,
        ease: "sine.inOut"
    }, 0);
    
    timeline.to(camTarget, {
        x: 0,
        y: 3,
        z: -180,
        duration: 3.5,
        ease: "sine.inOut"
    }, 0);
    
    // 3.5s - 5.5s: Plunge into the Ocean (Crossing y = 0)
    timeline.to(camera.position, {
        x: 0,
        y: -15,
        z: -10,
        duration: 2.0,
        ease: "power2.in",
        onUpdate: () => {
            // When camera crosses water line (y = 0)
            if (camera.position.y <= 0.1 && waterMaterial.uniforms.uUnderwater.value < 0.5) {
                triggerSplashTransition();
            }
        }
    }, 3.5);
    
    timeline.to(camTarget, {
        x: 0,
        y: -25,
        z: -120,
        duration: 2.0,
        ease: "power2.in"
    }, 3.5);
    
    // 5.5s - 9.5s: Submerge deep, glide through light rays & schools of fish
    timeline.to(camera.position, {
        x: -28,
        y: -38,
        z: -65,
        duration: 4.0,
        ease: "sine.out"
    }, 5.5);
    
    timeline.to(camTarget, {
        x: -2,
        y: -46,
        z: -120,
        duration: 4.0,
        ease: "sine.out"
    }, 5.5);
    
    // Fade in Title Overlay at t=6.5s
    timeline.call(() => {
        document.getElementById("cinematic-title-overlay").classList.add("visible");
        addLogLine("Displaying title overlay credentials...");
    }, null, 6.2);
    
    // 9.5s - 13.5s: Approach the data center pods, showcase eco-cooling grids
    timeline.to(camera.position, {
        x: 8,
        y: -44,
        z: -96,
        duration: 4.5,
        ease: "sine.inOut"
    }, 9.5);
    
    timeline.to(camTarget, {
        x: -5,
        y: -47,
        z: -122,
        duration: 4.5,
        ease: "sine.inOut"
    }, 9.5);
    
    // Fade out cinematic title overlay to prepare HUD reveal
    timeline.call(() => {
        document.getElementById("cinematic-title-overlay").classList.remove("visible");
    }, null, 12.0);
}

// Water Plunge Impact trigger
function triggerSplashTransition() {
    // Set shader variables
    waterMaterial.uniforms.uUnderwater.value = 1.0;
    skyDome.material.uniforms.uUnderwater.value = 1.0;
    
    // Modify Fog to murky ocean blue
    scene.fog.color = new THREE.Color(0x000a18);
    scene.fog.density = 0.015;
    
    // Update ambient scene lights to deep blue
    scene.children.forEach(c => {
        if (c.isAmbientLight) {
            c.color.setHex(0x004c88);
            c.intensity = 0.65;
        }
        if (c.isDirectionalLight && c.position.z === -280) {
            c.color.setHex(0x0078a8);
            c.intensity = 0.8;
            c.position.set(0, 40, -120); // reposition sun rays filtering straight down
        }
    });
    
    // Trigger web audio sound transition
    transitionAudioToUnderwater();
    
    // Animate god rays and marine snow elements in
    gsap.to(godRays.children[0].material, { opacity: 0.16, duration: 1.5 });
    gsap.to(marineSnow.material, { opacity: 0.8, size: 0.65, duration: 2.0 });
    
    // Fade in bubble screen
    bubbleSystems.forEach(sys => {
        gsap.to(sys.mesh.material, { opacity: 0.7, duration: 1.5 });
    });
    
    // Trigger screen glitch visual impact
    const appContainer = document.getElementById("app-container");
    appContainer.style.filter = "brightness(2) saturate(1.8)";
    setTimeout(() => {
        appContainer.style.filter = "none";
    }, 150);
    
    addLogLine("CRITICAL ALTITUDE EXCEEDED: Splashdown.");
    addLogLine("Coolant shield integrity: SECURE.");
}

// Cinematic finished - Boot HUD dashboard
function completeCinematicSequence() {
    isCinematicRunning = false;
    
    // Turn on HUD panels
    const dashboard = document.getElementById("hud-dashboard");
    dashboard.classList.remove("hud-hidden");
    dashboard.classList.add("hud-visible");
    
    addLogLine("Cinematic sequence trace complete.");
    addLogLine("UI Telemetry streaming online.");
    
    // Start interval updating HUD console with marine telemetry
    startTelemetrySimulation();
}

function replayCinematic() {
    // Reset variables
    waterMaterial.uniforms.uUnderwater.value = 0.0;
    skyDome.material.uniforms.uUnderwater.value = 0.0;
    
    scene.fog.color = new THREE.Color(0xfb8c00);
    scene.fog.density = 0.002;
    
    scene.children.forEach(c => {
        if (c.isAmbientLight) {
            c.color.setHex(0xffccaa);
            c.intensity = 0.4;
        }
        if (c.isDirectionalLight && c.position.z === -280) {
            c.color.setHex(0xffaa66);
            c.intensity = 1.8;
            c.position.set(0, 5, -280);
        }
    });
    
    // Hide god rays and marine snow
    godRays.children.forEach(ray => ray.material.opacity = 0.0);
    marineSnow.material.opacity = 0.0;
    bubbleSystems.forEach(sys => sys.mesh.material.opacity = 0.0);
    
    // Reset schematic/impact/comparison/eco/conclusion modes
    isSchematicMode = false;
    isImpactMode = false;
    isRetrofitMode = false;
    isComparisonMode = false;
    isEcoMode = false;
    isBenefitsMode = false;
    isPrototypeMode = false;
    isConclusionMode = false;
    
    // Reset control highlights
    document.getElementById("btn-overview").classList.add("active");
    document.getElementById("btn-schematic").classList.remove("active");
    document.getElementById("btn-impact").classList.remove("active");
    document.getElementById("btn-retrofit").classList.remove("active");
    document.getElementById("btn-comparison").classList.remove("active");
    document.getElementById("btn-eco").classList.remove("active");
    document.getElementById("btn-benefits").classList.remove("active");
    document.getElementById("btn-prototype").classList.remove("active");
    document.getElementById("btn-conclusion").classList.remove("active");
    
    const leftPanel = document.querySelector(".hud-panel.left-panel");
    const rightPanel = document.querySelector(".hud-panel.right-panel");
    leftPanel.style.transform = "translateX(0)";
    leftPanel.style.opacity = "1";
    rightPanel.style.transform = "translateX(0)";
    rightPanel.style.opacity = "1";
    
    const pAnnotations = document.getElementById("physics-annotations");
    pAnnotations.classList.remove("hud-visible");
    pAnnotations.classList.add("hud-hidden");
    
    const iAnnotations = document.getElementById("impact-annotations");
    iAnnotations.classList.remove("hud-visible");
    iAnnotations.classList.add("hud-hidden");
    
    const rAnnotations = document.getElementById("retrofit-annotations");
    rAnnotations.classList.remove("hud-visible");
    rAnnotations.classList.add("hud-hidden");
    
    const cOverlays = document.getElementById("comparison-overlays");
    cOverlays.classList.remove("hud-visible");
    cOverlays.classList.add("hud-hidden");
    
    const eOverlays = document.getElementById("eco-annotations");
    eOverlays.classList.remove("hud-visible");
    eOverlays.classList.add("hud-hidden");
    
    const bAnnotations = document.getElementById("benefits-annotations");
    bAnnotations.classList.remove("hud-visible");
    bAnnotations.classList.add("hud-hidden");
    
    const prAnnotations = document.getElementById("prototype-annotations");
    prAnnotations.classList.remove("hud-visible");
    prAnnotations.classList.add("hud-hidden");
    
    const cOverlay = document.getElementById("conclusion-overlay");
    cOverlay.classList.remove("hud-visible");
    cOverlay.classList.add("hud-hidden");
    
    const blackScreen = document.getElementById("black-out-screen");
    blackScreen.classList.remove("hud-visible");
    blackScreen.classList.add("hud-hidden");
    
    if (centerPodMesh) centerPodMesh.material.opacity = 1.0;
    if (coldWaterFlow) coldWaterFlow.material.opacity = 0.0;
    if (thermalPlume) {
        thermalPlume.material.opacity = 0.0;
        thermalPlume.material.size = 0.35;
        thermalPlume.material.color.setHex(0xff5500);
    }
    if (retrofitGroup) retrofitGroup.visible = false;
    if (window.heatmapRings) {
        window.heatmapRings.forEach(r => r.mesh.material.opacity = 0.0);
    }
    
    // Restore default fog parameters
    if (scene.fog) {
        scene.fog.color.setRGB(0.023, 0.066, 0.129);
        scene.fog.density = 0.015;
    }
    const sunLight = scene.getObjectByName("sunLight");
    if (sunLight) sunLight.intensity = 1.5;
    if (classroomLight) classroomLight.intensity = 0.0;
    if (prototypeGroup) prototypeGroup.visible = false;
    
    // Re-enable marine life
    fishSchools.forEach(school => school.group.visible = true);
    bubbleSystems.forEach(sys => sys.mesh.material.opacity = 0.0);
    marineSnow.material.opacity = 0.0;
    
    // Clean logs
    document.getElementById("hud-marine-logs").innerHTML = "";
    logQueue = [];
    addLogLine("Replaying sequence...");
    
    // Start timeline
    startCinematic();
}

// ==========================================
// 4. TELEMETRY HUD DATA STREAMING
// ==========================================
function startTelemetrySimulation() {
    if (window.telemetryTimer) clearInterval(window.telemetryTimer);
    
    window.telemetryTimer = setInterval(() => {
        if (isCinematicRunning) return;
        
        // Randomly simulate slight values fluctuations
        currentCoreTemp = 12.0 + Math.sin(Date.now() * 0.001) * 0.8;
        currentEfficiency = 98.5 + Math.sin(Date.now() * 0.003) * 0.3;
        currentHeatDiss = 4.1 + Math.cos(Date.now() * 0.0005) * 0.15;
        
        // Update DOM values
        document.getElementById("tel-core-temp").innerText = currentCoreTemp.toFixed(1);
        document.getElementById("tel-cool-eff").innerText = currentEfficiency.toFixed(1);
        document.getElementById("tel-heat-diss").innerText = currentHeatDiss.toFixed(1);
        
        // Modulate progress bars slightly
        document.getElementById("tel-bar-temp").style.width = `${(currentCoreTemp/25)*100}%`;
        document.getElementById("tel-bar-eff").style.width = `${currentEfficiency}%`;
        document.getElementById("tel-bar-heat").style.width = `${(currentHeatDiss/10)*100}%`;
        
        // Periodic telemetry log printout
        if (Math.random() > 0.72) {
            const randomLog = marineLifeLogs[Math.floor(Math.random() * marineLifeLogs.length)];
            addLogLine(randomLog);
        }
    }, 1000);
}

// Append log to console
function addLogLine(text) {
    const logBox = document.getElementById("hud-marine-logs");
    if (!logBox) return;
    
    const now = new Date();
    const pad = (num) => String(num).padStart(2, '0');
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    
    const logElement = document.createElement("div");
    logElement.className = "log-line";
    logElement.innerHTML = `<span class="log-time">[${timeStr}]</span> ${text}`;
    
    logBox.appendChild(logElement);
    logBox.scrollTop = logBox.scrollHeight;
    
    // limit max logs
    if (logBox.children.length > 25) {
        logBox.removeChild(logBox.firstChild);
    }
}

// HUD Button: Toggle circular scanning grid on seabed
function toggleGridOverlay(btn) {
    showGridOverlay = !showGridOverlay;
    scanningGrid.visible = showGridOverlay;
    
    if (showGridOverlay) {
        btn.classList.add("active");
        addLogLine("Science grid overlay: VISIBLE.");
    } else {
        btn.classList.remove("active");
        addLogLine("Science grid overlay: HIDDEN.");
    }
}

// HUD Button: Toggle Manual camera controls (Orbit)
function toggleOrbitControls(btn) {
    if (isCinematicRunning) return;
    
    orbitControlsEnabled = !orbitControlsEnabled;
    orbitControls.enabled = orbitControlsEnabled;
    
    const textLabel = document.getElementById("btn-orbit-text");
    
    if (orbitControlsEnabled) {
        btn.classList.add("active");
        textLabel.innerText = "LOCK CAMERA";
        orbitControls.target.copy(dataCenterGroup.position);
        addLogLine("Free Orbit enabled. Use mouse to rotate.");
    } else {
        btn.classList.remove("active");
        textLabel.innerText = "FREE ORBIT";
        // Reset camera view
        gsap.to(camera.position, {
            x: 8,
            y: -44,
            z: -96,
            duration: 1.5,
            ease: "power2.out",
            onUpdate: () => {
                camera.lookAt(-5, -47, -122);
            }
        });
        addLogLine("Camera locked to data center pods.");
    }
}

// ==========================================
// 5. ANIMATION RENDERING LOOP
// ==========================================
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    
    const time = clock.getElapsedTime();
    
    // 5.1 Update Shader Uniforms
    if (waterMaterial) {
        waterMaterial.uniforms.uTime.value = time;
    }
    
    // 5.2 Rotate Sky Dome slowly
    if (skyDome) {
        skyDome.rotation.y = time * 0.005;
    }
    
    // 5.3 Animate marine snow wiggles
    if (marineSnow && marineSnow.material.opacity > 0.0) {
        const positions = marineSnow.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            // Sink particle
            positions[i + 1] -= 0.05; // fall speed
            // Wiggle sideways
            positions[i] += Math.sin(time * 0.5 + i) * 0.012;
            
            // Loop particles back to top if below boundary
            if (positions[i + 1] < -100) {
                positions[i + 1] = 0;
            }
        }
        marineSnow.geometry.attributes.position.needsUpdate = true;
    }
    
    // 5.4 Update wiggling bubble screens underneath data pods
    bubbleSystems.forEach((sys) => {
        if (sys.mesh.material.opacity > 0.0) {
            const positions = sys.mesh.geometry.attributes.position.array;
            for (let i = 0; i < sys.count; i++) {
                const idx = i * 3;
                
                // Move bubble up
                positions[idx + 1] += sys.velocities[i].y;
                // Wobble
                positions[idx] += Math.sin(time * 3.5 + i) * 0.015;
                positions[idx + 2] += Math.cos(time * 3.5 + i) * 0.015;
                
                // Reset bubbles when reaching ocean level
                if (positions[idx + 1] >= 48) {
                    positions[idx] = sys.originX + (Math.random() - 0.5) * 8;
                    positions[idx + 1] = sys.originY;
                    positions[idx + 2] = sys.originZ + (Math.random() - 0.5) * 16;
                }
            }
            sys.mesh.geometry.attributes.position.needsUpdate = true;
        }
    });
    
    // 5.5 Update fish movements
    updateFish(time);
    
    // 5.6 Pulse glowing cooling loops
    if (dataCenterGroup) {
        const emissivePulse = 0.5 + Math.sin(time * 2.5) * 0.25;
        dataCenterGroup.children.forEach(child => {
            // Target the pods (cylinders)
            if (child.isMesh && child.geometry.type === "CylinderGeometry") {
                // Tube group is at index 8 (or check children)
                child.children.forEach(subchild => {
                    if (subchild.isGroup) { // cooling loops group
                        subchild.children.forEach(tubeSegment => {
                            if (tubeSegment.material) {
                                tubeSegment.material.emissiveIntensity = emissivePulse;
                            }
                        });
                    }
                });
            }
        });
    }
    
    // 5.7 Update Real-time Cinematic Telemetry
    updateCinematicTelemetry();
    
    // 5.9 Animate cold seawater current
    if (coldWaterFlow && coldWaterFlow.material.opacity > 0.0) {
        const positions = coldWaterFlow.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            positions[i] -= 0.35; // flow right-to-left
            
            // wrap around central cylinder
            const dx = positions[i] - 0;
            const dy = positions[i + 1] - (-45);
            const dz = positions[i + 2] - (-120);
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            
            if (dist < 7.2) {
                const angle = Math.atan2(dy, dz);
                positions[i + 1] = -45 + Math.sin(angle) * 7.5;
                positions[i + 2] = -120 + Math.cos(angle) * 7.5;
            }
            
            if (positions[i] < -45) {
                positions[i] = 45 + Math.random() * 10;
                positions[i + 1] = -45 + (Math.random() - 0.5) * 12;
                positions[i + 2] = -120 + (Math.random() - 0.5) * 24;
            }
        }
        coldWaterFlow.geometry.attributes.position.needsUpdate = true;
    }
    
    // 5.10 Animate warm thermal plume
    if (thermalPlume && (thermalPlume.material.opacity > 0.0)) {
        const positions = thermalPlume.geometry.attributes.position.array;
        const velocities = window.plumeVelocities;
        for (let i = 0; i < velocities.length; i++) {
            const idx = i * 3;
            const vel = velocities[i];
            
            positions[idx] += vel.x;
            positions[idx + 1] += vel.y;
            positions[idx + 2] += vel.z;
            
            positions[idx + 2] += Math.sin(time * 6 + i) * 0.02; // wobble
            
            vel.life += 0.008;
            
            if (vel.life > 1.0 || positions[idx + 1] > -12) {
                positions[idx] = -4 + (Math.random() - 0.5) * 1.5;
                positions[idx + 1] = -41.2;
                positions[idx + 2] = -120 + (Math.random() - 0.5) * 2;
                vel.life = 0.0;
            }
        }
        thermalPlume.geometry.attributes.position.needsUpdate = true;
    }
    
    // 5.12 Animate thermal diagnostic heatmap grid
    if (isImpactMode && window.heatmapRings) {
        window.heatmapRings.forEach((r) => {
            let scale = r.mesh.scale.x + r.speed;
            if (scale > 3.0) {
                scale = 0.1;
            }
            r.mesh.scale.setScalar(scale);
            
            const progress = scale / 3.0; // 0 to 1
            r.mesh.material.opacity = (1.0 - progress) * 0.45;
            
            // color shift from red (0.0 HSL) to orange/yellow (0.09 HSL)
            r.mesh.material.color.setHSL(0.09 * progress, 1.0, 0.5);
        });
    }
    
    // 5.13 Animate retrofit module spinners & lights
    if ((isRetrofitMode || isComparisonMode || isEcoMode || isConclusionMode) && retrofitGroup) {
        // Spin turbine
        if (flowSensorTurbine) {
            flowSensorTurbine.rotation.z += 0.18;
        }
        
        // Blink sensor indicators
        if (window.coldSensorMesh && window.hotSensorMesh) {
            window.coldSensorMesh.material.color.setHSL(0.55 + Math.sin(time * 7) * 0.03, 1.0, 0.5);
            window.hotSensorMesh.material.color.setHSL(0.02 + Math.cos(time * 8) * 0.02, 1.0, 0.5);
        }
        
        // Pulse CPU edge controller
        if (window.cpuGlowMesh) {
            window.cpuGlowMesh.material.emissiveIntensity = 0.4 + Math.sin(time * 4.5) * 0.35;
        }
    }
    
    // 5.14 Sway seagrass blades gently
    if (seagrassGroup) {
        seagrassGroup.children.forEach((blade, idx) => {
            blade.rotation.z = Math.sin(time * 1.4 + idx * 0.3) * 0.12;
            blade.rotation.x = Math.cos(time * 1.1 + idx * 0.25) * 0.06;
        });
    }
    
    // 5.15 Animate prototype board LEDs
    if (isPrototypeMode && window.protoLedRed && window.protoLedGreen) {
        window.protoLedRed.material.color.setHSL(0.02, 1.0, 0.4 + Math.sin(time * 12) * 0.2); // flash red
        window.protoLedGreen.material.color.setHSL(0.45, 1.0, 0.5 + Math.cos(time * 9) * 0.25); // flash green
    }
    
    // 5.11 Animate server rack LEDs
    if (isSchematicMode && serverRacksGroup) {
        serverRacksGroup.children.forEach(child => {
            if (child.isPoints) {
                const colors = child.geometry.attributes.color.array;
                for (let i = 0; i < colors.length; i += 3) {
                    if (Math.random() > 0.98) {
                        const isGreen = Math.random() > 0.4;
                        colors[i] = isGreen ? 0.0 : (colors[i] > 0.5 ? 0.0 : 1.0);
                        colors[i + 1] = colors[i + 1] > 0.5 ? 0.15 : 1.0;
                    }
                }
                child.geometry.attributes.color.needsUpdate = true;
            }
        });
    }
    
    // 5.8 Render camera pass
    if (isCinematicRunning || !orbitControlsEnabled) {
        camera.lookAt(camTarget);
    }
    
    if (orbitControlsEnabled) {
        orbitControls.update();
    }
    
    if (isComparisonMode) {
        const width = renderer.domElement.clientWidth;
        const height = renderer.domElement.clientHeight;
        
        renderer.setScissorTest(true);
        
        // -------------------------------------
        // LEFT VIEWPORT: BEFORE (Fixed cooling, strong thermal plume)
        // -------------------------------------
        renderer.setViewport(0, 0, width / 2, height);
        renderer.setScissor(0, 0, width / 2, height);
        
        // Visibility state
        if (retrofitGroup) retrofitGroup.visible = false;
        
        // Modify plume to be larger & red
        if (thermalPlume) {
            thermalPlume.material.color.setHex(0xff3300);
            thermalPlume.material.size = 0.55;
            
            window.plumeVelocities.forEach(v => {
                v.x = -0.15 - Math.random() * 0.12; // faster flow
                v.y = 0.16 + Math.random() * 0.1;
            });
        }
        
        // Fast bubbles (higher pump speed)
        bubbleSystems.forEach(sys => {
            sys.velocities.forEach(v => {
                v.y = 0.22 + Math.random() * 0.1;
            });
        });
        
        renderer.render(scene, camera);
        
        // -------------------------------------
        // RIGHT VIEWPORT: AFTER (AquaShield active, smaller plume)
        // -------------------------------------
        renderer.setViewport(width / 2, 0, width / 2, height);
        renderer.setScissor(width / 2, 0, width / 2, height);
        
        // Visibility state
        if (retrofitGroup) retrofitGroup.visible = true;
        
        // Modify plume to be smaller & teal
        if (thermalPlume) {
            thermalPlume.material.color.setHex(0x00ffc4);
            thermalPlume.material.size = 0.26;
            
            window.plumeVelocities.forEach(v => {
                v.x = -0.04 - Math.random() * 0.05; // slower flow
                v.y = 0.06 + Math.random() * 0.06;
            });
        }
        
        // Slow bubbles (reduced pump speed)
        bubbleSystems.forEach(sys => {
            sys.velocities.forEach(v => {
                v.y = 0.06 + Math.random() * 0.04;
            });
        });
        
        renderer.render(scene, camera);
        
        renderer.setScissorTest(false);
    } else {
        // Standard fullscreen render
        renderer.setViewport(0, 0, renderer.domElement.clientWidth, renderer.domElement.clientHeight);
        renderer.render(scene, camera);
    }
}

// Telemetry values bound to camera height during cinematic
function updateCinematicTelemetry() {
    // Height translates to depth
    // y goes from 16 to -44. 
    // depth goes from 0m to 50.0m
    const camY = camera.position.y;
    
    if (camY >= 0.0) {
        currentDepth = 0.0;
        currentTemp = 21.5 - (16.0 - camY) * 0.15;
        currentShield = 0.0;
        currentAcoustics = 0.0;
    } else {
        // under water
        currentDepth = Math.min(50.0, -camY * 1.13);
        currentTemp = 19.1 + (camY * 0.22); // approaches 8.4°C at depth
        currentShield = Math.min(100.0, -camY * 2.2); // grows as camera submerges
        currentAcoustics = Math.max(-80.0, camY * 1.8); // decibels drop
    }
    
    // Sync HUD labels
    document.getElementById("telemetry-depth-meta").innerText = `${currentDepth.toFixed(1)}m`;
    document.getElementById("telemetry-temp-meta").innerText = `${currentTemp.toFixed(1)}°C`;
    
    const shieldLabel = document.getElementById("tel-shield");
    const acousticsLabel = document.getElementById("tel-acoustics");
    
    if (shieldLabel) shieldLabel.innerText = currentShield.toFixed(1);
    if (acousticsLabel) acousticsLabel.innerText = currentAcoustics.toFixed(1);
    
    const shieldBar = document.getElementById("tel-bar-shield");
    const acousticsBar = document.getElementById("tel-bar-acoustics");
    
    if (shieldBar) shieldBar.style.width = `${currentShield}%`;
    if (acousticsBar) acousticsBar.style.width = `${(Math.abs(currentAcoustics)/80)*100}%`;
}

// Window Resize Handler
function onWindowResize() {
    const container = document.getElementById("canvas-container");
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    
    renderer.setSize(width, height);
}

// ==========================================
// 6. PROCEDURAL THERMAL SIMULATION GENERATORS
// ==========================================
function createColdWaterFlow() {
    const particleCount = 350;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 80;
        positions[i * 3 + 1] = -45 + (Math.random() - 0.5) * 12;
        positions[i * 3 + 2] = -120 + (Math.random() - 0.5) * 24;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
        color: 0x00d2ff,
        size: 0.0,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    
    coldWaterFlow = new THREE.Points(geometry, material);
    scene.add(coldWaterFlow);
}

function createThermalPlume() {
    const particleCount = 200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = [];
    
    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = -4;
        positions[i * 3 + 1] = -41.2;
        positions[i * 3 + 2] = -120;
        
        velocities.push({
            x: -0.06 - Math.random() * 0.1,
            y: 0.08 + Math.random() * 0.1,
            z: (Math.random() - 0.5) * 0.05,
            life: Math.random()
        });
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    // soft round particles programmatically using canvas
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    grad.addColorStop(0, 'rgba(255, 80, 0, 1)');
    grad.addColorStop(1, 'rgba(255, 80, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 16, 16);
    const texture = new THREE.CanvasTexture(canvas);
    
    const material = new THREE.PointsMaterial({
        color: 0xff5500,
        size: 0.0,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        map: texture,
        depthWrite: false
    });
    thermalPlume = new THREE.Points(geometry, material);
    scene.add(thermalPlume);
    
    window.plumeVelocities = velocities;
}

function toggleSchematicMode() {
    if (isCinematicRunning) return;
    
    isSchematicMode = true;
    isImpactMode = false;
    isRetrofitMode = false;
    isComparisonMode = false;
    isEcoMode = false;
    isBenefitsMode = false;
    isPrototypeMode = false;
    isConclusionMode = false;
    
    const btnOverview = document.getElementById("btn-overview");
    const btnSchematic = document.getElementById("btn-schematic");
    const btnImpact = document.getElementById("btn-impact");
    const btnRetrofit = document.getElementById("btn-retrofit");
    const btnComparison = document.getElementById("btn-comparison");
    const btnEco = document.getElementById("btn-eco");
    const btnBenefits = document.getElementById("btn-benefits");
    const btnPrototype = document.getElementById("btn-prototype");
    const btnConclusion = document.getElementById("btn-conclusion");
    
    btnOverview.classList.remove("active");
    btnSchematic.classList.add("active");
    btnImpact.classList.remove("active");
    btnRetrofit.classList.remove("active");
    btnComparison.classList.remove("active");
    btnEco.classList.remove("active");
    btnBenefits.classList.remove("active");
    btnPrototype.classList.remove("active");
    btnConclusion.classList.remove("active");
    
    const leftPanel = document.querySelector(".hud-panel.left-panel");
    const rightPanel = document.querySelector(".hud-panel.right-panel");
    const pAnnotations = document.getElementById("physics-annotations");
    const iAnnotations = document.getElementById("impact-annotations");
    const rAnnotations = document.getElementById("retrofit-annotations");
    const cOverlays = document.getElementById("comparison-overlays");
    const eOverlays = document.getElementById("eco-annotations");
    const bAnnotations = document.getElementById("benefits-annotations");
    const prAnnotations = document.getElementById("prototype-annotations");
    const cOverlay = document.getElementById("conclusion-overlay");
    const blackScreen = document.getElementById("black-out-screen");
    
    // Disable orbit controls
    orbitControlsEnabled = false;
    orbitControls.enabled = false;
    document.getElementById("btn-orbit").classList.remove("active");
    document.getElementById("btn-orbit-text").innerText = "FREE ORBIT";
    
    // Hide dashboard
    leftPanel.style.transform = "translateX(-350px)";
    leftPanel.style.opacity = "0";
    rightPanel.style.transform = "translateX(350px)";
    rightPanel.style.opacity = "0";
    
    // Toggle overlays
    pAnnotations.classList.remove("hud-hidden");
    pAnnotations.classList.add("hud-visible");
    iAnnotations.classList.remove("hud-visible");
    iAnnotations.classList.add("hud-hidden");
    rAnnotations.classList.remove("hud-visible");
    rAnnotations.classList.add("hud-hidden");
    cOverlays.classList.remove("hud-visible");
    cOverlays.classList.add("hud-hidden");
    eOverlays.classList.remove("hud-visible");
    eOverlays.classList.add("hud-hidden");
    bAnnotations.classList.remove("hud-visible");
    bAnnotations.classList.add("hud-hidden");
    prAnnotations.classList.remove("hud-visible");
    prAnnotations.classList.add("hud-hidden");
    cOverlay.classList.remove("hud-visible");
    cOverlay.classList.add("hud-hidden");
    blackScreen.classList.remove("hud-visible");
    blackScreen.classList.add("hud-hidden");
    
    // Hide tabletop prototype elements
    if (classroomLight) classroomLight.intensity = 0.0;
    if (prototypeGroup) prototypeGroup.visible = false;
    
    // Restore marine life
    fishSchools.forEach(school => school.group.visible = true);
    bubbleSystems.forEach(sys => sys.mesh.material.opacity = 0.0);
    marineSnow.material.opacity = 0.0;
    
    // Zoom close-up to center pod
    gsap.to(camera.position, {
        x: 0,
        y: -42,
        z: -96,
        duration: 2.0,
        ease: "power2.inOut"
    });
    
    gsap.to(camTarget, {
        x: 0,
        y: -45,
        z: -120,
        duration: 2.0,
        ease: "power2.inOut"
    });
    
    // Transparent center pod
    if (centerPodMesh) {
        gsap.to(centerPodMesh.material, {
            opacity: 0.16,
            duration: 1.8
        });
    }
    
    // Restore default fog parameters
    if (scene.fog) {
        gsap.to(scene.fog.color, { r: 0.023, g: 0.066, b: 0.129, duration: 1.5 });
        gsap.to(scene.fog, { density: 0.015, duration: 1.5 });
    }
    const sunLight = scene.getObjectByName("sunLight");
    if (sunLight) gsap.to(sunLight, { intensity: 1.5, duration: 1.5 });
    
    // Restore default particle parameters
    if (thermalPlume) {
        thermalPlume.material.size = 0.5;
        thermalPlume.material.color.setHex(0xff5500);
        window.plumeVelocities.forEach(v => {
            v.x = -0.06 - Math.random() * 0.1;
            v.y = 0.08 + Math.random() * 0.1;
        });
    }
    
    bubbleSystems.forEach(sys => {
        sys.velocities.forEach(v => {
            v.y = Math.random() * 0.15 + 0.08;
        });
    });
    
    // Activate flow systems
    if (coldWaterFlow) gsap.to(coldWaterFlow.material, { opacity: 0.8, size: 0.35, duration: 1.5 });
    if (thermalPlume) gsap.to(thermalPlume.material, { opacity: 0.9, size: 0.5, duration: 1.5 });
    if (retrofitGroup) retrofitGroup.visible = false;
    if (window.heatmapRings) {
        window.heatmapRings.forEach(r => r.mesh.material.opacity = 0.0);
    }
    
    addLogLine("Educational Thermal Schematic: ACTIVE.");
    addLogLine("Displaying server cutaway and conduction currents...");
}

function toggleOverviewMode() {
    if (isCinematicRunning) return;
    
    isSchematicMode = false;
    isImpactMode = false;
    isRetrofitMode = false;
    isComparisonMode = false;
    isEcoMode = false;
    isBenefitsMode = false;
    isPrototypeMode = false;
    isConclusionMode = false;
    
    const btnOverview = document.getElementById("btn-overview");
    const btnSchematic = document.getElementById("btn-schematic");
    const btnImpact = document.getElementById("btn-impact");
    const btnRetrofit = document.getElementById("btn-retrofit");
    const btnComparison = document.getElementById("btn-comparison");
    const btnEco = document.getElementById("btn-eco");
    const btnBenefits = document.getElementById("btn-benefits");
    const btnPrototype = document.getElementById("btn-prototype");
    const btnConclusion = document.getElementById("btn-conclusion");
    
    btnOverview.classList.add("active");
    btnSchematic.classList.remove("active");
    btnImpact.classList.remove("active");
    btnRetrofit.classList.remove("active");
    btnComparison.classList.remove("active");
    btnEco.classList.remove("active");
    btnBenefits.classList.remove("active");
    btnPrototype.classList.remove("active");
    btnConclusion.classList.remove("active");
    
    const leftPanel = document.querySelector(".hud-panel.left-panel");
    const rightPanel = document.querySelector(".hud-panel.right-panel");
    const pAnnotations = document.getElementById("physics-annotations");
    const iAnnotations = document.getElementById("impact-annotations");
    const rAnnotations = document.getElementById("retrofit-annotations");
    const cOverlays = document.getElementById("comparison-overlays");
    const eOverlays = document.getElementById("eco-annotations");
    const bAnnotations = document.getElementById("benefits-annotations");
    const prAnnotations = document.getElementById("prototype-annotations");
    const cOverlay = document.getElementById("conclusion-overlay");
    const blackScreen = document.getElementById("black-out-screen");
    
    orbitControlsEnabled = false;
    orbitControls.enabled = false;
    document.getElementById("btn-orbit").classList.remove("active");
    document.getElementById("btn-orbit-text").innerText = "FREE ORBIT";
    
    // Restore dashboard
    leftPanel.style.transform = "translateX(0)";
    leftPanel.style.opacity = "1";
    rightPanel.style.transform = "translateX(0)";
    rightPanel.style.opacity = "1";
    
    // Hide overlays
    pAnnotations.classList.remove("hud-visible");
    pAnnotations.classList.add("hud-hidden");
    iAnnotations.classList.remove("hud-visible");
    iAnnotations.classList.add("hud-hidden");
    rAnnotations.classList.remove("hud-visible");
    rAnnotations.classList.add("hud-hidden");
    cOverlays.classList.remove("hud-visible");
    cOverlays.classList.add("hud-hidden");
    eOverlays.classList.remove("hud-visible");
    eOverlays.classList.add("hud-hidden");
    bAnnotations.classList.remove("hud-visible");
    bAnnotations.classList.add("hud-hidden");
    prAnnotations.classList.remove("hud-visible");
    prAnnotations.classList.add("hud-hidden");
    cOverlay.classList.remove("hud-visible");
    cOverlay.classList.add("hud-hidden");
    blackScreen.classList.remove("hud-visible");
    blackScreen.classList.add("hud-hidden");
    
    // Hide tabletop prototype elements
    if (classroomLight) classroomLight.intensity = 0.0;
    if (prototypeGroup) prototypeGroup.visible = false;
    
    // Restore marine life
    fishSchools.forEach(school => school.group.visible = true);
    bubbleSystems.forEach(sys => sys.mesh.material.opacity = 0.0);
    marineSnow.material.opacity = 0.0;
    
    // Default camera view
    gsap.to(camera.position, {
        x: 8,
        y: -44,
        z: -96,
        duration: 1.8,
        ease: "power2.inOut"
    });
    
    gsap.to(camTarget, {
        x: -5,
        y: -47,
        z: -122,
        duration: 1.8,
        ease: "power2.inOut"
    });
    
    // Solid pod
    if (centerPodMesh) {
        gsap.to(centerPodMesh.material, {
            opacity: 1.0,
            duration: 1.5
        });
    }
    
    // Restore default fog parameters
    if (scene.fog) {
        gsap.to(scene.fog.color, { r: 0.023, g: 0.066, b: 0.129, duration: 1.5 });
        gsap.to(scene.fog, { density: 0.015, duration: 1.5 });
    }
    const sunLight = scene.getObjectByName("sunLight");
    if (sunLight) gsap.to(sunLight, { intensity: 1.5, duration: 1.5 });
    
    // Restore default particle parameters
    if (thermalPlume) {
        thermalPlume.material.size = 0.35;
        thermalPlume.material.color.setHex(0xff5500);
        window.plumeVelocities.forEach(v => {
            v.x = -0.06 - Math.random() * 0.1;
            v.y = 0.08 + Math.random() * 0.1;
        });
    }
    
    bubbleSystems.forEach(sys => {
        sys.velocities.forEach(v => {
            v.y = Math.random() * 0.15 + 0.08;
        });
    });
    
    // Fade out schematic systems
    if (coldWaterFlow) gsap.to(coldWaterFlow.material, { opacity: 0.0, size: 0.0, duration: 1.2 });
    if (thermalPlume) gsap.to(thermalPlume.material, { opacity: 0.0, size: 0.0, duration: 1.2 });
    if (retrofitGroup) retrofitGroup.visible = false;
    if (window.heatmapRings) {
        window.heatmapRings.forEach(r => r.mesh.material.opacity = 0.0);
    }
    
    addLogLine("System Overview dashboard online.");
}

function toggleImpactMode() {
    if (isCinematicRunning) return;
    
    isSchematicMode = false;
    isImpactMode = true;
    isRetrofitMode = false;
    isComparisonMode = false;
    isEcoMode = false;
    isBenefitsMode = false;
    isPrototypeMode = false;
    isConclusionMode = false;
    
    const btnOverview = document.getElementById("btn-overview");
    const btnSchematic = document.getElementById("btn-schematic");
    const btnImpact = document.getElementById("btn-impact");
    const btnRetrofit = document.getElementById("btn-retrofit");
    const btnComparison = document.getElementById("btn-comparison");
    const btnEco = document.getElementById("btn-eco");
    const btnBenefits = document.getElementById("btn-benefits");
    const btnPrototype = document.getElementById("btn-prototype");
    const btnConclusion = document.getElementById("btn-conclusion");
    
    btnOverview.classList.remove("active");
    btnSchematic.classList.remove("active");
    btnImpact.classList.add("active");
    btnRetrofit.classList.remove("active");
    btnComparison.classList.remove("active");
    btnEco.classList.remove("active");
    btnBenefits.classList.remove("active");
    btnPrototype.classList.remove("active");
    btnConclusion.classList.remove("active");
    
    const leftPanel = document.querySelector(".hud-panel.left-panel");
    const rightPanel = document.querySelector(".hud-panel.right-panel");
    const pAnnotations = document.getElementById("physics-annotations");
    const iAnnotations = document.getElementById("impact-annotations");
    const rAnnotations = document.getElementById("retrofit-annotations");
    const cOverlays = document.getElementById("comparison-overlays");
    const eOverlays = document.getElementById("eco-annotations");
    const bAnnotations = document.getElementById("benefits-annotations");
    const prAnnotations = document.getElementById("prototype-annotations");
    const cOverlay = document.getElementById("conclusion-overlay");
    const blackScreen = document.getElementById("black-out-screen");
    
    orbitControlsEnabled = false;
    orbitControls.enabled = false;
    document.getElementById("btn-orbit").classList.remove("active");
    document.getElementById("btn-orbit-text").innerText = "FREE ORBIT";
    
    // Hide dashboard
    leftPanel.style.transform = "translateX(-350px)";
    leftPanel.style.opacity = "0";
    rightPanel.style.transform = "translateX(350px)";
    rightPanel.style.opacity = "0";
    
    // Toggle overlays
    pAnnotations.classList.remove("hud-visible");
    pAnnotations.classList.add("hud-hidden");
    iAnnotations.classList.remove("hud-hidden");
    iAnnotations.classList.add("hud-visible");
    rAnnotations.classList.remove("hud-visible");
    rAnnotations.classList.add("hud-hidden");
    cOverlays.classList.remove("hud-visible");
    cOverlays.classList.add("hud-hidden");
    eOverlays.classList.remove("hud-visible");
    eOverlays.classList.add("hud-hidden");
    bAnnotations.classList.remove("hud-visible");
    bAnnotations.classList.add("hud-hidden");
    iAnnotations.classList.remove("hud-visible");
    iAnnotations.classList.add("hud-hidden");
    cOverlays.classList.remove("hud-visible");
    cOverlays.classList.add("hud-hidden");
    eOverlays.classList.remove("hud-visible");
    eOverlays.classList.add("hud-hidden");
    cOverlay.classList.remove("hud-visible");
    cOverlay.classList.add("hud-hidden");
    blackScreen.classList.remove("hud-visible");
    blackScreen.classList.add("hud-hidden");
    
    // Hide tabletop prototype elements
    if (classroomLight) classroomLight.intensity = 0.0;
    if (prototypeGroup) prototypeGroup.visible = false;
    
    // Restore marine life
    fishSchools.forEach(school => school.group.visible = true);
    bubbleSystems.forEach(sys => sys.mesh.material.opacity = 0.0);
    marineSnow.material.opacity = 0.0;
    
    // Zoom close-up onto Left Exhaust Outlet (-4, -41, -120)
    gsap.to(camera.position, {
        x: -12,
        y: -38,
        z: -108,
        duration: 2.0,
        ease: "power2.inOut"
    });
    
    gsap.to(camTarget, {
        x: -4,
        y: -41.2,
        z: -120,
        duration: 2.0,
        ease: "power2.inOut"
    });
    
    // Solid center pod
    if (centerPodMesh) {
        gsap.to(centerPodMesh.material, {
            opacity: 1.0,
            duration: 1.5
        });
    }
    
    // Restore default fog parameters
    if (scene.fog) {
        gsap.to(scene.fog.color, { r: 0.023, g: 0.066, b: 0.129, duration: 1.5 });
        gsap.to(scene.fog, { density: 0.015, duration: 1.5 });
    }
    const sunLight = scene.getObjectByName("sunLight");
    if (sunLight) gsap.to(sunLight, { intensity: 1.5, duration: 1.5 });
    
    // Restore default particle parameters
    if (thermalPlume) {
        thermalPlume.material.size = 0.6;
        thermalPlume.material.color.setHex(0xff5500);
        window.plumeVelocities.forEach(v => {
            v.x = -0.06 - Math.random() * 0.1;
            v.y = 0.08 + Math.random() * 0.1;
        });
    }
    
    bubbleSystems.forEach(sys => {
        sys.velocities.forEach(v => {
            v.y = Math.random() * 0.15 + 0.08;
        });
    });
    
    // Toggle particles and activate heatmap
    if (coldWaterFlow) gsap.to(coldWaterFlow.material, { opacity: 0.0, size: 0.0, duration: 1.0 });
    if (thermalPlume) gsap.to(thermalPlume.material, { opacity: 0.95, size: 0.6, duration: 1.5 });
    if (retrofitGroup) retrofitGroup.visible = false;
    
    if (window.heatmapRings) {
        window.heatmapRings.forEach(r => {
            gsap.to(r.mesh.material, { opacity: r.baseOpacity, duration: 1.5 });
        });
    }
    
    addLogLine("Diagnostic Impact Analysis: ACTIVE.");
    addLogLine("Monitoring exhaust thermal footprint...");
}

function toggleRetrofitMode() {
    if (isCinematicRunning) return;
    
    isSchematicMode = false;
    isImpactMode = false;
    isRetrofitMode = true;
    isComparisonMode = false;
    isEcoMode = false;
    isBenefitsMode = false;
    isPrototypeMode = false;
    isConclusionMode = false;
    
    const btnOverview = document.getElementById("btn-overview");
    const btnSchematic = document.getElementById("btn-schematic");
    const btnImpact = document.getElementById("btn-impact");
    const btnRetrofit = document.getElementById("btn-retrofit");
    const btnComparison = document.getElementById("btn-comparison");
    const btnEco = document.getElementById("btn-eco");
    const btnBenefits = document.getElementById("btn-benefits");
    const btnPrototype = document.getElementById("btn-prototype");
    const btnConclusion = document.getElementById("btn-conclusion");
    
    btnOverview.classList.remove("active");
    btnSchematic.classList.remove("active");
    btnImpact.classList.remove("active");
    btnRetrofit.classList.add("active");
    btnComparison.classList.remove("active");
    btnEco.classList.remove("active");
    btnBenefits.classList.remove("active");
    btnPrototype.classList.remove("active");
    btnConclusion.classList.remove("active");
    
    const leftPanel = document.querySelector(".hud-panel.left-panel");
    const rightPanel = document.querySelector(".hud-panel.right-panel");
    const pAnnotations = document.getElementById("physics-annotations");
    const iAnnotations = document.getElementById("impact-annotations");
    const rAnnotations = document.getElementById("retrofit-annotations");
    const cOverlays = document.getElementById("comparison-overlays");
    const eOverlays = document.getElementById("eco-annotations");
    const bAnnotations = document.getElementById("benefits-annotations");
    const prAnnotations = document.getElementById("prototype-annotations");
    const cOverlay = document.getElementById("conclusion-overlay");
    const blackScreen = document.getElementById("black-out-screen");
    
    orbitControlsEnabled = false;
    orbitControls.enabled = false;
    document.getElementById("btn-orbit").classList.remove("active");
    document.getElementById("btn-orbit-text").innerText = "FREE ORBIT";
    
    // Hide dashboard
    leftPanel.style.transform = "translateX(-350px)";
    leftPanel.style.opacity = "0";
    rightPanel.style.transform = "translateX(350px)";
    rightPanel.style.opacity = "0";
    
    // Toggle overlays
    pAnnotations.classList.remove("hud-visible");
    pAnnotations.classList.add("hud-hidden");
    iAnnotations.classList.remove("hud-visible");
    iAnnotations.classList.add("hud-hidden");
    rAnnotations.classList.remove("hud-hidden");
    rAnnotations.classList.add("hud-visible");
    cOverlays.classList.remove("hud-visible");
    cOverlays.classList.add("hud-hidden");
    eOverlays.classList.remove("hud-visible");
    eOverlays.classList.add("hud-hidden");
    bAnnotations.classList.remove("hud-visible");
    bAnnotations.classList.add("hud-hidden");
    prAnnotations.classList.remove("hud-visible");
    prAnnotations.classList.add("hud-hidden");
    cOverlay.classList.remove("hud-visible");
    cOverlay.classList.add("hud-hidden");
    blackScreen.classList.remove("hud-visible");
    blackScreen.classList.add("hud-hidden");
    
    // Hide tabletop prototype elements
    if (classroomLight) classroomLight.intensity = 0.0;
    if (prototypeGroup) prototypeGroup.visible = false;
    
    // Restore marine life if hidden
    fishSchools.forEach(school => school.group.visible = true);
    bubbleSystems.forEach(sys => sys.mesh.material.opacity = 0.7);
    marineSnow.material.opacity = 0.8;
    
    // Zoom close-up onto central retrofit mount zone (4, -44, -120)
    gsap.to(camera.position, {
        x: 6.5,
        y: -39.5,
        z: -108,
        duration: 2.0,
        ease: "power2.inOut"
    });
    
    gsap.to(camTarget, {
        x: 3.5,
        y: -43.0,
        z: -120,
        duration: 2.0,
        ease: "power2.inOut"
    });
    
    // Solid center pod
    if (centerPodMesh) {
        gsap.to(centerPodMesh.material, {
            opacity: 1.0,
            duration: 1.5
        });
    }
    
    // Restore default fog parameters
    if (scene.fog) {
        gsap.to(scene.fog.color, { r: 0.023, g: 0.066, b: 0.129, duration: 1.5 });
        gsap.to(scene.fog, { density: 0.015, duration: 1.5 });
    }
    const sunLight = scene.getObjectByName("sunLight");
    if (sunLight) gsap.to(sunLight, { intensity: 1.5, duration: 1.5 });
    
    // Restore default particle parameters
    if (thermalPlume) {
        thermalPlume.material.size = 0.35;
        thermalPlume.material.color.setHex(0xff5500);
        window.plumeVelocities.forEach(v => {
            v.x = -0.06 - Math.random() * 0.1;
            v.y = 0.08 + Math.random() * 0.1;
        });
    }
    
    bubbleSystems.forEach(sys => {
        sys.velocities.forEach(v => {
            v.y = Math.random() * 0.15 + 0.08;
        });
    });
    
    // Hide heatmap, configure particles (mild plume representing controlled flow)
    if (coldWaterFlow) gsap.to(coldWaterFlow.material, { opacity: 0.0, size: 0.0, duration: 1.0 });
    if (thermalPlume) gsap.to(thermalPlume.material, { opacity: 0.55, size: 0.35, duration: 1.5 }); // mild managed plume
    if (window.heatmapRings) {
        window.heatmapRings.forEach(r => r.mesh.material.opacity = 0.0);
    }
    
    // Run slide-down mechanical clamp installation animation
    if (retrofitGroup) {
        retrofitGroup.visible = true;
        // set starting position y offset (high in the water)
        retrofitGroup.position.y = 12.0; 
        
        gsap.to(retrofitGroup.position, {
            y: 0.0,
            duration: 1.3,
            ease: "bounce.out", // satisfying mechanical bounce click
            onComplete: () => {
                addLogLine("Retrofit module: SECURED onto pressure hull.");
                addLogLine("Sensors online. AI edge optimization: STANDBY.");
            }
        });
    }
}

function toggleComparisonMode() {
    if (isCinematicRunning) return;
    
    isSchematicMode = false;
    isImpactMode = false;
    isRetrofitMode = false;
    isComparisonMode = true;
    isEcoMode = false;
    isBenefitsMode = false;
    isPrototypeMode = false;
    isConclusionMode = false;
    
    const btnOverview = document.getElementById("btn-overview");
    const btnSchematic = document.getElementById("btn-schematic");
    const btnImpact = document.getElementById("btn-impact");
    const btnRetrofit = document.getElementById("btn-retrofit");
    const btnComparison = document.getElementById("btn-comparison");
    const btnEco = document.getElementById("btn-eco");
    const btnBenefits = document.getElementById("btn-benefits");
    const btnPrototype = document.getElementById("btn-prototype");
    const btnConclusion = document.getElementById("btn-conclusion");
    
    btnOverview.classList.remove("active");
    btnSchematic.classList.remove("active");
    btnImpact.classList.remove("active");
    btnRetrofit.classList.remove("active");
    btnComparison.classList.add("active");
    btnEco.classList.remove("active");
    btnBenefits.classList.remove("active");
    btnPrototype.classList.remove("active");
    btnConclusion.classList.remove("active");
    
    const leftPanel = document.querySelector(".hud-panel.left-panel");
    const rightPanel = document.querySelector(".hud-panel.right-panel");
    const pAnnotations = document.getElementById("physics-annotations");
    const iAnnotations = document.getElementById("impact-annotations");
    const rAnnotations = document.getElementById("retrofit-annotations");
    const cOverlays = document.getElementById("comparison-overlays");
    const eOverlays = document.getElementById("eco-annotations");
    const bAnnotations = document.getElementById("benefits-annotations");
    const prAnnotations = document.getElementById("prototype-annotations");
    const cOverlay = document.getElementById("conclusion-overlay");
    const blackScreen = document.getElementById("black-out-screen");
    
    orbitControlsEnabled = false;
    orbitControls.enabled = false;
    document.getElementById("btn-orbit").classList.remove("active");
    document.getElementById("btn-orbit-text").innerText = "FREE ORBIT";
    
    // Hide dashboard
    leftPanel.style.transform = "translateX(-350px)";
    leftPanel.style.opacity = "0";
    rightPanel.style.transform = "translateX(350px)";
    rightPanel.style.opacity = "0";
    
    // Toggle overlays
    pAnnotations.classList.remove("hud-visible");
    pAnnotations.classList.add("hud-hidden");
    iAnnotations.classList.remove("hud-visible");
    iAnnotations.classList.add("hud-hidden");
    rAnnotations.classList.remove("hud-visible");
    rAnnotations.classList.add("hud-hidden");
    cOverlays.classList.remove("hud-hidden");
    cOverlays.classList.add("hud-visible");
    eOverlays.classList.remove("hud-visible");
    eOverlays.classList.add("hud-hidden");
    bAnnotations.classList.remove("hud-visible");
    bAnnotations.classList.add("hud-hidden");
    prAnnotations.classList.remove("hud-visible");
    prAnnotations.classList.add("hud-hidden");
    cOverlay.classList.remove("hud-visible");
    cOverlay.classList.add("hud-hidden");
    blackScreen.classList.remove("hud-visible");
    blackScreen.classList.add("hud-hidden");
    
    // Hide tabletop prototype elements
    if (classroomLight) classroomLight.intensity = 0.0;
    if (prototypeGroup) prototypeGroup.visible = false;
    
    // Restore marine life if hidden
    fishSchools.forEach(school => school.group.visible = true);
    bubbleSystems.forEach(sys => sys.mesh.material.opacity = 0.7);
    marineSnow.material.opacity = 0.8;
    
    // Camera position to frame central pod perfectly centered on division border
    gsap.to(camera.position, {
        x: 2.0,
        y: -43.0,
        z: -106,
        duration: 2.0,
        ease: "power2.inOut"
    });
    
    gsap.to(camTarget, {
        x: 2.0,
        y: -44.5,
        z: -120,
        duration: 2.0,
        ease: "power2.inOut"
    });
    
    // Solid center pod shell (for clarity in comparison)
    if (centerPodMesh) {
        gsap.to(centerPodMesh.material, {
            opacity: 1.0,
            duration: 1.5
        });
    }
    
    // Restore default fog parameters
    if (scene.fog) {
        gsap.to(scene.fog.color, { r: 0.023, g: 0.066, b: 0.129, duration: 1.5 });
        gsap.to(scene.fog, { density: 0.015, duration: 1.5 });
    }
    const sunLight = scene.getObjectByName("sunLight");
    if (sunLight) gsap.to(sunLight, { intensity: 1.5, duration: 1.5 });
    
    // Fade in particles for split viewport render
    if (coldWaterFlow) gsap.to(coldWaterFlow.material, { opacity: 0.0, size: 0.0, duration: 1.0 });
    if (thermalPlume) gsap.to(thermalPlume.material, { opacity: 0.95, duration: 1.5 });
    
    addLogLine("Comparison View: ACTIVE.");
    addLogLine("Comparing Conventional fixed cooling vs. Adaptive AquaShield dampening...");
}

function toggleEcoMode() {
    if (isCinematicRunning) return;
    
    isSchematicMode = false;
    isImpactMode = false;
    isRetrofitMode = false;
    isComparisonMode = false;
    isEcoMode = true;
    isBenefitsMode = false;
    isPrototypeMode = false;
    isConclusionMode = false;
    
    const btnOverview = document.getElementById("btn-overview");
    const btnSchematic = document.getElementById("btn-schematic");
    const btnImpact = document.getElementById("btn-impact");
    const btnRetrofit = document.getElementById("btn-retrofit");
    const btnComparison = document.getElementById("btn-comparison");
    const btnEco = document.getElementById("btn-eco");
    const btnBenefits = document.getElementById("btn-benefits");
    const btnPrototype = document.getElementById("btn-prototype");
    const btnConclusion = document.getElementById("btn-conclusion");
    
    btnOverview.classList.remove("active");
    btnSchematic.classList.remove("active");
    btnImpact.classList.remove("active");
    btnRetrofit.classList.remove("active");
    btnComparison.classList.remove("active");
    btnEco.classList.add("active");
    btnBenefits.classList.remove("active");
    btnPrototype.classList.remove("active");
    btnConclusion.classList.remove("active");
    
    const leftPanel = document.querySelector(".hud-panel.left-panel");
    const rightPanel = document.querySelector(".hud-panel.right-panel");
    const pAnnotations = document.getElementById("physics-annotations");
    const iAnnotations = document.getElementById("impact-annotations");
    const rAnnotations = document.getElementById("retrofit-annotations");
    const cOverlays = document.getElementById("comparison-overlays");
    const eOverlays = document.getElementById("eco-annotations");
    const bAnnotations = document.getElementById("benefits-annotations");
    const prAnnotations = document.getElementById("prototype-annotations");
    const cOverlay = document.getElementById("conclusion-overlay");
    const blackScreen = document.getElementById("black-out-screen");
    
    orbitControlsEnabled = false;
    orbitControls.enabled = false;
    document.getElementById("btn-orbit").classList.remove("active");
    document.getElementById("btn-orbit-text").innerText = "FREE ORBIT";
    
    // Hide dashboard
    leftPanel.style.transform = "translateX(-350px)";
    leftPanel.style.opacity = "0";
    rightPanel.style.transform = "translateX(350px)";
    rightPanel.style.opacity = "0";
    
    // Toggle overlays
    pAnnotations.classList.remove("hud-visible");
    pAnnotations.classList.add("hud-hidden");
    iAnnotations.classList.remove("hud-visible");
    iAnnotations.classList.add("hud-hidden");
    rAnnotations.classList.remove("hud-visible");
    rAnnotations.classList.add("hud-hidden");
    cOverlays.classList.remove("hud-visible");
    cOverlays.classList.add("hud-hidden");
    eOverlays.classList.remove("hud-hidden");
    eOverlays.classList.add("hud-visible");
    bAnnotations.classList.remove("hud-visible");
    bAnnotations.classList.add("hud-hidden");
    prAnnotations.classList.remove("hud-visible");
    prAnnotations.classList.add("hud-hidden");
    cOverlay.classList.remove("hud-visible");
    cOverlay.classList.add("hud-hidden");
    blackScreen.classList.remove("hud-visible");
    blackScreen.classList.add("hud-hidden");
    
    // Hide tabletop prototype elements
    if (classroomLight) classroomLight.intensity = 0.0;
    if (prototypeGroup) prototypeGroup.visible = false;
    
    // Restore marine life
    fishSchools.forEach(school => school.group.visible = true);
    bubbleSystems.forEach(sys => sys.mesh.material.opacity = 0.0);
    marineSnow.material.opacity = 0.0;
    
    // Zoom camera out to wide cinematic view
    gsap.to(camera.position, {
        x: 13.0,
        y: -38.0,
        z: -86.0,
        duration: 2.0,
        ease: "power2.inOut"
    });
    
    gsap.to(camTarget, {
        x: 0,
        y: -45.0,
        z: -125.0,
        duration: 2.0,
        ease: "power2.inOut"
    });
    
    // Solid center pod shell
    if (centerPodMesh) {
        gsap.to(centerPodMesh.material, {
            opacity: 1.0,
            duration: 1.5
        });
    }
    
    // Clear, hopeful blue fog & light adjustments
    if (scene.fog) {
        gsap.to(scene.fog.color, {
            r: 0.04,
            g: 0.11,
            b: 0.19, // slightly brighter teal-blue
            duration: 1.5
        });
        gsap.to(scene.fog, {
            density: 0.011, // clearer water
            duration: 1.5
        });
    }
    
    // Make sun god rays filter brighter
    const sunLight = scene.getObjectByName("sunLight");
    if (sunLight) {
        gsap.to(sunLight, {
            intensity: 2.6,
            duration: 1.5
        });
    }
    
    // Hide heatmap, show retrofitted module, configure plume (faded, nearly invisible cool teal)
    if (coldWaterFlow) gsap.to(coldWaterFlow.material, { opacity: 0.0, size: 0.0, duration: 1.0 });
    if (thermalPlume) {
        thermalPlume.material.size = 0.22;
        thermalPlume.material.color.setHex(0x00ffc4);
        gsap.to(thermalPlume.material, { opacity: 0.12, duration: 1.5 });
        
        window.plumeVelocities.forEach(v => {
            v.x = -0.03 - Math.random() * 0.04; // slow, gentle drift
            v.y = 0.04 + Math.random() * 0.04;
        });
    }
    if (retrofitGroup) {
        retrofitGroup.visible = true;
        retrofitGroup.position.y = 0.0; // clamp fixed
    }
    if (window.heatmapRings) {
        window.heatmapRings.forEach(r => r.mesh.material.opacity = 0.0);
    }
    
    addLogLine("Eco-Harmony Mode: ACTIVE.");
    addLogLine("Monitoring biological recovery & temperature compliance...");
}

function toggleBenefitsMode() {
    if (isCinematicRunning) return;
    
    isSchematicMode = false;
    isImpactMode = false;
    isRetrofitMode = false;
    isComparisonMode = false;
    isEcoMode = false;
    isBenefitsMode = true;
    isPrototypeMode = false;
    isConclusionMode = false;
    
    const btnOverview = document.getElementById("btn-overview");
    const btnSchematic = document.getElementById("btn-schematic");
    const btnImpact = document.getElementById("btn-impact");
    const btnRetrofit = document.getElementById("btn-retrofit");
    const btnComparison = document.getElementById("btn-comparison");
    const btnEco = document.getElementById("btn-eco");
    const btnBenefits = document.getElementById("btn-benefits");
    const btnPrototype = document.getElementById("btn-prototype");
    const btnConclusion = document.getElementById("btn-conclusion");
    
    btnOverview.classList.remove("active");
    btnSchematic.classList.remove("active");
    btnImpact.classList.remove("active");
    btnRetrofit.classList.remove("active");
    btnComparison.classList.remove("active");
    btnEco.classList.remove("active");
    btnBenefits.classList.add("active");
    btnPrototype.classList.remove("active");
    btnConclusion.classList.remove("active");
    
    const leftPanel = document.querySelector(".hud-panel.left-panel");
    const rightPanel = document.querySelector(".hud-panel.right-panel");
    const pAnnotations = document.getElementById("physics-annotations");
    const iAnnotations = document.getElementById("impact-annotations");
    const rAnnotations = document.getElementById("retrofit-annotations");
    const cOverlays = document.getElementById("comparison-overlays");
    const eOverlays = document.getElementById("eco-annotations");
    const bAnnotations = document.getElementById("benefits-annotations");
    const prAnnotations = document.getElementById("prototype-annotations");
    const cOverlay = document.getElementById("conclusion-overlay");
    const blackScreen = document.getElementById("black-out-screen");
    
    orbitControlsEnabled = false;
    orbitControls.enabled = false;
    document.getElementById("btn-orbit").classList.remove("active");
    document.getElementById("btn-orbit-text").innerText = "FREE ORBIT";
    
    // Hide default panels
    leftPanel.style.transform = "translateX(-350px)";
    leftPanel.style.opacity = "0";
    rightPanel.style.transform = "translateX(350px)";
    rightPanel.style.opacity = "0";
    
    // Toggle overlays
    pAnnotations.classList.remove("hud-visible");
    pAnnotations.classList.add("hud-hidden");
    iAnnotations.classList.remove("hud-visible");
    iAnnotations.classList.add("hud-hidden");
    rAnnotations.classList.remove("hud-visible");
    rAnnotations.classList.add("hud-hidden");
    cOverlays.classList.remove("hud-visible");
    cOverlays.classList.add("hud-hidden");
    eOverlays.classList.remove("hud-visible");
    eOverlays.classList.add("hud-hidden");
    bAnnotations.classList.remove("hud-hidden");
    bAnnotations.classList.add("hud-visible");
    prAnnotations.classList.remove("hud-visible");
    prAnnotations.classList.add("hud-hidden");
    cOverlay.classList.remove("hud-visible");
    cOverlay.classList.add("hud-hidden");
    blackScreen.classList.remove("hud-visible");
    blackScreen.classList.add("hud-hidden");
    
    // Standard camera view
    gsap.to(camera.position, {
        x: 8,
        y: -44,
        z: -96,
        duration: 1.8,
        ease: "power2.inOut"
    });
    
    gsap.to(camTarget, {
        x: -5,
        y: -47,
        z: -122,
        duration: 1.8,
        ease: "power2.inOut"
    });
    
    // Solid pod
    if (centerPodMesh) {
        gsap.to(centerPodMesh.material, {
            opacity: 1.0,
            duration: 1.5
        });
    }
    
    // Restore default fog parameters
    if (scene.fog) {
        gsap.to(scene.fog.color, { r: 0.023, g: 0.066, b: 0.129, duration: 1.5 });
        gsap.to(scene.fog, { density: 0.015, duration: 1.5 });
    }
    const sunLight = scene.getObjectByName("sunLight");
    if (sunLight) gsap.to(sunLight, { intensity: 1.5, duration: 1.5 });
    if (classroomLight) classroomLight.intensity = 0.0;
    if (prototypeGroup) prototypeGroup.visible = false;
    
    // Restore marine life
    fishSchools.forEach(school => school.group.visible = true);
    bubbleSystems.forEach(sys => sys.mesh.material.opacity = 0.5);
    marineSnow.material.opacity = 0.8;
    
    // Hide specific modes' helper assets
    if (coldWaterFlow) gsap.to(coldWaterFlow.material, { opacity: 0.0, size: 0.0, duration: 1.0 });
    if (thermalPlume) gsap.to(thermalPlume.material, { opacity: 0.0, size: 0.0, duration: 1.0 });
    if (retrofitGroup) retrofitGroup.visible = false;
    if (window.heatmapRings) {
        window.heatmapRings.forEach(r => r.mesh.material.opacity = 0.0);
    }
    
    addLogLine("Benefits Hologram Dashboard: ACTIVE.");
}

function togglePrototypeMode() {
    if (isCinematicRunning) return;
    
    isSchematicMode = false;
    isImpactMode = false;
    isRetrofitMode = false;
    isComparisonMode = false;
    isEcoMode = false;
    isBenefitsMode = false;
    isPrototypeMode = true;
    isConclusionMode = false;
    
    const btnOverview = document.getElementById("btn-overview");
    const btnSchematic = document.getElementById("btn-schematic");
    const btnImpact = document.getElementById("btn-impact");
    const btnRetrofit = document.getElementById("btn-retrofit");
    const btnComparison = document.getElementById("btn-comparison");
    const btnEco = document.getElementById("btn-eco");
    const btnBenefits = document.getElementById("btn-benefits");
    const btnPrototype = document.getElementById("btn-prototype");
    const btnConclusion = document.getElementById("btn-conclusion");
    
    btnOverview.classList.remove("active");
    btnSchematic.classList.remove("active");
    btnImpact.classList.remove("active");
    btnRetrofit.classList.remove("active");
    btnComparison.classList.remove("active");
    btnEco.classList.remove("active");
    btnBenefits.classList.remove("active");
    btnPrototype.classList.add("active");
    btnConclusion.classList.remove("active");
    
    const leftPanel = document.querySelector(".hud-panel.left-panel");
    const rightPanel = document.querySelector(".hud-panel.right-panel");
    const pAnnotations = document.getElementById("physics-annotations");
    const iAnnotations = document.getElementById("impact-annotations");
    const rAnnotations = document.getElementById("retrofit-annotations");
    const cOverlays = document.getElementById("comparison-overlays");
    const eOverlays = document.getElementById("eco-annotations");
    const bAnnotations = document.getElementById("benefits-annotations");
    const prAnnotations = document.getElementById("prototype-annotations");
    const cOverlay = document.getElementById("conclusion-overlay");
    const blackScreen = document.getElementById("black-out-screen");
    
    orbitControlsEnabled = false;
    orbitControls.enabled = false;
    document.getElementById("btn-orbit").classList.remove("active");
    document.getElementById("btn-orbit-text").innerText = "FREE ORBIT";
    
    // Hide dashboard
    leftPanel.style.transform = "translateX(-350px)";
    leftPanel.style.opacity = "0";
    rightPanel.style.transform = "translateX(350px)";
    rightPanel.style.opacity = "0";
    
    // Toggle overlays
    pAnnotations.classList.remove("hud-visible");
    pAnnotations.classList.add("hud-hidden");
    iAnnotations.classList.remove("hud-visible");
    iAnnotations.classList.add("hud-hidden");
    rAnnotations.classList.remove("hud-visible");
    rAnnotations.classList.add("hud-hidden");
    cOverlays.classList.remove("hud-visible");
    cOverlays.classList.add("hud-hidden");
    eOverlays.classList.remove("hud-visible");
    eOverlays.classList.add("hud-hidden");
    bAnnotations.classList.remove("hud-visible");
    bAnnotations.classList.add("hud-hidden");
    prAnnotations.classList.remove("hud-hidden");
    prAnnotations.classList.add("hud-visible");
    cOverlay.classList.remove("hud-visible");
    cOverlay.classList.add("hud-hidden");
    blackScreen.classList.remove("hud-visible");
    blackScreen.classList.add("hud-hidden");
    
    // Zoom onto tabletop prototype
    gsap.to(camera.position, {
        x: 42.0,
        y: -4.0,
        z: -48.0,
        duration: 2.0,
        ease: "power2.inOut"
    });
    
    gsap.to(camTarget, {
        x: 42.0,
        y: -9.0,
        z: -60.0,
        duration: 2.0,
        ease: "power2.inOut"
    });
    
    // Tabletop lighting & environmental atmospheric fog (classroom style)
    if (classroomLight) gsap.to(classroomLight, { intensity: 3.8, duration: 1.5 });
    if (scene.fog) {
        gsap.to(scene.fog.color, { r: 0.88, g: 0.91, b: 0.94, duration: 1.5 });
        gsap.to(scene.fog, { density: 0.001, duration: 1.5 });
    }
    const sunLight = scene.getObjectByName("sunLight");
    if (sunLight) gsap.to(sunLight, { intensity: 0.0, duration: 1.5 });
    
    if (prototypeGroup) prototypeGroup.visible = true;
    
    // Hide marine assets
    fishSchools.forEach(school => school.group.visible = false);
    bubbleSystems.forEach(sys => sys.mesh.material.opacity = 0.0);
    marineSnow.material.opacity = 0.0;
    
    if (coldWaterFlow) gsap.to(coldWaterFlow.material, { opacity: 0.0, size: 0.0, duration: 1.0 });
    if (thermalPlume) gsap.to(thermalPlume.material, { opacity: 0.0, size: 0.0, duration: 1.0 });
    if (retrofitGroup) retrofitGroup.visible = false;
    if (window.heatmapRings) {
        window.heatmapRings.forEach(r => r.mesh.material.opacity = 0.0);
    }
    
    addLogLine("Student Prototype Demo: ACTIVE.");
}

function playConclusionOutro() {
    if (isCinematicRunning) return;
    
    isSchematicMode = false;
    isImpactMode = false;
    isRetrofitMode = false;
    isComparisonMode = false;
    isEcoMode = false;
    isBenefitsMode = false;
    isPrototypeMode = false;
    isConclusionMode = true;
    
    const btnConclusion = document.getElementById("btn-conclusion");
    document.querySelectorAll(".hud-ctrl-btn").forEach(btn => btn.classList.remove("active"));
    btnConclusion.classList.add("active");
    
    const leftPanel = document.querySelector(".hud-panel.left-panel");
    const rightPanel = document.querySelector(".hud-panel.right-panel");
    const bottomPanel = document.querySelector(".bottom-bar");
    const pAnnotations = document.getElementById("physics-annotations");
    const iAnnotations = document.getElementById("impact-annotations");
    const rAnnotations = document.getElementById("retrofit-annotations");
    const cOverlays = document.getElementById("comparison-overlays");
    const eOverlays = document.getElementById("eco-annotations");
    const bAnnotations = document.getElementById("benefits-annotations");
    const prAnnotations = document.getElementById("prototype-annotations");
    const cOverlay = document.getElementById("conclusion-overlay");
    const blackScreen = document.getElementById("black-out-screen");
    
    orbitControlsEnabled = false;
    orbitControls.enabled = false;
    document.getElementById("btn-orbit").classList.remove("active");
    document.getElementById("btn-orbit-text").innerText = "FREE ORBIT";
    
    // Slide panels completely off screen
    leftPanel.style.transform = "translateX(-350px)";
    leftPanel.style.opacity = "0";
    rightPanel.style.transform = "translateX(350px)";
    rightPanel.style.opacity = "0";
    bottomPanel.style.transform = "translateY(150px)";
    bottomPanel.style.opacity = "0";
    
    // Clean overlays
    pAnnotations.classList.remove("hud-visible");
    pAnnotations.classList.add("hud-hidden");
    iAnnotations.classList.remove("hud-visible");
    iAnnotations.classList.add("hud-hidden");
    rAnnotations.classList.remove("hud-visible");
    rAnnotations.classList.add("hud-hidden");
    cOverlays.classList.remove("hud-visible");
    cOverlays.classList.add("hud-hidden");
    eOverlays.classList.remove("hud-visible");
    eOverlays.classList.add("hud-hidden");
    bAnnotations.classList.remove("hud-visible");
    bAnnotations.classList.add("hud-hidden");
    prAnnotations.classList.remove("hud-visible");
    prAnnotations.classList.add("hud-hidden");
    
    // STEP 1: Zoom immediately onto the tabletop prototype if not already there
    camera.position.set(42.0, -4.0, -48.0);
    camTarget.set(42.0, -9.0, -60.0);
    
    if (prototypeGroup) prototypeGroup.visible = true;
    if (classroomLight) classroomLight.intensity = 3.8;
    if (scene.fog) {
        scene.fog.color.setRGB(0.88, 0.91, 0.94);
        scene.fog.density = 0.001;
    }
    
    fishSchools.forEach(school => school.group.visible = false);
    bubbleSystems.forEach(sys => sys.mesh.material.opacity = 0.0);
    marineSnow.material.opacity = 0.0;
    
    addLogLine("Starting Outro Sequence...");
    
    // STEP 2: Hold for 1 second, then slow pull-back into the ocean (Duration: 6.5s)
    setTimeout(() => {
        // Cameras track back to the wide deep-ocean view
        gsap.to(camera.position, {
            x: 13.0,
            y: -38.0,
            z: -86.0,
            duration: 6.5,
            ease: "power1.inOut"
        });
        
        gsap.to(camTarget, {
            x: 0.0,
            y: -45.0,
            z: -125.0,
            duration: 6.5,
            ease: "power1.inOut"
        });
        
        // Transition lighting & environmental atmospheric fog back to deep sea
        if (scene.fog) {
            gsap.to(scene.fog.color, { r: 0.023, g: 0.066, b: 0.129, duration: 5.5 });
            gsap.to(scene.fog, { density: 0.015, duration: 5.5 });
        }
        
        const sunLight = scene.getObjectByName("sunLight");
        if (sunLight) gsap.to(sunLight, { intensity: 1.5, duration: 5.5 });
        if (classroomLight) gsap.to(classroomLight, { intensity: 0.0, duration: 4.5 });
        
        // Mid-way: toggle visibility of assets
        setTimeout(() => {
            if (prototypeGroup) prototypeGroup.visible = false;
            fishSchools.forEach(school => school.group.visible = true);
            bubbleSystems.forEach(sys => sys.mesh.material.opacity = 0.5);
            marineSnow.material.opacity = 0.85;
            
            if (retrofitGroup) {
                retrofitGroup.visible = true;
                retrofitGroup.position.y = 0.0;
            }
            if (thermalPlume) {
                thermalPlume.material.size = 0.22;
                thermalPlume.material.color.setHex(0x00ffc4);
                gsap.to(thermalPlume.material, { opacity: 0.12, duration: 2.0 });
            }
        }, 3000);
        
    }, 1000);
    
    // STEP 3: Fade in final centered value text cards (At 7.5 seconds)
    setTimeout(() => {
        cOverlay.classList.remove("hud-hidden");
        cOverlay.classList.add("hud-visible");
    }, 7500);
    
    // STEP 4: Fade entire screen to black after holding (At 10.5 seconds)
    setTimeout(() => {
        blackScreen.classList.remove("hud-hidden");
        blackScreen.classList.add("hud-visible");
    }, 10500);
}

function restartPresentation() {
    const leftPanel = document.querySelector(".hud-panel.left-panel");
    const rightPanel = document.querySelector(".hud-panel.right-panel");
    const bottomPanel = document.querySelector(".bottom-bar");
    const cOverlay = document.getElementById("conclusion-overlay");
    const blackScreen = document.getElementById("black-out-screen");
    
    cOverlay.classList.remove("hud-visible");
    cOverlay.classList.add("hud-hidden");
    blackScreen.classList.remove("hud-visible");
    blackScreen.classList.add("hud-hidden");
    
    leftPanel.style.transform = "translateX(0)";
    leftPanel.style.opacity = "1";
    rightPanel.style.transform = "translateX(0)";
    rightPanel.style.opacity = "1";
    bottomPanel.style.transform = "translateY(0)";
    bottomPanel.style.opacity = "1";
    
    replayCinematic();
}

function createPrototypeScene() {
    prototypeGroup = new THREE.Group();
    prototypeGroup.position.set(40, -10, -60);
    prototypeGroup.visible = false;
    scene.add(prototypeGroup);
    
    // Classroom Light (glowing fluorescent panel simulation)
    classroomLight = new THREE.DirectionalLight(0xffffff, 0.0);
    classroomLight.position.set(40, 20, -50);
    classroomLight.target.position.set(40, -10, -60);
    scene.add(classroomLight);
    scene.add(classroomLight.target);
    
    // 1. Wood Workbench Table
    const tableGeo = new THREE.BoxGeometry(16, 0.4, 10);
    const tableMat = new THREE.MeshStandardMaterial({
        color: 0x8a5a36,
        roughness: 0.6,
        metalness: 0.1
    });
    const table = new THREE.Mesh(tableGeo, tableMat);
    table.position.set(0, -0.2, 0);
    table.receiveShadow = true;
    prototypeGroup.add(table);
    
    // Table legs (four simple cylinders)
    const legGeo = new THREE.CylinderGeometry(0.3, 0.3, 10, 8);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
    const legPositions = [
        [-7.5, -5.2, -4.5],
        [7.5, -5.2, -4.5],
        [-7.5, -5.2, 4.5],
        [7.5, -5.2, 4.5]
    ];
    legPositions.forEach(pos => {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(pos[0], pos[1], pos[2]);
        prototypeGroup.add(leg);
    });
    
    // 2. Glass Aquarium Tank
    const glassGeo = new THREE.BoxGeometry(5.2, 3.6, 3.4);
    const glassMat = new THREE.MeshStandardMaterial({
        color: 0xaaddff,
        transparent: true,
        opacity: 0.28,
        roughness: 0.1,
        metalness: 0.95
    });
    const glassAquarium = new THREE.Mesh(glassGeo, glassMat);
    glassAquarium.position.set(-3.5, 1.8, 1);
    prototypeGroup.add(glassAquarium);
    
    // Translucent water inside tank
    const waterGeo = new THREE.BoxGeometry(5.0, 3.0, 3.2);
    const waterMat = new THREE.MeshStandardMaterial({
        color: 0x00d2ff,
        transparent: true,
        opacity: 0.35,
        roughness: 0.2
    });
    const aquariumWater = new THREE.Mesh(waterGeo, waterMat);
    aquariumWater.position.set(-3.5, 1.5, 1);
    prototypeGroup.add(aquariumWater);
    
    // Miniature Horizontal Data Pod
    const miniPodGeo = new THREE.CylinderGeometry(0.45, 0.45, 2.0, 16);
    miniPodGeo.rotateZ(Math.PI / 2);
    const miniPodMat = new THREE.MeshStandardMaterial({
        color: 0x778899,
        metalness: 0.85,
        roughness: 0.25
    });
    const miniPod = new THREE.Mesh(miniPodGeo, miniPodMat);
    miniPod.position.set(-3.5, 1.2, 1); // submersed
    prototypeGroup.add(miniPod);
    
    // Submersed Mini Pump (small black box)
    const pumpGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
    const pumpMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    const pump = new THREE.Mesh(pumpGeo, pumpMat);
    pump.position.set(-5.0, 0.45, 0.2);
    prototypeGroup.add(pump);
    
    // 3. ESP32 Microcontroller on Breadboard
    // Breadboard base
    const bbGeo = new THREE.BoxGeometry(2.2, 0.15, 1.3);
    const bbMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.9 });
    const breadboard = new THREE.Mesh(bbGeo, bbMat);
    breadboard.position.set(1.5, 0.1, 2.0);
    prototypeGroup.add(breadboard);
    
    // ESP32 Chip
    const espGeo = new THREE.BoxGeometry(1.5, 0.08, 0.95);
    const espMat = new THREE.MeshStandardMaterial({ color: 0x0c3360, roughness: 0.4 });
    const esp = new THREE.Mesh(espGeo, espMat);
    esp.position.set(1.5, 0.22, 2.0);
    prototypeGroup.add(esp);
    
    // Small flashing red/green LED bulbs on ESP32
    const ledGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const ledRMat = new THREE.MeshBasicMaterial({ color: 0xff3b00 });
    const ledGMat = new THREE.MeshBasicMaterial({ color: 0x00ffc4 });
    
    const ledRed = new THREE.Mesh(ledGeo, ledRMat);
    ledRed.position.set(1.0, 0.28, 1.7);
    prototypeGroup.add(ledRed);
    window.protoLedRed = ledRed;
    
    const ledGreen = new THREE.Mesh(ledGeo, ledGMat);
    ledGreen.position.set(1.1, 0.28, 2.3);
    prototypeGroup.add(ledGreen);
    window.protoLedGreen = ledGreen;
    
    // 4. Laptop Dashboard
    const laptopGroup = new THREE.Group();
    laptopGroup.position.set(3.2, 0.0, -1.0);
    prototypeGroup.add(laptopGroup);
    
    // Keyboard base
    const lBaseGeo = new THREE.BoxGeometry(3.2, 0.08, 2.2);
    const lBaseMat = new THREE.MeshStandardMaterial({ color: 0x2d3748, metalness: 0.8, roughness: 0.3 });
    const laptopBase = new THREE.Mesh(lBaseGeo, lBaseMat);
    laptopBase.position.set(0, 0.04, 0);
    laptopGroup.add(laptopBase);
    
    // Open Screen lid (slanted)
    const lScreenGeo = new THREE.BoxGeometry(3.2, 2.2, 0.08);
    const laptopScreen = new THREE.Mesh(lScreenGeo, lBaseMat);
    laptopScreen.position.set(0, 1.1, -1.0);
    laptopScreen.rotation.x = -0.15; // tilt back slightly
    laptopGroup.add(laptopScreen);
    
    // Glowing Digital Twin UI display
    const lDisplayGeo = new THREE.BoxGeometry(3.0, 2.0, 0.02);
    const lDisplayMat = new THREE.MeshStandardMaterial({
        color: 0x00ffc4,
        emissive: 0x005544,
        emissiveIntensity: 0.8,
        roughness: 0.1
    });
    const laptopDisplay = new THREE.Mesh(lDisplayGeo, lDisplayMat);
    laptopDisplay.position.set(0, 1.1, -0.96);
    laptopDisplay.rotation.x = -0.15;
    laptopGroup.add(laptopDisplay);
    
    // Draw wire connections (catmull-rom curves mapped to line rendering)
    const wireMatBlue = new THREE.LineBasicMaterial({ color: 0x00a2ff, linewidth: 2 });
    const wirePointsBlue = [
        new THREE.Vector3(1.5, 0.22, 1.5),  // ESP32
        new THREE.Vector3(0.0, 1.0, 1.5),
        new THREE.Vector3(-3.0, 1.5, 1.0)   // Aquarium
    ];
    const wireCurveBlue = new THREE.CatmullRomCurve3(wirePointsBlue);
    const wireGeoBlue = new THREE.BufferGeometry().setFromPoints(wireCurveBlue.getPoints(24));
    const wireBlue = new THREE.Line(wireGeoBlue, wireMatBlue);
    prototypeGroup.add(wireBlue);
    
    const wireMatRed = new THREE.LineBasicMaterial({ color: 0xff3b00, linewidth: 2 });
    const wirePointsRed = [
        new THREE.Vector3(1.0, 0.22, 2.0),
        new THREE.Vector3(-1.0, 0.8, 0.8),
        new THREE.Vector3(-4.8, 0.5, 0.2) // pump
    ];
    const wireCurveRed = new THREE.CatmullRomCurve3(wirePointsRed);
    const wireGeoRed = new THREE.BufferGeometry().setFromPoints(wireCurveRed.getPoints(24));
    const wireRed = new THREE.Line(wireGeoRed, wireMatRed);
    prototypeGroup.add(wireRed);
}

function createSeagrass() {
    seagrassGroup = new THREE.Group();
    scene.add(seagrassGroup);
    
    const bladeGeo = new THREE.PlaneGeometry(0.15, 2.2, 1, 4);
    bladeGeo.translate(0, 1.1, 0); // pivot at base
    
    const bladeMat = new THREE.MeshStandardMaterial({
        color: 0x0b3223,
        roughness: 0.8,
        side: THREE.DoubleSide
    });
    
    const bladeCount = 50;
    for (let i = 0; i < bladeCount; i++) {
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        const x = -20 + Math.random() * 40;
        const z = -150 + Math.random() * 70;
        blade.position.set(x, -50.0, z);
        
        blade.rotation.y = Math.random() * Math.PI;
        blade.rotation.x = (Math.random() - 0.5) * 0.1;
        blade.rotation.z = (Math.random() - 0.5) * 0.1;
        
        seagrassGroup.add(blade);
    }
}

function createHeatmap() {
    heatmapMesh = new THREE.Group();
    heatmapMesh.position.set(-4, -41.2, -120); // exhaust port world position
    
    heatmapMesh.rotation.x = -Math.PI / 2; // lay flat horizontally
    scene.add(heatmapMesh);
    
    const ringCount = 4;
    window.heatmapRings = [];
    
    for (let i = 0; i < ringCount; i++) {
        // Flat ring shape representing thermal bands
        const ringGeo = new THREE.RingGeometry(0.2, 5.5, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xff3b00,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.0, // starts invisible
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.scale.setScalar(i / ringCount * 3.0 + 0.1);
        heatmapMesh.add(ring);
        
        window.heatmapRings.push({
            mesh: ring,
            speed: 0.012 + Math.random() * 0.004,
            baseOpacity: 0.45
        });
    }
}

function createRetrofitModule() {
    if (!centerPodMesh) return;
    
    retrofitGroup = new THREE.Group();
    
    // Torus hoops wrapping around cylinder shell (podRadius = 3.2)
    const torusGeo = new THREE.TorusGeometry(3.2 + 0.1, 0.08, 8, 48);
    torusGeo.rotateY(Math.PI / 2); // align in Y-Z plane
    
    const clampMat = new THREE.MeshStandardMaterial({
        color: 0x1f2e3d,
        roughness: 0.5,
        metalness: 0.8
    });
    
    const clamp1 = new THREE.Mesh(torusGeo, clampMat);
    clamp1.position.set(-0.8, 0, 0); // local offset
    retrofitGroup.add(clamp1);
    
    const clamp2 = new THREE.Mesh(torusGeo, clampMat);
    clamp2.position.set(0.8, 0, 0);
    retrofitGroup.add(clamp2);
    
    // Chassis box mounting on top of cylinder shell
    const chassisGeo = new THREE.BoxGeometry(2.2, 1.2, 1.4);
    const chassisMat = new THREE.MeshStandardMaterial({
        color: 0x182430,
        roughness: 0.2,
        metalness: 0.8
    });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    chassis.position.set(0, 3.2 + 0.6, 0);
    retrofitGroup.add(chassis);
    
    // Glowing temperature sensors (spheres)
    const sensorGeo = new THREE.SphereGeometry(0.14, 16, 16);
    
    // Cold thermistor (blue)
    const coldSensorMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff });
    const coldSensor = new THREE.Mesh(sensorGeo, coldSensorMat);
    coldSensor.position.set(-0.6, 3.2 + 1.2, 0.35);
    retrofitGroup.add(coldSensor);
    window.coldSensorMesh = coldSensor;
    
    // Hot thermistor (red)
    const hotSensorMat = new THREE.MeshBasicMaterial({ color: 0xff3b00 });
    const hotSensor = new THREE.Mesh(sensorGeo, hotSensorMat);
    hotSensor.position.set(0.6, 3.2 + 1.2, 0.35);
    retrofitGroup.add(hotSensor);
    window.hotSensorMesh = hotSensor;
    
    // Flow Turbine sensor (spinning blades on front face)
    flowSensorTurbine = new THREE.Group();
    flowSensorTurbine.position.set(0, 3.2 + 0.6, 0.72); // front face center
    
    const bladeGeo = new THREE.BoxGeometry(0.7, 0.08, 0.08);
    const bladeMat = new THREE.MeshStandardMaterial({
        color: 0x00ffc4,
        roughness: 0.1,
        metalness: 0.9,
        emissive: 0x003322
    });
    
    for (let b = 0; b < 3; b++) {
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.rotation.z = (b * Math.PI / 3);
        flowSensorTurbine.add(blade);
    }
    retrofitGroup.add(flowSensorTurbine);
    
    // Edge controller CPU board (pulsing blue grid)
    const cpuGeo = new THREE.BoxGeometry(0.65, 0.1, 0.65);
    const cpuMat = new THREE.MeshStandardMaterial({
        color: 0x081220,
        roughness: 0.6,
        metalness: 0.9
    });
    const cpu = new THREE.Mesh(cpuGeo, cpuMat);
    cpu.position.set(0, 3.2 + 1.25, -0.2);
    retrofitGroup.add(cpu);
    
    const cpuGlowGeo = new THREE.BoxGeometry(0.5, 0.02, 0.5);
    const cpuGlowMat = new THREE.MeshStandardMaterial({
        color: 0x00ffc4,
        emissive: 0x00ffc4,
        emissiveIntensity: 1.0,
        transparent: true
    });
    const cpuGlow = new THREE.Mesh(cpuGlowGeo, cpuGlowMat);
    cpuGlow.position.set(0, 3.2 + 1.31, -0.2);
    retrofitGroup.add(cpuGlow);
    window.cpuGlowMesh = cpuGlow;
    
    // Position clamp module on the right side of the center pod cylinder
    retrofitGroup.position.set(4, 0, 0); 
    retrofitGroup.visible = false; // invisible until mode starts
    
    centerPodMesh.add(retrofitGroup);
}

// ==========================================
// 7. INITIALIZATION KICK-OFF
// ==========================================
init3D();
animate();
