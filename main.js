import "./style.css";
import * as THREE from "three";
import { gsap } from "gsap";
// import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GlitchPass } from "three/addons/postprocessing/GlitchPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { FilmPass } from "three/addons/postprocessing/FilmPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { DotScreenShader } from "three/addons/shaders/DotScreenShader.js";
import { SobelOperatorShader } from "three/addons/shaders/SobelOperatorShader.js";
import { LuminosityShader } from "three/addons/shaders/LuminosityShader.js";
import { ColorifyShader } from "three/addons/shaders/ColorifyShader.js";

//init
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  20000
); //(field of view, aspect ratio, view frustum) view frustrum is min view distance and max view distance

const renderer = new THREE.WebGLRenderer();
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
const t = document.body.getBoundingClientRect().top; //getting the scroll position distance from the top of the page
camera.position.set(t * 0.0002, t * 0.0002, t * 0.01);
camera.rotation.set(
  3.141578583494836,
  -0.000014070094955789397,
  3.1415926533918257
);
document.body.appendChild(renderer.domElement);
//-----------------------------------------------

//post processing
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const dotEffect = new ShaderPass(DotScreenShader);
dotEffect.uniforms["scale"].value = 2;

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1,
  0.5,
  0.3
);
const luminosityEffect = new ShaderPass(LuminosityShader);

const sobelEffect = new ShaderPass(SobelOperatorShader);
sobelEffect.uniforms["resolution"].value.x =
  window.innerWidth * window.devicePixelRatio;
sobelEffect.uniforms["resolution"].value.y =
  window.innerHeight * window.devicePixelRatio;

const colorifyEffect = new ShaderPass(ColorifyShader);
colorifyEffect.uniforms["color"].value.setRGB(1, 0.4, 0.2);

composer.addPass(sobelEffect);
composer.addPass(luminosityEffect);
composer.addPass(colorifyEffect);
composer.addPass(bloomPass);
// composer.addPass(dotEffect);

// const glitchPass = new GlitchPass();
// composer.addPass(glitchPass);

// const outputPass = new OutputPass();
// composer.addPass(outputPass);
//-----------------------------------------------

//scene background/skybox
// const spaceTexure = new THREE.TextureLoader().load('space.jpg');
// scene.background = spaceTexure;
//-----------------------------------------------

//objs torus
const geometry = new THREE.TorusGeometry(10, 0.3, 16, 100);
const material = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  emissive: 0xffffff,
});
const torus = new THREE.Mesh(geometry, material);
torus.position.z = 10;

const t2geometry = new THREE.TorusGeometry(3, 0.3, 16, 100);
const torus2 = new THREE.Mesh(t2geometry, material);
torus.add(torus2);
torus2.position.x = 10;
const torus3 = new THREE.Mesh(t2geometry, material);
torus.add(torus3);
torus3.position.x = -10;
scene.add(torus);
//----------------------------------------------

//texturemapping
// const customTexture = new THREE.TextureLoader().load('normal.jpg')
// const customMesh = new THREE.Mesh(
//   new THREE.BoxGeometry(3,3,3),
//   new THREE.MeshBasicMaterial({
//     map:customTexture
//   })
// )
// customMesh.position.set(20, 20, 20)
// scene.add(customMesh);
//-----------------------------------------------

//moon
const moonTexture = new THREE.TextureLoader().load("moon.jpg");
const moonNormalTexture = new THREE.TextureLoader().load("normal.jpg");

const moonMesh = new THREE.Mesh(
  new THREE.SphereGeometry(3, 32, 32),
  new THREE.MeshStandardMaterial({
    map: moonTexture,
    normalMap: moonNormalTexture,
  })
);
moonMesh.position.set(-10, 0, -5);
scene.add(moonMesh);
//-----------------------------------------------

//moon 2
const moon2Mesh = new THREE.Mesh(
  new THREE.SphereGeometry(3, 32, 32),
  new THREE.MeshStandardMaterial({
    map: moonTexture,
    normalMap: moonNormalTexture,
  })
);
moon2Mesh.position.set(15, 0, -70);
scene.add(moon2Mesh);

//-----------------------------------------------

//moon 2
const moon3Mesh = new THREE.Mesh(
  new THREE.SphereGeometry(2, 32, 32),
  new THREE.MeshStandardMaterial({
    map: moonTexture,
    normalMap: moonNormalTexture,
  })
);
moon3Mesh.position.set(0, -3, -135);
scene.add(moon3Mesh);

