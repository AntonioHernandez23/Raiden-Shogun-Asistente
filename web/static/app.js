/* Raiden Assistant – Three r152.2 + VRM v2
   Pose tímida + idle + springs + colita procedural + PARTÍCULAS + RAYOS ELECTRO
   Build 19 con efectos de rayos al hablar
*/
import * as THREE from 'https://esm.sh/three@0.152.2';
import { OrbitControls } from 'https://esm.sh/three@0.152.2/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://esm.sh/three@0.152.2/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'https://esm.sh/three@0.152.2/examples/jsm/loaders/DRACOLoader.js';
import { VRMLoaderPlugin, VRMUtils, VRMExpressionPresetName } from 'https://esm.sh/@pixiv/three-vrm@2.0.4?deps=three@0.152.2';

// Mapeo de emociones de Python a expresiones VRM
const EMOTION_TO_VRM = {
    'satisfied': 'happy',
    'stern': 'angry',
    'contemplative': 'sad',
    'intrigued': 'surprised',
    'gentle': 'relaxed',
    'serious': 'neutral'
};

// Intensidades específicas para Raiden (sutiles y dignas)
const EMOTION_INTENSITY = {
    'satisfied': 0.75, //mas alto mayor el rasgo de emoción
    'stern': 0.70,
    'contemplative': 0.60,
    'intrigued': 0.60,
    'gentle': 0.55,
    'serious': 0.40
};

console.log("🎭 Sistema de expresiones emocionales cargado");

// Detectar dispositivo móvil
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
console.log(isMobile ? '📱 Dispositivo móvil detectado' : '💻 Dispositivo desktop detectado');

/* Parche ShaderChunk */
{
  const C = THREE.ShaderChunk;
  if (!C.colorspace_pars_fragment && C.encodings_pars_fragment) {
    C.colorspace_pars_fragment = C.encodings_pars_fragment;
  }
  if (!C.colorspace_fragment) {
    C.colorspace_fragment = `
      gl_FragColor = vec4( clamp( gl_FragColor.rgb, 0.0, 1.0 ), gl_FragColor.a );
    `;
  }
}

/* CONFIG */
const ROTATE_180 = true;

const SLEEVE_CFG = {
  gravityZ: THREE.MathUtils.degToRad(10),
  ampX:     THREE.MathUtils.degToRad(6),
  ampZ:     THREE.MathUtils.degToRad(5),
  freq:     0.9,
  phase:    0.55,
  decay:    0.65
};

/* Blink */
const BLINK = {
  intervalMin: 2.2,
  intervalMax: 4.6,
  duration:    0.14,
  strength:    1.0
};

let blinkStartTime = -1;
let nextBlinkTime   =  0;

function scheduleNextBlink(tNow = 0) {
  const wait = BLINK.intervalMin + Math.random() * (BLINK.intervalMax - BLINK.intervalMin);
  nextBlinkTime = tNow + wait;
}

function blinkCurve01(u) {
  u = Math.min(Math.max(u, 0), 1);
  return Math.sin(Math.PI * u) * BLINK.strength;
}

/* Canvas / renderer / escena / cámara */
const canvas   = document.getElementById('scene');
// Renderer optimizado según dispositivo
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true,
    antialias: !isMobile, // Desactivar en móviles
    powerPreference: isMobile ? "low-power" : "high-performance"
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(isMobile ? 1 : Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = !isMobile; // Sin sombras en móviles

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    isMobile ? 40 : 35, // FOV más amplio en móviles
    window.innerWidth / window.innerHeight,
    0.1,
    20
);

scene.add(new THREE.AmbientLight(0xffffff, 0.45));
const dir = new THREE.DirectionalLight(0xffffff, 1.2);
dir.position.set(1, 2, 3);
scene.add(dir);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.35, 0);
controls.enableDamping = true;

/* ========== SISTEMA DE PARTÍCULAS ELECTRO ========== */
function createElectroParticles(scene) {
  const particlesGeometry = new THREE.BufferGeometry();
  const particlesCount = 300;
  
  const positions = new Float32Array(particlesCount * 3);
  const colors = new Float32Array(particlesCount * 3);
  
  const color1 = new THREE.Color(0x9d4edd);
  const color2 = new THREE.Color(0x5a189a);
  const color3 = new THREE.Color(0xc77dff);
  
  for (let i = 0; i < particlesCount; i++) {
    const i3 = i * 3;
    
    positions[i3] = (Math.random() - 0.5) * 10;
    positions[i3 + 1] = Math.random() * 5 - 1;
    positions[i3 + 2] = (Math.random() - 0.5) * 10;
    
    const colorChoice = Math.floor(Math.random() * 3);
    const chosenColor = colorChoice === 0 ? color1 : colorChoice === 1 ? color2 : color3;
    
    colors[i3] = chosenColor.r;
    colors[i3 + 1] = chosenColor.g;
    colors[i3 + 2] = chosenColor.b;
  }
  
  particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  
  const particlesMaterial = new THREE.PointsMaterial({
    size: 0.05,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.8,
    sizeAttenuation: true
  });
  
  const particles = new THREE.Points(particlesGeometry, particlesMaterial);
  scene.add(particles);
  
  return particles;
}

