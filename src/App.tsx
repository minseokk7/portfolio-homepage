import { type FormEvent, type MouseEvent, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  ArrowUpRight,
  Bot,
  Factory,
  Mail,
  Menu,
  MessageSquareText,
  MoveRight,
  Send,
  Trash2,
  X,
} from "lucide-react"

import {
  getPortfolioSupabase,
  isSupabaseConfigured,
  type SupabaseContactMessage,
  type SupabasePost,
} from "@/lib/supabase"

type Post = {
  id: string
  title: string
  content: string
  author: string
  createdAt?: string
}

type SystemItem = {
  slug: string
  name: string
  summary: string
  detail: string
  image: string
  imageAlt: string
  services: string[]
  specs: string[]
}

type AdminRateLimit = {
  attempts: number
  lockedUntil: number
}

type ContactMessage = {
  id: string
  name: string
  email: string
  message: string
  source: string
  createdAt: string
}

const LOCAL_POSTS_KEY = "aurora-robotics-posts"
const ADMIN_RATE_LIMIT_KEY = "aurora-admin-rate-limit"
const assetPath = (path: string) => `${import.meta.env.BASE_URL}${path}`.replace(/\/+/g, "/")
const adminHash = normalizeAdminHash(import.meta.env.VITE_ADMIN_HASH)
const adminSessionMinutes = getAdminSessionMinutes(import.meta.env.VITE_ADMIN_SESSION_MINUTES)
const adminLoginMaxAttempts = getPositiveInteger(import.meta.env.VITE_ADMIN_LOGIN_MAX_ATTEMPTS, 5, 1, 10)
const adminLoginLockoutMinutes = getPositiveInteger(import.meta.env.VITE_ADMIN_LOGIN_LOCKOUT_MINUTES, 15, 1, 60)

const navItems = [
  ["Solutions", "solutions"],
  ["Systems", "systems"],
  ["Approach", "approach"],
  ["Board", "board"],
  ["Contact", "contact"],
] as const

const systems: SystemItem[] = [
  {
    slug: "factory-motion",
    name: "Factory Motion",
    summary: "비전 인식과 협동 로봇을 연결한 생산 자동화 시스템.",
    detail:
      "Factory Motion은 제품 위치 인식, 로봇 팔 제어, 작업자 안전 구역 감지를 하나의 흐름으로 연결합니다. 반복 조립, 부품 정렬, 품질 검사처럼 시간이 많이 드는 공정을 안정적으로 처리하도록 설계했습니다.",
    image: assetPath("images/robot-inspection.png"),
    imageAlt: "AI 비전 검사 장비와 로봇 그리퍼가 있는 자동화 검사 스테이션",
    services: ["Robot Arm", "Vision AI", "Line Control", "Safety Layer"],
    specs: ["카메라 기반 위치 추정", "협동 로봇 작업 경로 제어", "작업자 접근 감지", "라인 상태 대시보드"],
  },
  {
    slug: "campus-delivery",
    name: "Campus Delivery",
    summary: "실내외 이동과 물류 안내를 지원하는 자율주행 플랫폼.",
    detail:
      "Campus Delivery는 교육기관, 연구소, 사무 공간에서 작은 물품을 이동시키는 자율주행 로봇 서비스입니다. 지도 생성, 경로 계획, 원격 관제 화면을 포함해 실제 공간에서 운영 가능한 형태를 목표로 합니다.",
    image: assetPath("images/robot-delivery.png"),
    imageAlt: "스마트 팩토리 복도에서 화물을 운반하는 자율주행 로봇",
    services: ["AMR", "Mapping", "Fleet UI", "Telemetry"],
    specs: ["실내 지도 생성", "장애물 회피", "배송 상태 추적", "다중 로봇 관제"],
  },
  {
    slug: "inspection-core",
    name: "Inspection Core",
    summary: "센서와 카메라로 설비 이상을 감지하는 검사 솔루션.",
    detail:
      "Inspection Core는 카메라, 조명, 센서 데이터를 결합해 설비와 제품의 이상 징후를 확인합니다. 검사 결과는 기록으로 남고, 운영자는 문제 발생 지점을 빠르게 파악할 수 있습니다.",
    image: assetPath("images/robot-operations.png"),
    imageAlt: "로봇 운영 데이터를 보여주는 관제실과 로봇 프로토타입",
    services: ["Edge AI", "Sensors", "Dashboard", "Report"],
    specs: ["불량 이미지 분류", "센서 이상 탐지", "검사 이력 저장", "운영 리포트 생성"],
  },
]