//-----------------------------------------------

//orb
const orbMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  emissive: 0xffffff,
  emissiveIntensity: 10,
});
const orbMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.3, 32, 32),
  orbMaterial
);

const orbOrbit = new THREE.Object3D();

orbOrbit.add(orbMesh);
orbMesh.position.set(0, 0, 5);
orbOrbit.position.set(0, 0, 200);
scene.add(orbOrbit);

let orbIsOrbiting = false;

// Add glow effect to the orb
const glowMaterial = new THREE.SpriteMaterial({
  map: new THREE.TextureLoader().load("glow.png"), // Add a glow texture
  color: 0xffffff,
  transparent: true,
  opacity: 0.5,
});
const glowSprite = new THREE.Sprite(glowMaterial);
glowSprite.scale.set(5, 5, 1); // Adjust size of the glow
orbMesh.add(glowSprite);

// Add pulsating effect to the orb
function animateOrbPulse() {
  const scale = 1 + Math.sin(Date.now() * 0.005) * 0.1; // Pulsate between 1 and 1.1
  orbMesh.scale.set(scale, scale, scale);
}

// Add particle explosion on click
function createParticleExplosion(position) {
  const explosionGeometry = new THREE.BufferGeometry();
  const explosionCount = 100;
  const explosionPositions = new Float32Array(explosionCount * 3);

  for (let i = 0; i < explosionCount; i++) {
    explosionPositions[i * 3] = position.x + (Math.random() - 0.5) * 2;
    explosionPositions[i * 3 + 1] = position.y + (Math.random() - 0.5) * 2;
    explosionPositions[i * 3 + 2] = position.z + (Math.random() - 0.5) * 2;
  }

  explosionGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(explosionPositions, 3)
  );

  const explosionMaterial = new THREE.PointsMaterial({
    color: 0xff9933,
    size: 0.1,
    transparent: true,
    opacity: 0.8,
  });

  const explosion = new THREE.Points(explosionGeometry, explosionMaterial);
  scene.add(explosion);

  // Fade out and remove explosion
  gsap.to(explosionMaterial, {
    opacity: 0,
    duration: 1,
    onComplete: () => scene.remove(explosion),
  });
}

// Add click event listener for particle explosion
window.addEventListener("click", (event) => {
  const mouse = new THREE.Vector2(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1
  );

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObject(orbMesh);
  if (intersects.length > 0) {
    createParticleExplosion(intersects[0].point);
  }
});
//-----------------------------------------------

// Add this code near your other event listeners

document.querySelectorAll("section").forEach((section) => {
  section.addEventListener("mousemove", (e) => {
    const rect = section.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    section.style.setProperty("--mouse-x", `${x}px`);
    section.style.setProperty("--mouse-y", `${y}px`);
  });
});

// Add event listeners for header and blockquote elements
document.querySelectorAll("header, blockquote").forEach((element) => {
  element.addEventListener("mousemove", (e) => {
    const rect = element.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    element.style.setProperty("--mouse-x", `${x}px`);
    element.style.setProperty("--mouse-y", `${y}px`);
  });
});

// Add this near your other scroll-related code
function setupMobileFloatAnimation() {
  if (window.innerWidth > 768) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
          entry.target.classList.add("float-away");
        } else {
          entry.target.classList.remove("float-away");
        }
      });
    },
    { threshold: 0, rootMargin: "-20% 0px -20% 0px" }
  );

  document.querySelectorAll("section, blockquote").forEach((element) => {
    observer.observe(element);
  });
}

// Add this to your existing window event listeners
window.addEventListener("load", setupMobileFloatAnimation);
window.addEventListener("resize", setupMobileFloatAnimation);

//particle system
// ShaderMaterial for particles
const particleMaterial = new THREE.ShaderMaterial({
  uniforms: {
    color: { value: new THREE.Color(0xffffff) }, // Base color
  },
  vertexShader: `
    attribute float alpha;
    varying float vAlpha;
    
    void main() {
      vAlpha = alpha;
      gl_PointSize = 5.0;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 color;
    varying float vAlpha;
    
    void main() {
      gl_FragColor = vec4(color, vAlpha);
    }
  `,
  transparent: true,
  depthWrite: false,
});

// Creating an empty geometry for the particles
const particleGeometry = new THREE.BufferGeometry();
const particleCount = 70000;
const positions = new Float32Array(particleCount * 3); // 3 values per particle (x, y, z)
const alphas = new Float32Array(particleCount); // Storing opacity for each particle
particleGeometry.setAttribute(
  "position",
  new THREE.BufferAttribute(positions, 3)
);
particleGeometry.setAttribute("alpha", new THREE.BufferAttribute(alphas, 1)); // Opacity attribute