const electroParticles = createElectroParticles(scene);
console.log('✨ Partículas electro activadas');

/* ========== SISTEMA DE RAYOS ELÉCTRICOS ========== */
class LightningBolt {
  constructor(scene) {
    this.scene = scene;
    this.lines = [];
    this.maxBolts = 5;
    this.createBolts();
  }

  createBolts() {
    for (let i = 0; i < this.maxBolts; i++) {
      const geometry = new THREE.BufferGeometry();
      const material = new THREE.LineBasicMaterial({
        color: 0xc77dff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        linewidth: 2
      });
      
      const line = new THREE.Line(geometry, material);
      this.scene.add(line);
      this.lines.push({
        line: line,
        active: false,
        lifetime: 0,
        maxLifetime: 0
      });
    }
  }

  generateBoltPath(startPos, endPos, segments = 8) {
    const points = [];
    const direction = new THREE.Vector3().subVectors(endPos, startPos);
    const segmentLength = 1 / segments;
    
    points.push(startPos.clone());
    
    for (let i = 1; i < segments; i++) {
      const t = i * segmentLength;
      const point = new THREE.Vector3().lerpVectors(startPos, endPos, t);
      
      // Añadir desviación aleatoria perpendicular
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * 0.15,
        (Math.random() - 0.5) * 0.15,
        (Math.random() - 0.5) * 0.15
      );
      point.add(offset);
      points.push(point);
    }
    
    points.push(endPos.clone());
    return points;
  }

  strike(centerPos, intensity = 1.0) {
    // Encontrar un rayo inactivo
    const bolt = this.lines.find(b => !b.active);
    if (!bolt) return;

    // Posición aleatoria alrededor del personaje
    const angle = Math.random() * Math.PI * 2;
    const radius = 0.4 + Math.random() * 0.3;
    const height = 0.8 + Math.random() * 0.8;
    
    const start = new THREE.Vector3(
      centerPos.x + Math.cos(angle) * radius,
      centerPos.y + height + Math.random() * 0.5,
      centerPos.z + Math.sin(angle) * radius
    );
    
    const end = new THREE.Vector3(
      centerPos.x + Math.cos(angle) * (radius * 0.7),
      centerPos.y + height * 0.3,
      centerPos.z + Math.sin(angle) * (radius * 0.7)
    );

    const points = this.generateBoltPath(start, end, 6 + Math.floor(Math.random() * 4));
    bolt.line.geometry.setFromPoints(points);
    
    // Color aleatorio entre púrpura y violeta
    const colors = [0x9d4edd, 0xc77dff, 0x7b2cbf];
    bolt.line.material.color.setHex(colors[Math.floor(Math.random() * colors.length)]);
    bolt.line.material.opacity = 0.7 + Math.random() * 0.3;
    
    bolt.active = true;
    bolt.lifetime = 0;
    bolt.maxLifetime = 0.1 + Math.random() * 0.15; // 100-250ms
  }

  update(dt) {
    this.lines.forEach(bolt => {
      if (bolt.active) {
        bolt.lifetime += dt;
        
        // Fade out
        const lifeRatio = bolt.lifetime / bolt.maxLifetime;
        bolt.line.material.opacity = Math.max(0, 1 - lifeRatio);
        
        if (bolt.lifetime >= bolt.maxLifetime) {
          bolt.active = false;
          bolt.line.material.opacity = 0;
        }
      }
    });
  }

  setIntensity(intensity) {
    // Ajustar visibilidad base
    this.lines.forEach(bolt => {
      if (!bolt.active) {
        bolt.line.material.opacity = 0;
      }
    });
  }
}

const lightningSystem = new LightningBolt(scene);
console.log('⚡ Sistema de rayos activado');

/* ========== RESPLANDOR AMBIENTAL ========== */
const glowLight = new THREE.PointLight(0x9d4edd, 0, 3);
glowLight.position.set(0, 1.4, 0);
scene.add(glowLight);

/* Loader VRM */
const gltfLoader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
gltfLoader.setDRACOLoader(draco);
gltfLoader.register(parser => new VRMLoaderPlugin(parser));

/* REST pose */
const REST_BONE = new Map();
const REST_NODE = new Map();

function cacheRestBone(vrm, name){
  const n = vrm?.humanoid?.getNormalizedBoneNode?.(name);
  if (n && !REST_BONE.has(name)) REST_BONE.set(name, { q:n.quaternion.clone(), p:n.position.clone() });
  return n || null;
}
function cacheRestNode(node){
  if (node && !REST_NODE.has(node)) REST_NODE.set(node, { q:node.quaternion.clone(), p:node.position.clone() });
}
function setBoneRotAbs(vrm,name,euler){
  const n = vrm?.humanoid?.getNormalizedBoneNode?.(name);
  const base = REST_BONE.get(name);
  if(!n||!base) return;
  const dq = new THREE.Quaternion().setFromEuler(euler);
  n.quaternion.copy(base.q).multiply(dq);
}
function setBonePosAbs(vrm,name,vec){
  const n = vrm?.humanoid?.getNormalizedBoneNode?.(name);
  const base = REST_BONE.get(name);
  if(!n||!base) return;
  n.position.copy(base.p).add(vec);
}
function setNodeRotAbs(node,euler){
  const base = REST_NODE.get(node);
  if(!node||!base) return;
  const dq = new THREE.Quaternion().setFromEuler(euler);
  node.quaternion.copy(base.q).multiply(dq);
}

