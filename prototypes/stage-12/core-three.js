import * as THREE from 'three';

const mount = document.querySelector('#core-orbit');
const display = document.querySelector('.core-display');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const narrow = matchMedia('(max-width: 650px)');
const lowPower = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);

if (mount && display && !reduced.matches && !narrow.matches && !lowPower && !new URLSearchParams(location.search).has('fallback')) {
  let renderer;
  let canvas;
  try {
    canvas = document.createElement('canvas');
    canvas.className = 'core-webgl';
    canvas.setAttribute('aria-hidden', 'true');
    mount.prepend(canvas);
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.35));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = document.documentElement.dataset.theme === 'light' ? 1.15 : 1.32;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, .1, 30);
    camera.position.set(.18, .2, 9.1);
    camera.lookAt(0, 0, 0);
    const rig = new THREE.Group();
    scene.add(rig);
    const shell = new THREE.Group();
    shell.rotation.set(.18, -.22, .11);
    rig.add(shell);
    const disposable = [];

    const darkCore = new THREE.Mesh(
      new THREE.SphereGeometry(1.34, 32, 24),
      new THREE.MeshPhysicalMaterial({ color: 0x183126, metalness: .42, roughness: .27, clearcoat: .75, clearcoatRoughness: .18 })
    );
    darkCore.castShadow = true;
    shell.add(darkCore);
    disposable.push(darkCore.geometry, darkCore.material);

    const source = new THREE.IcosahedronGeometry(1.73, 0);
    const position = source.getAttribute('position');
    const triangles = [];
    for (let index = 0; index < position.count; index += 3) {
      const vertices = [0, 1, 2].map(offset => new THREE.Vector3().fromBufferAttribute(position, index + offset));
      const center = vertices[0].clone().add(vertices[1]).add(vertices[2]).divideScalar(3);
      const normal = center.clone().normalize();
      triangles.push({ vertices, center, normal });
    }
    source.dispose();
    const apertureIndex = triangles.reduce((best, triangle, index) => triangle.center.z > triangles[best].center.z ? index : best, 0);
    const plateColors = [0xd7a06c, 0xb5794c, 0xf1d0a0, 0x946141, 0xc58e61];
    const plateMaterials = plateColors.map(color => new THREE.MeshPhysicalMaterial({
      color, metalness: .34, roughness: .33, clearcoat: .72, clearcoatRoughness: .24,
      emissive: 0x633c22, emissiveIntensity: .025, side: THREE.DoubleSide
    }));
    disposable.push(...plateMaterials);

    function plateGeometry(triangle) {
      const vertices = [];
      for (const depth of [.115, -.055]) {
        for (const vertex of triangle.vertices) {
          const inset = depth > 0 ? .115 : .035;
          const point = vertex.clone().lerp(triangle.center, inset).addScaledVector(triangle.normal, depth);
          vertices.push(point.x, point.y, point.z);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setIndex([0, 1, 2, 5, 4, 3, 0, 3, 4, 0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 3, 2, 3, 0]);
      geometry.computeVertexNormals();
      return geometry;
    }

    const plates = [];
    triangles.forEach((triangle, index) => {
      if (index === apertureIndex) return;
      const geometry = plateGeometry(triangle);
      const plate = new THREE.Mesh(geometry, plateMaterials[index % plateMaterials.length]);
      plate.castShadow = true;
      plate.receiveShadow = true;
      shell.add(plate);
      plates.push({ plate, normal: triangle.normal, phase: index * .67 });
      disposable.push(geometry);
      const outlineGeometry = new THREE.EdgesGeometry(geometry, 20);
      const outlineMaterial = new THREE.LineBasicMaterial({ color: 0xf9ddb3, transparent: true, opacity: .36 });
      plate.add(new THREE.LineSegments(outlineGeometry, outlineMaterial));
      disposable.push(outlineGeometry, outlineMaterial);
    });

    const apertureNormal = triangles[apertureIndex].normal;
    const aperture = new THREE.Group();
    aperture.position.copy(apertureNormal).multiplyScalar(1.5);
    aperture.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), apertureNormal);
    const apertureBase = new THREE.Mesh(
      new THREE.CircleGeometry(.33, 40),
      new THREE.MeshPhysicalMaterial({ color: 0x102b20, metalness: .25, roughness: .23, clearcoat: 1 })
    );
    const apertureRing = new THREE.Mesh(
      new THREE.TorusGeometry(.31, .034, 8, 64),
      new THREE.MeshStandardMaterial({ color: 0xe7bb81, metalness: .62, roughness: .24, emissive: 0x8b532c, emissiveIntensity: .15 })
    );
    apertureRing.position.z = .015;
    const apertureEye = new THREE.Mesh(
      new THREE.SphereGeometry(.12, 20, 12),
      new THREE.MeshStandardMaterial({ color: 0xf5d09a, metalness: .18, roughness: .2, emissive: 0xd39052, emissiveIntensity: .7 })
    );
    apertureEye.position.z = .045;
    aperture.add(apertureBase, apertureRing, apertureEye);
    shell.add(aperture);
    disposable.push(apertureBase.geometry, apertureBase.material, apertureRing.geometry, apertureRing.material, apertureEye.geometry, apertureEye.material);

    const ringMaterial = new THREE.MeshStandardMaterial({ color: 0xc59b6c, metalness: .68, roughness: .3, transparent: true, opacity: .62 });
    const outerRing = new THREE.Mesh(new THREE.TorusGeometry(2.28, .018, 6, 96), ringMaterial);
    outerRing.rotation.set(1.02, .18, -.4);
    const innerRing = new THREE.Mesh(new THREE.TorusGeometry(2.01, .013, 6, 96), ringMaterial.clone());
    innerRing.rotation.set(.25, 1.06, .35);
    rig.add(outerRing, innerRing);
    disposable.push(ringMaterial, outerRing.geometry, innerRing.geometry, innerRing.material);

    const nodeMaterial = new THREE.MeshStandardMaterial({ color: 0xe8b476, metalness: .55, roughness: .23, emissive: 0xa56e3b, emissiveIntensity: .3 });
    for (const [ring, angle] of [[outerRing, 0], [outerRing, Math.PI], [innerRing, Math.PI / 2]]) {
      const node = new THREE.Mesh(new THREE.OctahedronGeometry(.075, 0), nodeMaterial);
      node.position.set(Math.cos(angle) * (ring === outerRing ? 2.28 : 2.01), Math.sin(angle) * (ring === outerRing ? 2.28 : 2.01), 0);
      ring.add(node);
      disposable.push(node.geometry);
    }
    disposable.push(nodeMaterial);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ color: 0x030f08, opacity: .085 }));
    floor.position.set(.25, -.12, -2.15);
    floor.receiveShadow = true;
    scene.add(floor);
    disposable.push(floor.geometry, floor.material);
    scene.add(new THREE.AmbientLight(0xf4e8ce, 1.55));
    const key = new THREE.DirectionalLight(0xffd3a1, 4.8);
    key.position.set(-3.5, 5, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(512, 512);
    key.shadow.radius = 3;
    key.shadow.camera.left = -4;
    key.shadow.camera.right = 4;
    key.shadow.camera.top = 4;
    key.shadow.camera.bottom = -4;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x8fb99e, 4);
    rim.position.set(3.5, 1, -3.4);
    scene.add(rim);
    const specular = new THREE.PointLight(0xffe4ba, 10, 12, 2);
    specular.position.set(3, -1.6, 4.1);
    scene.add(specular);

    const pointer = { x: 0, y: 0 };
    const onPointerMove = event => {
      if (event.pointerType !== 'mouse') return;
      const bounds = mount.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width - .5) * .26;
      pointer.y = ((event.clientY - bounds.top) / bounds.height - .5) * .18;
    };
    const onPointerLeave = () => { pointer.x = 0; pointer.y = 0; };
    mount.addEventListener('pointermove', onPointerMove);
    mount.addEventListener('pointerleave', onPointerLeave);

    let active = true;
    let contextLost = false;
    let frame = 0;
    let elapsed = 0;
    let last = performance.now();
    let state = 'idle';
    let scroll = 0;
    let openness = 0;
    const onState = event => { state = event.detail; };
    const onScroll = () => {
      const rect = document.querySelector('#story').getBoundingClientRect();
      scroll = THREE.MathUtils.clamp((innerHeight - rect.top) / (innerHeight + rect.height), 0, 1);
    };
    const resize = () => {
      const { width, height } = mount.getBoundingClientRect();
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();
    window.addEventListener('scroll', onScroll, { passive: true });
    display.addEventListener('core-state-change', onState);
    const onTheme = new MutationObserver(() => { renderer.toneMappingExposure = document.documentElement.dataset.theme === 'light' ? 1.15 : 1.32; });
    onTheme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    onScroll();

    const render = now => {
      frame = 0;
      if (!active || contextLost || document.hidden || reduced.matches) return;
      const delta = Math.min((now - last) / 1000, .05);
      last = now;
      elapsed += delta;
      const opening = state === 'listening' ? .13 : state === 'thinking' ? .19 : state === 'action' ? .08 : 0;
      openness = THREE.MathUtils.damp(openness, opening, 4.2, delta);
      const speed = state === 'thinking' ? .36 : state === 'listening' ? .15 : .055;
      shell.rotation.y += delta * speed;
      shell.rotation.x = THREE.MathUtils.damp(shell.rotation.x, .18 + pointer.y + scroll * .22, 2.6, delta);
      rig.rotation.y = THREE.MathUtils.damp(rig.rotation.y, pointer.x + scroll * .23, 2.2, delta);
      rig.position.y = Math.sin(elapsed * 1.15) * .045;
      for (const { plate, normal, phase } of plates) {
        const pulse = state === 'listening' ? Math.sin(elapsed * 7.5 + phase) * .024 : 0;
        plate.position.copy(normal).multiplyScalar(openness + pulse);
      }
      outerRing.rotation.z += delta * (state === 'listening' ? .33 : .035);
      innerRing.rotation.y += delta * (state === 'thinking' ? .32 : .026);
      const warm = state === 'result' ? 0x91d6a0 : state === 'thinking' ? 0xffdf9f : 0xf5ca8d;
      apertureEye.material.emissive.lerp(new THREE.Color(warm), Math.min(1, delta * 3.5));
      apertureEye.material.emissiveIntensity = THREE.MathUtils.damp(apertureEye.material.emissiveIntensity, state === 'listening' ? 1.5 : state === 'thinking' ? 1.2 : .7, 4, delta);
      for (const material of plateMaterials) material.emissiveIntensity = THREE.MathUtils.damp(material.emissiveIntensity, state === 'thinking' ? .11 : .025, 3, delta);
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    const inView = new IntersectionObserver(entries => {
      active = entries[0]?.isIntersecting ?? false;
      if (!active) { cancelAnimationFrame(frame); frame = 0; }
      else if (!contextLost && !frame) { last = performance.now(); frame = requestAnimationFrame(render); }
    }, { threshold: .04 });
    inView.observe(mount);
    const onVisibility = () => { if (!document.hidden && active && !contextLost && !frame) { last = performance.now(); frame = requestAnimationFrame(render); } };
    document.addEventListener('visibilitychange', onVisibility);
    const onContextLost = event => {
      event.preventDefault();
      contextLost = true;
      active = false;
      cancelAnimationFrame(frame);
      frame = 0;
      display.dataset.renderer = 'fallback';
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    display.dataset.renderer = 'webgl';
    frame = requestAnimationFrame(render);

    const cleanup = () => {
      cancelAnimationFrame(frame);
      inView.disconnect();
      observer.disconnect();
      onTheme.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      display.removeEventListener('core-state-change', onState);
      window.removeEventListener('scroll', onScroll);
      mount.removeEventListener('pointermove', onPointerMove);
      mount.removeEventListener('pointerleave', onPointerLeave);
      for (const resource of disposable) resource.dispose();
      renderer.dispose();
    };
    window.addEventListener('pagehide', cleanup, { once: true });
  } catch {
    display.dataset.renderer = 'fallback';
    canvas?.remove();
    renderer?.dispose();
  }
}