const principles = [
  "현장에서 바로 쓰이는 자동화",
  "사람과 함께 일하는 안전 설계",
  "데이터로 개선되는 로봇 운영",
]

function App() {
  const [route, setRoute] = useState(() => window.location.hash)

  useEffect(() => {
    const handleHashChange = () => setRoute(window.location.hash)
    window.addEventListener("hashchange", handleHashChange)
    return () => window.removeEventListener("hashchange", handleHashChange)
  }, [])

  useEffect(() => {
    if (adminHash && route === adminHash) {
      window.scrollTo({ top: 0, behavior: "auto" })
      return
    }

    if (route.startsWith("#notice-")) {
      window.scrollTo({ top: 0, behavior: "auto" })
      return
    }

    if (route.startsWith("#detail-")) {
      window.scrollTo({ top: 0, behavior: "auto" })
      return
    }

    if (!route || route === "#home") {
      return
    }

    window.requestAnimationFrame(() => {
      document.getElementById(route.slice(1))?.scrollIntoView({ behavior: "auto", block: "start" })
    })
  }, [route])

  const detailSlug = route.startsWith("#detail-") ? route.replace("#detail-", "") : ""
  const detailSystem = systems.find((system) => system.slug === detailSlug)
  const noticeId = route.startsWith("#notice-") ? route.replace("#notice-", "") : ""
  const isAdminRoute = Boolean(adminHash && route === adminHash)

  return (
    <div className="site-shell">
      <CustomCursor />
      <Header adminHash={adminHash} />
      <main>
        {isAdminRoute ? (
          <AdminPage />
        ) : noticeId ? (
          <NoticeDetailPage postId={noticeId} />
        ) : detailSystem ? (
          <DetailPage system={detailSystem} />
        ) : (
          <>
            <HeroSection />
            <AmbitionSection />
            <SystemsSection />
            <ApproachSection />
            <BoardSection />
            <ContactSection />
          </>
        )}
      </main>
    </div>
  )
}

function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const finePointer = window.matchMedia("(any-pointer: fine)")

    if (!finePointer.matches) {
      return
    }

    const cursor = cursorRef.current

    if (!cursor) {
      return
    }

    let animationFrame = 0
    let x = window.innerWidth / 2
    let y = window.innerHeight / 2
    let isInteractive = false

    const moveCursor = () => {
      cursor.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`
      animationFrame = 0
    }

    const requestMove = () => {
      if (!animationFrame) {
        animationFrame = window.requestAnimationFrame(moveCursor)
      }
    }

    const handlePointerMove = (event: PointerEvent) => {
      x = event.clientX
      y = event.clientY
      cursor.classList.add("is-visible")
      requestMove()
    }

    const handlePointerOver = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null
      const nextInteractive = Boolean(target?.closest("a, button, input, textarea, .focus-in-contract"))

      if (nextInteractive !== isInteractive) {
        isInteractive = nextInteractive
        cursor.classList.toggle("is-interactive", nextInteractive)
      }
    }

    const handlePointerDown = () => cursor.classList.add("is-pressed")
    const handlePointerUp = () => cursor.classList.remove("is-pressed")
    const handlePointerLeave = () => cursor.classList.remove("is-visible", "is-interactive", "is-pressed")

    document.documentElement.classList.add("custom-cursor-enabled")
    window.addEventListener("pointermove", handlePointerMove, { passive: true })
    window.addEventListener("pointerover", handlePointerOver, { passive: true })
    window.addEventListener("pointerdown", handlePointerDown, { passive: true })
    window.addEventListener("pointerup", handlePointerUp, { passive: true })
    document.addEventListener("mouseleave", handlePointerLeave)

    return () => {
      document.documentElement.classList.remove("custom-cursor-enabled")
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerover", handlePointerOver)
      window.removeEventListener("pointerdown", handlePointerDown)
      window.removeEventListener("pointerup", handlePointerUp)
      document.removeEventListener("mouseleave", handlePointerLeave)
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame)
      }
    }
  }, [])

  return <div className="custom-cursor" ref={cursorRef} aria-hidden="true" />
}

function Header({ adminHash }: { adminHash: string }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const adminClickRef = useRef({ count: 0, startedAt: 0 })

  const closeMenu = () => setIsMenuOpen(false)

  const handleBrandClick = (event: MouseEvent<HTMLAnchorElement>) => {
    closeMenu()

    if (!adminHash) {
      return
    }

    const now = Date.now()
    const adminClicks = adminClickRef.current

    if (now - adminClicks.startedAt > 1800) {
      adminClicks.count = 0
      adminClicks.startedAt = now
    }

    adminClicks.count += 1

    if (adminClicks.count >= 5) {
      event.preventDefault()
      adminClicks.count = 0
      adminClicks.startedAt = 0
      window.location.hash = adminHash
    }
  }

  return (
    <header className="site-header">
      <a className="brand" href="#home" aria-label="AURORA Robotics 홈으로 이동" onClick={handleBrandClick}>
        AURORA Robotics
      </a>
      <nav className="desktop-nav" aria-label="주요 메뉴">
        {navItems.map(([label, id]) => (
          <a key={id} href={`#${id}`}>
            {label}
          </a>
        ))}
      </nav>
      <button
        type="button"
        className="mobile-menu-button"
        onClick={() => setIsMenuOpen((isOpen) => !isOpen)}
        aria-expanded={isMenuOpen}
        aria-controls="mobile-menu"
        aria-label="모바일 메뉴 열기"
      >
        {isMenuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
      </button>
      {isMenuOpen ? (
        <nav className="mobile-nav" id="mobile-menu" aria-label="모바일 주요 메뉴">
          {navItems.map(([label, id]) => (
            <a key={id} href={`#${id}`} onClick={closeMenu}>
              {label}
            </a>
          ))}
        </nav>
      ) : null}
    </header>
  )
}

