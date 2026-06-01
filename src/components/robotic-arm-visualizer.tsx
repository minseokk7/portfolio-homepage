import { useEffect, useRef, useState } from "react"
import { Play, RotateCcw, Sliders, Cpu, Activity, CheckCircle, Move } from "lucide-react"
import * as THREE from "three"

type VisualizerState = {
  base: number
  shoulder: number
  elbow: number
  gripperOpen: boolean
}

type AutoRunStep = {
  name: string
  base: number
  shoulder: number
  elbow: number
  gripperOpen: boolean
  duration: number
}

const INITIAL_STATE: VisualizerState = {
  base: 0,
  shoulder: 15,
  elbow: 45,
  gripperOpen: true,
}

// 3D 가상 정밀 공정 자동화 8단계 시퀀스 (360도 회전 반경 최적화)
const AUTO_RUN_STEPS: AutoRunStep[] = [
  { name: "비전 카메라 센서로 에너지 구체 대상 탐색 중...", base: 0, shoulder: 15, elbow: 45, gripperOpen: true, duration: 1500 },
  { name: "구체 픽업 위치로 3D 회전 선회 및 하강...", base: 60, shoulder: 45, elbow: 65, gripperOpen: true, duration: 1800 },
  { name: "진공 그리퍼 밀착 - 에너지 구체 흡착 완료", base: 60, shoulder: 45, elbow: 65, gripperOpen: false, duration: 1000 },
  { name: "안전 이송 고도로 리프팅 및 충돌 방지 궤도 설정...", base: 60, shoulder: -10, elbow: 30, gripperOpen: false, duration: 1600 },
  { name: "수평 360도 회전축 가동 - 이송 벨트 선회 비행...", base: -120, shoulder: -10, elbow: 30, gripperOpen: false, duration: 2000 },
  { name: "적재함 목표 진입 및 조인트 슬라이딩 하강...", base: -120, shoulder: 35, elbow: 55, gripperOpen: false, duration: 1500 },
  { name: "그리퍼 공압 해제 - 에너지 구체 적재 완료", base: -120, shoulder: 35, elbow: 55, gripperOpen: true, duration: 1000 },
  { name: "3D 대기 홈(Home) 상태로 부드러운 원위치 복귀...", base: 0, shoulder: 15, elbow: 45, gripperOpen: true, duration: 1800 },
]

