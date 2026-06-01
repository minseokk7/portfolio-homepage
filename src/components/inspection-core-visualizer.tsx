import { useEffect, useRef, useState } from "react"
import { Sliders, Cpu, Activity, AlertTriangle, ShieldAlert, Check, RefreshCw } from "lucide-react"
import * as THREE from "three"
// @ts-ignore
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"

type InspectionMode = "normal" | "vision-fault" | "thermal-fault" | "vibration-fault"

interface WaferItem {
  mesh: THREE.Mesh
  boxHelper: THREE.BoxHelper | null
  status: "pending" | "scanning" | "ok" | "fault"
  isFaulty: boolean
  id: number
  progress: number // 0 (start) to 1 (end) of conveyor
  diverted: boolean
}

export function InspectionCoreVisualizer() {
  const [mode, setMode] = useState<InspectionMode>("normal")
  const [temp, setTemp] = useState(35.2)
  const [vibration, setVibration] = useState(1.8)
  const [yieldRate, setYieldRate] = useState(100)
  const [scannedCount, setScannedCount] = useState(0)
  const [faultCount, setFaultCount] = useState(0)
  const [consoleLogs, setConsoleLogs] = useState<string[]>([
    "[SYS-READY] Edge AI inspection core booting complete.",
    "[SYS-READY] Camera stream stabilized at 60fps.",
    "[SYS-READY] Vibration accelerometer calibrated (Noise floor: 1.8g).",
    "[SYS-READY] Core thermal sensor initialized (Core: 35.2°C).",
  ])

  const containerRef = useRef<HTMLDivElement>(null)
  const canvas3DRef = useRef<HTMLCanvasElement>(null)
  const canvasGraphRef = useRef<HTMLCanvasElement>(null)
  
  const modeRef = useRef<InspectionMode>(mode)
  const waferIdCounterRef = useRef(1000)
  const animFrameRef = useRef<number | null>(null)
  const graphFrameRef = useRef<number | null>(null)

  // 통계 관리를 위한 레프
  const statsRef = useRef({ total: 0, faults: 0 })

  useEffect(() => {
    modeRef.current = mode
    // 모드 변경 시 로그 출력
    if (mode === "normal") {
      addLog("[MODE-CHANGE] 설비 공정 상태 복귀 -> 정상 안전 가동 중.")
    } else if (mode === "vision-fault") {
      addLog("[MODE-CHANGE] 경고: 비전 분석 이상 인젝션 -> 무작위 크랙 불량 칩 유입 개시.")
    } else if (mode === "thermal-fault") {
      addLog("[ALERT-INJECT] 인젝션 활성화: 구동 모터 과부하 상태 주입 -> 서멀 리미트 테스트.")
    } else if (mode === "vibration-fault") {
      addLog("[ALERT-INJECT] 인젝션 활성화: 베어링 언밸런싱 기어 진동 파동 주입.")
    }
  }, [mode])

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString("ko-KR", { hour12: false })
    setConsoleLogs((prev) => [`[${time}] ${msg}`, ...prev.slice(0, 14)])
  }

  // 1. ✨ HTML5 2D Canvas 초호화 Sci-Fi 오실로스코프 HUD 모니터 모듈
  useEffect(() => {
    if (!canvasGraphRef.current) return
    const canvas = canvasGraphRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let width = canvas.width
    let height = canvas.height

    const pointsVib: number[] = Array(64).fill(1.8)
    const pointsTemp: number[] = Array(64).fill(35.2)
    let t = 0

    const drawGraph = () => {
      t += 0.08
      
      // 잔상(Phosphor Decay) 효과를 내기 위해 투명한 다크 백그라운드로 덮어씌움
      ctx.fillStyle = "rgba(9, 12, 22, 0.25)"
      ctx.fillRect(0, 0, width, height)

      // 온도 및 진동 실시간 스냅 상태 업데이트
      const currentMode = modeRef.current
      let targetTemp = 35.2
      let targetVib = 1.8

      if (currentMode === "thermal-fault") {
        targetTemp = 92.4 + Math.sin(t * 2.5) * 1.8
        targetVib = 2.0 + Math.sin(t) * 0.45
      } else if (currentMode === "vibration-fault") {
        targetTemp = 42.1 + Math.sin(t) * 0.7
        targetVib = 7.8 + Math.cos(t * 3.5) * 1.5 + (Math.random() - 0.5) * 0.4 // 미세 떨림 지터 노이즈 추가
      } else {
        targetTemp = 35.2 + Math.sin(t * 0.4) * 0.35
        targetVib = 1.8 + Math.cos(t * 0.9) * 0.22
      }

      setTemp(Number(targetTemp.toFixed(1)))
      setVibration(Number(targetVib.toFixed(1)))

      pointsTemp.push(targetTemp)
      pointsTemp.shift()
      pointsVib.push(targetVib)
      pointsVib.shift()

      // A. 사이버네틱 HUD 보정 격자망(Micro Grid Network)
      ctx.strokeStyle = "rgba(0, 240, 255, 0.04)"
      ctx.lineWidth = 1
      for (let i = 0; i < width; i += 16) {
        ctx.beginPath()
        ctx.moveTo(i, 0)
        ctx.lineTo(i, height)
        ctx.stroke()
      }
      for (let i = 0; i < height; i += 16) {
        ctx.beginPath()
        ctx.moveTo(0, i)
        ctx.lineTo(width, i)
        ctx.stroke()
      }

      const graphH = height / 2

      // B. 온도 모니터 그래프 그리기 (상단)
      ctx.shadowColor = currentMode === "thermal-fault" ? "rgba(239, 68, 68, 0.85)" : "rgba(0, 240, 255, 0.6)"
      ctx.shadowBlur = 8
      ctx.strokeStyle = currentMode === "thermal-fault" ? "#ef4444" : "#00f0ff"
      ctx.lineWidth = 2.0
      ctx.beginPath()
      for (let i = 0; i < pointsTemp.length; i++) {
        const x = (i / (pointsTemp.length - 1)) * width
        const ratio = (pointsTemp[i] - 15) / 100 // 15°C to 115°C 스케일
        const y = graphH - 12 - ratio * (graphH - 24)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      // 온도 안전 한계선 (빨간 점멸 테두리 데인저 라인)
      ctx.shadowBlur = 0
      ctx.strokeStyle = "rgba(239, 68, 68, 0.35)"
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      const limitY = graphH - 12 - ((75 - 15) / 100) * (graphH - 24)
      ctx.moveTo(0, limitY)
      ctx.lineTo(width, limitY)
      ctx.stroke()
      ctx.setLineDash([])

      // 데인저 위험 임계치 경고 텍스트 오버레이
      ctx.fillStyle = "rgba(0, 240, 255, 0.55)"
      ctx.font = "7px monospace"
      ctx.fillText("TEMP SENSOR FEEDBACK (75°C MAX)", 8, 12)
      ctx.fillStyle = "rgba(239, 68, 68, 0.8)"
      ctx.fillText("WARN_LIMIT", width - 58, limitY - 4)

      // C. 진동 가속도 그래프 그리기 (하단)
      ctx.shadowColor = currentMode === "vibration-fault" ? "rgba(239, 68, 68, 0.85)" : "rgba(110, 60, 255, 0.7)"
      ctx.shadowBlur = 8
      ctx.strokeStyle = currentMode === "vibration-fault" ? "#ef4444" : "#6e3cff"
      ctx.lineWidth = 2.0
      ctx.beginPath()
      for (let i = 0; i < pointsVib.length; i++) {
        const x = (i / (pointsVib.length - 1)) * width
        const ratio = pointsVib[i] / 12 // 0g to 12g 스케일
        const y = height - 12 - ratio * (graphH - 24)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      // 진동 안전 위험선
      ctx.shadowBlur = 0
      ctx.strokeStyle = "rgba(239, 68, 68, 0.35)"
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      const vibLimitY = height - 12 - (5.0 / 12) * (graphH - 24)
      ctx.moveTo(0, vibLimitY)
      ctx.lineTo(width, vibLimitY)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.fillStyle = "rgba(110, 60, 255, 0.65)"
      ctx.fillText("ACCELEROMETER FEEDBACK (5.0g MAX)", 8, graphH + 12)
      ctx.fillStyle = "rgba(239, 68, 68, 0.8)"
      ctx.fillText("WARN_LIMIT", width - 58, vibLimitY - 4)

      graphFrameRef.current = window.requestAnimationFrame(drawGraph)
    }

    drawGraph()

    // 리사이징 대응
    const handleResize = () => {
      if (!canvasGraphRef.current) return
      width = canvasGraphRef.current.width = canvasGraphRef.current.clientWidth
      height = canvasGraphRef.current.height = canvasGraphRef.current.clientHeight
    }
    window.addEventListener("resize", handleResize)
    handleResize()

    return () => {
      if (graphFrameRef.current) window.cancelAnimationFrame(graphFrameRef.current)
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  // 2. 🦾 Three.js WebGL 실시간 3D 스마트 스캐너 기믹
  useEffect(() => {
    if (!canvas3DRef.current || !containerRef.current) return
    const canvas = canvas3DRef.current
    const container = containerRef.current

    let width = container.clientWidth
    let height = container.clientHeight

    // 씬 및 렌더러 설정
    const scene = new THREE.Scene()
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    // 카메라 설정
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100)
    camera.position.set(0, 2.5, 4.2)

    // 부드러운 궤도 제어용 OrbitControls 이식
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.maxPolarAngle = Math.PI / 2 - 0.05
    controls.minDistance = 2.0
    controls.maxDistance = 10.0
    controls.target.set(0, 0.2, 0)

    // 고휘도 3포인트 스튜디오 조명 배치
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95)
    scene.add(ambientLight)

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5)
    dirLight.position.set(4, 10, 4)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.width = 1024
    dirLight.shadow.mapSize.height = 1024
    dirLight.shadow.bias = -0.0003
    scene.add(dirLight)

    const fillLight = new THREE.DirectionalLight(0x00f0ff, 0.6) // 미래지향적 푸른 충전 조명
    fillLight.position.set(-4, 5, -3)
    scene.add(fillLight)

    // 모터 가열 시 벌겋게 연출하기 위한 열광 포인트 소스
    const heatIndicatorLight = new THREE.PointLight(0xff3300, 0, 8)
    heatIndicatorLight.position.set(-1.9, 0.2, 0)
    scene.add(heatIndicatorLight)

    // 미래형 홀로그래픽 바닥 스튜디오 스테이지
    const gridHelper = new THREE.GridHelper(8, 20, 0x6e3cff, 0x22263b)
    gridHelper.position.y = -0.5
    scene.add(gridHelper)

    // 바닥 중심의 빛나는 홀로그램 서클
    const holoRingMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide
    })
    const holoRingGeo = new THREE.RingGeometry(0.9, 0.93, 32)
    holoRingGeo.rotateX(-Math.PI / 2)
    const holoRing = new THREE.Mesh(holoRingGeo, holoRingMat)
    holoRing.position.set(0, -0.48, 0)
    scene.add(holoRing)

    // 재질 정의
    const conveyorMat = new THREE.MeshStandardMaterial({ color: 0x1d222d, roughness: 0.55, metalness: 0.85 })
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.15, metalness: 0.92 }) // 티타늄 브러시드 실버
    const cameraBodyMat = new THREE.MeshStandardMaterial({ color: 0x2d3248, roughness: 0.25, metalness: 0.88 }) // 카본 딥블루
    const glowLaserMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide
    })
    const normalWaferMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.1, metalness: 0.9, emissive: 0x064e3b, emissiveIntensity: 0.2 })
    const faultyWaferMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.2, metalness: 0.7, emissive: 0x7f1d1d, emissiveIntensity: 0.4 })
    const scrapTrayMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.4, metalness: 0.8, emissive: 0x080914 })

    // A. 컨베이어 벨트 구조물
    const conveyorGeo = new THREE.BoxGeometry(4.2, 0.15, 0.6)
    const conveyor = new THREE.Mesh(conveyorGeo, conveyorMat)
    conveyor.position.set(0, 0, 0)
    conveyor.receiveShadow = true
    scene.add(conveyor)

    // 컨베이어 좌우 메탈 세이프티 가이드 가드레일 (크롬 실버 피막 코팅)
    const railGeo = new THREE.BoxGeometry(4.2, 0.04, 0.03)
    const rail1 = new THREE.Mesh(railGeo, frameMat)
    rail1.position.set(0, 0.09, 0.315)
    const rail2 = rail1.clone()
    rail2.position.set(0, 0.09, -0.315)
    scene.add(rail1, rail2)

    // 컨베이어 벨트 드라이브 힌지용 메탈 스포크 롤러 휠 기어 2개 추가
    const rollerGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.62, 12)
    rollerGeo.rotateX(Math.PI / 2)
    
    const leftRoller = new THREE.Mesh(rollerGeo, frameMat)
    leftRoller.position.set(-1.8, -0.02, 0)
    
    const rightRoller = new THREE.Mesh(rollerGeo, frameMat)
    rightRoller.position.set(1.8, -0.02, 0)
    scene.add(leftRoller, rightRoller)

    // B. 비전 검사 카메라 하우징 & 지지 갠트리 프레임
    const gantryFrameGroup = new THREE.Group()
    scene.add(gantryFrameGroup)

    const pillarGeo = new THREE.CylinderGeometry(0.04, 0.045, 1.2, 16)
    const pillar1 = new THREE.Mesh(pillarGeo, frameMat)
    pillar1.position.set(0, 0.5, 0.38)
    pillar1.castShadow = true
    const pillar2 = pillar1.clone()
    pillar2.position.set(0, 0.5, -0.38)
    gantryFrameGroup.add(pillar1, pillar2)

    const crossbarGeo = new THREE.BoxGeometry(0.08, 0.08, 0.8)
    const crossbar = new THREE.Mesh(crossbarGeo, frameMat)
    crossbar.position.set(0, 1.1, 0)
    crossbar.castShadow = true
    gantryFrameGroup.add(crossbar)

    // 비전 카메라 본체 및 LED 상태등
    const cameraBodyGeo = new THREE.BoxGeometry(0.20, 0.22, 0.20)
    const cameraBody = new THREE.Mesh(cameraBodyGeo, cameraBodyMat)
    cameraBody.position.set(0, 0.95, 0)
    cameraBody.castShadow = true
    gantryFrameGroup.add(cameraBody)

    const lensGeo = new THREE.CylinderGeometry(0.05, 0.065, 0.12, 16)
    const lens = new THREE.Mesh(lensGeo, frameMat)
    lens.position.set(0, 0.78, 0)
    gantryFrameGroup.add(lens)

    // 카메라 작동 시그널 LED 라이트 링
    const cameraLedGeo = new THREE.SphereGeometry(0.024, 16, 16)
    const cameraLedMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 })
    const cameraLed = new THREE.Mesh(cameraLedGeo, cameraLedMat)
    cameraLed.position.set(0.07, 0.95, 0.11)
    gantryFrameGroup.add(cameraLed)

    // C. 3D 네온 스캔 레이저 빔 플레이트
    const laserGeo = new THREE.PlaneGeometry(0.015, 0.6)
    laserGeo.rotateX(Math.PI / 2)
    const laserMesh = new THREE.Mesh(laserGeo, glowLaserMat)
    laserMesh.position.set(0, 0.4, 0)
    scene.add(laserMesh)

    // D. 불량품용 폐기 트레이 수거함
    const trayGeo = new THREE.BoxGeometry(0.65, 0.3, 0.65)
    const tray = new THREE.Mesh(trayGeo, scrapTrayMat)
    tray.position.set(1.5, -0.3, 0.75) // 컨베이어 아래, 우측 빗겨난 구역
    tray.castShadow = true
    tray.receiveShadow = true
    scene.add(tray)

    const trayDecalGeo = new THREE.RingGeometry(0.32, 0.35, 32)
    trayDecalGeo.rotateX(-Math.PI / 2)
    const trayRingMat = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.2 })
    const trayRing = new THREE.Mesh(trayDecalGeo, trayRingMat)
    trayRing.position.set(1.5, -0.14, 0.75)
    scene.add(trayRing)

    // E. 불량 분리용 회전 게이트 (Diverter Arm)
    const gateGroup = new THREE.Group()
    gateGroup.position.set(1.1, 0.08, 0.31)
    scene.add(gateGroup)

    const gateBarGeo = new THREE.BoxGeometry(0.62, 0.08, 0.028)
    gateBarGeo.translate(0.31, 0, 0) // 회전축 보정
    const gateBar = new THREE.Mesh(gateBarGeo, frameMat)
    gateBar.castShadow = true
    gateGroup.add(gateBar)

    // F. ✨ AI 비전 스포트라이트 파티클 시스템 (Scanning Spark Particles)
    const sparkCount = 40
    const sparksGeo = new THREE.BufferGeometry()
    const sparkPos = new Float32Array(sparkCount * 3)
    const sparkVel = new Float32Array(sparkCount * 3)

    // 스캔선 구역(X=0, Z=-0.3 ~ 0.3, Y=0.08)에 파티클 응집 대기
    for (let i = 0; i < sparkCount; i++) {
      sparkPos[i * 3] = (Math.random() - 0.5) * 0.05
      sparkPos[i * 3 + 1] = 0.08 + Math.random() * 0.05
      sparkPos[i * 3 + 2] = (Math.random() - 0.5) * 0.6

      sparkVel[i * 3] = 0
      sparkVel[i * 3 + 1] = 0
      sparkVel[i * 3 + 2] = 0
    }

    sparksGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3))
    const sparkMat = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 0.05,
      transparent: true,
      opacity: 0.0, // 최초엔 보이지 않음 (스캔 기동 시에만 튕김)
      blending: THREE.AdditiveBlending
    })
    const scanSparks = new THREE.Points(sparksGeo, sparkMat)
    scene.add(scanSparks)

    // 검사 품목(칩/웨이퍼) 관리용 큐
    let wafers: WaferItem[] = []
    let spawnTimer = 0

    // 비전 스캔 반응 효과를 위한 조명
    const flashLight = new THREE.PointLight(0x00f0ff, 0, 6)
    flashLight.position.set(0, 0.8, 0)
    scene.add(flashLight)

    // G. 모터 구동 롤러 회전 장비 (수직 메탈 기어)
    const motorGroup = new THREE.Group()
    motorGroup.position.set(-2.0, -0.2, 0)
    scene.add(motorGroup)

    const motorGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.22, 16)
    motorGeo.rotateX(Math.PI / 2)
    const motorMesh = new THREE.Mesh(motorGeo, frameMat)
    motorMesh.castShadow = true
    motorGroup.add(motorMesh)

    // 3D 렌더러 애니메이션 루프
    const tick = () => {
      const currentMode = modeRef.current

      // 모터 이상 발생 시 붉게 가열되는 글로우 처리
      if (currentMode === "thermal-fault") {
        const pulse = 1.0 + Math.sin(performance.now() * 0.015) * 0.5
        heatIndicatorLight.intensity = pulse * 4
        motorMesh.material = new THREE.MeshStandardMaterial({
          color: 0xef4444,
          roughness: 0.1,
          metalness: 0.9,
          emissive: 0xff3300,
          emissiveIntensity: pulse * 1.5
        })
      } else {
        heatIndicatorLight.intensity = 0
        motorMesh.material = frameMat
      }

      // 모터 및 컨베이어 롤러 기어 실시간 연동 회전 기믹
      const rotSpeed = currentMode === "vibration-fault" ? 0.38 : currentMode === "thermal-fault" ? 0.04 : 0.08
      motorGroup.rotation.z += rotSpeed
      
      // 스포크 롤러 축 2개 회전
      leftRoller.rotation.x += rotSpeed
      rightRoller.rotation.x += rotSpeed

      // OrbitControls 카메라 댐핑 업데이트
      controls.update()

      // 컨베이어 벨트 위의 제품 스폰 제어 (등간격 스폰)
      spawnTimer++
      if (spawnTimer >= 100) {
        spawnTimer = 0
        
        waferIdCounterRef.current++
        const waferId = waferIdCounterRef.current

        // 무작위로 크랙 칩 생성 결정 (모드가 vision-fault 일 땐 55% 확률로 불량품 유입)
        const isFaulty = currentMode === "vision-fault" && Math.random() < 0.55

        // 웨이퍼 디스크와 칩 코어가 정밀 조립된 입체 형상 구현
        const waferGroup = new THREE.Group()
        
        // 반도체 원형 디스크 바디
        const discGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.03, 32)
        const disc = new THREE.Mesh(discGeo, isFaulty ? faultyWaferMat : normalWaferMat)
        disc.position.y = 0.015
        disc.castShadow = true
        waferGroup.add(disc)

        // 칩 표면 패턴 디테일 사각형 코어
        const coreGeo = new THREE.BoxGeometry(0.14, 0.04, 0.14)
        const coreMat = new THREE.MeshStandardMaterial({
          color: isFaulty ? 0xff3333 : 0x00f0ff,
          roughness: 0.1,
          metalness: 0.95
        })
        const core = new THREE.Mesh(coreGeo, coreMat)
        core.position.set(0, 0.035, 0)
        waferGroup.add(core)

        // 이상 감지 3D 바운딩 박스 라벨 (스캔 대기 시 비활성 보이지 않음)
        waferGroup.position.set(-2.0, 0.08, 0)
        scene.add(waferGroup)

        wafers.push({
          mesh: waferGroup as unknown as THREE.Mesh,
          boxHelper: null,
          status: "pending",
          isFaulty,
          id: waferId,
          progress: 0,
          diverted: false
        })
      }

      // 분류 게이트 (Diverter Arm) 부드러운 유도 물리 애니메이션
      let targetGateAngle = 0
      
      // 기화된 웨이퍼들이 있는지 확인해서, 벨트 끝에서 불량품이 오면 게이트를 회전시킴
      const faultyApproaching = wafers.some(
        (w) => w.isFaulty && w.progress >= 0.72 && w.progress <= 0.88 && !w.diverted
      )
      if (faultyApproaching) {
        targetGateAngle = -Math.PI / 4.2 // 45도 안쪽으로 꺾임
      }
      gateGroup.rotation.y += (targetGateAngle - gateGroup.rotation.y) * 0.22

      // ✨ 스캔 기동 상태 및 LED 시그널 깜빡임 파악 변수
      let isAnyScanning = false
      let isAnyFaultFound = false

      // 웨이퍼 위치 업데이트 및 AI 비전 감지 연산
      wafers.forEach((wafer) => {
        // 이송 진행
        const speed = currentMode === "vibration-fault" ? 0.007 : 0.0048
        wafer.progress += speed

        // 컨베이어 상의 실시간 x좌표 투영
        const startX = -2.0
        const endX = 2.0
        const curX = startX + (endX - startX) * wafer.progress

        if (!wafer.diverted) {
          wafer.mesh.position.x = curX
        }

        // A. 스캐닝 빔 통과 센싱 (X좌표가 0.0에 다다를 때 스캐닝 작동)
        if (wafer.status === "pending" && Math.abs(curX) <= 0.06) {
          wafer.status = "scanning"
          isAnyScanning = true
          
          // 푸른색 카메라 셔터 플래시 이펙트
          flashLight.intensity = 5.0
          setTimeout(() => { flashLight.intensity = 0 }, 120)

          // 스파크 파티클 튕겨나가는 물리 가속 시동
          const sPos = scanSparks.geometry.attributes.position as THREE.BufferAttribute
          const sArray = sPos.array as Float32Array
          sparkMat.opacity = 0.95

          for (let i = 0; i < sparkCount; i++) {
            sArray[i * 3] = (Math.random() - 0.5) * 0.02
            sArray[i * 3 + 1] = 0.08 + Math.random() * 0.08
            sArray[i * 3 + 2] = (Math.random() - 0.5) * 0.4

            sparkVel[i * 3] = (Math.random() - 0.5) * 0.06
            sparkVel[i * 3 + 1] = Math.random() * 0.08 + 0.03 // 위로 튕김
            sparkVel[i * 3 + 2] = (Math.random() - 0.5) * 0.06
          }
          sPos.needsUpdate = true

          // AI 분류 연계
          statsRef.current.total++
          if (wafer.isFaulty) {
            statsRef.current.faults++
            wafer.status = "fault"
            isAnyFaultFound = true
            addLog(`[VISION-AI] 이상 발견! 검출 칩 ID: #${wafer.id} -> 표면 0.4mm 크랙 불량 결함 판정.`)
          } else {
            wafer.status = "ok"
            addLog(`[VISION-AI] 판정 완료. 칩 ID: #${wafer.id} -> 정밀 비전 패턴 분석 결과 정상 (PASS).`)
          }

          // 통계량 스냅
          setScannedCount(statsRef.current.total)
          setFaultCount(statsRef.current.faults)
          setYieldRate(
            statsRef.current.total > 0
              ? Number((((statsRef.current.total - statsRef.current.faults) / statsRef.current.total) * 100).toFixed(1))
              : 100
          )

          // AI 비전 판정 바운딩 박스 생성 기믹 장착
          const bboxColor = wafer.isFaulty ? 0xef4444 : 0x22c55e
          const boxHelper = new THREE.BoxHelper(wafer.mesh, new THREE.Color(bboxColor))
          scene.add(boxHelper)
          wafer.boxHelper = boxHelper
        }

        if (wafer.status === "scanning") {
          isAnyScanning = true
        }

        // 바운딩 박스가 생성되었다면 칩과 위치 완벽 동기화
        if (wafer.boxHelper) {
          wafer.boxHelper.update()
        }

        // B. 벨트 우측 끝단 분류 분기점 (Diverter Arm)
        if (wafer.progress >= 0.78 && wafer.isFaulty && !wafer.diverted) {
          wafer.diverted = true
          // 불량 수거함 방향으로 포물선 낙하 가상 드롭 궤적 애니메이션 적용
          const startDivertedTime = performance.now()
          const startX = wafer.mesh.position.x
          const startZ = wafer.mesh.position.z

          const animateDrop = () => {
            const elapsed = (performance.now() - startDivertedTime) / 1000
            const t = Math.min(elapsed / 0.65, 1) // 0.65초 낙하
            
            // X는 수거함 중심으로 포물선, Z는 0에서 0.75로 이동, Y는 중력 가속도 낙하
            wafer.mesh.position.x = startX + (1.5 - startX) * t
            wafer.mesh.position.z = startZ + (0.75 - startZ) * t
            wafer.mesh.position.y = 0.08 - 0.55 * t * t // 중력 포물선

            if (wafer.boxHelper) {
              wafer.boxHelper.position.copy(wafer.mesh.position)
              wafer.boxHelper.rotation.copy(wafer.mesh.rotation)
            }

            if (t < 1) {
              requestAnimationFrame(animateDrop)
            } else {
              // 낙하 완료 후 제거
              scene.remove(wafer.mesh)
              if (wafer.boxHelper) scene.remove(wafer.boxHelper)
            }
          }
          animateDrop()
          addLog(`[REJECT-SYSTEM] 분류 조작기 기동 -> 불량 칩 ID: #${wafer.id} 폐기 트레이 이송 분리 완료.`)
        }
      })

      // 스캔 시그널 LED 라이트 색상 동적 매핑
      if (isAnyScanning) {
        cameraLedMat.color.setHex(0x00f0ff) // 스캔 동작 중: 사이언 블루
      } else if (isAnyFaultFound) {
        cameraLedMat.color.setHex(0xef4444) // 붉은 알람 점등
      } else {
        cameraLedMat.color.setHex(0x00ff88) // 정상 대기: 녹색
      }

      // ✨ 비전 스포트라이트 파티클 실시간 감쇠 및 발산
      if (sparkMat.opacity > 0) {
        sparkMat.opacity -= 0.035
        const sPos = scanSparks.geometry.attributes.position as THREE.BufferAttribute
        const sArray = sPos.array as Float32Array

        for (let i = 0; i < sparkCount; i++) {
          sArray[i * 3] += sparkVel[i * 3]
          sArray[i * 3 + 1] += sparkVel[i * 3 + 1]
          sArray[i * 3 + 2] += sparkVel[i * 3 + 2]

          // 중력 효과 추가로 포물선 튕김
          sparkVel[i * 3 + 1] -= 0.002
        }
        sPos.needsUpdate = true
      }

      // C. 컨베이어 밖으로 나간 정상 제품 제거 처리
      const expiredWafers = wafers.filter((w) => w.progress >= 1.05 && !w.isFaulty)
      expiredWafers.forEach((wafer) => {
        scene.remove(wafer.mesh)
        if (wafer.boxHelper) scene.remove(wafer.boxHelper)
      })
      wafers = wafers.filter((w) => !(w.progress >= 1.05 && !w.isFaulty))

      renderer.render(scene, camera)
      animFrameRef.current = window.requestAnimationFrame(tick)
    }

    tick()

    // 반응형 리사이징
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

      // 3D 자원 메모리 해제
      conveyorGeo.dispose()
      railGeo.dispose()
      rollerGeo.dispose()
      pillarGeo.dispose()
      crossbarGeo.dispose()
      cameraBodyGeo.dispose()
      lensGeo.dispose()
      cameraLedGeo.dispose()
      laserGeo.dispose()
      trayGeo.dispose()
      trayDecalGeo.dispose()
      gateBarGeo.dispose()
      motorGeo.dispose()
      sparksGeo.dispose()
      holoRingGeo.dispose()

      conveyorMat.dispose()
      frameMat.dispose()
      cameraBodyMat.dispose()
      cameraLedMat.dispose()
      glowLaserMat.dispose()
      normalWaferMat.dispose()
      faultyWaferMat.dispose()
      scrapTrayMat.dispose()
      trayRingMat.dispose()
      sparkMat.dispose()
      holoRingMat.dispose()

      renderer.dispose()
    }
  }, [])

  // 인젝션 이상상태 리셋
  const resetAllSystems = () => {
    setMode("normal")
    statsRef.current = { total: 0, faults: 0 }
    setScannedCount(0)
    setFaultCount(0)
    setYieldRate(100)
    addLog("[SYS-RESET] 엣지 컴퓨터 누적 통계치 및 결함 인젝션 상태 초기화 복귀.")
  }

  return (
    <div className="robotic-sandbox">
      <div className="sandbox-card">
        {/* 상단 타이틀 헤더 */}
        <div className="sandbox-header">
          <div className="title-area">
            <Cpu className="icon-pulse" />
            <div>
              <h3>AI Edge Inspection Sandbox</h3>
              <p>Three.js WebGL & Canvas 실시간 IoT 계측 시뮬레이션</p>
            </div>
          </div>
          <div className={`status-badge ${mode !== "normal" ? "badge-active" : "badge-manual"}`}>
            <Activity className={mode !== "normal" ? "spin-pulse" : ""} />
            <span>{mode !== "normal" ? "ANOMALY INJECTED" : "SYSTEM RUNNING"}</span>
          </div>
        </div>

        {/* 3D 뷰포트 및 2D IoT 대시보드 스플릿 영역 */}
        <div className="sandbox-screen-split">
          {/* 좌측: Three.js 3D 비전 스캐너 */}
          <div className="screen-3d" ref={containerRef}>
            {/* 수치 데이터 계측 대시보드 */}
            <div className="coordinate-overlay">
              <div className="telemetry-item">
                <span className="label">MOTOR:</span>
                <span className="value font-mono" style={{ color: mode === "vibration-fault" ? "oklch(0.68 0.22 27)" : "inherit" }}>
                  {mode === "vibration-fault" ? "HIGH VIB" : "NORMAL"}
                </span>
              </div>
              <div className="telemetry-item">
                <span className="label">TEMP:</span>
                <span className="value font-mono" style={{ color: temp >= 75 ? "oklch(0.68 0.22 27)" : "inherit" }}>
                  {temp} °C
                </span>
              </div>
              <div className="telemetry-item">
                <span className="label">VIB:</span>
                <span className="value font-mono" style={{ color: vibration >= 5.0 ? "oklch(0.68 0.22 27)" : "inherit" }}>
                  {vibration} g
                </span>
              </div>
              <div className="telemetry-item">
                <span className="label">LASER:</span>
                <span className="value font-mono font-bold" style={{ color: "oklch(0.7 0.12 142)" }}>● ACTIVE</span>
              </div>
            </div>

            {/* 비상 사일런트 온도과열/진동점멸 경보 라이트 */}
            {(temp >= 75 || vibration >= 5.0) && (
              <div className="alert-pulse font-mono">
                <AlertTriangle size={14} className="spin-pulse" />
                <span>{temp >= 75 ? "CORE THERMAL OVERHEAT CRITICAL" : "MOTOR BEARING VIBRATION UNBALANCED"}</span>
              </div>
            )}

            <canvas ref={canvas3DRef} className="arm-3d-canvas" />
          </div>

          {/* 우측: Canvas 2D 실시간 IoT 센서 그래프 */}
          <div className="screen-iot-dashboard">
            <div className="iot-header font-mono">
              <Activity size={12} className="spin-pulse" />
              <span>Real-Time Edge Telemetry</span>
            </div>
            
            <div className="graph-container">
              <canvas ref={canvasGraphRef} className="iot-graph-canvas" />
            </div>

            {/* 계측 통계 보드 */}
            <div className="iot-stats font-mono">
              <div className="stat-row">
                <span className="stat-lbl">총 스캔 횟수:</span>
                <span className="stat-val text-blue-400">{scannedCount} EA</span>
              </div>
              <div className="stat-row">
                <span className="stat-lbl">결함 칩 검출:</span>
                <span className="stat-val" style={{ color: faultCount > 0 ? "oklch(0.68 0.22 27)" : "inherit" }}>
                  {faultCount} EA
                </span>
              </div>
              <div className="stat-row border-t border-gray-700/60 pt-1.5 mt-1.5">
                <span className="stat-lbl">품질 수율 (Yield):</span>
                <span className="stat-val font-bold" style={{ color: yieldRate < 90 ? "oklch(0.68 0.22 27)" : "oklch(0.7 0.12 142)" }}>
                  {yieldRate} %
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 하단 셸 게이트웨이 로그 콘솔 */}
        <div className="sandbox-console font-mono">
          <span className="prompt">EDGE_AI_SYS &gt; </span>
          <div className="console-log-flow">
            {consoleLogs.map((log, i) => (
              <div key={i} className={`log-line ${log.includes("ALERT") || log.includes("이상") ? "log-alert" : ""}`}>
                {log}
              </div>
            ))}
          </div>
        </div>

        {/* 하단 결함 주입 제어반 */}
        <div className="sandbox-controls">
          <div className="control-tabs">
            <button className="tab-active">
              <Sliders size={14} />
              <span>Edge AI Anomaly Fault Injection (결함 인젝션 제어반)</span>
            </button>
          </div>

          <div className="action-buttons grid grid-cols-2 md:grid-cols-4 gap-2.5 p-3.5">
            <button
              type="button"
              className={`btn-action btn-gripper ${mode === "normal" ? "btn-active-glow" : ""}`}
              onClick={() => setMode("normal")}
            >
              <Check size={14} />
              <span>정상 가동 (Normal)</span>
            </button>

            <button
              type="button"
              className={`btn-action btn-gripper ${mode === "vision-fault" ? "btn-ready-glow" : ""}`}
              onClick={() => setMode("vision-fault")}
              style={{ borderColor: mode === "vision-fault" ? "oklch(0.68 0.22 27)" : "transparent" }}
            >
              <Cpu size={14} />
              <span>비전 결함 (Vision Crack)</span>
            </button>

            <button
              type="button"
              className={`btn-action btn-gripper ${mode === "thermal-fault" ? "btn-ready-glow" : ""}`}
              onClick={() => setMode("thermal-fault")}
              style={{ borderColor: mode === "thermal-fault" ? "oklch(0.68 0.22 27)" : "transparent" }}
            >
              <AlertTriangle size={14} />
              <span>모터 과열 (Thermal)</span>
            </button>

            <button
              type="button"
              className={`btn-action btn-gripper ${mode === "vibration-fault" ? "btn-ready-glow" : ""}`}
              onClick={() => setMode("vibration-fault")}
              style={{ borderColor: mode === "vibration-fault" ? "oklch(0.68 0.22 27)" : "transparent" }}
            >
              <ShieldAlert size={14} />
              <span>베어링 진동 (Vibration)</span>
            </button>
          </div>

          {/* 리셋 버튼 단독 배치 */}
          <div className="flex justify-end px-3.5 pb-3.5">
            <button
              type="button"
              className="btn-action btn-reset w-full md:w-auto"
              onClick={resetAllSystems}
            >
              <RefreshCw size={14} className="icon-pulse" />
              <span>계측 리셋 (Reset stats)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
