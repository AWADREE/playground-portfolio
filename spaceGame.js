import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { LuminosityShader } from "three/addons/shaders/LuminosityShader.js";
import { ColorifyShader } from "three/addons/shaders/ColorifyShader.js";

const POWERUP_TYPES = {
  FIRE_RATE: {
    color: 0xffff00,
    emissive: 0x444400,
    scale: 0.5,
    effect: (game) => {
      game.shotCooldown = Math.max(50, game.shotCooldown - 20);
      game.score += 50;
    },
  },
  SHIELD: {
    color: 0x00ffff,
    emissive: 0x004444,
    scale: 0.6,
    effect: (game) => {
      game.hasShield = true;
      game.score += 75;
      game.createShieldEffect();
      if (game.shieldTimeout) clearTimeout(game.shieldTimeout);
      game.shieldTimeout = setTimeout(() => {
        game.hasShield = false;
        game.removeShieldEffect();
      }, 8000);
    },
  },
};

export class SpaceGame {
  constructor(container) {
    this.container = container;
    this.score = 0;
    this.highScore = localStorage.getItem("spaceGameHighScore") || 0;
    this.isPlaying = false;
    this.mousePosition = new THREE.Vector2();
    this.hasShield = false;
    this.powerUpEffects = {
      hasShield: false,
      fireCooldown: 200,
    };
    this.shieldTimeout = null;
    this.isShooting = false;
    this.isTouching = false;
    this.init();
  }

  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    this.camera = new THREE.PerspectiveCamera(
      30,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.z = 60;

    const vFov = (this.camera.fov * Math.PI) / 180;
    const height = 2 * Math.tan(vFov / 2) * this.camera.position.z;
    const width =
      height * (this.container.clientWidth / this.container.clientHeight);

    this.gameWidth = width;
    this.gameHeight = height;
    this.gameScale = height / 30;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    this.renderer.setClearColor(0x000000, 0.3);
    this.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight
    );
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.appendChild(this.renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x333333, 0.5);
    const mainLight = new THREE.DirectionalLight(0xffffff, 1);
    mainLight.position.set(0, 1, 10);
    mainLight.castShadow = true;

    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 50;

    this.scene.add(ambientLight, mainLight);

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.BasicShadowMap;

    this.setupPostProcessing();

    this.bulletPool = this.createObjectPool(30, this.createBullet.bind(this));
    this.explosionPool = this.createObjectPool(
      20,
      this.createExplosionParticles.bind(this)
    );

    this.createShip();

    this.setupTrailEffect();

    this.asteroids = [];
    this.powerUps = [];
    this.bullets = [];
    this.lastShot = 0;
    this.shotCooldown = 200;
    this.speed = 0.1;
    this.powerUpChance = 0.02;

    this.container.addEventListener("mousemove", (e) =>
      this.handleMouseMove(e)
    );
    this.container.addEventListener("click", () => this.handleClick());
    window.addEventListener("resize", () => this.handleResize());

    this.container.addEventListener(
      "touchstart",
      (e) => this.handleTouchStart(e),
      { passive: false }
    );
    this.container.addEventListener(
      "touchmove",
      (e) => this.handleTouchMove(e),
      { passive: false }
    );
    this.container.addEventListener("touchend", () => this.handleTouchEnd());

    this.createStars();

