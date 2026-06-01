import { useEffect, useRef, useState } from "react"
import { Sliders, Cpu, Activity, AlertTriangle, ShieldAlert, Check, RefreshCw, RotateCcw } from "lucide-react"
import * as THREE from "three"
// @ts-ignore
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"

type AMRMode = "idle" | "delivering" | "obstacle-avoiding" | "returning" | "estop"

export function CampusDeliveryVisualizer() {
  const [mode, setMode] = useState<AMRMode>("idle")
  const [battery, setBattery] = useState(88.5)
  const [speed, setSpeed] = useState(0.0)
  const [payload] = useState(15.4)
  const [xPos, setXPos] = useState(-2.0)
  const [zPos, setZPos] = useState(0.0)
  const [obstacleActive, setObstacleActive] = useState(false)
  const [consoleLogs, setConsoleLogs] = useState<string[]>(
    [
      "[SYS-READY] AMR Fleet management client boot complete.",
      "[SYS-READY] Solid-state LiDAR modules stabilized at 10Hz spin.",
      "[SYS-READY] Kinematics drive motor controller initialized.",
      "[SYS-READY] Wireless Edge telemetry link established (Signal: 98dBm).",
    ]
  )

  const containerRef = useRef<HTMLDivElement>(null)
  const canvas3DRef = useRef<HTMLCanvasElement>(null)
  const canvasRadarRef = useRef<HTMLCanvasElement>(null)

  const modeRef = useRef<AMRMode>(mode)
  const obstacleActiveRef = useRef<boolean>(obstacleActive)
  const animFrameRef = useRef<number | null>(null)
  const radarFrameRef = useRef<number | null>(null)

  // 실시간 좌표 연계를 위한 레프
  const amrPositionRef = useRef({ x: -2.0, z: 0.0 })
  const obstaclePositionRef = useRef({ x: 0.0, z: -0.1 })

  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  useEffect(() => {
    obstacleActiveRef.current = obstacleActive
  }, [obstacleActive])

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString("ko-KR", { hour12: false })
    setConsoleLogs((prev) => [`[${time}] ${msg}`, ...prev.slice(0, 14)])
  }

  // 1. 📡 HTML5 2D Canvas 실시간 360도 초고감도 LiDAR Radar HUD 스코프
  useEffect(() => {
    if (!canvasRadarRef.current) return
    const canvas = canvasRadarRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let width = canvas.width
    let height = canvas.height
    let sweepAngle = 0

    // 가상 스캔 점 추적용 큐
    interface ScanDot {
      angle: number
      distRatio: number
      life: number
      isObstacle: boolean
    }
    let scanDots: ScanDot[] = []

    const drawRadar = () => {
      sweepAngle += 0.045
      if (sweepAngle >= Math.PI * 2) sweepAngle = 0

      // 잔상(Phosphor Decay) 효과를 위한 어두운 투명 백그라운드 피막
      ctx.fillStyle = "rgba(7, 10, 20, 0.24)"
      ctx.fillRect(0, 0, width, height)

      const cx = width / 2
      const cy = height / 2
      const radius = Math.min(width, height) / 2 - 8

      // A. 레이더 스크린 백그라운드 원판 및 미세 사이버네틱 HUD 격자망
      ctx.fillStyle = "rgba(7, 10, 20, 0.15)"
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.fill()

      // 동심원 방위 계측선 그리기 (네온 블루 페이드 스타일)
      ctx.strokeStyle = "rgba(0, 240, 255, 0.08)"
      ctx.lineWidth = 1
      for (let r = radius / 4; r <= radius; r += radius / 4) {
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.stroke()
      }

      // 십자 방위각 가이드 라인
      ctx.beginPath()
      ctx.moveTo(cx - radius, cy)
      ctx.lineTo(cx + radius, cy)
      ctx.moveTo(cx, cy - radius)
      ctx.lineTo(cx, cy + radius)
      ctx.stroke()

      // 방위 눈금선 (30도 간격)
      ctx.strokeStyle = "rgba(0, 240, 255, 0.03)"
      for (let i = 0; i < 12; i++) {
        const angle = (i * Math.PI) / 6
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle))
        ctx.stroke()
      }

      // B. 레이저 스위프 빔 그리기 (네온 부드러운 그라데이션)
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
      grad.addColorStop(0, "rgba(0, 240, 255, 0.28)")
      grad.addColorStop(0.7, "rgba(0, 240, 255, 0.06)")
      grad.addColorStop(1, "rgba(0, 240, 255, 0)")

      ctx.strokeStyle = grad
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, radius, sweepAngle - 0.22, sweepAngle, false)
      ctx.closePath()
      ctx.fill()

      // 레이저 빔 선단
      ctx.shadowColor = "rgba(0, 240, 255, 0.9)"
      ctx.shadowBlur = 6
      ctx.strokeStyle = "rgba(0, 240, 255, 0.7)"
      ctx.lineWidth = 1.8
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + radius * Math.cos(sweepAngle), cy + radius * Math.sin(sweepAngle))
      ctx.stroke()
      ctx.shadowBlur = 0 // 섀도우 블러 리셋

      // C. 가상 라이다 감지 스캐닝 점 생성 및 렌더링
      const activeObstacle = obstacleActiveRef.current
      const curAMR = amrPositionRef.current
      const curObs = obstaclePositionRef.current

      // 스위프 빔 각도에 따라 장애물 감지 점 추가 (상대 각도 arctan2 계산 모델)
      const angleToObs = Math.atan2(curObs.z - curAMR.z, curObs.x - curAMR.x)
      const normalizedAngle = angleToObs < 0 ? angleToObs + Math.PI * 2 : angleToObs

      if (activeObstacle && Math.abs(sweepAngle - normalizedAngle) < 0.05) {
        const dist = Math.sqrt(Math.pow(curObs.x - curAMR.x, 2) + Math.pow(curObs.z - curAMR.z, 2))
        const distRatio = Math.min(dist / 3.2, 1.0)
        scanDots.push({
          angle: normalizedAngle,
          distRatio,
          life: 1.0,
          isObstacle: true
        })
      }

      // 무작위 스마트 빌딩 벽체 레이저 리플렉션 점 생성 (라이다 신뢰성 연출)
      if (Math.random() < 0.24) {
        const boundaryAngle = sweepAngle
        const distRatio = 0.75 + Math.random() * 0.16
        scanDots.push({
          angle: boundaryAngle,
          distRatio,
          life: 0.82,
          isObstacle: false
        })
      }

      // 스캔 점 드로잉 및 디케이(생명력 감쇠) 처리
      scanDots.forEach((dot) => {
        dot.life -= 0.016
        if (dot.life <= 0) return

        const dotX = cx + radius * dot.distRatio * Math.cos(dot.angle)
        const dotY = cy + radius * dot.distRatio * Math.sin(dot.angle)

        ctx.shadowColor = dot.isObstacle ? "rgba(239, 68, 68, 0.9)" : "rgba(0, 240, 255, 0.5)"
        ctx.shadowBlur = dot.isObstacle ? 8 : 4
        ctx.fillStyle = dot.isObstacle
          ? `rgba(239, 68, 68, ${dot.life})` // 장애물: 적색 네온
          : `rgba(0, 240, 255, ${dot.life * 0.65})` // 일반 벽체: 사이언 네온

        ctx.beginPath()
        ctx.arc(dotX, dotY, dot.isObstacle ? 4.0 : 2.2, 0, Math.PI * 2)
        ctx.fill()
      })
      ctx.shadowBlur = 0 // 섀도우 블러 리셋
      scanDots = scanDots.filter((dot) => dot.life > 0)

      // 레이더 원형 림 테두리
      ctx.strokeStyle = "rgba(0, 240, 255, 0.24)"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.stroke()

      // 방위각 텍스트 라벨 인쇄
      ctx.fillStyle = "rgba(0, 240, 255, 0.45)"
      ctx.font = "bold 8px monospace"
      ctx.fillText("0° (N)", cx - 14, cy - radius + 8)
      ctx.fillText("180° (S)", cx - 18, cy + radius - 4)
      ctx.fillText("90° (E)", cx + radius - 32, cy + 3)
      ctx.fillText("270° (W)", cx - radius + 4, cy + 3)

      radarFrameRef.current = window.requestAnimationFrame(drawRadar)
    }

    drawRadar()

    // 리사이징 대응
    const handleResize = () => {
      if (!canvasRadarRef.current) return
      width = canvasRadarRef.current.width = canvasRadarRef.current.clientWidth
      height = canvasRadarRef.current.height = canvasRadarRef.current.clientHeight
    }
    window.addEventListener("resize", handleResize)
    handleResize()

    return () => {
      if (radarFrameRef.current) window.cancelAnimationFrame(radarFrameRef.current)
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  // 2. 🛞 Three.js WebGL 실시간 자율주행 AMR 회피주행 물리 샌드박스
  useEffect(() => {
    if (!canvas3DRef.current || !containerRef.current) return
    const canvas = canvas3DRef.current
    const container = containerRef.current

    let width = container.clientWidth
    let height = container.clientHeight

    // 씬 및 렌더러
    const scene = new THREE.Scene()
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    // 카메라
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100)
    camera.position.set(0, 3.4, 4.8)

    // OrbitControls 이식
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.maxPolarAngle = Math.PI / 2 - 0.05
    controls.minDistance = 2.0
    controls.maxDistance = 12.0
    controls.target.set(0, 0.1, 0)

    // 조명
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.96)
    scene.add(ambientLight)

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4)
    dirLight.position.set(4, 9, 4)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.width = 1024
    dirLight.shadow.mapSize.height = 1024
    dirLight.shadow.bias = -0.0003
    scene.add(dirLight)

    const fillLight = new THREE.DirectionalLight(0x00f0ff, 0.65) // 사이버 충전 전용 조명
    fillLight.position.set(-4, 6, -3)
    scene.add(fillLight)

    // 가상 라우팅 맵 환경
    const floorGrid = new THREE.GridHelper(8, 22, 0x6e3cff, 0x22263b)
    floorGrid.position.y = -0.01
    scene.add(floorGrid)

    // 바닥의 빛나는 홀로그램 원형 데칼
    const holoRingMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide
    })
    const holoRingGeo1 = new THREE.RingGeometry(1.6, 1.63, 64)
    holoRingGeo1.rotateX(-Math.PI / 2)
    const holoRing1 = new THREE.Mesh(holoRingGeo1, holoRingMat)
    holoRing1.position.y = 0.01
    scene.add(holoRing1)

    // 재질 정의
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x2d3248, roughness: 0.22, metalness: 0.88 }) // 카본 딥블루
    const robotBodyMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.15, metalness: 0.92 }) // 티타늄 실버
    const darkGrayMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.55, metalness: 0.8 })
    const dockMat = new THREE.MeshStandardMaterial({ color: 0x181c2b, roughness: 0.4, metalness: 0.85, emissive: 0x080914 })
    const glowLaserMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide
    })
    const dangerObstacleMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      roughness: 0.1,
      metalness: 0.92,
      emissive: 0x991b1b,
      emissiveIntensity: 0.95
    })
    const obstacleDangerRingMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide
    })

    // A. 충전용 도킹 스테이션 (시작 지점)
    const dockGeo = new THREE.BoxGeometry(0.55, 0.08, 0.55)
    const dockStart = new THREE.Mesh(dockGeo, dockMat)
    dockStart.position.set(-2.0, 0.04, 0)
    scene.add(dockStart)

    // 목적지 수령 포탈 바닥
    const dockDest = new THREE.Mesh(dockGeo, dockMat)
    dockDest.position.set(2.0, 0.04, 0)
    scene.add(dockDest)

    const portalSignGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.02, 32)
    const portalSignMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.25 })
    const portalSign = new THREE.Mesh(portalSignGeo, portalSignMat)
    portalSign.position.set(2.0, 0.051, 0)
    scene.add(portalSign)

    // B. 자율주행 배송 로봇 (AMR) 어셈블리 그룹
    const amrGroup = new THREE.Group()
    amrGroup.position.set(-2.0, 0.08, 0)
    scene.add(amrGroup)

    // 원형 섀시 본체
    const bodyGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.14, 32)
    const bodyMesh = new THREE.Mesh(bodyGeo, robotBodyMat)
    bodyMesh.castShadow = true
    amrGroup.add(bodyMesh)

    // 배송 화물 보관 캐비닛 (네모난 서랍)
    const cabGeo = new THREE.BoxGeometry(0.18, 0.15, 0.24)
    const cabMesh = new THREE.Mesh(cabGeo, darkGrayMat)
    cabMesh.position.set(0, 0.14, 0)
    cabMesh.castShadow = true
    amrGroup.add(cabMesh)

    // 라이다 돔 센서 (로봇 상단 힌지)
    const lidarDomeGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.06, 16)
    const lidarDome = new THREE.Mesh(lidarDomeGeo, darkGrayMat)
    lidarDome.position.set(0, 0.24, 0)
    amrGroup.add(lidarDome)

    // 라이다 돔 회전 렌즈 라벨
    const lidarLensGeo = new THREE.BoxGeometry(0.02, 0.04, 0.05)
    const lidarLens = new THREE.Mesh(lidarLensGeo, frameMat)
    lidarLens.position.set(0.05, 0.24, 0)
    amrGroup.add(lidarLens)

    // C. 3D AMR 4륜 메카넘 바퀴 추가 (주행 회전 효과용)
    const wheelGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.04, 16)
    wheelGeo.rotateZ(Math.PI / 2) // Y축 방향 바퀴 회전
    
    const wheelFrontLeft = new THREE.Mesh(wheelGeo, darkGrayMat)
    wheelFrontLeft.position.set(-0.16, -0.04, 0.12)
    
    const wheelFrontRight = new THREE.Mesh(wheelGeo, darkGrayMat)
    wheelFrontRight.position.set(0.16, -0.04, 0.12)
    
    const wheelBackLeft = new THREE.Mesh(wheelGeo, darkGrayMat)
    wheelBackLeft.position.set(-0.16, -0.04, -0.12)
    
    const wheelBackRight = new THREE.Mesh(wheelGeo, darkGrayMat)
    wheelBackRight.position.set(0.16, -0.04, -0.12)

    amrGroup.add(wheelFrontLeft, wheelFrontRight, wheelBackLeft, wheelBackRight)

    // D. 3D 라이다 스캔 레이저 빔 동심원 링
    const laserRingGeo = new THREE.RingGeometry(0.24, 0.82, 32)
    laserRingGeo.rotateX(-Math.PI / 2)
    const laserRing = new THREE.Mesh(laserRingGeo, glowLaserMat)
    laserRing.position.set(0, 0.24, 0)
    amrGroup.add(laserRing)

    // E. ✨ 실시간 3D LiDAR 포인트 클라우드 파티클 센싱 빔 (LiDAR Scanning Point Cloud)
    const lidarParticleCount = 120
    const lidarGeo = new THREE.BufferGeometry()
    const lidarPositions = new Float32Array(lidarParticleCount * 3)
    const lidarAngles = new Float32Array(lidarParticleCount)
    const lidarDistances = new Float32Array(lidarParticleCount)

    // 입자들을 AMR 주변 극좌표 방사형으로 배치
    for (let i = 0; i < lidarParticleCount; i++) {
      const angle = (i / lidarParticleCount) * Math.PI * 2
      const dist = 0.5 + Math.random() * 2.2
      lidarAngles[i] = angle
      lidarDistances[i] = dist

      lidarPositions[i * 3] = dist * Math.cos(angle)
      lidarPositions[i * 3 + 1] = 0.24
      lidarPositions[i * 3 + 2] = dist * Math.sin(angle)
    }

    lidarGeo.setAttribute("position", new THREE.BufferAttribute(lidarPositions, 3))
    const lidarParticleMat = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 0.05,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    })

    const lidarParticles = new THREE.Points(lidarGeo, lidarParticleMat)
    amrGroup.add(lidarParticles)

    // F. 인젝션 장애물 기둥
    const obstaclePillarGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.6, 16)
    const obstaclePillar = new THREE.Mesh(obstaclePillarGeo, dangerObstacleMat)
    obstaclePillar.position.set(0.0, -1.0, -0.1) // 최초 지하 대기
    obstaclePillar.castShadow = true
    scene.add(obstaclePillar)

    // 장애물 하단 홀로그램 위험 펄스 원 링
    const obstacleDangerRingGeo = new THREE.RingGeometry(0.38, 0.40, 32)
    obstacleDangerRingGeo.rotateX(-Math.PI / 2)
    const obstacleDangerRing = new THREE.Mesh(obstacleDangerRingGeo, obstacleDangerRingMat)
    obstacleDangerRing.position.set(0.0, 0.015, -0.1)
    obstacleDangerRing.scale.set(0, 0, 0)
    scene.add(obstacleDangerRing)

    // 실시간 주행 궤적용 변수
    let currentX = -2.0
    let currentZ = 0.0
    let progress = 0.0
    let avoidOffset = 0.0

    // 3D 렌더러 루프
    const tick = () => {
      const currentMode = modeRef.current
      const activeObstacle = obstacleActiveRef.current

      // A. 장애물 소환 애니메이션
      let targetPillarY = -1.0
      let targetRingScale = 0.0
      if (activeObstacle) {
        targetPillarY = 0.3
        targetRingScale = 1.0 + Math.sin(performance.now() * 0.012) * 0.08
      }
      obstaclePillar.position.y += (targetPillarY - obstaclePillar.position.y) * 0.15
      
      // 위험 구역 붉은 홀로그램 펄스 링 연동 스케일
      obstacleDangerRing.scale.x += (targetRingScale - obstacleDangerRing.scale.x) * 0.12
      obstacleDangerRing.scale.z += (targetRingScale - obstacleDangerRing.scale.z) * 0.12

      // 라이다 센서 돔 고속 회전 및 레이저 펄스 링 연출
      lidarDome.rotation.y += 0.32
      laserRing.rotation.y -= 0.02
      
      const laserPulse = 1.0 + Math.sin(performance.now() * 0.01) * 0.2
      laserRing.scale.set(laserPulse, 1, laserPulse)

      // LiDAR 3D 포인트 클라우드 파티클 센서 링 회전 및 펄스 반짝임
      lidarParticles.rotation.y -= 0.025

      // OrbitControls Damping 업데이트
      controls.update()

      // B. 자율주행 모션 및 궤적 계산 (AMR 주행제어 코어)
      let wSpeed = 0 // 바퀴 회전 속도

      if (currentMode === "delivering") {
        // 배터리 소모 감쇄 시뮬레이션
        setBattery((b) => Math.max(0, Number((b - 0.005).toFixed(2))))

        // 주행 진행 속도
        let speedVal = 0.005
        wSpeed = speedVal * 12.0 // 전진 속도 비례 휠 굴림

        // 장애물 존재 및 거리 센싱
        const obstacleX = 0.0

        // 회회 궤적 연산 (Obstacle Avoidance replanning)
        if (activeObstacle && Math.abs(currentX - obstacleX) < 1.1) {
          // 장애물 사각 접근권 진입 시 속도 자동 감속 처리 (안전 셧다운 제어 0.4 m/s 연계)
          speedVal = 0.0016
          wSpeed = speedVal * 12.0
          setSpeed(0.4)

          // 가우시안 곡선 형태의 스무스한 로컬 회회 이격(Z축 offset) 자동 보간
          // X가 -0.8부터 0.8까지 접근할 때 Z축으로 0.45 units 만큼 우회 주행하게끔 Z축 좌표 계산
          const dx = currentX - obstacleX
          const avoidanceArc = 0.46 * Math.exp(-Math.pow(dx * 1.5, 2))
          avoidOffset = avoidanceArc
          
          amrGroup.rotation.y = -Math.sin(dx * 2) * 0.42 // 우회 선회 각도 표현
        } else {
          // 일반 주행 상태
          setSpeed(1.2)
          avoidOffset += (0.0 - avoidOffset) * 0.08
          amrGroup.rotation.y += (0.0 - amrGroup.rotation.y) * 0.15
        }

        // 전진 이송
        progress += speedVal
        if (progress >= 1.0) {
          progress = 1.0
          setMode("idle")
          setSpeed(0)
          addLog("[NAV-CORE] 목적지 도달 성공! AMR 배송실 열림 제어 기동.")
        }

        // 3D 씬 좌표 실시간 투영
        const startX = -2.0
        const endX = 2.0
        currentX = startX + (endX - startX) * progress
        currentZ = avoidOffset

        amrGroup.position.set(currentX, 0.08, currentZ)

        // 실시간 텔레메트리 연계
        setXPos(Number(currentX.toFixed(2)))
        setZPos(Number(currentZ.toFixed(2)))

        amrPositionRef.current = { x: currentX, z: currentZ }

      } else if (currentMode === "returning") {
        // 충전 도킹 기지로 후진/복귀
        setSpeed(1.0)
        progress -= 0.006
        wSpeed = -0.006 * 12.0 // 역회전 휠 굴림

        if (progress <= 0) {
          progress = 0
          setMode("idle")
          setSpeed(0)
          addLog("[AMR-SYS] 도킹 기지 복귀 안착 완료. 유선 충전 시동 및 배터리 충전 중.")
          setBattery(100)
        }

        currentX = -2.0 + (2.0 - (-2.0)) * progress
        currentZ = 0

        amrGroup.position.set(currentX, 0.08, currentZ)
        amrGroup.rotation.y = Math.PI // 180도 선회

        setXPos(Number(currentX.toFixed(2)))
        setZPos(Number(currentZ.toFixed(2)))

        amrPositionRef.current = { x: currentX, z: currentZ }

      } else if (currentMode === "estop") {
        setSpeed(0)
        wSpeed = 0
      } else {
        // idle 대기
        setSpeed(0)
        wSpeed = 0
      }

      // AMR 4륜 메카넘 바퀴 회전 대입
      wheelFrontLeft.rotation.x += wSpeed
      wheelFrontRight.rotation.x += wSpeed
      wheelBackLeft.rotation.x += wSpeed
      wheelBackRight.rotation.x += wSpeed

      renderer.render(scene, camera)
      animFrameRef.current = window.requestAnimationFrame(tick)
    }

    tick()

    // 리사이징 제어
    const handleResize = () => {
      if (!containerRef.current) return
      width = containerRef.current.clientWidth
      height = containerRef.current.clientHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }

    const resizeObserver = new ResizeObserver(() => { handleResize() })
    resizeObserver.observe(container)

    return () => {
      if (animFrameRef.current) window.cancelAnimationFrame(animFrameRef.current)
      resizeObserver.disconnect()

      // 자원 해제
      dockGeo.dispose()
      portalSignGeo.dispose()
      bodyGeo.dispose()
      cabGeo.dispose()
      lidarDomeGeo.dispose()
      lidarLensGeo.dispose()
      wheelGeo.dispose()
      laserRingGeo.dispose()
      lidarGeo.dispose()
      obstaclePillarGeo.dispose()
      obstacleDangerRingGeo.dispose()

      frameMat.dispose()
      robotBodyMat.dispose()
      darkGrayMat.dispose()
      dockMat.dispose()
      glowLaserMat.dispose()
      dangerObstacleMat.dispose()
      obstacleDangerRingMat.dispose()
      portalSignMat.dispose()
      holoRingMat.dispose()
      lidarParticleMat.dispose()

      renderer.dispose()
    }
  }, [])

  // 임무 개시
  const startMission = () => {
    if (mode === "estop") {
      addLog("[AMR-SYS] 경고: 비상 정지 상태입니다. 시스템 복구를 수행하십시오.")
      return
    }
    setMode("delivering")
    addLog("[NAV-CORE] 주행 임무 기동 개시. Target: Meeting Room B.")
  }

  // 충전기지 귀환
  const returnToDock = () => {
    if (mode === "estop") return
    setMode("returning")
    addLog("[NAV-CORE] 임무 취소 감지 -> 충전 도킹 기지로 자동 복귀 모드 기동.")
  }

  // 비상정지
  const triggerEStop = () => {
    setMode("estop")
    setSpeed(0.0)
    addLog("[ESTOP-ALERT] 긴급 비상 정지(E-STOP) 셧다운 명령 감지! 구동 모터 물리 제동.")
  }

  // 시스템 리셋
  const resetAllSystems = () => {
    setMode("idle")
    setBattery(88.5)
    setSpeed(0)
    setXPos(-2.0)
    setZPos(0)
    setObstacleActive(false)
    amrPositionRef.current = { x: -2.0, z: 0.0 }
    addLog("[SYS-RESET] AMR 플랫폼 관제 텔레메트리 정보 및 오류 인젝션 상태 복구 완료.")
  }

  return (
    <div className="robotic-sandbox">
      <div className="sandbox-card">
        {/* 상단 타이틀 */}
        <div className="sandbox-header">
          <div className="title-area">
            <Cpu className="icon-pulse" />
            <div>
              <h3>Fleet AMR Telemetry Simulator</h3>
              <p>Three.js WebGL & Canvas 실시간 자율주행 3D 레이더</p>
            </div>
          </div>
          <div className={`status-badge ${mode === "estop" ? "badge-active" : "badge-manual"}`}>
            <Activity className={mode === "delivering" ? "spin-pulse" : ""} />
            <span>{mode === "estop" ? "ESTOP ACTIVE" : mode.toUpperCase() + " MODE"}</span>
          </div>
        </div>

        {/* 3D 씬 및 2D 스코프 대시보드 스플릿 영역 */}
        <div className="sandbox-screen-split">
          {/* 좌측: Three.js 3D 실시간 주행 맵 */}
          <div className="screen-3d" ref={containerRef}>
            {/* 수치 데이터 계측 대시보드 */}
            <div className="coordinate-overlay">
              <div className="telemetry-item">
                <span className="label">BATTERY:</span>
                <span className="value font-mono" style={{ color: battery <= 20 ? "oklch(0.68 0.22 27)" : "inherit" }}>
                  {battery} %
                </span>
              </div>
              <div className="telemetry-item">
                <span className="label">SPEED:</span>
                <span className="value font-mono">{speed} m/s</span>
              </div>
              <div className="telemetry-item">
                <span className="label">POS X:</span>
                <span className="value font-mono">{xPos} m</span>
              </div>
              <div className="telemetry-item">
                <span className="label">POS Z:</span>
                <span className="value font-mono">{zPos} m</span>
              </div>
            </div>

            {/* 비상 사일런트 경보 라이트 */}
            {mode === "estop" && (
              <div className="alert-pulse font-mono">
                <AlertTriangle size={14} className="spin-pulse" />
                <span>ESTOP EMERGENCY SHUTDOWN COMMAND ACTIVE</span>
              </div>
            )}
            
            {obstacleActive && Math.abs(xPos) < 1.0 && (
              <div className="alert-pulse font-mono" style={{ animation: "alert-red-flash 0.8s infinite ease-in-out" }}>
                <ShieldAlert size={14} className="spin-pulse" />
                <span>LOCAL PATH RE-PLANNING: AVOIDING PILLAR OBSTACLE</span>
              </div>
            )}

            <canvas ref={canvas3DRef} className="arm-3d-canvas" />
          </div>

          {/* 우측: Canvas 2D 실시간 라이다 레이더 스코프 */}
          <div className="screen-iot-dashboard">
            <div className="iot-header font-mono">
              <Activity size={12} className="spin-pulse" />
              <span>360° LiDAR Scanner Radar Scope</span>
            </div>

            <div className="graph-container">
              <canvas ref={canvasRadarRef} className="iot-graph-canvas" />
            </div>

            {/* 계측 데이터 보드 */}
            <div className="iot-stats font-mono">
              <div className="stat-row">
                <span className="stat-lbl">LiDAR 모듈 상태:</span>
                <span className="stat-val text-blue-400">● 10Hz ACTIVE</span>
              </div>
              <div className="stat-row">
                <span className="stat-lbl">적재 하중 (Payload):</span>
                <span className="stat-val">{payload} kg</span>
              </div>
              <div className="stat-row border-t border-gray-700/60 pt-1.5 mt-1.5">
                <span className="stat-lbl">경로 장애물 감지:</span>
                <span className="stat-val font-bold" style={{ color: obstacleActive ? "oklch(0.68 0.22 27)" : "oklch(0.7 0.12 142)" }}>
                  {obstacleActive ? "DETECTED" : "CLEAR"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 하단 셸 콘솔 */}
        <div className="sandbox-console font-mono">
          <span className="prompt">FLEET_AMR_LOG &gt; </span>
          <div className="console-log-flow">
            {consoleLogs.map((log, i) => (
              <div key={i} className={`log-line ${log.includes("ALERT") || log.includes("ESTOP") || log.includes("경고") ? "log-alert" : ""}`}>
                {log}
              </div>
            ))}
          </div>
        </div>

        {/* 하단 조작반 */}
        <div className="sandbox-controls">
          <div className="control-tabs">
            <button className="tab-active">
              <Sliders size={14} />
              <span>AMR Mission Control & Obstacle Injection (원격 관제 조작반)</span>
            </button>
          </div>

          <div className="action-buttons grid grid-cols-2 md:grid-cols-4 gap-2.5 p-3.5">
            <button
              type="button"
              className={`btn-action btn-gripper ${mode === "delivering" ? "btn-active-glow" : ""}`}
              onClick={startMission}
              disabled={mode === "delivering"}
            >
              <Check size={14} />
              <span>배송 시작 (Start)</span>
            </button>

            <button
              type="button"
              className={`btn-action btn-gripper ${obstacleActive ? "btn-ready-glow" : ""}`}
              onClick={() => {
                const nextActive = !obstacleActive
                setObstacleActive(nextActive)
                if (nextActive) {
                  addLog("[ALERT-INJECT] 인젝션 활성화: 자율주행 궤도 정중앙에 고정식 장애물 기둥 소환.")
                } else {
                  addLog("[SYS-CLEAR] 장애물 해제 감지 -> 직선 최단 경로 자동 복귀.")
                }
              }}
              style={{ borderColor: obstacleActive ? "oklch(0.68 0.22 27)" : "transparent" }}
            >
              <AlertTriangle size={14} />
              <span>장애물 배치 (Pillar)</span>
            </button>

            <button
              type="button"
              className={`btn-action btn-gripper ${mode === "returning" ? "btn-active-glow" : ""}`}
              onClick={returnToDock}
              disabled={mode === "returning" || mode === "idle"}
            >
              <RefreshCw size={14} />
              <span>충전 귀환 (Return)</span>
            </button>

            <button
              type="button"
              className="btn-action btn-stop"
              onClick={triggerEStop}
              disabled={mode === "estop"}
            >
              <div className="stop-icon" />
              <span>비상 정지 (ESTOP)</span>
            </button>
          </div>

          {/* 리셋 버튼 단독 배치 */}
          <div className="flex justify-end px-3.5 pb-3.5">
            <button
              type="button"
              className="btn-action btn-reset w-full md:w-auto"
              onClick={resetAllSystems}
            >
              <RotateCcw size={14} className="icon-pulse" />
              <span>관제 리셋 (Reset AMR)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