function HeroSection() {
  return (
    <section className="hero-section" id="home" aria-labelledby="hero-title">
      <div className="hero-field" aria-hidden="true" />
      <div className="hero-content hero-content--text-only">
        <div className="hero-lockup">
          <div className="hero-intro-icon" aria-hidden="true">
            <Bot />
          </div>
          <h1 id="hero-title" className="focus-in-contract">
            Building Robots,
            <br />
            Moving Futures
          </h1>
          <p>
            로봇 자동화, 인공지능 비전, 자율주행 플랫폼을 연결해 산업 현장과 일상 공간의 움직임을 새롭게
            설계하는 로봇 기술 회사입니다.
          </p>
        </div>
      </div>
    </section>
  )
}

function AmbitionSection() {
  return (
    <section className="statement-section" id="solutions" aria-labelledby="solutions-title">
      <span className="section-label">Purpose</span>
      <h2 id="solutions-title">Useful robots for real-world work.</h2>
      <div className="statement-grid">
        <p>
          AURORA Robotics는 단순히 로봇을 소개하는 회사가 아니라, 문제를 정의하고 자동화 구조를 설계한 뒤
          실제 운영 가능한 시스템으로 구현하는 팀입니다.
        </p>
        <ul>
          {principles.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function SystemsSection() {
  return (
    <section className="work-section" id="systems" aria-labelledby="systems-title">
      <div className="section-heading">
        <span className="section-label">Selected Systems</span>
        <h2 id="systems-title">Selected robotic systems.</h2>
      </div>
      <div className="system-list">
        {systems.map((system) => (
          <article className="system-row" key={system.name}>
            <figure>
              <img src={system.image} alt={system.imageAlt} />
            </figure>
            <div>
              <h3>{system.name}</h3>
              <p>{system.summary}</p>
            </div>
            <ul aria-label={`${system.name} 구성 기술`}>
              {system.services.map((service) => (
                <li key={service}>{service}</li>
              ))}
            </ul>
            <a href={`#detail-${system.slug}`} aria-label={`${system.name} 자세한 내용 보기`}>
              <ArrowUpRight aria-hidden="true" />
            </a>
          </article>
        ))}
      </div>
    </section>
  )
}

function DetailPage({ system }: { system: SystemItem }) {
  return (
    <section className="detail-page" aria-labelledby="detail-title">
      <a className="back-link" href="#systems">
        <ArrowLeft aria-hidden="true" />
        시스템 목록으로 돌아가기
      </a>
      <span className="section-label">System Detail</span>
      <div className="detail-hero">
        <div>
          <h1 id="detail-title">{system.name}</h1>
          <p className="detail-lead">{system.detail}</p>
        </div>
        <figure className="detail-visual">
          <img src={system.image} alt={system.imageAlt} />
        </figure>
      </div>
      <div className="detail-grid">
        <article>
          <h2>핵심 기능</h2>
          <ul>
            {system.specs.map((spec) => (
              <li key={spec}>{spec}</li>
            ))}
          </ul>
        </article>
        <article>
          <h2>적용 분야</h2>
          <p>
            제조 현장, 연구실, 학교 실습실, 물류 공간처럼 반복 작업과 데이터 확인이 필요한 환경에 적용할 수
            있습니다.
          </p>
        </article>
      </div>
      <a className="detail-cta" href="#board">
        게시판 확인하기
        <MoveRight aria-hidden="true" />
      </a>
    </section>
  )
}

function ApproachSection() {
  return (
    <section className="approach-section" id="approach" aria-labelledby="approach-title">
      <div>
        <span className="section-label">Approach</span>
        <h2 id="approach-title">Robotics shaped around real operations.</h2>
      </div>
      <div className="approach-copy">
        <p>
          로봇 회사 홈페이지는 기술이 어렵게 보이는 순간 설득력을 잃습니다. 그래서 이 사이트는 New Studio처럼
          큰 메시지와 명확한 섹션 흐름을 사용해 회사의 목적, 제품, 운영 방식, 게시판을 순서대로 보여줍니다.
        </p>
        <a className="text-link" href="#board">
          게시판 보기
          <MoveRight aria-hidden="true" />
        </a>
      </div>
    </section>
  )
}

function BoardSection() {
  const { posts, status } = useNoticePosts()
  const boardStatus = status || "관리자 페이지에서 등록한 공지사항을 확인할 수 있습니다."

  return (
    <section className="news-section" id="board" aria-labelledby="board-title">
      <div className="section-heading">
        <span className="section-label">Notice</span>
        <h2 id="board-title">Notice Board</h2>
      </div>
      <div className="board-toolbar">
        <p>제품 소식, 시연 일정, 기술 업데이트를 한곳에서 확인합니다.</p>
      </div>
      <div className="board-layout">
        <div className="post-panel" aria-live="polite">
          {boardStatus ? (
            <p className="form-status" role="status">
              {boardStatus}
            </p>
          ) : null}
          {posts.length > 0 ? (
            posts.map((post) => (
              <article className="post-card post-card--public" key={post.id}>
                <div className="post-meta">
                  <span>{post.author}</span>
                  {post.createdAt ? <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time> : null}
                </div>
                <div className="post-content">
                  <h3>
                    <a href={`#notice-${post.id}`}>{post.title}</a>
                  </h3>
                  <p>{post.content}</p>
                </div>
              </article>
            ))
          ) : (
            <div className="empty-state">
              <MessageSquareText aria-hidden="true" />
              <h3>아직 등록된 공지가 없습니다</h3>
              <p>관리자 페이지에서 제품 소식, 시연 일정, 기술 업데이트를 등록할 수 있습니다.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function NoticeDetailPage({ postId }: { postId: string }) {
  const { posts, status } = useNoticePosts()
  const post = posts.find((currentPost) => currentPost.id === postId)

  return (
    <section className="notice-detail-page" aria-labelledby="notice-detail-title">
      <a className="back-link" href="#board">
        <ArrowLeft aria-hidden="true" />
        게시판으로 돌아가기
      </a>
      <span className="section-label">Notice Detail</span>
      {post ? (
        <>
          <div className="notice-detail-heading">
            <h1 id="notice-detail-title">{post.title}</h1>
            <div className="notice-detail-meta">
              <span>{post.author}</span>
              {post.createdAt ? <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time> : null}
            </div>
          </div>
          <article className="notice-detail-body">
            {post.content.split("\n").map((line, index) => (
              <p key={`${post.id}-${index}`}>{line || "\u00a0"}</p>
            ))}
          </article>
        </>
      ) : (
        <div className="empty-state notice-detail-empty">
          <MessageSquareText aria-hidden="true" />
          <h1 id="notice-detail-title">공지사항을 찾을 수 없습니다</h1>
          <p>{status || "게시글이 삭제되었거나 아직 불러오는 중입니다."}</p>
        </div>
      )}
    </section>
  )
}

function AdminPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loginMessage, setLoginMessage] = useState("")
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAuthReady, setIsAuthReady] = useState(() => !isSupabaseConfigured)
  const [rateLimit, setRateLimit] = useState(() => readAdminRateLimit())
  const [now, setNow] = useState(() => Date.now())
  const [title, setTitle] = useState("")
  const [author, setAuthor] = useState("")
  const [content, setContent] = useState("")

  const supabase = useMemo(() => getPortfolioSupabase(), [])
  const { posts, status, isSubmitting, deletingPostId, submitPost, deletePost } = useNoticePosts()
  const {
    contacts,
    status: contactStatus,
    deletingContactId,
    deleteContact,
  } = useContactMessages(isAuthenticated)
  const isFormValid = title.trim() && author.trim() && content.trim()
  const lockoutRemainingMs = Math.max(0, rateLimit.lockedUntil - now)
  const isLoginLocked = lockoutRemainingMs > 0
  const remainingAttempts = Math.max(0, adminLoginMaxAttempts - rateLimit.attempts)

  useEffect(() => {
    if (!supabase) {
      return
    }

    let isMounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return
      }

      setIsAuthenticated(Boolean(data.session))
      setIsAuthReady(true)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session))
      setIsAuthReady(true)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  useEffect(() => {
    if (!supabase) {
      return
    }

    return () => {
      void supabase.auth.signOut()
    }
  }, [supabase])

  useEffect(() => {
    if (!supabase || !isAuthenticated) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void supabase.auth.signOut().then(() => {
        setLoginMessage("관리자 세션 시간이 만료되었습니다. 다시 로그인하세요.")
      })
    }, adminSessionMinutes * 60 * 1000)

    return () => window.clearTimeout(timeoutId)
  }, [isAuthenticated, supabase])

  useEffect(() => {
    if (!isLoginLocked) {
      return
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [isLoginLocked])

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!supabase) {
      setLoginMessage("Supabase 환경변수가 설정되지 않았습니다.")
      return
    }

    if (isLoginLocked) {
      setLoginMessage(`로그인 시도가 너무 많습니다. ${formatRemainingTime(lockoutRemainingMs)} 후 다시 시도하세요.`)
      return
    }

    if (!email.trim() || !password) {
      setLoginMessage("관리자 이메일과 비밀번호를 입력하세요.")
      return
    }

    setLoginMessage("")

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      const nextRateLimit = recordFailedAdminLogin(rateLimit)
      setRateLimit(nextRateLimit)

      if (nextRateLimit.lockedUntil > Date.now()) {
        setNow(Date.now())
        setLoginMessage(
          `로그인 실패가 ${adminLoginMaxAttempts}회 누적되어 ${adminLoginLockoutMinutes}분 동안 잠겼습니다.`,
        )
      } else {
        setLoginMessage(`Supabase 관리자 로그인을 확인하세요. 남은 시도: ${Math.max(0, remainingAttempts - 1)}회`)
      }

      return
    }

    clearAdminRateLimit()
    setRateLimit(readAdminRateLimit())
    setPassword("")
  }

  async function handleLogout() {
    await supabase?.auth.signOut()
    setPassword("")
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const ok = await submitPost({
      title: title.trim(),
      author: author.trim(),
      content: content.trim(),
    })

    if (ok) {
      setTitle("")
      setAuthor("")
      setContent("")
    }
  }

  if (!isAuthReady || !isAuthenticated) {
    return (
      <section className="admin-page" aria-labelledby="admin-login-title">
        <a className="back-link" href="#home">
          <ArrowLeft aria-hidden="true" />
          홈으로 돌아가기
        </a>
        <div className="admin-login-card">
          <span className="section-label">Admin Access</span>
          <h1 id="admin-login-title">관리자 로그인</h1>
          <p>
            공지 게시판 글쓰기는 Supabase 관리자 계정으로 로그인한 뒤 사용할 수 있습니다. 관리자 세션은{" "}
            {adminSessionMinutes}분 뒤 자동 종료됩니다.
          </p>
          <form className="admin-login-form" onSubmit={handleLogin}>
            <label htmlFor="admin-email">관리자 이메일</label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
            />
            <label htmlFor="admin-password">관리자 비밀번호</label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
            <button type="submit" disabled={isLoginLocked}>
              {isLoginLocked ? `${formatRemainingTime(lockoutRemainingMs)} 후 재시도` : "관리자 페이지 열기"}
            </button>
          </form>
          {loginMessage ? (
            <p className="form-status" role="status">
              {loginMessage}
            </p>
          ) : null}
        </div>
      </section>
    )
  }

  return (
    <section className="admin-page" aria-labelledby="admin-title">
      <a className="back-link" href="#board">
        <ArrowLeft aria-hidden="true" />
        게시판으로 돌아가기
      </a>
      <div className="admin-heading">
        <div>
          <span className="section-label">Admin Console</span>
          <h1 id="admin-title">Notice Manager</h1>
          <p className="admin-session-note">{adminSessionMinutes}분 뒤 자동 로그아웃됩니다.</p>
        </div>
        <button type="button" className="admin-logout-button" onClick={() => void handleLogout()}>
          로그아웃
        </button>
      </div>
      <div className="admin-grid">
        <form className="board-form admin-compose" onSubmit={handleSubmit}>
          <label htmlFor="post-title">공지 제목</label>
          <input
            id="post-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="예: 자율주행 로봇 데모 공개"
          />
          <label htmlFor="post-author">작성자</label>
          <input
            id="post-author"
            value={author}
            onChange={(event) => setAuthor(event.target.value)}
            placeholder="AURORA Lab"
          />
          <label htmlFor="post-content">내용</label>
          <textarea
            id="post-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="공지 내용을 입력하세요"
            rows={7}
          />
          <button type="submit" disabled={isSubmitting || !isFormValid}>
            <Send aria-hidden="true" />
            {isSubmitting ? "등록 중" : "공지 등록"}
          </button>
        </form>
        <div className="admin-posts" aria-live="polite">
          {status ? (
            <p className="form-status" role="status">
              {status}
            </p>
          ) : null}
          {posts.length > 0 ? (
            posts.map((post) => (
              <article className="post-card" key={post.id}>
                <div className="post-meta">
                  <span>{post.author}</span>
                </div>
                <div className="post-content">
                  <h3>{post.title}</h3>
                  <p>{post.content}</p>
                </div>
                <button
                  type="button"
                  className="delete-post-button"
                  onClick={() => void deletePost(post.id)}
                  disabled={deletingPostId === post.id}
                  aria-label={`${post.title} 삭제`}
                  title="삭제"
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </article>
            ))
          ) : (
            <div className="empty-state">
              <MessageSquareText aria-hidden="true" />
              <h3>아직 등록된 공지가 없습니다</h3>
              <p>왼쪽 작성 영역에서 첫 공지를 등록할 수 있습니다.</p>
            </div>
          )}
        </div>
      </div>
      <section className="admin-contacts" aria-labelledby="admin-contacts-title">
        <div>
          <span className="section-label">Contact Inbox</span>
          <h2 id="admin-contacts-title">Contact Messages</h2>
        </div>
        <div className="admin-contact-list" aria-live="polite">
          {contactStatus ? (
            <p className="form-status" role="status">
              {contactStatus}
            </p>
          ) : null}
          {contacts.length > 0 ? (
            contacts.map((contact) => (
              <article className="contact-card" key={contact.id}>
                <div className="post-meta">
                  <span>{contact.name}</span>
                  <time dateTime={contact.createdAt}>{formatDate(contact.createdAt)}</time>
                </div>
                <div>
                  <h3>{contact.email}</h3>
                  <p>{contact.message}</p>
                </div>
                <button
                  type="button"
                  className="delete-post-button"
                  onClick={() => void deleteContact(contact.id)}
                  disabled={deletingContactId === contact.id}
                  aria-label={`${contact.name} 문의 삭제`}
                  title="삭제"
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </article>
            ))
          ) : (
            <div className="empty-state">
              <Mail aria-hidden="true" />
              <h3>아직 접수된 문의가 없습니다</h3>
              <p>홈페이지 문의 폼으로 접수된 메시지가 여기에 표시됩니다.</p>
            </div>
          )}
        </div>
      </section>
    </section>
  )
}