/* Pose tímida + idle */
function cacheRestForCoreBones(vrm){
  [
    'spine','chest','upperChest','neck','head',
    'leftUpperArm','leftLowerArm','rightUpperArm','rightLowerArm',
    'leftHand','rightHand'
  ].forEach(n=>cacheRestBone(vrm,n));
}

function applyShyPose(vrm,k=1){
  const d = THREE.MathUtils.degToRad;
  setBoneRotAbs(vrm,'leftUpperArm',  new THREE.Euler(0,  d( 5*k), d(+75*k)));
  setBoneRotAbs(vrm,'rightUpperArm', new THREE.Euler(0,  d(-5*k), d(-75*k)));
  setBoneRotAbs(vrm,'leftLowerArm',  new THREE.Euler(d(-20*k),0,0));
  setBoneRotAbs(vrm,'rightLowerArm', new THREE.Euler(d(-20*k),0,0));
  setBonePosAbs(vrm,'leftHand',  new THREE.Vector3(0,-0.04*k,0));
  setBonePosAbs(vrm,'rightHand', new THREE.Vector3(0,-0.04*k,0));
  setBoneRotAbs(vrm,'spine', new THREE.Euler( d(2*k),0,0));
  setBoneRotAbs(vrm,'chest', new THREE.Euler( d(3*k),0,0));
  setBoneRotAbs(vrm,'neck',  new THREE.Euler( d(-2*k),0,0));
}

function applyBreathAndBob(vrm,t){
  setBoneRotAbs(vrm,'chest', new THREE.Euler( 0.03*Math.sin(t*1.1), 0, 0));
  setBoneRotAbs(vrm,'neck',  new THREE.Euler( 0.02*Math.sin(t*1.1+1.1), 0, 0));
  setBoneRotAbs(vrm,'head',  new THREE.Euler( 0, 0, 0.02*Math.sin(t*0.8)));
}

/* Detección de mangas */
const SLEEVE = { L:[], R:[] };

const HINTS = {
  sleeve:  /sleeve|kimono|armcloth|sode|袖/i,
  left:    /(^|\b|_)(l|left|hidari|左)(\b|_|-)/i,
  right:   /(^|\b|_)(r|right|migi|右)(\b|_|-)/i
};

function traverse(node, fn){
  fn(node);
  for(const c of node.children) traverse(c,fn);
}

function detectSleeves(vrm){
  SLEEVE.L.length = 0; SLEEVE.R.length = 0;

  const candidatesL = [], candidatesR = [];

  traverse(vrm.scene, (n)=>{
    const name = (n.name||'').toLowerCase();
    if (HINTS.sleeve.test(name)) {
      if (HINTS.left.test(name))  candidatesL.push(n);
      else if (HINTS.right.test(name)) candidatesR.push(n);
    }
  });

  function sortChainByDistance(chain, root){
    chain.sort((a,b)=>root.getWorldPosition(new THREE.Vector3()).distanceTo(a.getWorldPosition(new THREE.Vector3()))
                      - root.getWorldPosition(new THREE.Vector3()).distanceTo(b.getWorldPosition(new THREE.Vector3())));
  }

  const lUpper = vrm.humanoid?.getNormalizedBoneNode?.('leftUpperArm')  || null;
  const rUpper = vrm.humanoid?.getNormalizedBoneNode?.('rightUpperArm') || null;

  if (candidatesL.length >= 1 && lUpper){
    sortChainByDistance(candidatesL, lUpper);
    SLEEVE.L.push(...candidatesL);
  }
  if (candidatesR.length >= 1 && rUpper){
    sortChainByDistance(candidatesR, rUpper);
    SLEEVE.R.push(...candidatesR);
  }

  function fallbackArm(side){
    const up   = vrm.humanoid?.getNormalizedBoneNode?.(`${side}UpperArm`);
    const low  = vrm.humanoid?.getNormalizedBoneNode?.(`${side}LowerArm`);
    const hand = vrm.humanoid?.getNormalizedBoneNode?.(`${side}Hand`);
    const arr = [];
    if (up)   arr.push(up);
    if (low && low !== up) arr.push(low);
    if (hand && hand !== low) arr.push(hand);
    return arr;
  }

  if (SLEEVE.L.length === 0) SLEEVE.L = fallbackArm('left');
  if (SLEEVE.R.length === 0) SLEEVE.R = fallbackArm('right');

  [...SLEEVE.L, ...SLEEVE.R].forEach(n=>cacheRestNode(n));

  console.log('Sleeves detected:',
    { L:SLEEVE.L.map(n=>n.name), R:SLEEVE.R.map(n=>n.name) });
}