// Creating particle system
const particles = new THREE.Points(particleGeometry, particleMaterial);
scene.add(particles);

// Number of emission points (multiple lines)
const emissionCount = 120;

function animateParticles() {
  // Shifting existing particles down the array to create the trail effect
  for (let i = particleCount - 1; i >= emissionCount; i--) {
    positions[i * 3] = positions[(i - emissionCount) * 3];
    positions[i * 3 + 1] = positions[(i - emissionCount) * 3 + 1];
    positions[i * 3 + 2] = positions[(i - emissionCount) * 3 + 2];

    alphas[i] = alphas[i - emissionCount]; // Carry forward alpha (opacity)
  }

  const orbWorldPos = new THREE.Vector3();
  orbMesh.getWorldPosition(orbWorldPos);

  // Emitting multiple particles at slightly offset positions around the orbMesh
  for (let j = 0; j < emissionCount; j++) {
    // Offsetting the emission points around the object to create multiple trails
    const angle = ((Math.PI * 2) / emissionCount) * j; // Spreading particles in a circle
    // const offsetX = Math.cos(angle) * 0.2;
    // const offsetY = Math.sin(angle) * 0.2;
    const offsetX = Math.random() * 0.4 - 0.15;
    const offsetY = Math.random() * 0.4 - 0.15;
    const offsetZ = Math.random() * 0.4 - 0.15;

    // Setting the new position for each emitted particle
    positions[j * 3] = orbWorldPos.x + offsetX;
    positions[j * 3 + 1] = orbWorldPos.y + offsetY;
    positions[j * 3 + 2] = orbWorldPos.z + offsetZ;

    alphas[j] = 1.0; // New particles start with full opacity
  }

  // Gradually reducing opacity based on their lifetime
  for (let i = 0; i < particleCount; i++) {
    alphas[i] *= 0.98; // Reduceing opacity over time for each particle
  }

  // Updating geometry attributes
  particleGeometry.attributes.position.needsUpdate = true;
  particleGeometry.attributes.alpha.needsUpdate = true;
}
//-----------------------------------------------

//light
const pointLight = new THREE.PointLight(0xffffff, 20, 1000, 0.3);
pointLight.position.set(0, 0, 10);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
scene.add(pointLight, ambientLight);
//----------------------------------------------

//controlls
// const controls = new OrbitControls(camera, renderer.domElement);
// controls.enabled = false;
//----------------------------------------------

function addStar(spreadDistance) {
  const geometry = new THREE.SphereGeometry(0.25, 24, 24);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
  });
  const star = new THREE.Mesh(geometry, material);

  const [x, y, z] = Array(3)
    .fill()
    .map(() => THREE.MathUtils.randFloatSpread(spreadDistance));

  star.position.set(x, y, z);
  scene.add(star);
}
Array(2000)
  .fill()
  .forEach(() => addStar(1000));
Array(200)
  .fill()
  .forEach(() => addStar(200));

const moveOrb = (t) => {
  if (t >= -1000) {
    gsap.to(orbOrbit.position, {
      x: 0,
      y: 0,
      z: 200,
      duration: 3,
      ease: "power4",
    });
    if (orbIsOrbiting) {
      orbIsOrbiting = false;
    }
    gsap.to(orbOrbit.rotation, {
      x: 0,
      y: 0,
      z: 0,
      duration: 2,
      ease: "power4",
    });
  } else if (t < -1000 && t >= -4000) {
    gsap.to(orbOrbit.position, {
      x: -10,
      y: 0,
      z: -5,
      duration: 0.9,
      ease: "power4",
    });
    if (!orbIsOrbiting) {
      orbIsOrbiting = true;
    }
  } else if (t < -4000 && t >= -6600) {
    gsap.to(orbOrbit.position, {
      x: 15,
      y: 0,
      z: -70,
      duration: 0.9,
      ease: "power4",
    });
    if (!orbIsOrbiting) {
      orbIsOrbiting = true;
    }
  } else if (t < -6600) {
    gsap.to(orbOrbit.position, {
      x: 0,
      y: -3,
      z: -135,
      duration: 0.9,
      ease: "power4",
    });
    if (!orbIsOrbiting) {
      orbIsOrbiting = true;
    }
  }
};
//-8096
//8

