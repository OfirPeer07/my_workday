import React from "react";
import * as THREE from "three";

type ParticlePoint = {
  angle: number;
  radius: number;
  speed: number;
  drift: number;
  depth: number;
};

function createCircleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext("2d");

  if (context) {
    const gradient = context.createRadialGradient(48, 48, 0, 48, 48, 48);
    gradient.addColorStop(0, "rgba(255,255,255,0.95)");
    gradient.addColorStop(0.24, "rgba(226,190,255,0.55)");
    gradient.addColorStop(0.62, "rgba(156,84,255,0.18)");
    gradient.addColorStop(1, "rgba(156,84,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 96, 96);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function CrystalSmokeCanvas() {
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearAlpha(0);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
    camera.position.set(0, 0, 9);

    const texture = createCircleTexture();
    const particleCount = 420;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const points: ParticlePoint[] = [];

    const purple = new THREE.Color("#a855ff");
    const white = new THREE.Color("#ffffff");
    const blue = new THREE.Color("#5f7cff");

    for (let index = 0; index < particleCount; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 1.4 + Math.random() * 5.2;
      const depth = -2.2 + Math.random() * 2.8;
      const speed = 0.08 + Math.random() * 0.22;
      const drift = Math.random() * Math.PI * 2;
      const color = index % 5 === 0 ? white : index % 3 === 0 ? blue : purple;

      points.push({ angle, radius, speed, drift, depth });
      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] = Math.sin(angle) * radius * 0.58;
      positions[index * 3 + 2] = depth;
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
      sizes[index] = 0.16 + Math.random() * 0.42;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 0.34,
      map: texture,
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true,
    });

    const particleSystem = new THREE.Points(geometry, material);
    particleSystem.rotation.z = -0.08;
    scene.add(particleSystem);

    const ringGeometry = new THREE.TorusGeometry(2.35, 0.018, 16, 160);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: "#d9b4ff",
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.scale.set(1, 0.72, 1);
    ring.position.set(-1.2, 0.08, -0.5);
    scene.add(ring);

    let frameId = 0;
    const startTime = window.performance.now();

    function resize() {
      const currentContainer = containerRef.current;
      if (!currentContainer) return;

      const width = currentContainer.clientWidth || 1;
      const height = currentContainer.clientHeight || 1;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    function render() {
      const elapsed = (window.performance.now() - startTime) / 1000;
      const positionAttribute = geometry.getAttribute("position") as THREE.BufferAttribute;

      for (let index = 0; index < particleCount; index += 1) {
        const point = points[index];
        const localAngle = point.angle + elapsed * point.speed;
        const wave = Math.sin(elapsed * 0.52 + point.drift) * 0.36;
        const pulse = Math.cos(elapsed * 0.38 + point.drift) * 0.2;

        positionAttribute.setXYZ(
          index,
          Math.cos(localAngle) * (point.radius + pulse) - 0.9,
          Math.sin(localAngle) * (point.radius * 0.54 + wave) + 0.12,
          point.depth + Math.sin(elapsed * 0.28 + point.drift) * 0.42,
        );
      }

      positionAttribute.needsUpdate = true;
      particleSystem.rotation.z = Math.sin(elapsed * 0.12) * 0.08 - 0.08;
      particleSystem.rotation.y = Math.sin(elapsed * 0.09) * 0.08;
      ring.rotation.z = elapsed * 0.08;
      ring.rotation.x = Math.sin(elapsed * 0.2) * 0.08;

      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(render);
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();
    render();

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      scene.remove(particleSystem);
      scene.remove(ring);
      geometry.dispose();
      material.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
      texture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div className="login-webgl-layer" ref={containerRef} aria-hidden="true" />;
}