function animateSleeves(t){
  const cfg = SLEEVE_CFG;

  function drive(chain, mirrorSign){
    let ampX = cfg.ampX;
    let ampZ = cfg.ampZ;
    for(let i=0;i<chain.length;i++){
      const n = chain[i];
      const phase = i * cfg.phase;
      const aX = ampX * Math.sin(t*cfg.freq + phase);
      const aZ = ampZ * Math.sin(t*cfg.freq*0.85 + phase*1.15);

      const e = new THREE.Euler(aX, 0, mirrorSign*(cfg.gravityZ + aZ));
      setNodeRotAbs(n, e);

      ampX *= cfg.decay;
      ampZ *= cfg.decay;
    }
  }

  if (SLEEVE.L.length) drive(SLEEVE.L, +1);
  if (SLEEVE.R.length) drive(SLEEVE.R, -1);
}


/* Mouth Sync */
function createMouthSync(vrm) {
  const isV1 = !!vrm.expressionManager;
  const setExpr = (name, w) =>
    isV1 ? vrm.expressionManager?.setValue?.(name, w)
         : vrm.blendShapeProxy?.setValue?.(name.toUpperCase(), w);

  const V = isV1 ? ['aa','ih','ou','ee','oh'] : ['A','I','U','E','O'];
  let attachedEl = null;
  let smooth = 0, vowelClock = 0;

  const clearAll = () => { V.forEach(n => setExpr(n, 0)); };

  function attachElement(el) {
    if (!el || attachedEl === el) return;
    attachedEl = el;
    console.log('[MOUTH] ✅ Elemento conectado para lip-sync básico');
  }

  function detach() {
    attachedEl = null; 
    clearAll();
    console.log('[MOUTH] Desconectado');
  }

  function update(dt) {
    let target = 0;
    if (attachedEl && !attachedEl.paused && !attachedEl.ended) {
      target = Math.sin(Date.now() * 0.01) * 0.5 + 0.5;
    }
    
    smooth = smooth * 0.8 + target * 0.2;
    vowelClock += dt;
    
    const idx = (smooth > 0.15) ? (Math.floor(vowelClock * 8) % V.length) : 0;

    clearAll();
    if (smooth > 0.1) {
      const main = V[idx];
      const alt  = V[(idx + 1) % V.length];
      setExpr(main, smooth * 0.7);
      setExpr(alt,  smooth * 0.3);
    }

    vrm.expressionManager?.update?.(dt);
  }

  return { attachElement, detach, update };
}

/* ========== SISTEMA DE EXPRESIONES EMOCIONALES ========== */

/**
 * Aplica una expresión emocional al modelo VRM de Raiden
 * @param {string} emotion - Emoción recibida del backend (satisfied, stern, etc.)
 */
function applyEmotion(emotion) {
    if (!expressionManager) {
        console.warn("⚠️ Expression Manager no disponible");
        return;
    }

    // Limpiar timeout anterior si existe
    if (emotionTimeout) {
        clearTimeout(emotionTimeout);
    }

    // Resetear todas las expresiones primero
    const expressions = expressionManager.expressionMap;
    Object.keys(expressions).forEach(exp => {
        expressionManager.setValue(exp, 0);
    });

    // Obtener expresión VRM correspondiente
    const vrmExpression = EMOTION_TO_VRM[emotion] || 'neutral';
    const intensity = EMOTION_INTENSITY[emotion] || 0.3;

    // Aplicar la nueva expresión
    if (expressions[vrmExpression]) {
        expressionManager.setValue(vrmExpression, intensity);
        currentEmotion = emotion;
        
        console.log(`[EMOTION] 🎭 ${vrmExpression} (${intensity.toFixed(2)}) - ${emotion}`);


        // ✨ Actualizar indicador visual
        if (typeof updateEmotionIndicatorSimple === 'function') {
            updateEmotionIndicatorSimple(emotion, intensity);
        }
        // Auto-resetear después de 5 segundos
        emotionTimeout = setTimeout(() => {
            resetExpression();
        }, 5000);
    } else {
        console.warn(`⚠️ Expresión "${vrmExpression}" no encontrada en el modelo`);
        console.log("Expresiones disponibles:", Object.keys(expressions));
    }
}

/**
 * Resetea la expresión a neutral suave
 */
function resetExpression() {
    if (!expressionManager) return;

    const expressions = expressionManager.expressionMap;
    
    // Resetear todas las expresiones
    Object.keys(expressions).forEach(exp => {
        expressionManager.setValue(exp, 0);
    });

    // Aplicar neutral suave (para mantener dignidad de Raiden)
    if (expressions['neutral']) {
        expressionManager.setValue('neutral', 0.3);
    }

    currentEmotion = null;
    console.log("[EMOTION] 🔄 Expresión reseteada a neutral");
}

/* Estado + loop */
let currentVRM = null;
let currentSpring = null;
let isSpeaking = false;
let speakingIntensity = 0;
let lightningTimer = 0;

// ✨ Sistema de expresiones emocionales
let expressionManager = null;
let currentEmotion = null;
let emotionTimeout = null;


