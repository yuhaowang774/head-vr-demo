/**
 * 头部姿态识别模块
 * 功能：使用MediaPipe Face Mesh进行面部特征点检测和头部姿态计算
 * 依赖：MediaPipe Face Mesh库
 */

class HeadTracking {
  constructor() {
    this.drawingUtils = window;
    this.mpFaceMesh = window;

    // 头部姿态数据回调函数
    this.headPoseCallback = null;

    // 参考点初始化和存储
    this.initialHeadPosition = null;
    this.initialYaw = 0;
    this.initialPitch = 0;
    this.initialRoll = 0;
    this.isReferenceInitialized = false;

    // 运动检测阈值
    this.translationThreshold = 0.02;
    // 前后运动单独阈值，提高灵敏度
    this.forwardBackwardThreshold = 0.01;
    // 存储当前面部特征点，用于校准
    this.currentLandmarks = null;

    // DOM元素
    this.videoElement = null;
    this.canvasElement = null;
    this.canvasCtx = null;
    this.angleInfoDiv = null;
    this.calibrationOverlay = null;
    this.calibrateBtn = null;
    this.outputCanvas = null;

    this.isDragging = false;
    this.offsetX = 0;
    this.offsetY = 0;

    // 初始化配置
    this.config = {
      locateFile: (file) => {
        return (
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@` +
          `${this.mpFaceMesh.VERSION}/${file}`
        );
      },
    };

    // Solution options
    this.solutionOptions = {
      selfieMode: true,
      enableFaceGeometry: false,
      maxNumFaces: 1,
      refineLandmarks: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    };
  }

  /**
   * 初始化头部跟踪模块
   */
  init() {
    this.setupDOM();
    this.setupEventListeners();
    this.setupFaceMesh();
    this.setupCamera();
  }

  /**
   * 设置头部姿态数据回调函数
   * @param {Function} callback - 回调函数，接收头部姿态数据
   */
  setHeadPoseCallback(callback) {
    this.headPoseCallback = callback;
  }

  /**
   * 设置DOM元素
   */
  setupDOM() {
    // 视频元素
    this.videoElement = document.createElement("video");
    this.videoElement.className = "input_video";
    this.videoElement.style.display = "none";
    document.body.appendChild(this.videoElement);

    // Canvas元素
    this.canvasElement = document.getElementsByClassName("output_canvas")[0];
    this.canvasCtx = this.canvasElement.getContext("2d");

    // 角度信息显示元素
    this.angleInfoDiv = document.createElement("div");
    this.angleInfoDiv.id = "angle-info";
    this.angleInfoDiv.style.position = "fixed";
    this.angleInfoDiv.style.top = "20px";
    this.angleInfoDiv.style.right = "20px";
    this.angleInfoDiv.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    this.angleInfoDiv.style.color = "white";
    this.angleInfoDiv.style.padding = "15px";
    this.angleInfoDiv.style.borderRadius = "8px";
    this.angleInfoDiv.style.fontFamily = "Arial, sans-serif";
    this.angleInfoDiv.style.fontSize = "14px";
    this.angleInfoDiv.style.zIndex = "1000";
    document.body.appendChild(this.angleInfoDiv);

    this.outputCanvas = document.querySelector(".output_canvas");

    this.calibrationOverlay = document.getElementById("calibration-overlay");
    this.calibrateBtn = document.getElementById("calibrate-btn");
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    this.calibrateBtn.addEventListener("click", () => {
      this.calibrate();
    });

    this.setupCanvasDrag();
  }

  setupCanvasDrag() {
    this.outputCanvas.addEventListener("mousedown", (e) => {
      this.isDragging = true;
      this.offsetX = e.clientX - this.outputCanvas.offsetLeft;
      this.offsetY = e.clientY - this.outputCanvas.offsetTop;
      this.outputCanvas.style.cursor = "grabbing";
    });

    document.addEventListener("mousemove", (e) => {
      if (this.isDragging) {
        const newX = e.clientX - this.offsetX;
        const newY = e.clientY - this.offsetY;
        this.outputCanvas.style.left = `${newX}px`;
        this.outputCanvas.style.top = `${newY}px`;
      }
    });

    document.addEventListener("mouseup", () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.outputCanvas.style.cursor = "move";
      }
    });

    document.addEventListener("mouseleave", () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.outputCanvas.style.cursor = "move";
      }
    });
  }

  /**
   * 设置Face Mesh
   */
  setupFaceMesh() {
    this.faceMesh = new this.mpFaceMesh.FaceMesh(this.config);
    this.faceMesh.setOptions(this.solutionOptions);
    this.faceMesh.onResults((results) => this.onResults(results));
  }

  /**
   * 设置相机
   */
  setupCamera() {
    // 直接使用摄像头输入
    this.camera = new Camera(this.videoElement, {
      onFrame: async () => {
        await this.faceMesh.send({ image: this.videoElement });
      },
      width: 1280,
      height: 720,
    });
    this.camera.start();
  }

  /**
   * 计算头部转动角度（欧拉角）和位移
   * @param {Array} landmarks - 面部特征点
   * @returns {Object} 包含yaw（偏航）、pitch（俯仰）、roll（翻滚）角度和位移信息
   */
  calculateHeadPose(landmarks) {
    // 获取关键特征点位置
    const leftEye = landmarks[33]; // 左眼外角
    const rightEye = landmarks[263]; // 右眼外角
    const noseTip = landmarks[1]; // 鼻尖
    const chin = landmarks[152]; // 下巴
    const leftEar = landmarks[234]; // 左脸
    const rightEar = landmarks[454]; // 右脸

    // 将归一化坐标转换为以鼻尖为原点的相对坐标
    const centerX = noseTip.x;
    const centerY = noseTip.y;
    const centerZ = noseTip.z;

    // 计算面部朝向的向量
    // 1. 偏航角 (Yaw) - 左右转动: 基于左右眼和鼻尖的位置
    const eyeMidPointX = (leftEye.x + rightEye.x) / 2;
    const rawYaw =
      (Math.atan2(centerX - eyeMidPointX, Math.abs(rightEye.x - leftEye.x)) *
        180) /
      Math.PI;

    // 2. 俯仰角 (Pitch) - 上下转动: 基于鼻尖和下巴的位置
    const rawPitch =
      (Math.atan2(chin.y - centerY, Math.abs(chin.y - eyeMidPointX)) * 180) /
      Math.PI;

    // 3. 翻滚角 (Roll) - 左右倾斜: 基于左右脸点和眼睛的相对位置
    const eyeLevel = (leftEye.y + rightEye.y) / 2;
    const leftFaceY = leftEar.y;
    const rightFaceY = rightEar.y;
    const rawRoll =
      (Math.atan2(rightFaceY - leftFaceY, Math.abs(leftEar.x - rightEar.x)) *
        180) /
      Math.PI;

    // 计算相对角度和位移（只有在参考点初始化后才计算）
    let yaw = 0;
    let pitch = 0;
    let roll = 0;
    let translation = { x: 0, y: 0, z: 0 };

    if (this.isReferenceInitialized) {
      // 计算相对角度（相对于初始位置）
      yaw = rawYaw - this.initialYaw;
      pitch = rawPitch - this.initialPitch;
      roll = rawRoll - this.initialRoll;

      // 计算头部位移
      translation = {
        x: noseTip.x - this.initialHeadPosition.x, // 左右运动 (正值: 向右, 负值: 向左)
        y: noseTip.y - this.initialHeadPosition.y, // 上下运动 (正值: 向下, 负值: 向上)
        z: noseTip.z - this.initialHeadPosition.z, // 前后运动 (正值: 向后, 负值: 向前)
      };
    }

    return {
      yaw: Math.round(yaw), // 偏航角：正值表示向右，负值表示向左
      pitch: Math.round(pitch), // 俯仰角：正值表示向上看，负值表示向下看
      roll: Math.round(roll), // 翻滚角：正值表示向右倾斜，负值表示向左倾斜
      translation: {
        x: Math.round(translation.x * 100), // 转换为百分比形式
        y: Math.round(translation.y * 100),
        z: Math.round(translation.z * 1000), // 增大Z轴放大倍数，提高前后运动的视觉效果
      },
    };
  }

  /**
   * 更新角度信息显示
   * @param {Object} angles - 包含yaw、pitch、roll角度和translation位移的对象
   */
  updateAngleInfo(angles) {
    const { yaw, pitch, roll, translation } = angles;
    const { x: translateX, y: translateY, z: translateZ } = translation;

    // 确定平移方向描述
    let leftRightMotion = "(居中)";
    if (Math.abs(translateX) > this.translationThreshold * 100) {
      leftRightMotion = translateX > 0 ? `(向右移动)` : `(向左移动)`;
    }

    let upDownMotion = "(居中)";
    if (Math.abs(translateY) > this.translationThreshold * 100) {
      upDownMotion = translateY > 0 ? `(向下移动)` : `(向上移动)`;
    }

    let forwardBackwardMotion = "(居中)";
    if (Math.abs(translateZ) > this.forwardBackwardThreshold * 100) {
      forwardBackwardMotion = translateZ > 0 ? `(向后移动)` : `(向前移动)`;
    }

    this.angleInfoDiv.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 8px;">头部姿态信息</div>
      <div><span style="color: cyan;">偏航 (Yaw):</span> ${yaw}° ${
      yaw > 10 ? "(向右看)" : yaw < -10 ? "(向左看)" : "(正面)"
    }</div>
      <div><span style="color: magenta;">俯仰 (Pitch):</span> ${pitch}° ${
      pitch > 10 ? "(向上看)" : pitch < -10 ? "(向下看)" : "(平视)"
    }</div>
      <div><span style="color: yellow;">翻滚 (Roll):</span> ${roll}° ${
      roll > 10 ? "(向右歪头)" : roll < -10 ? "(向左歪头)" : "(端正)"
    }</div>
      <div style="margin-top: 10px; font-weight: bold; border-top: 1px solid rgba(255,255,255,0.3); padding-top: 10px;">头部运动信息</div>
      <div><span style="color: green;">左右运动:</span> ${translateX}% ${leftRightMotion}</div>
      <div><span style="color: blue;">上下运动:</span> ${translateY}% ${upDownMotion}</div>
      <div><span style="color: orange;">前后运动:</span> ${translateZ}% ${forwardBackwardMotion}</div>
    `;
  }

  /**
   * 处理Face Mesh结果
   * @param {Object} results - Face Mesh检测结果
   */
  onResults(results) {
    this.canvasCtx.save();
    this.canvasCtx.clearRect(
      0,
      0,
      this.canvasElement.width,
      this.canvasElement.height
    );
    this.canvasCtx.drawImage(
      results.image,
      0,
      0,
      this.canvasElement.width,
      this.canvasElement.height
    );
    if (results.multiFaceLandmarks) {
      for (const landmarks of results.multiFaceLandmarks) {
        this.drawingUtils.drawConnectors(
          this.canvasCtx,
          landmarks,
          this.mpFaceMesh.FACEMESH_TESSELATION,
          { color: "#C0C0C070", lineWidth: 1 }
        );
        this.drawingUtils.drawConnectors(
          this.canvasCtx,
          landmarks,
          this.mpFaceMesh.FACEMESH_RIGHT_EYE,
          { color: "#FF3030" }
        );
        this.drawingUtils.drawConnectors(
          this.canvasCtx,
          landmarks,
          this.mpFaceMesh.FACEMESH_RIGHT_EYEBROW,
          { color: "#FF3030" }
        );
        this.drawingUtils.drawConnectors(
          this.canvasCtx,
          landmarks,
          this.mpFaceMesh.FACEMESH_LEFT_EYE,
          { color: "#30FF30" }
        );
        this.drawingUtils.drawConnectors(
          this.canvasCtx,
          landmarks,
          this.mpFaceMesh.FACEMESH_LEFT_EYEBROW,
          { color: "#30FF30" }
        );
        this.drawingUtils.drawConnectors(
          this.canvasCtx,
          landmarks,
          this.mpFaceMesh.FACEMESH_FACE_OVAL,
          { color: "#E0E0E0" }
        );
        this.drawingUtils.drawConnectors(
          this.canvasCtx,
          landmarks,
          this.mpFaceMesh.FACEMESH_LIPS,
          { color: "#E0E0E0" }
        );
        if (this.solutionOptions.refineLandmarks) {
          this.drawingUtils.drawConnectors(
            this.canvasCtx,
            landmarks,
            this.mpFaceMesh.FACEMESH_RIGHT_IRIS,
            { color: "#FF3030" }
          );
          this.drawingUtils.drawConnectors(
            this.canvasCtx,
            landmarks,
            this.mpFaceMesh.FACEMESH_LEFT_IRIS,
            { color: "#30FF30" }
          );
        }

        // 存储当前面部特征点
        this.currentLandmarks = landmarks;

        // 计算并显示头部姿态
        const angles = this.calculateHeadPose(landmarks);
        this.updateAngleInfo(angles);

        // 调用回调函数传递头部姿态数据
        if (
          this.headPoseCallback &&
          typeof this.headPoseCallback === "function"
        ) {
          this.headPoseCallback(angles);
        }

        // 在画布上标记关键特征点
        [33, 263, 1, 152, 234, 454].forEach((index) => {
          const point = landmarks[index];
          this.canvasCtx.beginPath();
          this.canvasCtx.arc(
            point.x * this.canvasElement.width,
            point.y * this.canvasElement.height,
            5,
            0,
            2 * Math.PI
          );
          this.canvasCtx.fillStyle = "yellow";
          this.canvasCtx.fill();
        });
      }
    }
    this.canvasCtx.restore();
  }

  /**
   * 执行校准操作
   */
  calibrate() {
    if (this.currentLandmarks) {
      // 获取当前鼻尖位置作为初始参考点
      const noseTip = this.currentLandmarks[1];
      const chin = this.currentLandmarks[152];
      const leftEye = this.currentLandmarks[33];
      const rightEye = this.currentLandmarks[263];

      // 计算初始俯仰角
      const centerX = noseTip.x;
      const centerY = noseTip.y;
      const eyeMidPointX = (leftEye.x + rightEye.x) / 2;
      const rawPitch =
        (Math.atan2(chin.y - centerY, Math.abs(chin.y - eyeMidPointX)) * 180) /
        Math.PI;

      // 存储初始参考点
      this.initialHeadPosition = {
        x: noseTip.x,
        y: noseTip.y,
        z: noseTip.z,
      };
      this.initialPitch = rawPitch;
      this.isReferenceInitialized = true;

      // 隐藏校准界面
      this.calibrationOverlay.style.display = "none";
    }
  }
}

// 导出模块
export default HeadTracking;
