'use client';

/**
 * Three.js 标准紧固件参数化三维模型生成器
 * 与 FreeCAD 建模逻辑保持一致的参数化渲染，支持螺栓、螺母、垫圈、销、铆钉等
 */

import * as THREE from 'three';
import { FastenerData, FastenerType, FastenerGeometryParams } from '@/lib/types';
import { getModelGeometryParams } from '@/lib/fastener-params';

/**
 * 创建一个螺栓（六角头螺栓）的3D网格组
 */
function createBolt(params: Record<string, number>): THREE.Group {
  const group = new THREE.Group();
  const { d, s, k, L, dk } = params;

  const mat = new THREE.MeshStandardMaterial({
    color: 0x8899aa,
    metalness: 0.7,
    roughness: 0.3,
  });

  // 六角头 - 使用CylinderGeometry
  const headGeo = new THREE.CylinderGeometry(s / 2, s / 2, k, 6);
  const head = new THREE.Mesh(headGeo, mat);
  head.position.y = L / 2 + k / 2;
  group.add(head);

  // 头部倒角（垫圈面）
  const chamferGeo = new THREE.CylinderGeometry(dk / 2, dk / 2, 0.2, 32);
  const chamfer = new THREE.Mesh(chamferGeo, mat);
  chamfer.position.y = L / 2 - 0.1;
  group.add(chamfer);

  // 螺杆
  const shaftGeo = new THREE.CylinderGeometry(d / 2, d / 2, L - 1, 32);
  const shaft = new THREE.Mesh(shaftGeo, mat);
  shaft.position.y = 0;
  group.add(shaft);

  // 螺纹示意（用环状装饰表示螺纹）
  const threadMat = new THREE.MeshStandardMaterial({
    color: 0x667788,
    metalness: 0.5,
    roughness: 0.4,
  });
  const threadCount = Math.floor((L - 5) / 1.5);
  for (let i = 0; i < threadCount; i++) {
    const ringGeo = new THREE.TorusGeometry(d / 2 + 0.05, 0.05, 8, 24);
    const ring = new THREE.Mesh(ringGeo, threadMat);
    ring.position.y = -L / 2 + 2 + i * 1.5;
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
  }

  // 螺杆端部倒角
  const tipGeo = new THREE.ConeGeometry(d / 2, 0.5, 32);
  const tip = new THREE.Mesh(tipGeo, mat);
  tip.position.y = -L / 2 - 0.25;
  group.add(tip);

  // 中心轴对齐
  return group;
}

/**
 * 创建一个螺母的3D网格组
 */
function createNut(params: Record<string, number>): THREE.Group {
  const group = new THREE.Group();
  const { d, m, s } = params;

  const mat = new THREE.MeshStandardMaterial({
    color: 0x8899aa,
    metalness: 0.6,
    roughness: 0.3,
  });

  // 六角本体
  const bodyGeo = new THREE.CylinderGeometry(s / 2, s / 2, m, 6);
  const body = new THREE.Mesh(bodyGeo, mat);
  group.add(body);

  // 内螺纹孔
  const innerMat = new THREE.MeshStandardMaterial({
    color: 0x556677,
    metalness: 0.4,
    roughness: 0.5,
  });
  const holeGeo = new THREE.CylinderGeometry(d / 2 - 0.2, d / 2 - 0.2, m + 0.1, 24);
  const hole = new THREE.Mesh(holeGeo, innerMat);
  hole.position.y = 0;
  group.add(hole);

  // 上下倒角（螺母的C倒角）
  for (const yPos of [-m / 2, m / 2]) {
    const bevelGeo = new THREE.TorusGeometry(s / 2 + 0.1, 0.15, 8, 24);
    const bevel = new THREE.Mesh(bevelGeo, mat);
    bevel.position.y = yPos;
    bevel.rotation.x = Math.PI / 2;
    group.add(bevel);
  }

  return group;
}

/**
 * 创建一个垫圈的3D网格组
 */
function createWasher(params: Record<string, number>): THREE.Group {
  const group = new THREE.Group();
  const { d1, d2, h } = params;

  const mat = new THREE.MeshStandardMaterial({
    color: 0x99aabb,
    metalness: 0.6,
    roughness: 0.25,
  });

  // 环形垫圈 - 使用RingGeometry + Lathe
  const shape = new THREE.Shape();
  shape.absarc(0, 0, d2 / 2, 0, Math.PI * 2, false);
  const holePath = new THREE.Path();
  holePath.absarc(0, 0, d1 / 2, 0, Math.PI * 2, true);
  shape.holes.push(holePath);

  const extrudeSettings = {
    depth: h,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.05,
    bevelSegments: 3,
  };

  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = -h / 2;
  group.add(mesh);

  return group;
}