const clock = new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  const t  = clock.elapsedTime;

  if(currentVRM){
    currentVRM.scene.rotation.y = (ROTATE_180 ? Math.PI : 0) + 0.05*Math.sin(t*0.6);
    applyBreathAndBob(currentVRM,t);
    animateSleeves(t);
    window._mouthSync?.update(dt);
    currentVRM.update?.(dt);
    currentSpring?.update?.(dt);
  }

  /* ========== EFECTOS AL HABLAR ========== */
  // Transición suave de intensidad
  const targetIntensity = isSpeaking ? 1.0 : 0;
  speakingIntensity += (targetIntensity - speakingIntensity) * dt * 5;

  if (speakingIntensity > 0.1) {
    // Actualizar luz de resplandor
    glowLight.intensity = speakingIntensity * 2.5;
    
    // Generar rayos aleatorios
    lightningTimer += dt;
    if (lightningTimer > 0.08) { // Cada ~80ms
      if (Math.random() < speakingIntensity * 0.7 && currentVRM) {
        const pos = currentVRM.scene.position.clone();
        pos.y += 1.3; // Centro del personaje
        lightningSystem.strike(pos, speakingIntensity);
      }
      lightningTimer = 0;
    }

    // Partículas más intensas
    if (electroParticles) {
      electroParticles.material.opacity = 0.8 + speakingIntensity * 0.2;
      electroParticles.material.size = 0.05 + speakingIntensity * 0.03;
    }
  } else {
    glowLight.intensity = 0;
    if (electroParticles) {
      electroParticles.material.opacity = 0.8;
      electroParticles.material.size = 0.05;
    }
  }

  lightningSystem.update(dt);

  /* ========== ANIMACIÓN DE PARTÍCULAS ========== */
  if (electroParticles) {
    electroParticles.rotation.y += 0.0005;
    
    const positions = electroParticles.geometry.attributes.position.array;
    const speed = 0.002 + speakingIntensity * 0.003; // Más rápido al hablar
    
    for (let i = 0; i < positions.length; i += 3) {
      positions[i + 1] += speed;
      
      if (positions[i + 1] > 4) {
        positions[i + 1] = -1;
      }
    }
    electroParticles.geometry.attributes.position.needsUpdate = true;
  }

  controls.update();
  renderer.render(scene,camera);

  /* Blink */
  if (currentVRM?.expressionManager) {
    if (blinkStartTime < 0) {
      if (t >= nextBlinkTime) blinkStartTime = t;
    } else {
      const u = (t - blinkStartTime) / BLINK.duration;
      if (u >= 1) {
        currentVRM.expressionManager.setValue(VRMExpressionPresetName.Blink, 0);
        blinkStartTime = -1;
        scheduleNextBlink(t);
      } else {
        const v = blinkCurve01(u);
        currentVRM.expressionManager.setValue(VRMExpressionPresetName.Blink, v);
      }
    }
  }
}
animate();

addEventListener('resize',()=>{
  renderer.setSize(innerWidth,innerHeight);
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
});

/* Carga del VRM */
const MODEL_URL = '/Modelo_IA/Raiden_Shogun.vrm';

gltfLoader.load(
  MODEL_URL,
  (gltf)=>{
    VRMUtils.removeUnnecessaryJoints(gltf.scene);
    VRMUtils.removeUnnecessaryVertices(gltf.scene);

    const vrm = gltf.userData.vrm;
    currentVRM = vrm;

     // ✨ NUEVO: Guardar expressionManager
    expressionManager = vrm.expressionManager;
    
    console.log("✅ Modelo VRM cargado correctamente");
    console.log("🎭 Expression Manager:", 
        expressionManager ? "✅ Disponible" : "❌ No disponible");
    
    // Log de expresiones disponibles
    if (expressionManager) {
        const expressions = expressionManager.expressionMap;
        console.log("📋 Expresiones disponibles:", Object.keys(expressions));
    }

    const mouthSync = createMouthSync(vrm);
    window._mouthSync = mouthSync;

    cacheRestForCoreBones(vrm);

    vrm.scene.rotation.y = ROTATE_180 ? Math.PI : 0;
    vrm.scene.position.set(0,-0.02,0);
    scene.add(vrm.scene);

    if(vrm.lookAt?.target) vrm.lookAt.target = null;

    const sb =
      vrm.springBoneManager ||
      vrm.springBone ||
      vrm.getExtension?.('VRMSpringBone')?.springBoneManager;

    if (sb){
      sb.gravityPower    = 0.35;
      sb.dragForce       = 0.25;
      sb.stiffnessForce  = 0.60;
      sb.setGravityDirection?.(new THREE.Vector3(0,-1,0));
      currentSpring = sb;

      try {
        const springs = sb.springs || sb.springBones || sb._springBones || [];
        console.log('SpringBoneManager OK. Nº springs =', springs.length);
      } catch {}
    } else {
      console.log('⚠️ Este VRM no publica spring bones; usamos "colita" procedural.');
    }

    detectSleeves(vrm);

    controls.target.set(0,1.35,0);
    controls.update();
    
    // 🎥 Configurar posición inicial de la cámara para ver el modelo completo
    camera.position.set(0, 1.4, 1.7); //La cámara se aleja más (1.7 en Z) y sube un poco (1.4 en Y)
    camera.lookAt(0, 1.2, 0);
    applyShyPose(vrm);

    vrm.expressionManager?.setValue(VRMExpressionPresetName.Blink, 0);
    scheduleNextBlink(0);

    console.log('THREE REV:', THREE.REVISION);
    console.log('VRM listo: ▶', vrm);
  },
  (ev)=>{
    const p = ev.total ? (ev.loaded/ev.total)*100 : 0;
    console.log(`Cargando VRM: ${p.toFixed(0)}%`);
  },
  (err)=>{
    console.error('Error VRM:', err);
  }
);