    this.animate();
  }

  setupPostProcessing() {
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    this.composer.setPixelRatio(Math.min(window.devicePixelRatio, 1));

    const luminosityEffect = new ShaderPass(LuminosityShader);

    const colorifyEffect = new ShaderPass(ColorifyShader);
    colorifyEffect.uniforms["color"].value.setRGB(1, 0.4, 0.2);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(
        this.container.clientWidth / 8,
        this.container.clientHeight / 8
      ),
      0.5,
      0.3,
      0.2
    );

    this.composer.addPass(luminosityEffect);
    this.composer.addPass(colorifyEffect);
    this.composer.addPass(bloomPass);
  }

  createObjectPool(size, createFunc) {
    const pool = [];
    for (let i = 0; i < size; i++) {
      const obj = createFunc();
      obj.visible = false;
      pool.push(obj);
    }
    return pool;
  }

  createBullet() {
    const bullet = new THREE.Mesh(
      new THREE.ConeGeometry(0.15, 0.6, 8),
      new THREE.MeshPhongMaterial({
        color: 0x00ff00,
        emissive: 0x00ff00,
        emissiveIntensity: 1.5,
        transparent: false,
        shininess: 0,
      })
    );
    bullet.rotation.x = -Math.PI / 2;

    const glowMaterial = new THREE.SpriteMaterial({
      map: new THREE.TextureLoader().load("glow.png"),
      color: 0x00ff00,
      transparent: true,
      blending: THREE.AdditiveBlending,
    });
    const glowSprite = new THREE.Sprite(glowMaterial);
    glowSprite.scale.set(0.6, 0.6, 1);
    glowSprite.position.y = -0.2;
    bullet.add(glowSprite);

    this.scene.add(bullet);
    return bullet;
  }

  createExplosionParticles() {
    const particles = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({
        size: 0.2,
        color: 0xff4400,
        transparent: true,
      })
    );
    this.scene.add(particles);
    return particles;
  }

  createShip() {
    const shipGroup = new THREE.Group();

    const bodyGeometry = new THREE.ConeGeometry(0.3, 2, 6);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.5,
      metalness: 0.3,
      roughness: 0.7,
      flatShading: true,
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.rotation.x = 0;

    const wingGeometry = new THREE.BoxGeometry(1.8, 0.1, 0.7);
    const wingMaterial = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      emissive: 0xcccccc,
      shininess: 0,
      flatShading: true,
    });
    const wings = new THREE.Mesh(wingGeometry, wingMaterial);
    wings.position.y = -0.8;
    wings.rotation.z = Math.PI * 0.02;

    const finGeometry = new THREE.BoxGeometry(0.6, 0.1, 0.3);
    const frontFins = new THREE.Mesh(finGeometry, wingMaterial);
    frontFins.position.y = -0.5;
    frontFins.position.z = 0;
    frontFins.rotation.z = Math.PI * 0.05;

    const engineLight = new THREE.PointLight(0xffffff, 2, 3);
    engineLight.position.y = -1;

    const engineGeometry = new THREE.CylinderGeometry(0.15, 0.2, 0.3, 6);
    const engineMaterial = new THREE.MeshPhongMaterial({
      color: 0x4444ff,
      emissive: 0x0000ff,
      emissiveIntensity: 0.5,
    });
    const engine = new THREE.Mesh(engineGeometry, engineMaterial);
    engine.position.y = -1;
    engine.rotation.x = Math.PI / 2;

    shipGroup.add(body, wings, frontFins, engine, engineLight);
    shipGroup.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    this.ship = shipGroup;
    this.scene.add(this.ship);
  }

  setupTrailEffect() {
    const trailGeometry = new THREE.BufferGeometry();
    const trailPositions = new Float32Array(100 * 3);
    const trailColors = new Float32Array(100 * 3);

    for (let i = 0; i < 100; i++) {
      const i3 = i * 3;
      const gradientFactor = i / 100;

      trailColors[i3] = 0.5 + 0.5 * gradientFactor;
      trailColors[i3 + 1] = 1;
      trailColors[i3 + 2] = 1 - 0.5 * gradientFactor;
    }

    trailGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(trailPositions, 3)
    );
    trailGeometry.setAttribute(
      "color",
      new THREE.BufferAttribute(trailColors, 3)
    );

    const trailMaterial = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });

    this.trail = new THREE.Points(trailGeometry, trailMaterial);
    this.scene.add(this.trail);
  }

  createStars() {
    const starGeometry = new THREE.BufferGeometry();
    const starVertices = [];
    for (let i = 0; i < 5000; i++) {
      starVertices.push(
        THREE.MathUtils.randFloatSpread(100),
        THREE.MathUtils.randFloatSpread(100),
        THREE.MathUtils.randFloatSpread(50)
      );
    }
    starGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(starVertices, 3)
    );
    const starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.1,
    });
    this.stars = new THREE.Points(starGeometry, starMaterial);
    this.scene.add(this.stars);
  }

  setupAsteroidTrail(asteroid) {
    const trailGeometry = new THREE.BufferGeometry();
    const particleCount = 50;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const gradientFactor = i / particleCount;
      colors[i3] = 1;
      colors[i3 + 1] = 1;
      colors[i3 + 2] = 1;
    }

    trailGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );
    trailGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const trailMaterial = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
    });

    const trail = new THREE.Points(trailGeometry, trailMaterial);
    this.scene.add(trail);
    return trail;
  }

  createAsteroid() {
    const size = Math.random() * 1 + 0.5;
    const health = Math.ceil(size * 3);

    const geometry = new THREE.OctahedronGeometry(size, 1);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 30.0,
      metalness: 0.05,
      roughness: 0.05,
      transparent: false,
      depthWrite: true,
      depthTest: true,
      opacity: 1,
    });

    const asteroid = new THREE.Mesh(geometry, material);
    asteroid.renderOrder = 1;

    const light = new THREE.PointLight(0xffffff, 25, size * 15);
    light.renderOrder = 2;
    asteroid.add(light);

    const glowMaterial = new THREE.SpriteMaterial({
      map: new THREE.TextureLoader().load("glow.png"),
      color: 0xffffff,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });
    const glowSprite = new THREE.Sprite(glowMaterial);
    glowSprite.scale.set(size * 5, size * 5, 1);
    glowSprite.renderOrder = 0;
    asteroid.add(glowSprite);

    asteroid.position.x = THREE.MathUtils.randFloatSpread(this.gameWidth);
    asteroid.position.y = this.gameHeight + size;
    asteroid.rotation.x = Math.random() * Math.PI;
    asteroid.rotation.y = Math.random() * Math.PI;

    const trail = this.setupAsteroidTrail(asteroid);

    this.asteroids.push({
      mesh: asteroid,
      health: health,
      maxHealth: health,
      rotationSpeed: new THREE.Vector3(
        Math.random() * 0.05,
        Math.random() * 0.05,
        Math.random() * 0.05
      ),
      velocity: new THREE.Vector2(
        THREE.MathUtils.randFloatSpread(0.1),
        -(Math.random() * 0.1 + 0.05)
      ),
      size: size,
      trail: trail,
    });

    this.scene.add(asteroid);
  }

  createPowerUp() {
    const types = Object.keys(POWERUP_TYPES);
    const type = types[Math.floor(Math.random() * types.length)];
    const powerUpData = POWERUP_TYPES[type];

    const geometry = new THREE.OctahedronGeometry(powerUpData.scale);
    const material = new THREE.MeshPhongMaterial({
      color: powerUpData.color,
      emissive: powerUpData.emissive,
      shininess: 100,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const powerUp = new THREE.Mesh(geometry, material);
    powerUp.renderOrder = 2;

    const glowMaterial = new THREE.SpriteMaterial({
      map: new THREE.TextureLoader().load("glow.png"),
      color: powerUpData.color,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });
    const glowSprite = new THREE.Sprite(glowMaterial);
    glowSprite.scale.set(powerUpData.scale * 4, powerUpData.scale * 4, 1);
    powerUp.add(glowSprite);

    powerUp.position.x = THREE.MathUtils.randFloatSpread(this.gameWidth);
    powerUp.position.y = this.gameHeight;

    this.powerUps.push({
      mesh: powerUp,
      velocity: new THREE.Vector2(0, -0.05),
      type: type,
    });

    this.scene.add(powerUp);
  }

  shoot() {
    const now = Date.now();
    if (now - this.lastShot < this.shotCooldown) return;

    const bullet = this.bulletPool.find((b) => !b.visible);
    if (!bullet) return;

    bullet.position.copy(this.ship.position);
    bullet.position.y += 1;
    bullet.visible = true;

    this.bullets.push({
      mesh: bullet,
      velocity: new THREE.Vector2(0, 0.5),
    });

    this.lastShot = now;
  }

  createExplosion(position, size) {
    const particleCount = Math.floor(size * 100);
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const velocities = [];
    const speed = size * 0.6;

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      positions[i3] = position.x;
      positions[i3 + 1] = position.y;
      positions[i3 + 2] = position.z;

      const colorRand = Math.random();
      colors[i3] = 1;
      colors[i3 + 1] = colorRand * 0.5;
      colors[i3 + 2] = colorRand * 0.2;

      sizes[i] = (Math.random() * 0.15 + 0.05) * size;

      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * speed;
      velocities.push(
        new THREE.Vector3(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
          (Math.random() - 0.5) * speed
        )
      );
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 0.5,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      vertexSizes: true,
    });

    const explosion = new THREE.Points(geometry, material);
    this.scene.add(explosion);

    const animate = () => {
      const positions = explosion.geometry.attributes.position.array;

      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        positions[i3] += velocities[i].x;
        positions[i3 + 1] += velocities[i].y;
        positions[i3 + 2] += velocities[i].z;
      }

      explosion.geometry.attributes.position.needsUpdate = true;
      material.opacity -= 0.04;

      if (material.opacity > 0) {
        requestAnimationFrame(animate);
      } else {
        this.scene.remove(explosion);
      }
    };
    animate();
  }

  updateTrail() {
    const positions = this.trail.geometry.attributes.position.array;
    const colors = this.trail.geometry.attributes.color.array;

    for (let i = positions.length - 1; i >= 3; i--) {
      positions[i] = positions[i - 3];
    }

    positions[0] = this.ship.position.x + (Math.random() - 0.5) * 0.1;
    positions[1] = this.ship.position.y - 1;
    positions[2] = this.ship.position.z + (Math.random() - 0.5) * 0.1;

    const movementSpeed = Math.abs(this.ship.position.x - this.mousePosition.x);
    const intensityFactor = Math.min(1, movementSpeed * 2);

    for (let i = 0; i < colors.length; i += 3) {
      const gradientFactor = i / colors.length;
      colors[i + 1] = 1 * intensityFactor;
    }

    this.trail.geometry.attributes.position.needsUpdate = true;
    this.trail.geometry.attributes.color.needsUpdate = true;
  }

  updateAsteroidTrail(asteroid) {
    const positions = asteroid.trail.geometry.attributes.position.array;

    for (let i = positions.length - 1; i >= 3; i--) {
      positions[i] = positions[i - 3];
    }

    positions[0] = asteroid.mesh.position.x;
    positions[1] = asteroid.mesh.position.y;
    positions[2] = asteroid.mesh.position.z;

    asteroid.trail.geometry.attributes.position.needsUpdate = true;
  }

  handleMouseMove(event) {
    const rect = this.container.getBoundingClientRect();

    this.mousePosition.x =
      ((event.clientX - rect.left) / rect.width) * this.gameWidth -
      this.gameWidth / 2;
    this.mousePosition.y =
      -((event.clientY - rect.top) / rect.height) * this.gameHeight +
      this.gameHeight / 2;
  }

  handleTouchStart(event) {
    event.preventDefault();
    this.isTouching = true;
    if (!this.isPlaying) {
      this.startGame();
    }
    const touch = event.touches[0];
    this.handleTouchMove(event);
  }

  handleTouchMove(event) {
    event.preventDefault();
    if (!this.isTouching) return;

    const touch = event.touches[0];
    const rect = this.container.getBoundingClientRect();

    this.mousePosition.x =
      ((touch.clientX - rect.left) / rect.width) * this.gameWidth -
      this.gameWidth / 2;
    this.mousePosition.y =
      -((touch.clientY - rect.top) / rect.height) * this.gameHeight +
      this.gameHeight / 2;
  }

  handleTouchEnd() {
    this.isTouching = false;
  }

  handleClick() {
    if (!this.isPlaying) {
      this.startGame();
    }
    this.isShooting = true;
  }

  startGame() {
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.isShooting = true;
    this.score = 0;
    this.updateScore();

    this.resetPowerUps();

    this.asteroids.forEach((a) => {
      this.scene.remove(a.mesh);
      this.scene.remove(a.trail);
    });
    this.powerUps.forEach((p) => this.scene.remove(p.mesh));
    this.bullets.forEach((b) => this.scene.remove(b.mesh));

    this.asteroids = [];
    this.powerUps = [];
    this.bullets = [];
  }

  resetPowerUps() {
    this.hasShield = false;
    this.removeShieldEffect();
    if (this.shieldTimeout) {
      clearTimeout(this.shieldTimeout);
      this.shieldTimeout = null;
    }

    this.shotCooldown = 200;
  }

  updateScore() {
    const scoreElement = document.getElementById("game-score");
    const highScoreElement = document.getElementById("game-high-score");

    if (scoreElement) scoreElement.textContent = `Score: ${this.score}`;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem("spaceGameHighScore", this.highScore);
    }
    if (highScoreElement) {
      highScoreElement.textContent = `High Score: ${this.highScore}`;
    }
  }

  checkCollisions() {
    const shipPos = this.ship.position;

    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      if (!bullet.mesh.visible) {
        this.bullets.splice(i, 1);
        continue;
      }

      for (let j = this.asteroids.length - 1; j >= 0; j--) {
        const asteroid = this.asteroids[j];
        if (
          bullet.mesh.position.distanceTo(asteroid.mesh.position) <
          asteroid.size
        ) {
          bullet.mesh.visible = false;
          this.bullets.splice(i, 1);

          asteroid.health--;
          const healthPercent = asteroid.health / asteroid.maxHealth;
          asteroid.mesh.material.emissiveIntensity = 0.5 + (1 - healthPercent);

          if (asteroid.health <= 0) {
            this.createExplosion(asteroid.mesh.position, asteroid.size);
            this.scene.remove(asteroid.mesh);
            this.scene.remove(asteroid.trail);
            this.asteroids.splice(j, 1);
            this.score += Math.floor(asteroid.size * 10);
            this.updateScore();
          }
          break;
        }
      }
    }

    for (let i = this.asteroids.length - 1; i >= 0; i--) {
      const asteroid = this.asteroids[i];
      if (asteroid.mesh.position.y < -this.gameHeight) {
        this.scene.remove(asteroid.mesh);
        this.scene.remove(asteroid.trail);
        this.asteroids.splice(i, 1);
      }
    }

    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const powerUp = this.powerUps[i];
      if (powerUp.mesh.position.y < -this.gameHeight) {
        this.scene.remove(powerUp.mesh);
        this.powerUps.splice(i, 1);
      }
    }

    for (let i = this.asteroids.length - 1; i >= 0; i--) {
      const asteroid = this.asteroids[i];
      if (asteroid.mesh.position.distanceTo(shipPos) < asteroid.size + 0.5) {
        if (this.hasShield) {
          this.hasShield = false;
          this.removeShieldEffect();
          this.scene.remove(asteroid.mesh);
          this.scene.remove(asteroid.trail);
          this.asteroids.splice(i, 1);
          continue;
        }
        this.isPlaying = false;
        this.resetPowerUps();
        break;
      }
    }

    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const powerUp = this.powerUps[i];
      const distance = powerUp.mesh.position.distanceTo(shipPos);

      if (distance < 2) {
        const powerUpData = POWERUP_TYPES[powerUp.type];
        powerUpData.effect(this);
        this.scene.remove(powerUp.mesh);
        this.powerUps.splice(i, 1);
        this.updateScore();
      }
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    if (this.isPlaying) {
      const targetX = this.mousePosition.x;
      const targetY = this.mousePosition.y;

      this.ship.position.x += (targetX - this.ship.position.x) * 0.1;
      this.ship.position.y += (targetY - this.ship.position.y) * 0.1;

      if (this.isShooting) {
        this.shoot();
      }

      if (Math.random() < 0.03) this.createAsteroid();

      if (Math.random() < this.powerUpChance) this.createPowerUp();

      this.bullets = this.bullets.filter((bullet) => {
        if (!bullet.mesh.visible) return false;

        bullet.mesh.position.y += bullet.velocity.y;
        bullet.mesh.position.x += bullet.velocity.x;

        if (bullet.mesh.position.y > this.gameHeight) {
          bullet.mesh.visible = false;
          return false;
        }
        return true;
      });

      this.asteroids = this.asteroids.filter((asteroid) => {
        const visible = asteroid.mesh.position.y > -this.gameHeight;
        if (!visible) {
          this.scene.remove(asteroid.mesh);
          this.scene.remove(asteroid.trail);
          asteroid.mesh.visible = false;
        }
        return visible;
      });

      this.asteroids.forEach((asteroid) => {
        asteroid.mesh.position.x += asteroid.velocity.x;
        asteroid.mesh.position.y += asteroid.velocity.y;
        asteroid.mesh.rotation.x += asteroid.rotationSpeed.x;
        asteroid.mesh.rotation.y += asteroid.rotationSpeed.y;
        asteroid.mesh.rotation.z += asteroid.rotationSpeed.z;

        const light = asteroid.mesh.children[0];
        if (light.isPointLight) {
          const healthPercent = asteroid.health / asteroid.maxHealth;
          const pulseIntensity = 1.5 + Math.sin(Date.now() * 0.005) * 0.5;
          light.intensity = (4 + (1 - healthPercent) * 2) * pulseIntensity;

          asteroid.mesh.material.emissiveIntensity =
            1.0 + (1 - healthPercent) + Math.sin(Date.now() * 0.005) * 0.3;
        }

        this.updateAsteroidTrail(asteroid);
      });

      this.asteroids.forEach((asteroid) => {
        if (asteroid.healthBar) {
          asteroid.healthBar.lookAt(this.camera.position);
        }
      });

      this.powerUps.forEach((powerUp, i) => {
        powerUp.mesh.position.y += powerUp.velocity.y;
        powerUp.mesh.rotation.y += 0.02;
        if (powerUp.mesh.position.y < -this.gameHeight) {
          powerUp.mesh.visible = false;
          this.powerUps.splice(i, 1);
        }
      });

      if (this.shieldMesh) {
        const pulse = Math.sin(Date.now() * 0.005) * 0.2 + 0.8;
        this.shieldMesh.material.opacity = 0.3 * pulse;
        this.shieldMesh.scale.setScalar(1 + pulse * 0.1);
      }

      this.checkCollisions();
      this.updateTrail();
    }

    if (this.stars) {
      this.stars.rotation.y += 0.0001;
    }

    this.composer.render();
  }

  handleResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;

    const vFov = (this.camera.fov * Math.PI) / 180;
    const heightBoundary = 2 * Math.tan(vFov / 2) * this.camera.position.z;
    const widthBoundary = heightBoundary * (width / height);

    this.gameWidth = widthBoundary;
    this.gameHeight = heightBoundary;

    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
  }

  createShieldEffect() {
    if (this.shieldMesh) return;

    const shieldGeometry = new THREE.SphereGeometry(2, 32, 32);
    const shieldMaterial = new THREE.MeshPhongMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.3,
      emissive: 0x00ffff,
      emissiveIntensity: 1,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

    this.shieldMesh = new THREE.Mesh(shieldGeometry, shieldMaterial);
    this.shieldMesh.renderOrder = 1;

    this.shieldMesh.scale.set(1, 1, 1);

    const glowMaterial = new THREE.SpriteMaterial({
      map: new THREE.TextureLoader().load("glow.png"),
      color: 0x00ffff,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });
    const glowSprite = new THREE.Sprite(glowMaterial);
    glowSprite.scale.set(4, 4, 1);
    glowSprite.renderOrder = 2;
    this.shieldMesh.add(glowSprite);

    this.ship.add(this.shieldMesh);
  }

  removeShieldEffect() {
    if (this.shieldMesh) {
      this.ship.remove(this.shieldMesh);
      this.shieldMesh = null;
    }
  }
}