/**
 * 创建一个螺钉（内六角圆柱头螺钉）的3D网格组
 */
function createScrew(params: Record<string, number>): THREE.Group {
  const group = new THREE.Group();
  const { d, dk, k, L, s } = params;

  const mat = new THREE.MeshStandardMaterial({
    color: 0x8899aa,
    metalness: 0.65,
    roughness: 0.3,
  });

  // 圆柱头
  const headGeo = new THREE.CylinderGeometry(dk / 2, dk / 2, k, 32);
  const head = new THREE.Mesh(headGeo, mat);
  head.position.y = L / 2 + k / 2;
  group.add(head);

  // 内六角孔
  const innerMat = new THREE.MeshStandardMaterial({
    color: 0x445566,
    metalness: 0.3,
    roughness: 0.6,
  });
  const hexGeo = new THREE.CylinderGeometry(s / 2 * 0.8, s / 2 * 0.8, k * 0.7, 6);
  const hexHole = new THREE.Mesh(hexGeo, innerMat);
  hexHole.position.y = L / 2 + k / 2;
  group.add(hexHole);

  // 螺杆
  const shaftGeo = new THREE.CylinderGeometry(d / 2, d / 2, L - 0.5, 32);
  const shaft = new THREE.Mesh(shaftGeo, mat);
  shaft.position.y = 0;
  group.add(shaft);

  // 螺纹示意
  const threadMat = new THREE.MeshStandardMaterial({
    color: 0x667788,
    metalness: 0.4,
    roughness: 0.4,
  });
  const threadCount = Math.floor(L / 2);
  for (let i = 0; i < threadCount; i++) {
    const ringGeo = new THREE.TorusGeometry(d / 2 + 0.05, 0.04, 8, 24);
    const ring = new THREE.Mesh(ringGeo, threadMat);
    ring.position.y = -L / 2 + 1 + i * 2;
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
  }

  return group;
}

/**
 * 创建一个铆钉（半圆头铆钉）的3D网格组
 */