/* Solo la sección de AUDIO modificada - reemplaza desde "AUDIO: TTS + BGM" hasta el final */

/* ========== AUDIO: TTS + BGM + SISTEMA ANTI-REPETICIÓN ========== */
const audioBtn  = document.getElementById('audioBtn');
const voiceEl   = document.getElementById('voice') || (() => {
  const a = document.createElement('audio');
  a.id = 'voice';
  a.preload = 'auto';
  document.body.appendChild(a);
  return a;
})();
const bgmEl = document.getElementById('bgm');

let pollHandle = null;
let lastPlayedAudioId = null; // 🆔 Tracking del último audio reproducido
let isCurrentlyPlaying = false; // 🔒 Lock para evitar reproducciones simultáneas

async function headOK(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    return r.ok && (r.headers.get('content-length') || '1') !== '0';
  } catch { return false; }
}

async function playVoiceUrl(url, audioId) {
  // 🔒 Si ya está reproduciendo, ignorar
  if (isCurrentlyPlaying) {
    console.log('[VOICE] ⏸️ Ya hay un audio reproduciéndose, ignorando...');
    return;
  }

  console.log('[VOICE] 🎵 Reproduciendo:', url, '| ID:', audioId);
  
  isCurrentlyPlaying = true;
  voiceEl.src = url;
  voiceEl.currentTime = 0;
  
  try {
    await voiceEl.play();
    console.log('[VOICE] ✅ Audio iniciado correctamente');
    
    // Marcar como reproducido
    lastPlayedAudioId = audioId;
    
    // ⚡ ACTIVAR EFECTOS AL HABLAR
    isSpeaking = true;
    
    window._mouthSync?.attachElement(voiceEl);
    
    voiceEl.onended = () => {
      console.log('[VOICE] ✅ Audio terminado');
      window._mouthSync?.detach();
      
      // ⚡ DESACTIVAR EFECTOS
      isSpeaking = false;
      isCurrentlyPlaying = false; // 🔓 Liberar lock
    };
    
    // Seguridad: si el audio no termina en 30 segundos, liberar
    setTimeout(() => {
      if (isCurrentlyPlaying) {
        console.log('[VOICE] ⚠️ Timeout de seguridad, liberando lock');
        isCurrentlyPlaying = false;
        isSpeaking = false;
      }
    }, 30000);
    
  } catch (e) {
    console.error('[VOICE] ❌ Error reproduciendo:', e?.message || e);
    isSpeaking = false;
    isCurrentlyPlaying = false;
  }
}

// 🆔 Sistema mejorado de detección usando metadata
async function checkForNewTTS() {
  try {
    // 1. Obtener metadata del servidor
    const metaResponse = await fetch('/audio/metadata', { cache: 'no-store' });
    
    if (!metaResponse.ok) {
      return; // No hay audio disponible
    }

    const metadata = await metaResponse.json();
    
    // 2. Verificar si es un audio nuevo
    if (!metadata.id) {
      return; // Sin ID válido
    }

    // 3. ✅ Comparar con el último reproducido
    if (metadata.id === lastPlayedAudioId) {
      // Es el mismo audio, no hacer nada
      return;
    }

    // 4. ✅ Es un audio nuevo, reproducir
    console.log('[AUDIO] 🆕 Nuevo audio detectado:', metadata.id);
    console.log('[AUDIO] 📝 Texto:', metadata.text.substring(0, 50) + '...');
    
    const url = `/audio/current?v=${metadata.timestamp}`;
    await playVoiceUrl(url, metadata.id);
    
  } catch (e) {
    console.error('[AUDIO] ❌ Error en polling:', e);
  }
}

async function startAudioOnce() {
  try {
    console.log('[AUDIO] 🎵 Inicializando...');
    
    // BGM
    if (bgmEl && await headOK('/static/bgm.mp3')) {
      bgmEl.volume = 0.25;
      try { await bgmEl.play(); } catch {}
    }

    // Verificar si hay audio inicial
    const metaResponse = await fetch('/audio/metadata', { cache: 'no-store' });
    if (metaResponse.ok) {
      const metadata = await metaResponse.json();
      if (metadata.id) {
        console.log('[AUDIO] 📢 Audio inicial encontrado');
        const url = `/audio/current?v=${metadata.timestamp}`;
        await playVoiceUrl(url, metadata.id);
      }
    }

    // Iniciar polling
    if (!pollHandle) {
      pollHandle = setInterval(checkForNewTTS, 1000);
      console.log('[AUDIO] 🔄 Polling iniciado cada 1 segundo');
    }

    // Ocultar botón
    if (audioBtn) {
      audioBtn.style.display = 'none';
      if (audioBtn.parentElement) audioBtn.parentElement.style.display = 'none';
    }

    console.log('[AUDIO] ✅ Sistema listo');
  } catch (err) {
    console.error('[AUDIO] ❌ Error inicializando:', err?.message || err);
    if (audioBtn) audioBtn.style.display = '';
  }
}