function useNoticePosts() {
  const [posts, setPosts] = useState<Post[]>(() => readLocalPosts())
  const [status, setStatus] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null)

  const supabase = useMemo(() => getPortfolioSupabase(), [])

  useEffect(() => {
    if (!supabase) {
      return
    }

    const supabaseClient = supabase
    let isMounted = true

    async function loadPosts() {
      const { data, error } = await supabaseClient
        .from("posts")
        .select("id,title,content,author,created_at")
        .order("created_at", { ascending: false })

      if (!isMounted) {
        return
      }

      if (error) {
        setStatus("게시글을 불러오지 못했습니다. Supabase 테이블과 권한을 확인하세요.")
        return
      }

      setPosts(mapSupabasePosts(data ?? []))
      setStatus("")
    }

    void loadPosts()

    const channel = supabaseClient
      .channel("posts-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "posts",
        },
        () => {
          void loadPosts()
        },
      )
      .subscribe()

    return () => {
      isMounted = false
      void supabaseClient.removeChannel(channel)
    }
  }, [supabase])

  async function submitPost(postInput: Pick<Post, "title" | "author" | "content">) {
    if (!postInput.title || !postInput.author || !postInput.content) {
      setStatus("제목, 작성자, 내용을 모두 입력하세요.")
      return false
    }

    setIsSubmitting(true)
    setStatus("")

    const newPost: Post = {
      id: crypto.randomUUID(),
      title: postInput.title,
      author: postInput.author,
      content: postInput.content,
      createdAt: new Date().toISOString(),
    }

    try {
      if (supabase && isSupabaseConfigured) {
        const { error } = await supabase.from("posts").insert({
          title: newPost.title,
          author: newPost.author,
          content: newPost.content,
        })

        if (error) {
          throw error
        }

        setStatus("공지 게시글이 등록되었습니다.")
      } else {
        const nextPosts = [newPost, ...posts]
        setPosts(nextPosts)
        localStorage.setItem(LOCAL_POSTS_KEY, JSON.stringify(nextPosts))
        setStatus("로컬 공지 게시판에 게시글이 등록되었습니다.")
      }

      return true
    } catch {
      setStatus("등록에 실패했습니다. Supabase 테이블과 권한을 확인하세요.")
      return false
    } finally {
      setIsSubmitting(false)
    }
  }

  async function deletePost(postId: string) {
    if (!window.confirm("이 공지를 삭제할까요?")) {
      return
    }

    setDeletingPostId(postId)
    setStatus("")

    try {
      if (supabase && isSupabaseConfigured) {
        const { error } = await supabase.from("posts").delete().eq("id", postId)

        if (error) {
          throw error
        }

        setPosts((currentPosts) => currentPosts.filter((post) => post.id !== postId))
        setStatus("공지 게시글이 삭제되었습니다.")
      } else {
        const nextPosts = posts.filter((post) => post.id !== postId)
        setPosts(nextPosts)
        localStorage.setItem(LOCAL_POSTS_KEY, JSON.stringify(nextPosts))
        setStatus("로컬 공지 게시글이 삭제되었습니다.")
      }
    } catch {
      setStatus("삭제에 실패했습니다. Supabase 삭제 권한을 확인하세요.")
    } finally {
      setDeletingPostId(null)
    }
  }

  return { posts, status, isSubmitting, deletingPostId, submitPost, deletePost }
}

