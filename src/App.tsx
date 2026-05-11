import { type FormEvent, useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  ArrowUpRight,
  Factory,
  Mail,
  Menu,
  MessageSquareText,
  MoveRight,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react"

import { getPortfolioSupabase, isSupabaseConfigured, type SupabasePost } from "@/lib/supabase"

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

const LOCAL_POSTS_KEY = "aurora-robotics-posts"
const assetPath = (path: string) => `${import.meta.env.BASE_URL}${path}`.replace(/\/+/g, "/")

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
    summary: "비전 인식과 협동 로봇을 연결해 반복 공정을 자동화하는 생산 라인 시스템.",
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
    summary: "실내외 자율주행 로봇을 활용해 물류, 장비 이동, 캠퍼스 안내를 지원하는 플랫폼.",
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
    summary: "센서 데이터와 카메라를 결합해 설비 이상을 조기에 감지하는 검사 자동화 솔루션.",
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

  return (
    <div className="site-shell">
      <Header />
      <main>
        {detailSystem ? (
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

function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const closeMenu = () => setIsMenuOpen(false)

  return (
    <header className="site-header">
      <a className="brand" href="#home" aria-label="AURORA Robotics 홈으로 이동" onClick={closeMenu}>
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
        <div>
          <h1 id="hero-title">
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
      <h2 id="solutions-title">We exist to make useful robots possible.</h2>
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
        <h2 id="systems-title">Robotic systems created where change becomes inevitable by design.</h2>
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
        <h2 id="approach-title">Growing robotics by redefining operation.</h2>
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
  const [posts, setPosts] = useState<Post[]>(() => readLocalPosts())
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [author, setAuthor] = useState("")
  const [content, setContent] = useState("")
  const [status, setStatus] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null)

  const supabase = useMemo(() => getPortfolioSupabase(), [])
  const isFormValid = title.trim() && author.trim() && content.trim()
  const boardStatus =
    status ||
    (!supabase
      ? "Supabase 설정 전에는 이 브라우저에 임시 저장되는 로컬 게시판으로 동작합니다."
      : "Supabase 실시간 게시판이 연결되었습니다.")

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
      setStatus("Supabase에서 게시글을 불러왔습니다.")
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!isFormValid) {
      setStatus("제목, 작성자, 내용을 모두 입력하세요.")
      return
    }

    setIsSubmitting(true)
    setStatus("")

    const newPost: Post = {
      id: crypto.randomUUID(),
      title: title.trim(),
      author: author.trim(),
      content: content.trim(),
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

        setStatus("Supabase 게시글이 등록되었습니다.")
      } else {
        const nextPosts = [newPost, ...posts]
        setPosts(nextPosts)
        localStorage.setItem(LOCAL_POSTS_KEY, JSON.stringify(nextPosts))
        setStatus("로컬 공지 게시판에 게시글이 등록되었습니다.")
      }

      setTitle("")
      setAuthor("")
      setContent("")
      setIsComposerOpen(false)
    } catch {
      setStatus("등록에 실패했습니다. Supabase 테이블과 권한을 확인하세요.")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(postId: string) {
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

  return (
    <section className="news-section" id="board" aria-labelledby="board-title">
      <div className="section-heading">
        <span className="section-label">Company Notice</span>
        <h2 id="board-title">공지 게시판</h2>
      </div>
      <div className="board-toolbar">
        <p>제품 소식, 시연 일정, 기술 업데이트를 한곳에서 확인합니다.</p>
        <button
          type="button"
          className="compose-toggle"
          onClick={() => setIsComposerOpen((isOpen) => !isOpen)}
          aria-expanded={isComposerOpen}
          aria-controls="board-composer"
        >
          {isComposerOpen ? <X aria-hidden="true" /> : <Plus aria-hidden="true" />}
          {isComposerOpen ? "닫기" : "글쓰기"}
        </button>
      </div>
      {isComposerOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="board-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="composer-title"
            id="board-composer"
          >
            <div className="modal-header">
              <div>
                <span className="section-label">Write Notice</span>
                <h3 id="composer-title">공지 글쓰기</h3>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setIsComposerOpen(false)}
                aria-label="글쓰기 창 닫기"
              >
                <X aria-hidden="true" />
              </button>
            </div>
            <form className="board-form" onSubmit={handleSubmit}>
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
                rows={6}
              />
              <button type="submit" disabled={isSubmitting}>
                <Send aria-hidden="true" />
                {isSubmitting ? "등록 중" : "공지 등록"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
      <div className="board-layout">
        <div className="post-panel" aria-live="polite">
          {boardStatus ? (
            <p className="form-status" role="status">
              {boardStatus}
            </p>
          ) : null}
          {posts.length > 0 ? (
            posts.map((post) => (
              <article className="post-card" key={post.id}>
                <div className="post-card-header">
                  <div>
                    <h3>{post.title}</h3>
                    <span>{post.author}</span>
                  </div>
                  <button
                    type="button"
                    className="delete-post-button"
                    onClick={() => void handleDelete(post.id)}
                    disabled={deletingPostId === post.id}
                    aria-label={`${post.title} 삭제`}
                  >
                    <Trash2 aria-hidden="true" />
                    {deletingPostId === post.id ? "삭제 중" : "삭제"}
                  </button>
                </div>
                <p>{post.content}</p>
              </article>
            ))
          ) : (
            <div className="empty-state">
              <MessageSquareText aria-hidden="true" />
              <h3>아직 등록된 공지가 없습니다</h3>
              <p>글쓰기 버튼을 눌러 제품 소식, 시연 일정, 기술 업데이트를 등록할 수 있습니다.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function ContactSection() {
  return (
    <footer className="contact-section" id="contact" aria-labelledby="contact-title">
      <div>
        <span className="section-label">Build With Us</span>
        <h2 id="contact-title">Design the next movement with AURORA Robotics.</h2>
      </div>
      <div className="contact-links">
        <a href="mailto:hello@aurora-robotics.example">
          <Mail aria-hidden="true" />
          hello@aurora-robotics.example
        </a>
        <a href="#systems">
          <Factory aria-hidden="true" />
          솔루션 보기
        </a>
      </div>
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

function mapSupabasePosts(posts: SupabasePost[]): Post[] {
  return posts.map((post) => ({
    id: post.id,
    title: post.title,
    content: post.content,
    author: post.author,
    createdAt: post.created_at,
  }))
}

export default App
