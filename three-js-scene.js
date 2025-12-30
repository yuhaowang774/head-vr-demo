/**
 * Three.js三维场景模块
 * 功能：创建和管理3D场景，包括相机、几何体、光照和交互控制
 * 依赖：Three.js库和OrbitControls
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

class ThreeJSScene {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;

    this.cube = null;
    this.cameraObject = null;

    this.syncCamera = null;
    this.syncRenderer = null;

    this.mappingConfig = {
      rotationSensitivity: { yaw: 0.6, pitch: 1.0, roll: 0.4 },
      translationSensitivity: { x: 0.1, y: 0.05, z: 0.1 },
      rotationOffset: { yaw: 0, pitch: 0, roll: 0 },
      translationOffset: { x: 0, y: 0, z: 0 },
    };

    this.container = null;

    this.config = {
      cubeSize: 1,
      gridSize: 50,
      gridDivisions: 50,
      axesLength: 2,
      cameraDistance: 5,
    };
  }

  /**
   * 初始化Three.js场景
   * @param {string} containerId - 容器元素的ID
   */
  init(containerId) {
    this.container = document.getElementById(containerId);

    if (!this.container) {
      console.error(`容器元素 ${containerId} 不存在`);
      return;
    }

    this.createScene();
    this.createCamera();
    this.createRenderer();
    this.createCube();
    this.createCameraObject();
    this.addHelpers();
    this.addLights();
    this.setupControls();
    this.setupEventListeners();
    this.createSyncCamera();
    this.startAnimationLoop();
  }

  /**
   * 创建场景
   */
  createScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf0f0f0);
  }

  /**
   * 创建相机
   */
  createCamera() {
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    this.camera.position.set(0, 6, -6);
    this.camera.lookAt(0, 0, 0);
  }

  /**
   * 创建渲染器
   */
  createRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight
    );
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.appendChild(this.renderer.domElement);
    this.renderer.domElement.renderer = this.renderer;
  }

  /**
   * 创建正方体
   */
  createCube() {
    const geometry = new THREE.BoxGeometry(
      this.config.cubeSize,
      this.config.cubeSize,
      this.config.cubeSize
    );
    const material = new THREE.MeshStandardMaterial({ color: 0x0077ff });
    this.cube = new THREE.Mesh(geometry, material);
    this.scene.add(this.cube);
  }

  /**
   * 创建相机物体模型
   */
  createCameraObject() {
    const cameraGroup = new THREE.Group();

    const bodyWidth = 0.8;
    const bodyHeight = 0.5;
    const bodyDepth = 1.2;

    const bodyGeometry = new THREE.BoxGeometry(
      bodyWidth,
      bodyHeight,
      bodyDepth
    );
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    cameraGroup.add(body);

    const lensGeometry = new THREE.CylinderGeometry(0.15, 0.2, 0.3, 32);
    const lensMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const lens = new THREE.Mesh(lensGeometry, lensMaterial);
    lens.rotation.x = Math.PI / 2;
    lens.position.z = -bodyDepth / 2 - 0.15;
    cameraGroup.add(lens);

    const lensInnerGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.05, 32);
    const lensInnerMaterial = new THREE.MeshStandardMaterial({
      color: 0x0066cc,
    });
    const lensInner = new THREE.Mesh(lensInnerGeometry, lensInnerMaterial);
    lensInner.rotation.x = Math.PI / 2;
    lensInner.position.z = -bodyDepth / 2 - 0.3;
    cameraGroup.add(lensInner);

    const viewfinderGeometry = new THREE.BoxGeometry(0.4, 0.3, 0.05);
    const viewfinderMaterial = new THREE.MeshStandardMaterial({
      color: 0x222222,
    });
    const viewfinder = new THREE.Mesh(viewfinderGeometry, viewfinderMaterial);
    viewfinder.position.set(0, bodyHeight / 2 + 0.15, bodyDepth / 4);
    viewfinder.rotation.x = 0.3;
    cameraGroup.add(viewfinder);

    const screenGeometry = new THREE.BoxGeometry(0.35, 0.25, 0.02);
    const screenMaterial = new THREE.MeshStandardMaterial({
      color: 0x00aaff,
      emissive: 0x003366,
    });
    const screen = new THREE.Mesh(screenGeometry, screenMaterial);
    screen.position.set(0, bodyHeight / 2 + 0.15, bodyDepth / 4 - 0.04);
    screen.rotation.x = 0.3;
    cameraGroup.add(screen);

    const gripGeometry = new THREE.BoxGeometry(0.15, 0.4, 0.2);
    const gripMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
    const grip = new THREE.Mesh(gripGeometry, gripMaterial);
    grip.position.set(0, -bodyHeight / 2 - 0.2, -bodyDepth / 4);
    cameraGroup.add(grip);

    this.cameraObject = cameraGroup;
    this.cameraObject.position.set(0, 0, -3);
    this.cameraObject.rotation.y = Math.PI;
    this.scene.add(this.cameraObject);
  }

  /**
   * 添加辅助元素
   */
  addHelpers() {
    const gridHelper = new THREE.GridHelper(
      this.config.gridSize,
      this.config.gridDivisions
    );
    this.scene.add(gridHelper);

    const axesHelper = new THREE.AxesHelper(this.config.axesLength);
    this.scene.add(axesHelper);

    this.addGridLabels();
  }

  addGridLabels() {
    const gridSize = this.config.gridSize;
    const step = 1;
    const halfSize = gridSize / 2;

    for (let i = -halfSize; i <= halfSize; i += step) {
      if (i === 0) continue;

      const texture = this.createNumberTexture(i);
      const material = new THREE.SpriteMaterial({ map: texture });
      const sprite = new THREE.Sprite(material);

      sprite.position.set(i, 0.1, 0);
      sprite.scale.set(0.4, 0.4, 1);
      this.scene.add(sprite);

      const spriteZ = new THREE.Sprite(material.clone());
      spriteZ.position.set(0, 0.1, i);
      spriteZ.scale.set(0.4, 0.4, 1);
      this.scene.add(spriteZ);
    }
  }

  createNumberTexture(number) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = 64;
    canvas.height = 64;

    context.fillStyle = "rgba(0, 0, 0, 0)";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.font = "bold 32px Arial";
    context.fillStyle = "black";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(
      Math.abs(number).toString(),
      canvas.width / 2,
      canvas.height / 2
    );

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  /**
   * 添加光照
   */
  addLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    this.scene.add(directionalLight);
  }

  createSyncCamera() {
    const syncCanvas = document.getElementById("sync-camera-canvas");

    this.syncCamera = new THREE.PerspectiveCamera(75, 1, 0.01, 1000);
    this.syncCamera.position.copy(this.cameraObject.position);
    this.syncCamera.quaternion.copy(this.cameraObject.quaternion);

    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(this.cameraObject.quaternion);
    this.syncCamera.position.add(forward.multiplyScalar(0.5));

    this.syncRenderer = new THREE.WebGLRenderer({
      canvas: syncCanvas,
      antialias: true,
    });

    const rightContainer = document.getElementById("right-canvas-container");
    this.syncRenderer.setSize(
      rightContainer.offsetWidth,
      rightContainer.offsetHeight
    );
    this.syncRenderer.setPixelRatio(window.devicePixelRatio);

    syncCanvas.renderer = this.syncRenderer;
  }

  /**
   * 设置交互控制
   */
  setupControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; // 启用阻尼效果
    this.controls.dampingFactor = 0.05;
    this.controls.target.set(0, 0, 0); // 设置旋转中心为正方体中心
    this.controls.enablePan = true; // 启用平移功能
    this.controls.enableRotate = true; // 启用旋转功能
    this.controls.update();

    // 防止右键菜单
    this.renderer.domElement.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    window.addEventListener("resize", () => {
      this.onWindowResize();
    });

    window.addEventListener("canvasResize", (e) => {
      this.onCanvasResize(e.detail);
    });
  }

  onWindowResize() {
    this.camera.aspect =
      this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight
    );

    if (this.syncRenderer) {
      const syncCanvas = document.getElementById("sync-camera-canvas");
      if (syncCanvas) {
        this.syncRenderer.setSize(
          syncCanvas.offsetWidth,
          syncCanvas.offsetHeight
        );
        this.syncCamera.aspect =
          syncCanvas.offsetWidth / syncCanvas.offsetHeight;
        this.syncCamera.updateProjectionMatrix();
      }
    }
  }

  onCanvasResize(detail) {
    const { leftWidth, rightWidth } = detail;

    this.camera.aspect = leftWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(leftWidth, window.innerHeight);

    if (this.syncRenderer) {
      this.syncRenderer.setSize(rightWidth, window.innerHeight);
      this.syncCamera.aspect = rightWidth / window.innerHeight;
      this.syncCamera.updateProjectionMatrix();
    }
  }

  /**
   * 开始动画循环
   */
  startAnimationLoop() {
    const animate = () => {
      requestAnimationFrame(animate);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      if (this.syncRenderer && this.syncCamera) {
        this.scene.remove(this.cameraObject);
        this.syncRenderer.render(this.scene, this.syncCamera);
        this.scene.add(this.cameraObject);
      }
    };

    animate();
  }

  /**
   * 更新正方体位置
   * @param {Object} position - 位置坐标 {x, y, z}
   */
  updateCubePosition(position) {
    if (this.cube) {
      this.cube.position.set(position.x, position.y, position.z);
    }
  }

  /**
   * 更新正方体旋转
   * @param {Object} rotation - 旋转角度 {x, y, z}（弧度）
   */
  updateCubeRotation(rotation) {
    if (this.cube) {
      this.cube.rotation.set(rotation.x, rotation.y, rotation.z);
    }
  }

  /**
   * 更新正方体缩放
   * @param {Object} scale - 缩放比例 {x, y, z}
   */
  updateCubeScale(scale) {
    if (this.cube) {
      this.cube.scale.set(scale.x, scale.y, scale.z);
    }
  }

  /**
   * 获取当前场景配置
   * @returns {Object} 场景配置
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * 更新场景配置
   * @param {Object} newConfig - 新的配置参数
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 更新相机物体姿态（位置和旋转）
   * @param {Object} headPose - 头部姿态数据 {yaw, pitch, roll, translation: {x, y, z}}
   */
  updateCameraObjectPose(headPose) {
    if (!this.cameraObject) return;

    const { yaw, pitch, roll, translation } = headPose;

    const yawRad = THREE.MathUtils.degToRad(-yaw);
    const pitchRad = THREE.MathUtils.degToRad(pitch);
    const rollRad = THREE.MathUtils.degToRad(-roll);

    const adjustedYaw =
      yawRad * this.mappingConfig.rotationSensitivity.yaw +
      THREE.MathUtils.degToRad(this.mappingConfig.rotationOffset.yaw);
    const adjustedPitch =
      pitchRad * this.mappingConfig.rotationSensitivity.pitch +
      THREE.MathUtils.degToRad(this.mappingConfig.rotationOffset.pitch);
    const adjustedRoll =
      rollRad * this.mappingConfig.rotationSensitivity.roll +
      THREE.MathUtils.degToRad(this.mappingConfig.rotationOffset.roll);

    this.cameraObject.rotation.set(
      adjustedPitch,
      Math.PI + adjustedYaw,
      adjustedRoll,
      "YXZ"
    );

    const adjustedX =
      -translation.x * this.mappingConfig.translationSensitivity.x +
      this.mappingConfig.translationOffset.x;
    const adjustedY =
      -translation.y * this.mappingConfig.translationSensitivity.y +
      this.mappingConfig.translationOffset.y;
    const adjustedZ =
      -translation.z * this.mappingConfig.translationSensitivity.z +
      this.mappingConfig.translationOffset.z;

    this.cameraObject.position.set(adjustedX, adjustedY, -3 + adjustedZ);

    if (this.syncCamera) {
      this.syncCamera.position.copy(this.cameraObject.position);
      this.syncCamera.quaternion.copy(this.cameraObject.quaternion);

      const euler = new THREE.Euler().setFromQuaternion(
        this.syncCamera.quaternion,
        "YXZ"
      );
      euler.z = -euler.z;
      this.syncCamera.quaternion.setFromEuler(euler);

      const syncCanvas = document.getElementById("sync-camera-canvas");
      if (syncCanvas) {
        const aspect = syncCanvas.offsetWidth / syncCanvas.offsetHeight;
        this.syncCamera.aspect = aspect;
        this.syncCamera.updateProjectionMatrix();
      }
    }
  }

  /**
   * 设置旋转灵敏度
   * @param {Object} sensitivity - 灵敏度参数 {yaw, pitch, roll}
   */
  setRotationSensitivity(sensitivity) {
    this.mappingConfig.rotationSensitivity = {
      ...this.mappingConfig.rotationSensitivity,
      ...sensitivity,
    };
  }

  /**
   * 设置平移灵敏度
   * @param {Object} sensitivity - 灵敏度参数 {x, y, z}
   */
  setTranslationSensitivity(sensitivity) {
    this.mappingConfig.translationSensitivity = {
      ...this.mappingConfig.translationSensitivity,
      ...sensitivity,
    };
  }

  /**
   * 设置旋转偏移量
   * @param {Object} offset - 偏移量参数 {yaw, pitch, roll}
   */
  setRotationOffset(offset) {
    this.mappingConfig.rotationOffset = {
      ...this.mappingConfig.rotationOffset,
      ...offset,
    };
  }

  /**
   * 设置平移偏移量
   * @param {Object} offset - 偏移量参数 {x, y, z}
   */
  setTranslationOffset(offset) {
    this.mappingConfig.translationOffset = {
      ...this.mappingConfig.translationOffset,
      ...offset,
    };
  }

  /**
   * 获取当前映射配置
   * @returns {Object} 映射配置
   */
  getMappingConfig() {
    return { ...this.mappingConfig };
  }
}