audioBtn?.addEventListener('click', startAudioOnce, { once: true });

// Debug mejorado
window.debugAudio = {
  testPlay: async () => {
    const meta = await (await fetch('/audio/metadata', { cache: 'no-store' })).json();
    if (meta.id) {
      await playVoiceUrl(`/audio/current?v=${Date.now()}`, meta.id);
    }
  },
  checkTTS: checkForNewTTS,
  toggleLightning: () => { 
    isSpeaking = !isSpeaking; 
    console.log('⚡ Rayos:', isSpeaking ? 'ON' : 'OFF'); 
  },
  status: () => {
    console.log('🆔 Último ID reproducido:', lastPlayedAudioId);
    console.log('🔒 Reproduciendo ahora:', isCurrentlyPlaying);
    console.log('⚡ Efectos activos:', isSpeaking);
  },
  reset: () => {
    lastPlayedAudioId = null;
    isCurrentlyPlaying = false;
    isSpeaking = false;
    console.log('🔄 Estado reiniciado');
  }
};
// Controles táctiles para móviles
if (isMobile) {
    let touchStartX = 0;
    let touchStartY = 0;
    let lastDistance = 0;

    // Rotación con un dedo
    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }
    }, { passive: true });

    canvas.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1) {
            // Rotación simple
            const touchX = e.touches[0].clientX;
            const touchY = e.touches[0].clientY;
            
            const deltaX = (touchX - touchStartX) * 0.005;
            const deltaY = (touchY - touchStartY) * 0.005;
            
            // Rotar cámara alrededor del personaje
            const radius = Math.sqrt(
                camera.position.x ** 2 + camera.position.z ** 2
            );
            
            camera.position.x = radius * Math.sin(deltaX);
            camera.position.z = radius * Math.cos(deltaX);
            camera.position.y += deltaY;
            camera.position.y = Math.max(0.5, Math.min(2.5, camera.position.y));
            
            camera.lookAt(0, 1.3, 0);
            
            touchStartX = touchX;
            touchStartY = touchY;
        } else if (e.touches.length === 2) {
            // Zoom con pinch
            e.preventDefault();
            
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            
            const distance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            
            if (lastDistance > 0) {
                const delta = distance - lastDistance;
                camera.position.z -= delta * 0.01;
                camera.position.z = Math.max(1.5, Math.min(4, camera.position.z));
            }
            
            lastDistance = distance;
        }
    }, { passive: false });

    canvas.addEventListener('touchend', () => {
        lastDistance = 0;
    }, { passive: true });

    console.log('✅ Controles táctiles activados');
}
/* ========== SOCKET.IO: SISTEMA DE EXPRESIONES EMOCIONALES ========== */
// Inicializar Socket.IO (si no está ya inicializado)
const socket = io();

// Listener para recibir emociones desde el backend
socket.on('emotion_change', (data) => {
    console.log("[EMOTION] 📨 Recibida desde backend:", data);
    
    if (data && data.emotion) {
        // Aplicar emoción al modelo
        applyEmotion(data.emotion);
        
        // Opcional: También mostrar en consola detalles
        if (data.intensity) {
            console.log(`[EMOTION] 💪 Intensidad del sentimiento: ${data.intensity.toFixed(2)}`);
        }
        if (data.text) {
            console.log(`[EMOTION] 💬 Texto analizado: "${data.text.substring(0, 60)}..."`);
        }
    }
});

// Debug: Confirmar conexión de Socket.IO
socket.on('connect', () => {
    console.log('🔌 Socket.IO conectado - Sistema de emociones listo');
});

socket.on('disconnect', () => {
    console.log('🔌 Socket.IO desconectado');
});

// Función de debug para probar emociones manualmente
window.debugEmotions = {
    // Probar una emoción específica
    test: (emotion) => {
        console.log(`🧪 Probando emoción: ${emotion}`);
        applyEmotion(emotion);
    },
    
    // Probar todas las emociones en secuencia
    testAll: () => {
        const emotions = Object.keys(EMOTION_TO_VRM);
        let index = 0;
        
        const interval = setInterval(() => {
            if (index >= emotions.length) {
                clearInterval(interval);
                console.log('✅ Test completado');
                return;
            }
            
            const emotion = emotions[index];
            console.log(`🧪 [${index + 1}/${emotions.length}] Probando: ${emotion}`);
            applyEmotion(emotion);
            index++;
        }, 3000); // Cada 3 segundos
    },
    
    // Reset manual
    reset: () => {
        resetExpression();
    },
    
    // Listar todas las emociones disponibles
    list: () => {
        console.log('📋 Emociones disponibles:', Object.keys(EMOTION_TO_VRM));
        console.log('🎭 Mapeo completo:', EMOTION_TO_VRM);
        console.log('💪 Intensidades:', EMOTION_INTENSITY);
    },
    
    // Ver estado actual
    status: () => {
        console.log('─────────────────────────────────────');
        console.log('📊 Estado del Sistema de Emociones');
        console.log('─────────────────────────────────────');
        console.log('🎭 Emoción actual:', currentEmotion || 'ninguna');
        console.log('🔧 Expression Manager:', expressionManager ? '✅ OK' : '❌ No disponible');
        console.log('🔌 Socket.IO:', socket.connected ? '✅ Conectado' : '❌ Desconectado');
        console.log('─────────────────────────────────────');
    }
};

