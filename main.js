const drawingUtils = window;
const mpFaceMesh = window;

const config = {
  locateFile: (file) => {
    return (
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@` +
      `${mpFaceMesh.VERSION}/${file}`
    );
  },
};

// 参考点初始化和存储
let initialHeadPosition = null;
let initialPitch = 0;
let isReferenceInitialized = false;
// 运动检测阈值
const translationThreshold = 0.02;
// 前后运动单独阈值，提高灵敏度
const forwardBackwardThreshold = 0.01;

// Our input frames will come from here.
const videoElement = document.createElement("video");
videoElement.className = "input_video";
videoElement.style.display = "none";
document.body.appendChild(videoElement);

const canvasElement = document.getElementsByClassName("output_canvas")[0];
const canvasCtx = canvasElement.getContext("2d");

/**
 * Solution options.
 */
const solutionOptions = {
  selfieMode: true,
  enableFaceGeometry: false,
  maxNumFaces: 1,
  refineLandmarks: false,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
};

// Optimization: Turn off animated spinner after its hiding animation is done.
const spinner = document.querySelector(".loading");
spinner.ontransitionend = () => {
  spinner.style.display = "none";
};

// 添加角度信息显示元素
const angleInfoDiv = document.createElement("div");
angleInfoDiv.id = "angle-info";
angleInfoDiv.style.position = "fixed";
angleInfoDiv.style.top = "20px";
angleInfoDiv.style.right = "20px";
angleInfoDiv.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
angleInfoDiv.style.color = "white";
angleInfoDiv.style.padding = "15px";
angleInfoDiv.style.borderRadius = "8px";
angleInfoDiv.style.fontFamily = "Arial, sans-serif";
angleInfoDiv.style.fontSize = "14px";
angleInfoDiv.style.zIndex = "1000";
document.body.appendChild(angleInfoDiv);

/**
 * 计算头部转动角度（欧拉角）和位移
 * @param {Array} landmarks - 面部特征点
 * @returns {Object} 包含yaw（偏航）、pitch（俯仰）、roll（翻滚）角度和位移信息
 */
function calculateHeadPose(landmarks) {
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
  const yaw =
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
  const roll =
    (Math.atan2(rightFaceY - leftFaceY, Math.abs(leftEar.x - rightEar.x)) *
      180) /
    Math.PI;

  // 初始化参考点
  if (!isReferenceInitialized) {
    initialHeadPosition = {
      x: noseTip.x,
      y: noseTip.y,
      z: noseTip.z,
    };
    initialPitch = rawPitch; // 存储初始俯仰角作为基准
    isReferenceInitialized = true;
  }

  // 计算相对俯仰角（相对于初始位置）
  const pitch = rawPitch - initialPitch;

  // 计算头部位移
  const translation = {
    x: noseTip.x - initialHeadPosition.x, // 左右运动 (正值: 向右, 负值: 向左)
    y: noseTip.y - initialHeadPosition.y, // 上下运动 (正值: 向下, 负值: 向上)
    z: noseTip.z - initialHeadPosition.z, // 前后运动 (正值: 向后, 负值: 向前)
  };

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

function onResults(results) {
  // Hide the spinner.
  document.body.classList.add("loaded");

  // Draw the overlays.
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(
    results.image,
    0,
    0,
    canvasElement.width,
    canvasElement.height
  );
  if (results.multiFaceLandmarks) {
    for (const landmarks of results.multiFaceLandmarks) {
      drawingUtils.drawConnectors(
        canvasCtx,
        landmarks,
        mpFaceMesh.FACEMESH_TESSELATION,
        { color: "#C0C0C070", lineWidth: 1 }
      );
      drawingUtils.drawConnectors(
        canvasCtx,
        landmarks,
        mpFaceMesh.FACEMESH_RIGHT_EYE,
        { color: "#FF3030" }
      );
      drawingUtils.drawConnectors(
        canvasCtx,
        landmarks,
        mpFaceMesh.FACEMESH_RIGHT_EYEBROW,
        { color: "#FF3030" }
      );
      drawingUtils.drawConnectors(
        canvasCtx,
        landmarks,
        mpFaceMesh.FACEMESH_LEFT_EYE,
        { color: "#30FF30" }
      );
      drawingUtils.drawConnectors(
        canvasCtx,
        landmarks,
        mpFaceMesh.FACEMESH_LEFT_EYEBROW,
        { color: "#30FF30" }
      );
      drawingUtils.drawConnectors(
        canvasCtx,
        landmarks,
        mpFaceMesh.FACEMESH_FACE_OVAL,
        { color: "#E0E0E0" }
      );
      drawingUtils.drawConnectors(
        canvasCtx,
        landmarks,
        mpFaceMesh.FACEMESH_LIPS,
        { color: "#E0E0E0" }
      );
      if (solutionOptions.refineLandmarks) {
        drawingUtils.drawConnectors(
          canvasCtx,
          landmarks,
          mpFaceMesh.FACEMESH_RIGHT_IRIS,
          { color: "#FF3030" }
        );
        drawingUtils.drawConnectors(
          canvasCtx,
          landmarks,
          mpFaceMesh.FACEMESH_LEFT_IRIS,
          { color: "#30FF30" }
        );
      }

      // 计算并显示头部姿态
      const angles = calculateHeadPose(landmarks);
      updateAngleInfo(angles);

      // 在画布上标记关键特征点
      [33, 263, 1, 152, 234, 454].forEach((index) => {
        const point = landmarks[index];
        canvasCtx.beginPath();
        canvasCtx.arc(
          point.x * canvasElement.width,
          point.y * canvasElement.height,
          5,
          0,
          2 * Math.PI
        );
        canvasCtx.fillStyle = "yellow";
        canvasCtx.fill();
      });
    }
  }
  canvasCtx.restore();
}

/**
 * 更新角度信息显示
 * @param {Object} angles - 包含yaw、pitch、roll角度和translation位移的对象
 */
function updateAngleInfo(angles) {
  const { yaw, pitch, roll, translation } = angles;
  const { x: translateX, y: translateY, z: translateZ } = translation;

  // 确定平移方向描述
  let leftRightMotion = "(居中)";
  if (Math.abs(translateX) > translationThreshold * 100) {
    leftRightMotion = translateX > 0 ? `(向右移动)` : `(向左移动)`;
  }

  let upDownMotion = "(居中)";
  if (Math.abs(translateY) > translationThreshold * 100) {
    upDownMotion = translateY > 0 ? `(向下移动)` : `(向上移动)`;
  }

  let forwardBackwardMotion = "(居中)";
  if (Math.abs(translateZ) > forwardBackwardThreshold * 100) {
    forwardBackwardMotion = translateZ > 0 ? `(向后移动)` : `(向前移动)`;
  }

  angleInfoDiv.innerHTML = `
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

const faceMesh = new mpFaceMesh.FaceMesh(config);
faceMesh.setOptions(solutionOptions);
faceMesh.onResults(onResults);

// 直接使用摄像头输入
const camera = new Camera(videoElement, {
  onFrame: async () => {
    await faceMesh.send({ image: videoElement });
  },
  width: 1280,
  height: 720,
});
camera.start();

// 实现可拖动功能
const draggableContainer = document.querySelector(".draggable-container");
let isDragging = false;
let offsetX = 0;
let offsetY = 0;

// 鼠标按下事件 - 开始拖动
draggableContainer.addEventListener("mousedown", (e) => {
  isDragging = true;
  // 计算鼠标相对于容器左上角的偏移量
  offsetX = e.clientX - draggableContainer.offsetLeft;
  offsetY = e.clientY - draggableContainer.offsetTop;
  // 改变鼠标样式
  draggableContainer.style.cursor = "grabbing";
});

// 鼠标移动事件 - 拖动中
document.addEventListener("mousemove", (e) => {
  if (isDragging) {
    // 计算新的容器位置
    const newX = e.clientX - offsetX;
    const newY = e.clientY - offsetY;
    // 更新容器位置
    draggableContainer.style.left = `${newX}px`;
    draggableContainer.style.top = `${newY}px`;
  }
});

// 鼠标释放事件 - 结束拖动
document.addEventListener("mouseup", () => {
  if (isDragging) {
    isDragging = false;
    // 恢复鼠标样式
    draggableContainer.style.cursor = "move";
  }
});

// 鼠标离开窗口事件 - 结束拖动
document.addEventListener("mouseleave", () => {
  if (isDragging) {
    isDragging = false;
    draggableContainer.style.cursor = "move";
  }
});