function useContactMessages(isEnabled: boolean) {
  const [contacts, setContacts] = useState<ContactMessage[]>([])
  const [status, setStatus] = useState("")
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null)
  const supabase = useMemo(() => getPortfolioSupabase(), [])

  useEffect(() => {
    if (!supabase || !isEnabled) {
      return
    }

    const supabaseClient = supabase
    let isMounted = true

    async function loadContacts() {
      const { data, error } = await supabaseClient
        .from("contacts")
        .select("id,name,email,message,source,created_at")
        .order("created_at", { ascending: false })

      if (!isMounted) {
        return
      }

      if (error) {
        setStatus("문의 목록을 불러오지 못했습니다. contacts RLS 정책을 확인하세요.")
        return
      }

      setContacts(mapSupabaseContacts((data ?? []) as SupabaseContactMessage[]))
      setStatus("")
    }

    void loadContacts()

    const channel = supabaseClient
      .channel("contacts-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contacts" },
        () => {
          void loadContacts()
        },
      )
      .subscribe()

    return () => {
      isMounted = false
      void supabaseClient.removeChannel(channel)
    }
  }, [isEnabled, supabase])

  async function deleteContact(contactId: string) {
    if (!supabase) {
      return
    }

    setDeletingContactId(contactId)

    const { error } = await supabase.from("contacts").delete().eq("id", contactId)

    if (error) {
      setStatus("문의 삭제에 실패했습니다. contacts 삭제 권한을 확인하세요.")
    } else {
      setContacts((currentContacts) => currentContacts.filter((contact) => contact.id !== contactId))
      setStatus("문의가 삭제되었습니다.")
    }

    setDeletingContactId(null)
  }

  return { contacts, status, deletingContactId, deleteContact }
}