// 导出模块
export default ThreeJSScene;

/**
 * 应用入口文件
 * 功能：初始化头部跟踪和Three.js 3D场景模块
 */

import HeadTracking from "./head-tracking.js";

// 全局变量
let headTracking = null;
let threeScene = null;

// 页面加载完成后初始化
window.addEventListener("DOMContentLoaded", () => {
  // 初始化头部跟踪模块
  headTracking = new HeadTracking();
  headTracking.init();

  // 初始化Three.js 3D场景模块
  threeScene = new ThreeJSScene();
  threeScene.init("three-js-container");

  // 设置头部姿态数据回调，实时更新相机物体
  headTracking.setHeadPoseCallback((headPose) => {
    threeScene.updateCameraObjectPose(headPose);
  });

  // 校准完成后显示参数校准面板
  const calibrateBtn = document.getElementById("calibrate-btn");
  const calibrationOverlay = document.getElementById("calibration-overlay");
  const calibrationPanel = document.getElementById("calibration-panel");
  const showPanelBtn = document.getElementById("show-panel-btn");
  const togglePanelBtn = document.getElementById("toggle-panel");
  const resetCalibrationBtn = document.getElementById("reset-calibration");

  // 监听校准按钮点击
  calibrateBtn.addEventListener("click", () => {
    // 显示参数校准面板
    calibrationPanel.style.display = "block";
  });

  // 面板显示/隐藏切换
  togglePanelBtn.onclick = () => {
    calibrationPanel.style.display = "none";
    showPanelBtn.style.display = "block";
  };

  showPanelBtn.onclick = () => {
    calibrationPanel.style.display = "block";
    showPanelBtn.style.display = "none";
  };

  // 重置参数
  resetCalibrationBtn.onclick = () => {
    threeScene.setRotationSensitivity({ yaw: 0.6, pitch: 1.0, roll: 0.4 });
    threeScene.setTranslationSensitivity({ x: 0.1, y: 0.05, z: 0.1 });
    threeScene.setRotationOffset({ yaw: 0, pitch: 0, roll: 0 });
    threeScene.setTranslationOffset({ x: 0, y: 0, z: 0 });

    // 重置滑块值
    document.getElementById("yaw-sensitivity").value = 0.6;
    document.getElementById("pitch-sensitivity").value = 1.0;
    document.getElementById("roll-sensitivity").value = 0.4;
    document.getElementById("x-sensitivity").value = 0.1;
    document.getElementById("y-sensitivity").value = 0.05;
    document.getElementById("z-sensitivity").value = 0.1;
    document.getElementById("yaw-offset").value = 0;
    document.getElementById("pitch-offset").value = 0;
    document.getElementById("roll-offset").value = 0;
    document.getElementById("x-offset").value = 0;
    document.getElementById("y-offset").value = 0;
    document.getElementById("z-offset").value = 0;

    // 更新显示值
    document.getElementById("yaw-sensitivity-val").textContent = "0.6";
    document.getElementById("pitch-sensitivity-val").textContent = "1.0";
    document.getElementById("roll-sensitivity-val").textContent = "0.4";
    document.getElementById("x-sensitivity-val").textContent = "0.1";
    document.getElementById("y-sensitivity-val").textContent = "0.05";
    document.getElementById("z-sensitivity-val").textContent = "0.1";
    document.getElementById("yaw-offset-val").textContent = "0";
    document.getElementById("pitch-offset-val").textContent = "0";
    document.getElementById("roll-offset-val").textContent = "0";
    document.getElementById("x-offset-val").textContent = "0.0";
    document.getElementById("y-offset-val").textContent = "0.0";
    document.getElementById("z-offset-val").textContent = "0.0";
  };

  // 旋转灵敏度控制
  document.getElementById("yaw-sensitivity").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("yaw-sensitivity-val").textContent =
      value.toFixed(1);
    threeScene.setRotationSensitivity({ yaw: value });
    console.log("旋转灵敏度:", threeScene.mappingConfig.rotationSensitivity);
  });

  document
    .getElementById("pitch-sensitivity")
    .addEventListener("input", (e) => {
      const value = parseFloat(e.target.value);
      document.getElementById("pitch-sensitivity-val").textContent =
        value.toFixed(1);
      threeScene.setRotationSensitivity({ pitch: value });
      console.log("旋转灵敏度:", threeScene.mappingConfig.rotationSensitivity);
    });

  document.getElementById("roll-sensitivity").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("roll-sensitivity-val").textContent =
      value.toFixed(1);
    threeScene.setRotationSensitivity({ roll: value });
    console.log("旋转灵敏度:", threeScene.mappingConfig.rotationSensitivity);
  });

  // 平移灵敏度控制
  document.getElementById("x-sensitivity").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("x-sensitivity-val").textContent = value.toFixed(1);
    threeScene.setTranslationSensitivity({ x: value });
    console.log("平移灵敏度:", threeScene.mappingConfig.translationSensitivity);
  });

  document.getElementById("y-sensitivity").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("y-sensitivity-val").textContent = value.toFixed(1);
    threeScene.setTranslationSensitivity({ y: value });
    console.log("平移灵敏度:", threeScene.mappingConfig.translationSensitivity);
  });

  document.getElementById("z-sensitivity").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("z-sensitivity-val").textContent = value.toFixed(1);
    threeScene.setTranslationSensitivity({ z: value });
    console.log("平移灵敏度:", threeScene.mappingConfig.translationSensitivity);
  });
});