export function RoboticArmVisualizer() {
  const [state, setState] = useState<VisualizerState>(INITIAL_STATE)
  const [isAutoRunning, setIsAutoRunning] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(-1)
  const [stepMessage, setStepMessage] = useState("3D 스튜디오 모드 - 드래그하여 로봇을 다른 각도에서 보세요.")
  const [waferPosition, setWaferPosition] = useState<"source" | "gripper" | "destination">("source")
  
  // Three.js 절대 월드 거리 계측 연동 Ref 및 State 정의
  const [realGrabReady, setRealGrabReady] = useState(false)
  const [realDistanceText, setRealDistanceText] = useState("---")

  const isNearSourceRef = useRef(false)
  const isNearDestRef = useRef(false)
  const isGrabReadyRef = useRef(false)
  const distanceTextRef = useRef("---")

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timerRef = useRef<number | null>(null)
  const animFrameRef = useRef<number | null>(null)
  
  // React-Three.js 상태 동기화 레프
  const stateRef = useRef<VisualizerState>(state)
  const waferPosRef = useRef<"source" | "gripper" | "destination">(waferPosition)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    waferPosRef.current = waferPosition
  }, [waferPosition])

  // 기구학 계산 (3D 공간 좌표 실시간 산출 - 링크2 1.4 + 팁 오프셋 0.22 비율 정확히 매핑)
  const L1_val = 70
  const L2_val = 63 // 3D 그리퍼 팁 오프셋 반영한 기구학 길이 등가값
  
  const shRad = (state.shoulder * Math.PI) / 180
  const elRad = ((state.shoulder + state.elbow) * Math.PI) / 180
  const baseRad = (state.base * Math.PI) / 180

  const z2D = L1_val * Math.sin(shRad) + L2_val * Math.sin(elRad)
  const y2D = L1_val * Math.cos(shRad) + L2_val * Math.cos(elRad)

  // 360도 전방위 기구학 매핑 (Three.js 씬 상의 베이스 높이 12mm Y-오프셋 보정 - 대시보드 오버레이용)
  const cartesianX = Math.round(z2D * Math.sin(baseRad))
  const cartesianY = 12 + Math.round(y2D)
  const cartesianZ = Math.round(z2D * Math.cos(baseRad))

  // Three.js WebGL 실시간 드로잉
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return

    const container = containerRef.current
    const canvas = canvasRef.current

    let width = container.clientWidth || 300
    let height = container.clientHeight || 240

    // 1. WebGL 렌더러 설정 (안티앨리어싱 활성화)
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    // 2. 씬 구성
    const scene = new THREE.Scene()

    // 3. 카메라 설정
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)
    let camRadius = 7.5
    let camTheta = Math.PI / 4
    let camPhi = Math.PI / 3.2

    const updateCameraPosition = () => {
      camPhi = Math.max(0.05, Math.min(Math.PI / 2 - 0.02, camPhi))
      camera.position.x = camRadius * Math.sin(camPhi) * Math.sin(camTheta)
      camera.position.y = camRadius * Math.cos(camPhi)
      camera.position.z = camRadius * Math.sin(camPhi) * Math.cos(camTheta)
      camera.lookAt(0, 1.1, 0)
    }
    updateCameraPosition()

    // 4. 고휘도 3포인트 스튜디오 조명 설계 (어둠 해소 및 금속 입체감 강조)
    // 전체 밝기 대폭 상향 (0.45 -> 0.95)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95)
    scene.add(ambientLight)

    // 주 직사광 (전면 밝게 비춤, 세기 0.8 -> 1.3)
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.3)
    dirLight1.position.set(5, 10, 5)
    dirLight1.castShadow = true
    dirLight1.shadow.mapSize.width = 1024
    dirLight1.shadow.mapSize.height = 1024
    scene.add(dirLight1)

    // 보조 역사광 (반대편 그림자 영역 제거하여 시인성 확보)
    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.65)
    dirLight2.position.set(-6, 8, -6)
    scene.add(dirLight2)

    // 퍼플 무드 포인트 조명
    const pointLight = new THREE.PointLight(0x8a53ff, 1.5, 12)
    pointLight.position.set(0, 2.8, 0)
    scene.add(pointLight)

    // 5. 작업 공간 그리드 바닥
    const gridHelper = new THREE.GridHelper(8, 16, 0x6837e5, 0xcccccc)
    gridHelper.position.y = 0.01
    scene.add(gridHelper)

    // 6. 밝고 화사한 브러시드 실버 메탈릭 및 글로우 재질 세팅
    // 칙칙한 어두운 색을 걷어내고 밝은 은빛 크롬 금속 재질로 전면 변경
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x9099b3, roughness: 0.18, metalness: 0.85 })
    const jointMat = new THREE.MeshStandardMaterial({ color: 0x7c4dff, roughness: 0.15, metalness: 0.9 })
    const linkMat = new THREE.MeshStandardMaterial({ color: 0xd9e0f5, roughness: 0.1, metalness: 0.95 }) // 매우 밝은 크롬 실버
    const glowMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00d8ff, emissiveIntensity: 2.2 }) // 화사한 네온 블루 3D 공
    const trayMat = new THREE.MeshStandardMaterial({ color: 0x22293d, roughness: 0.5, metalness: 0.7 })

    // 7. 로봇 링크 배치 및 계층 구조(Hierarchical Structure) 구축
    const robotGroup = new THREE.Group()
    scene.add(robotGroup)

    // A. 베이스 실린더
    const baseGeo = new THREE.CylinderGeometry(0.8, 0.9, 0.3, 32)
    const baseMesh = new THREE.Mesh(baseGeo, baseMat)
    baseMesh.position.y = 0.15
    baseMesh.receiveShadow = true
    baseMesh.castShadow = true
    robotGroup.add(baseMesh)

    // B. Y축 회전 그룹 (Base Rotation - 360도 전방위 선회)
    const baseRotGroup = new THREE.Group()
    baseRotGroup.position.y = 0.3
    robotGroup.add(baseRotGroup)

    // C. 1번 관절 숄더 힌지 (Shoulder Joint)
    const shoulderJointGeo = new THREE.SphereGeometry(0.24, 16, 16)
    const shoulderJointMesh = new THREE.Mesh(shoulderJointGeo, jointMat)
    baseRotGroup.add(shoulderJointMesh)

    // D. 숄더 회전 그룹
    const shoulderRotGroup = new THREE.Group()
    baseRotGroup.add(shoulderRotGroup)

    // E. 1번 링크 (Shoulder Link Cylinder - 1.8 units)
    const L1_len = 1.8
    const link1Geo = new THREE.CylinderGeometry(0.13, 0.16, L1_len, 16)
    link1Geo.translate(0, L1_len / 2, 0)
    const link1Mesh = new THREE.Mesh(link1Geo, linkMat)
    link1Mesh.castShadow = true
    shoulderRotGroup.add(link1Mesh)

    // F. 2번 관절 엘보우 힌지 그룹 (Elbow Joint)
    const elbowRotGroup = new THREE.Group()
    elbowRotGroup.position.y = L1_len
    shoulderRotGroup.add(elbowRotGroup)

    const elbowJointGeo = new THREE.SphereGeometry(0.19, 16, 16)
    const elbowJointMesh = new THREE.Mesh(elbowJointGeo, jointMat)
    elbowRotGroup.add(elbowJointMesh)

    // G. 2번 링크 (Elbow Link Cylinder - 1.4 units)
    const L2_len = 1.4
    const link2Geo = new THREE.CylinderGeometry(0.09, 0.12, L2_len, 16)
    link2Geo.translate(0, L2_len / 2, 0)
    const link2Mesh = new THREE.Mesh(link2Geo, linkMat)
    link2Mesh.castShadow = true
    elbowRotGroup.add(link2Mesh)

    // H. 엔드 이펙터 손목 및 그리퍼 헤드 그룹
    const gripperGroup = new THREE.Group()
    gripperGroup.position.y = L2_len
    elbowRotGroup.add(gripperGroup)

    const wristGeo = new THREE.BoxGeometry(0.26, 0.1, 0.26)
    const wristMesh = new THREE.Mesh(wristGeo, baseMat)
    gripperGroup.add(wristMesh)

    // I. 그리퍼 좌측 집게
    const clawLeftGeo = new THREE.BoxGeometry(0.04, 0.24, 0.08)
    clawLeftGeo.translate(0, 0.12, 0)
    const clawLeft = new THREE.Mesh(clawLeftGeo, jointMat)
    clawLeft.position.set(-0.08, 0.05, 0)
    gripperGroup.add(clawLeft)

    // J. 그리퍼 우측 집게
    const clawRightGeo = new THREE.BoxGeometry(0.04, 0.24, 0.08)
    clawRightGeo.translate(0, 0.12, 0)
    const clawRight = new THREE.Mesh(clawRightGeo, jointMat)
    clawRight.position.set(0.08, 0.05, 0)
    gripperGroup.add(clawRight)

    // K. 3D 씬 상의 진짜 그리퍼 끝단 절대 좌표 추적용 앵커 헬퍼 등록
    const gripperTipAnchor = new THREE.Object3D()
    gripperTipAnchor.position.set(0, 0.22, 0)
    gripperGroup.add(gripperTipAnchor)

    // 8. 에너지 구체 물체 (3D Sphere - 납작 웨이퍼에서 완벽한 입체 구체 '공'으로 업그레이드)
    const sphereRadius = 0.20
    const waferGeo = new THREE.SphereGeometry(sphereRadius, 32, 32)
    const waferMesh = new THREE.Mesh(waferGeo, glowMat)
    waferMesh.castShadow = true
    scene.add(waferMesh)

    // 9. 소스(Source) 및 데스트(Destination) 트레이 거치대
    const trayGeo = new THREE.CylinderGeometry(0.35, 0.4, 0.08, 32)
    
    // 소스 트레이 거치대
    const traySource = new THREE.Mesh(trayGeo, trayMat)
    const srcX = 2.0 * Math.sin((60 * Math.PI) / 180)
    const srcZ = 2.0 * Math.cos((60 * Math.PI) / 180)
    traySource.position.set(srcX, 0.04, srcZ)
    scene.add(traySource)

    // 데스트 트레이 거치대
    const trayDest = new THREE.Mesh(trayGeo, trayMat)
    const destX = 2.0 * Math.sin((-120 * Math.PI) / 180) // 360 선회 궤도 각도
    const destZ = 2.0 * Math.cos((-120 * Math.PI) / 180)
    trayDest.position.set(destX, 0.04, destZ)
    scene.add(trayDest)

    // 10. 마우스 드래그 기반 카메라 궤도 회전 제어
    let isDragging = false
    let prevX = 0
    let prevY = 0

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true
      prevX = e.clientX
      prevY = e.clientY
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      const deltaX = e.clientX - prevX
      const deltaY = e.clientY - prevY
      
      camTheta -= deltaX * 0.007
      camPhi -= deltaY * 0.007
      
      prevX = e.clientX
      prevY = e.clientY
      
      updateCameraPosition()
    }

    const onMouseUp = () => {
      isDragging = false
    }

    // 모바일 터치 대응
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      isDragging = true
      prevX = e.touches[0].clientX
      prevY = e.touches[0].clientY
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return
      const deltaX = e.touches[0].clientX - prevX
      const deltaY = e.touches[0].clientY - prevY
      
      camTheta -= deltaX * 0.01
      camPhi -= deltaY * 0.01
      
      prevX = e.touches[0].clientX
      prevY = e.touches[0].clientY
      
      updateCameraPosition()
    }

    canvas.addEventListener("mousedown", onMouseDown)
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
    canvas.addEventListener("touchstart", onTouchStart, { passive: true })
    window.addEventListener("touchmove", onTouchMove, { passive: true })
    window.addEventListener("touchend", onMouseUp)

    // 11. 60fps WebGL 실시간 렌더링 프레임 루프
    const animate = () => {
      const currentState = stateRef.current
      const currentWaferPos = waferPosRef.current

      // A. 각 관절 3차원 물리적 회전 대입
      // 1축 수평 회전 (360도 선회)
      baseRotGroup.rotation.y = (currentState.base * Math.PI) / 180

      // 2축 수직 회전 (Shoulder)
      shoulderRotGroup.rotation.z = (currentState.shoulder * Math.PI) / 180

      // 3축 관절 회전 (Elbow)
      elbowRotGroup.rotation.z = (currentState.elbow * Math.PI) / 180

      // B. 그리퍼 클로 양옆 클램핑 모션
      const clawOffset = currentState.gripperOpen ? 0.15 : 0.025
      clawLeft.position.x = -clawOffset
      clawRight.position.x = clawOffset

      // C. 3D 에너지 공(구체) 위치 의존성 렌더링 (그리핑 시 집게 사이 물리 안착 계산 반영)
      if (currentWaferPos === "source") {
        // 소스 거치대 중심 위 안착 (거치대 높이 0.08 + 공 반지름 0.20 = Y=0.28에 정확히 얹힘)
        waferMesh.position.set(srcX, 0.28, srcZ)
        waferMesh.rotation.set(0, 0, 0)
        if (waferMesh.parent !== scene) {
          scene.attach(waferMesh)
        }
      } else if (currentWaferPos === "destination") {
        // 도착 거치대 중심 위 안착
        waferMesh.position.set(destX, 0.28, destZ)
        waferMesh.rotation.set(0, 0, 0)
        if (waferMesh.parent !== scene) {
          scene.attach(waferMesh)
        }
      } else if (currentWaferPos === "gripper") {
        // 그리퍼 헤드 자식 노드로 접착
        if (waferMesh.parent !== gripperGroup) {
          gripperGroup.add(waferMesh)
        }
        // 집게 클로 사이 중심 부분 높이 매핑 (Y 오프셋 보정)
        waferMesh.position.set(0, 0.22, 0)
        waferMesh.rotation.set(0, 0, 0)
      }

      // 실시간 3D 씬 상의 진짜 절대 월드 유클리디안 거리 계측 및 센서 록 제어
      const gripperWorldPos = new THREE.Vector3()
      gripperTipAnchor.getWorldPosition(gripperWorldPos)

      const sourcePos = new THREE.Vector3(srcX, 0.28, srcZ)
      const destPos = new THREE.Vector3(destX, 0.28, destZ)

      const realDistToSource = gripperWorldPos.distanceTo(sourcePos)
      const realDistToDest = gripperWorldPos.distanceTo(destPos)

      // 3D 씬 상의 진짜 찰진 도킹 허용 임계치 (눈으로 보기에 완전히 근접하는 0.35 유닛 이내)
      const REAL_DOCKING_THRESHOLD = 0.35

      const nearSrc = currentWaferPos === "source" && realDistToSource <= REAL_DOCKING_THRESHOLD
      const nearDst = currentWaferPos === "destination" && realDistToDest <= REAL_DOCKING_THRESHOLD

      isNearSourceRef.current = nearSrc
      isNearDestRef.current = nearDst

      const isReady = nearSrc || nearDst
      if (isReady !== isGrabReadyRef.current) {
        isGrabReadyRef.current = isReady
        setRealGrabReady(isReady)
      }

      // 실시간 절대 3D 거리를 시각화용 mm 스케일로 환산 (Three.js 1유닛 = 100mm)
      const nearestDistVal = Math.round(Math.min(realDistToSource, realDistToDest) * 100)
      const text = `${nearestDistVal} mm`
      if (text !== distanceTextRef.current) {
        distanceTextRef.current = text
        setRealDistanceText(text)
      }

      renderer.render(scene, camera)
      animFrameRef.current = window.requestAnimationFrame(animate)
    }

    animate()

    // 12. 반응형 캔버스 크기 제어
    const handleResize = () => {
      if (!containerRef.current) return
      width = containerRef.current.clientWidth
      height = containerRef.current.clientHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }

    const resizeObserver = new ResizeObserver(() => {
      handleResize()
    })
    resizeObserver.observe(container)

    return () => {
      if (animFrameRef.current) window.cancelAnimationFrame(animFrameRef.current)
      
      canvas.removeEventListener("mousedown", onMouseDown)
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
      canvas.removeEventListener("touchstart", onTouchStart)
      window.removeEventListener("touchmove", onTouchMove)
      window.removeEventListener("touchend", onMouseUp)
      
      resizeObserver.disconnect()

      // 메모리 해제
      baseGeo.dispose()
      shoulderJointGeo.dispose()
      link1Geo.dispose()
      elbowJointGeo.dispose()
      link2Geo.dispose()
      wristGeo.dispose()
      clawLeftGeo.dispose()
      clawRightGeo.dispose()
      waferGeo.dispose()
      trayGeo.dispose()

      baseMat.dispose()
      jointMat.dispose()
      linkMat.dispose()
      glowMat.dispose()
      trayMat.dispose()

      renderer.dispose()
    }
  }, [])

  // 수동 각도 조절기
  const handleSliderChange = (joint: keyof Omit<VisualizerState, "gripperOpen">, value: number) => {
    if (isAutoRunning) return
    setState((prev) => ({
      ...prev,
      [joint]: value,
    }))
    setStepMessage(`3D 제어축 기동: ${joint.toUpperCase()} = ${value}°`)
  }

  // 그리퍼 작동 (비전 유도 스마트 정렬 및 자동 도킹 기능이 탑재된 고도화 제어 모듈)
  const toggleGripper = () => {
    if (isAutoRunning) return
    
    const nearSrc = isNearSourceRef.current
    const nearDst = isNearDestRef.current
    const currentBase = stateRef.current.base
    const currentWaferPos = waferPosRef.current

    setState((prev) => {
      const nextOpen = !prev.gripperOpen
      
      if (!nextOpen) {
        // 집기 작동: 그리퍼가 닫힐 때 근접 센서 확인 후 스마트 자동 도킹 수행
        if (nearSrc) {
          setWaferPosition("gripper")
          setStepMessage("비전 정렬 성공! - Source 트레이에서 스마트 흡착 완료.")
          // 관절각을 집기 최적화 각도로 자동 스냅/정렬
          return {
            ...prev,
            shoulder: 45,
            elbow: 65,
            gripperOpen: false,
          }
        } else if (nearDst) {
          setWaferPosition("gripper")
          setStepMessage("비전 정렬 성공! - Destination 트레이에서 스마트 흡착 완료.")
          // 관절각을 집기 최적화 각도로 자동 스냅/정렬
          return {
            ...prev,
            shoulder: 35,
            elbow: 55,
            gripperOpen: false,
          }
        } else {
          setStepMessage(`정렬 실패 (실제 3D 거리: ${distanceTextRef.current} / 제한: 35 mm) - 그리퍼 끝을 에너지 구체 가까이 조준하십시오.`)
          return prev // 변경 없음
        }
      } else {
        // 놓기 작동: 그리퍼가 열릴 때 제품을 현재 선회각에 따라 안전 방출
        if (currentWaferPos === "gripper") {
          if (currentBase <= -30 || currentBase > 150) {
            setWaferPosition("destination")
            setStepMessage("제품 방출 완료 - Destination 트레이에 입체 적재.")
          } else {
            setWaferPosition("source")
            setStepMessage("제품 방출 완료 - Source 트레이에 안전 적재.")
          }
        }
      }
      
      return {
        ...prev,
        gripperOpen: nextOpen,
      }
    })
  }

  // 홈 설정 복귀
  const resetToHome = () => {
    if (isAutoRunning) {
      stopAutoRun()
    }
    setState(INITIAL_STATE)
    setWaferPosition("source")
    setStepMessage("3D 조작 관절 및 에너지 3D 구체의 위치가 리셋되었습니다.")
  }

  // 자동 운전 비상 정지
  const stopAutoRun = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    if (animFrameRef.current) window.cancelAnimationFrame(animFrameRef.current)
    setIsAutoRunning(false)
    setCurrentStepIndex(-1)
    setStepMessage("자동화 시퀀스가 비상 정지(E-STOP) 처리되었습니다.")
  }

  // 자동 공정 루틴
  const runSequenceStep = (index: number) => {
    if (index >= AUTO_RUN_STEPS.length) {
      setIsAutoRunning(false)
      setCurrentStepIndex(-1)
      setStepMessage("3D 비전 센싱 가상 에너지 구체 적재 완료.")
      return
    }

    setCurrentStepIndex(index)
    const step = AUTO_RUN_STEPS[index]
    setStepMessage(step.name)

    const startState = { ...state }
    const targetState = {
      base: step.base,
      shoulder: step.shoulder,
      elbow: step.elbow,
      gripperOpen: step.gripperOpen,
    }

    const startTime = performance.now()
    const easeInOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t)

    const animateAngles = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / (step.duration - 150), 1)
      const easedProgress = easeInOutQuad(progress)

      setState({
        base: startState.base + (targetState.base - startState.base) * easedProgress,
        shoulder: startState.shoulder + (targetState.shoulder - startState.shoulder) * easedProgress,
        elbow: startState.elbow + (targetState.elbow - startState.elbow) * easedProgress,
        gripperOpen: targetState.gripperOpen,
      })

      if (index === 2) {
        setWaferPosition("gripper")
      } else if (index === 6) {
        setWaferPosition("destination")
      }

      if (progress < 1) {
        animFrameRef.current = window.requestAnimationFrame(animateAngles)
      }
    }

    animFrameRef.current = window.requestAnimationFrame(animateAngles)

    timerRef.current = window.setTimeout(() => {
      runSequenceStep(index + 1)
    }, step.duration)
  }

  const startAutoRun = () => {
    if (isAutoRunning) return
    setIsAutoRunning(true)
    setWaferPosition("source")
    runSequenceStep(0)
  }

  return (
    <div className="robotic-sandbox">
      <div className="sandbox-card">
        {/* 상단 타이틀 */}
        <div className="sandbox-header">
          <div className="title-area">
            <Cpu className="icon-pulse" />
            <div>
              <h3>Factory 3D Motion Visualizer</h3>
              <p>Three.js WebGL 고휘도 크롬 3D 시뮬레이터</p>
            </div>
          </div>
          <div className={`status-badge ${isAutoRunning ? "badge-active" : "badge-manual"}`}>
            <Activity className={isAutoRunning ? "spin-pulse" : ""} />
            <span>{isAutoRunning ? "3D AUTO RUNNING" : "3D MANUAL MODE"}</span>
          </div>
        </div>

        {/* 3D WebGL 스크린 */}
        <div className="sandbox-screen" ref={containerRef}>
          {/* 수치 데이터 계측 대시보드 */}
          <div className="coordinate-overlay">
            <div className="telemetry-item">
              <span className="label">3D X:</span>
              <span className="value font-mono">{cartesianX} mm</span>
            </div>
            <div className="telemetry-item">
              <span className="label">3D Y:</span>
              <span className="value font-mono">{cartesianY} mm</span>
            </div>
            <div className="telemetry-item">
              <span className="label">3D Z:</span>
              <span className="value font-mono">{cartesianZ} mm</span>
            </div>
            <div className="telemetry-item">
              <span className="label">3D DIST:</span>
              <span className="value font-mono">{realDistanceText}</span>
            </div>
            <div className="telemetry-item">
              <span className="label">SENSOR:</span>
              {realGrabReady ? (
                <span className="value font-mono blinking" style={{ color: "oklch(0.7 0.12 142)" }}>● DOCK READY</span>
              ) : waferPosition === "gripper" ? (
                <span className="value font-mono" style={{ color: "oklch(0.68 0.2 229)" }}>● GRIPPED</span>
              ) : (
                <span className="value font-mono" style={{ color: "oklch(0.58 0.22 27)" }}>○ OFFLINE</span>
              )}
            </div>
          </div>

          {/* 조작 설명 플로팅 아이콘 */}
          <div className="canvas-instruction font-mono">
            <Move size={12} />
            <span>3D 드래그: 화면 시점 회전</span>
          </div>

          <canvas ref={canvasRef} className="arm-3d-canvas" />

          {/* 셸 콘솔 바 */}
          <div className="sandbox-console font-mono">
            <span className="prompt">SYS_LOG &gt; </span>
            <span className="text">{stepMessage}</span>
          </div>
        </div>

        {/* 제어 패널 */}
        <div className="sandbox-controls">
          <div className="control-tabs">
            <button className="tab-active">
              <Sliders size={14} />
              <span>3D 기구학 관절 조작반</span>
            </button>
            <div className="controls-group-status">
              {isAutoRunning && <span className="text-pulse">자동 운전 기동 중 조작 컨트롤 비활성화</span>}
            </div>
          </div>

          <div className="sliders-container">
            {/* 1축 Base 회전 - 360도 전방위 선회로 변경 */}
            <div className="slider-row">
              <div className="slider-meta">
                <label htmlFor="base-slider">1축 Base 수평 선회 (360° 전방위)</label>
                <span className="value font-mono">{Math.round(state.base)}°</span>
              </div>
              <input
                id="base-slider"
                type="range"
                min="-180"
                max="180"
                value={Math.round(state.base)}
                onChange={(e) => handleSliderChange("base", Number(e.target.value))}
                disabled={isAutoRunning}
                className="arm-slider"
                aria-valuemin={-180}
                aria-valuemax={180}
                aria-valuenow={Math.round(state.base)}
              />
            </div>

            {/* 2축 Shoulder 회전 */}
            <div className="slider-row">
              <div className="slider-meta">
                <label htmlFor="shoulder-slider">2축 Shoulder 수직 굽힘</label>
                <span className="value font-mono">{Math.round(state.shoulder)}°</span>
              </div>
              <input
                id="shoulder-slider"
                type="range"
                min="-30"
                max="90"
                value={Math.round(state.shoulder)}
                onChange={(e) => handleSliderChange("shoulder", Number(e.target.value))}
                disabled={isAutoRunning}
                className="arm-slider"
                aria-valuemin={-30}
                aria-valuemax={90}
                aria-valuenow={Math.round(state.shoulder)}
              />
            </div>

            {/* 3축 Elbow 회전 */}
            <div className="slider-row">
              <div className="slider-meta">
                <label htmlFor="elbow-slider">3축 Elbow 관절 신장</label>
                <span className="value font-mono">{Math.round(state.elbow)}°</span>
              </div>
              <input
                id="elbow-slider"
                type="range"
                min="0"
                max="130"
                value={Math.round(state.elbow)}
                onChange={(e) => handleSliderChange("elbow", Number(e.target.value))}
                disabled={isAutoRunning}
                className="arm-slider"
                aria-valuemin={0}
                aria-valuemax={130}
                aria-valuenow={Math.round(state.elbow)}
              />
            </div>
          </div>

          {/* 제어반 버튼 그룹 */}
          <div className="action-buttons">
            <button
              type="button"
              className={`btn-action btn-gripper ${!state.gripperOpen ? "btn-active-glow" : ""} ${realGrabReady ? "btn-ready-glow" : ""}`}
              onClick={toggleGripper}
              disabled={isAutoRunning}
            >
              {!state.gripperOpen ? "공압 패드 해제 (Release)" : "3D 공 흡착 (Vacuum)"}
            </button>

            <button
              type="button"
              className="btn-action btn-reset"
              onClick={resetToHome}
              aria-label="관절 상태 원위치 복귀"
            >
              <RotateCcw size={15} />
              <span>원위치</span>
            </button>

            {!isAutoRunning ? (
              <button
                type="button"
                className="btn-action btn-autorun"
                onClick={startAutoRun}
                aria-label="자동 공정 기동 시작"
              >
                <Play size={15} />
                <span>비전 자동공정 (Auto Run)</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn-action btn-stop"
                onClick={stopAutoRun}
                aria-label="자동 공정 긴급 정지"
              >
                <div className="stop-icon" />
                <span>비상정지 (Stop)</span>
              </button>
            )}
          </div>
        </div>

        {/* 하단 기동 공정 프로그래스 바 */}
        {currentStepIndex >= 0 && (
          <div className="sequence-roadmap">
            <div className="step-progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${((currentStepIndex + 1) / AUTO_RUN_STEPS.length) * 100}%` }}
              />
            </div>
            <div className="roadmap-meta">
              <span className="step-count">자동화 공정 단계 {currentStepIndex + 1} / {AUTO_RUN_STEPS.length}</span>
              <span className="step-badge"><CheckCircle size={10} /> 3D 제어축 선회 중</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