function ContactSection() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [status, setStatus] = useState("")
  const [isSending, setIsSending] = useState(false)
  const isContactFormValid = name.trim() && email.trim() && message.trim()

  async function handleContactSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!isContactFormValid) {
      setStatus("이름, 이메일, 문의 내용을 모두 입력하세요.")
      return
    }

    const supabase = getPortfolioSupabase()
    const subject = encodeURIComponent(`[AURORA Robotics] ${name.trim()}님의 문의`)
    const body = encodeURIComponent(`이름: ${name.trim()}\n이메일: ${email.trim()}\n\n${message.trim()}`)

    if (!supabase) {
      setStatus("Supabase 설정이 없어 메일 앱으로 문의를 전환합니다.")
      window.location.href = `mailto:hello@aurora-robotics.example?subject=${subject}&body=${body}`
      return
    }

    setIsSending(true)
    setStatus("")

    const { error } = await supabase.from("contacts").insert({
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
      source: "website",
    })

    setIsSending(false)

    if (error) {
      setStatus("문의 저장에 실패했습니다. 잠시 후 다시 시도하거나 이메일로 문의하세요.")
      return
    }

    setName("")
    setEmail("")
    setMessage("")
    setStatus("문의가 접수되었습니다. 확인 후 연락드리겠습니다.")
  }

  return (
    <footer className="contact-section" id="contact" aria-labelledby="contact-title">
      <div>
        <span className="section-label">Build With Us</span>
        <h2 id="contact-title">Design the next movement with AURORA Robotics.</h2>
        <div className="contact-info" aria-label="Contact information">
          <div>
            <span>Email</span>
            <strong>hello@aurora-robotics.example</strong>
          </div>
          <div>
            <span>Response</span>
            <strong>Within 2 business days</strong>
          </div>
          <div>
            <span>Focus</span>
            <strong>Automation, AMR, vision robotics</strong>
          </div>
        </div>
      </div>
      <form className="contact-form" onSubmit={handleContactSubmit}>
        <label htmlFor="contact-name">이름</label>
        <input id="contact-name" value={name} onChange={(event) => setName(event.target.value)} />
        <label htmlFor="contact-email">이메일</label>
        <input
          id="contact-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <label htmlFor="contact-message">문의 내용</label>
        <textarea
          id="contact-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={5}
        />
        <button type="submit" disabled={isSending || !isContactFormValid}>
          <Mail aria-hidden="true" />
          {isSending ? "전송 중" : "문의 보내기"}
        </button>
        <a className="contact-inline-link" href="#systems">
          <Factory aria-hidden="true" />
          솔루션 보기
        </a>
        {status ? (
          <p className="contact-status" role="status">
            {status}
          </p>
        ) : null}
      </form>
    </footer>
  )
}