console.log('🎭 Socket.IO configurado para recibir emociones');
console.log('💡 Usa window.debugEmotions en la consola para probar el sistema');

/* ═══════════════════════════════════════════════════════════════════
   🎨 INDICADOR VISUAL DE EMOCIONES - CÓDIGO COMPLETO
   ═══════════════════════════════════════════════════════════════════
   
   INSTRUCCIONES:
   1. Abre: Raiden_web/web/static/app.js
   2. Ve al FINAL del archivo
   3. Copia y pega TODO este código
   4. Guarda el archivo
   5. Presiona Ctrl+F5 en el navegador
   
   ═══════════════════════════════════════════════════════════════════ */

// 🎨 Configuración visual de emociones
const EMOTION_CONFIG_VISUAL = {
    'satisfied': { color: '#ffd700', emoji: '😊', label: 'Satisfecha' },
    'serious': { color: '#9d4edd', emoji: '😐', label: 'Seria' },
    'contemplative': { color: '#5a189a', emoji: '😔', label: 'Pensativa' },
    'intrigued': { color: '#ff6b9d', emoji: '😮', label: 'Intrigada' },
    'stern': { color: '#ff4444', emoji: '😠', label: 'Severa' },
    'gentle': { color: '#90ee90', emoji: '💜', label: 'Gentil' }
};

// Crear indicador visual
function createEmotionIndicatorSimple() {
    const indicator = document.createElement('div');
    indicator.id = 'emotion-indicator-simple';
    indicator.innerHTML = `
        <style>
            #emotion-indicator-simple {
                position: fixed;
                top: 20px;
                right: 20px;
                background: rgba(30, 10, 61, 0.95);
                border: 2px solid rgba(157, 78, 221, 0.5);
                border-radius: 15px;
                padding: 15px 20px;
                font-family: system-ui, sans-serif;
                z-index: 10000;
                min-width: 180px;
                box-shadow: 0 8px 32px rgba(157, 78, 221, 0.4);
                transition: all 0.3s ease;
                backdrop-filter: blur(10px);
            }
            
            #emotion-indicator-simple.pulse {
                transform: scale(1.1);
            }
            
            .emotion-display {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .emotion-emoji {
                font-size: 32px;
                line-height: 1;
            }
            
            .emotion-info {
                flex: 1;
            }
            
            .emotion-label {
                color: #ffffff;
                font-weight: 600;
                font-size: 14px;
                margin-bottom: 4px;
            }
            
            .emotion-bar-bg {
                background: rgba(157, 78, 221, 0.3);
                height: 4px;
                border-radius: 2px;
                overflow: hidden;
            }
            
            .emotion-bar {
                height: 100%;
                transition: all 0.3s ease;
            }
        </style>
        <div class="emotion-display">
            <div class="emotion-emoji">😐</div>
            <div class="emotion-info">
                <div class="emotion-label">Seria</div>
                <div class="emotion-bar-bg">
                    <div class="emotion-bar" style="width: 30%; background: linear-gradient(90deg, #9d4edd, #c77dff);"></div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(indicator);
    console.log("🎨 Indicador visual creado");
}

// Actualizar indicador
function updateEmotionIndicatorSimple(emotion, intensity) {
    const indicator = document.getElementById('emotion-indicator-simple');
    if (!indicator) return;
    
    const config = EMOTION_CONFIG_VISUAL[emotion] || EMOTION_CONFIG_VISUAL['serious'];
    
    // Animación
    indicator.classList.add('pulse');
    indicator.style.borderColor = config.color;
    indicator.style.boxShadow = `0 8px 32px ${config.color}88`;
    
    setTimeout(() => indicator.classList.remove('pulse'), 200);
    
    // Actualizar contenido
    indicator.querySelector('.emotion-emoji').textContent = config.emoji;
    indicator.querySelector('.emotion-label').textContent = config.label;
    indicator.querySelector('.emotion-bar').style.width = `${intensity * 100}%`;
    indicator.querySelector('.emotion-bar').style.background = `linear-gradient(90deg, ${config.color}, ${config.color}dd)`;
    
    console.log(`[VISUAL] 🎨 ${config.label} (${(intensity * 100).toFixed(0)}%)`);
}


// Inicializar cuando cargue la página
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(createEmotionIndicatorSimple, 1000);
    });
} else {
    setTimeout(createEmotionIndicatorSimple, 1000);
}

console.log("✅ Módulo de indicador visual cargado");

/* ═══════════════════════════════════════════════════════════════════
   FIN DEL CÓDIGO DEL INDICADOR VISUAL
   ═══════════════════════════════════════════════════════════════════ */





