function createRivet(params: Record<string, number>): THREE.Group {
  const group = new THREE.Group();
  const { d, dk, k, L } = params;

  const mat = new THREE.MeshStandardMaterial({
    color: 0x99aabb,
    metalness: 0.5,
    roughness: 0.4,
  });

  // 半圆头（球体的一部分）
  const headGeo = new THREE.SphereGeometry(dk / 2, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const head = new THREE.Mesh(headGeo, mat);
  head.position.y = L / 2;
  head.rotation.z = Math.PI;
  group.add(head);

  // 钉杆
  const shaftGeo = new THREE.CylinderGeometry(d / 2, d / 2, L, 24);
  const shaft = new THREE.Mesh(shaftGeo, mat);
  shaft.position.y = 0;
  group.add(shaft);

  // 钉杆端部
  const endGeo = new THREE.SphereGeometry(d / 2, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const end = new THREE.Mesh(endGeo, mat);
  end.position.y = -L / 2;
  group.add(end);

  return group;
}

/**
 * 创建一个销（圆柱销）的3D网格组
 */
function createPin(params: Record<string, number>): THREE.Group {
  const group = new THREE.Group();
  const { d, L } = params;

  const mat = new THREE.MeshStandardMaterial({
    color: 0xaabbcc,
    metalness: 0.7,
    roughness: 0.2,
  });

  // 圆柱主体
  const bodyGeo = new THREE.CylinderGeometry(d / 2, d / 2, L, 24);
  const body = new THREE.Mesh(bodyGeo, mat);
  group.add(body);

  // 两端倒角
  for (const yPos of [-L / 2, L / 2]) {
    const bevelGeo = new THREE.SphereGeometry(d / 2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const bevel = new THREE.Mesh(bevelGeo, mat);
    bevel.position.y = yPos;
    bevel.rotation.x = yPos > 0 ? 0 : Math.PI;
    group.add(bevel);
  }

  return group;
}

/**
 * 创建一个螺柱（双头螺柱）的3D网格组
 */
function createStud(params: Record<string, number>): THREE.Group {
  const group = new THREE.Group();
  const { d, L, b } = params;

  const mat = new THREE.MeshStandardMaterial({
    color: 0x8899aa,
    metalness: 0.65,
    roughness: 0.3,
  });

  // 螺杆主体
  const shaftGeo = new THREE.CylinderGeometry(d / 2, d / 2, L, 32);
  const shaft = new THREE.Mesh(shaftGeo, mat);
  group.add(shaft);

  // 两端螺纹示意
  const threadMat = new THREE.MeshStandardMaterial({
    color: 0x667788,
    metalness: 0.4,
    roughness: 0.4,
  });

  for (const startY of [-L / 2, L / 2 - b]) {
    const count = Math.floor(Math.min(b, L / 2) / 1.5);
    for (let i = 0; i < count; i++) {
      const ringGeo = new THREE.TorusGeometry(d / 2 + 0.05, 0.05, 8, 24);
      const ring = new THREE.Mesh(ringGeo, threadMat);
      ring.position.y = startY + i * 1.5 + 0.5;
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
    }
  }

  return group;
}

/**
 * 根据紧固件类型和参数生成对应的3D模型
 */
export function createFastenerModel(fastenerData: FastenerData): THREE.Group {
  const params = getModelGeometryParams(fastenerData.type, fastenerData.geometry);

  let group: THREE.Group;

  switch (fastenerData.type) {
    case FastenerType.BOLT:
      group = createBolt(params);
      break;
    case FastenerType.NUT:
      group = createNut(params);
      break;
    case FastenerType.WASHER:
      group = createWasher(params);
      break;
    case FastenerType.SCREW:
      group = createScrew(params);
      break;
    case FastenerType.RIVET:
      group = createRivet(params);
      break;
    case FastenerType.PIN:
      group = createPin(params);
      break;
    case FastenerType.STUD:
      group = createStud(params);
      break;
    default:
      // 默认创建一个圆柱体占位
      group = new THREE.Group();
      const defaultGeo = new THREE.CylinderGeometry(5, 5, 20, 24);
      const defaultMat = new THREE.MeshStandardMaterial({ color: 0x8899aa, metalness: 0.6, roughness: 0.3 });
      const mesh = new THREE.Mesh(defaultGeo, defaultMat);
      group.add(mesh);
  }

  return group;
}

/**
 * 创建 Three.js 场景、相机和灯光
 */
export function createFastenerScene(
  container: HTMLElement,
  modelGroup: THREE.Group
): {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: { dispose: () => void };
} {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0e1a);

  // 相机
  const aspect = container.clientWidth / container.clientHeight;
  const camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 1000);
  camera.position.set(30, 20, 35);
  camera.lookAt(0, 0, 0);

  // 渲染器
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);

  // 灯光
  const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
  scene.add(ambientLight);

  const mainLight = new THREE.DirectionalLight(0xccddff, 1.8);
  mainLight.position.set(20, 30, 20);
  mainLight.castShadow = true;
  scene.add(mainLight);

  const fillLight = new THREE.DirectionalLight(0x8888ff, 0.6);
  fillLight.position.set(-20, 10, -15);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0x4488ff, 0.4);
  rimLight.position.set(0, -10, 30);
  scene.add(rimLight);

  // 网格地面
  const gridHelper = new THREE.GridHelper(50, 20, 0x3366aa, 0x224488);
  gridHelper.position.y = -15;
  scene.add(gridHelper);

  // 添加模型
  // 计算包围盒自动居中
  const box = new THREE.Box3().setFromObject(modelGroup);
  const center = box.getCenter(new THREE.Vector3());
  modelGroup.position.sub(center);
  
  // 计算合适缩放
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = maxDim > 20 ? 20 / maxDim : 1;
  if (scale < 1) modelGroup.scale.set(scale, scale, scale);
  
  scene.add(modelGroup);

  // 简化轨道控制 - 手动实现鼠标拖拽旋转
  let isDragging = false;
  let previousMousePosition = { x: 0, y: 0 };
  let spherical = { theta: Math.PI / 4, phi: Math.PI / 3, radius: 50 };
  const target = new THREE.Vector3(0, 0, 0);

  function updateCamera() {
    camera.position.x = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
    camera.position.y = spherical.radius * Math.cos(spherical.phi);
    camera.position.z = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
    camera.lookAt(target);
  }

  function onMouseDown(e: MouseEvent) {
    isDragging = true;
    previousMousePosition = { x: e.clientX, y: e.clientY };
  }

  function onMouseMove(e: MouseEvent) {
    if (!isDragging) return;
    const deltaX = e.clientX - previousMousePosition.x;
    const deltaY = e.clientY - previousMousePosition.y;
    spherical.theta -= deltaX * 0.01;
    spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi - deltaY * 0.01));
    previousMousePosition = { x: e.clientX, y: e.clientY };
    updateCamera();
  }

  function onMouseUp() {
    isDragging = false;
  }

  function onWheel(e: WheelEvent) {
    spherical.radius = Math.max(15, Math.min(100, spherical.radius + e.deltaY * 0.1));
    updateCamera();
  }

  container.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  container.addEventListener('wheel', onWheel);

  updateCamera();

  // 动画循环
  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();

  const controls = {
    dispose() {
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('wheel', onWheel);
      renderer.dispose();
    },
  };

  return { scene, camera, renderer, controls };
}