function readLocalPosts(): Post[] {
  try {
    const rawPosts = localStorage.getItem(LOCAL_POSTS_KEY)
    return rawPosts ? (JSON.parse(rawPosts) as Post[]) : []
  } catch {
    return []
  }
}

function readAdminRateLimit(): AdminRateLimit {
  try {
    const rawRateLimit = localStorage.getItem(ADMIN_RATE_LIMIT_KEY)

    if (!rawRateLimit) {
      return { attempts: 0, lockedUntil: 0 }
    }

    const parsedRateLimit = JSON.parse(rawRateLimit) as Partial<AdminRateLimit>
    const nextRateLimit = {
      attempts: Number(parsedRateLimit.attempts) || 0,
      lockedUntil: Number(parsedRateLimit.lockedUntil) || 0,
    }

    if (nextRateLimit.lockedUntil <= Date.now()) {
      clearAdminRateLimit()
      return { attempts: 0, lockedUntil: 0 }
    }

    return nextRateLimit
  } catch {
    return { attempts: 0, lockedUntil: 0 }
  }
}

function recordFailedAdminLogin(currentRateLimit: AdminRateLimit): AdminRateLimit {
  const attempts = currentRateLimit.lockedUntil > 0 && currentRateLimit.lockedUntil <= Date.now() ? 1 : currentRateLimit.attempts + 1
  const lockedUntil = attempts >= adminLoginMaxAttempts ? Date.now() + adminLoginLockoutMinutes * 60 * 1000 : 0
  const nextRateLimit = { attempts, lockedUntil }

  localStorage.setItem(ADMIN_RATE_LIMIT_KEY, JSON.stringify(nextRateLimit))
  return nextRateLimit
}