function moveCamera() {
  const t = document.body.getBoundingClientRect().top;
  moonMesh.rotation.x += 0.05;
  moonMesh.rotation.y += 0.05;
  moonMesh.rotation.z += 0.05;

  moon2Mesh.rotation.z += 0.05;

  torus.position.setZ(t * 0.01 * -1);
  pointLight.position.setZ(t * 0.01 * -1);
  // orbMesh.position.setZ((t * 0.01) * -1);

  camera.position.x = t * 0.0002 * 2;
  camera.position.y = t * 0.0002 * 2;
  camera.position.z = t * 0.01 * 2;
  camera.rotation.y = t * 0.0001;

  moveOrb(t);
  // console.log("t",t)
}
document.body.onscroll = moveCamera;

// Update scroll indicator on scroll
function updateScrollIndicator() {
  const scrollTop = document.documentElement.scrollTop;
  const scrollHeight =
    document.documentElement.scrollHeight - window.innerHeight;
  const scrollPercentage = (scrollTop / scrollHeight) * 100;
  const scrollIndicator = document.getElementById("scroll-indicator");
  if (scrollIndicator) {
    scrollIndicator.style.width = `${scrollPercentage}%`;
  }
}

window.addEventListener("scroll", updateScrollIndicator);

//update method
function animate() {
  requestAnimationFrame(animate);
  //
  //------------------------------
  // torus.rotation.x += 0.01;
  // torus.rotation.y += 0.01;
  torus.rotation.z += 0.01;

  moonMesh.rotation.x += 0.005;
  moonMesh.rotation.y += 0.005;
  moonMesh.rotation.z += 0.005;

  moon2Mesh.rotation.x += 0.01;
  moon2Mesh.rotation.z += 0.01;

  moon3Mesh.rotation.x += 0.005;
  moon3Mesh.rotation.z += 0.005;

  if (orbIsOrbiting) {
    orbOrbit.rotation.x += 0.005;
  }
  // orbOrbit.rotation.z += 0.005;
  animateOrbPulse(); // Add pulsating effect
  animateParticles();
  // controls.update();
  //------------------------------
  renderer.render(scene, camera);
  composer.render();
}

animate();

//helpers (gizmos)
const lightHelper = new THREE.PointLightHelper(pointLight);
const gridHelper = new THREE.GridHelper(200, 50);
// scene.add(lightHelper, gridHelper);
//----------------------------------------------

// Function to copy text to clipboard
function copyToClipboard(text) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      const message = document.getElementById("copy-message");
      if (message) {
        message.textContent = `Copied: ${text}`; // Display the copied text
        message.classList.add("visible");
        setTimeout(() => {
          message.classList.remove("visible");
        }, 2000);
      } else {
        console.error("Copy message element not found.");
      }
    })
    .catch((err) => {
      console.error("Failed to copy text: ", err);
    });
}

// Debugging: Log clicks to ensure the function is triggered
document.querySelectorAll(".copyable").forEach((element) => {
  element.addEventListener("click", (e) => {
    console.log(`Clicked: ${e.target.textContent}`);
  });
});

// Function to apply typing effect to header
function applyTypingEffectToHeader(selector) {
  const header = document.querySelector(selector);
  if (!header) return;

  const text = header.textContent;
  header.textContent = ""; // Clear the text
  let index = 0;

  const interval = setInterval(() => {
    if (index < text.length) {
      header.textContent += text[index];
      index++;
    } else {
      clearInterval(interval);
    }
  }, 50); // Adjust typing speed here
}

// Apply the typing effect to the header
document.addEventListener("DOMContentLoaded", () => {
  applyTypingEffectToHeader("header h3");
});

//--------------------------------------------------------
// // Set starting and target positions
// const startPosition = new THREE.Vector3(0, 0, 0);
// const targetPosition = new THREE.Vector3(5, 2, -3);

// // Time tracking variables
// let elapsedTime = 0;
// const duration = 2; // duration in seconds

// // In your render/animation loop:
// function animate(deltaTime) {
//   // Update elapsed time
//   elapsedTime += deltaTime;

//   // Calculate interpolation factor (0 to 1)
//   const t = Math.min(elapsedTime / duration, 1); // Ensures t doesn't go over 1

//   // Interpolate position using lerp
//   object.position.lerpVectors(startPosition, targetPosition, t);

//   // Render the scene
//   renderer.render(scene, camera);

//   // Repeat animation loop
//   requestAnimationFrame(animate);
// }
//--------------------------------------------------------