function clearAdminRateLimit() {
  localStorage.removeItem(ADMIN_RATE_LIMIT_KEY)
}

function mapSupabasePosts(posts: SupabasePost[]): Post[] {
  return posts.map((post) => ({
    id: post.id,
    title: post.title,
    content: post.content,
    author: post.author,
    createdAt: post.created_at,
  }))
}

function mapSupabaseContacts(contacts: SupabaseContactMessage[]): ContactMessage[] {
  return contacts.map((contact) => ({
    id: contact.id,
    name: contact.name,
    email: contact.email,
    message: contact.message,
    source: contact.source,
    createdAt: contact.created_at,
  }))
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value))
}

function normalizeAdminHash(value: string | undefined) {
  const trimmedValue = value?.trim()

  if (!trimmedValue) {
    return ""
  }

  return trimmedValue.startsWith("#") ? trimmedValue : `#${trimmedValue}`
}

function getAdminSessionMinutes(value: string | undefined) {
  return getPositiveInteger(value, 10, 1, 60)
}

function getPositiveInteger(value: string | undefined, fallback: number, min: number, max: number) {
  const parsedValue = Number(value)

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallback
  }

  return Math.max(min, Math.min(max, Math.round(parsedValue)))
}

function formatRemainingTime(milliseconds: number) {
  const totalSeconds = Math.max(1, Math.ceil(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes <= 0) {
    return `${seconds}초`
  }

  return `${minutes}분 ${seconds.toString().padStart(2, "0")}초`
}

export default App
