# AURORA Robotics Homepage

New Studio 스타일을 참고해 제작한 가상 로봇 회사 홈페이지입니다.

## Local Development

```bash
npm install
npm run dev
```

GitHub Pages 프로젝트 페이지 경로를 로컬에서 확인하려면 빌드 후 preview를 실행합니다.

```bash
npm run build
npm run preview
```

## Supabase

Supabase 게시판을 사용하려면 `.env.example`을 참고해 `.env`를 만들고 값을 채웁니다.

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Supabase SQL Editor에서 `supabase/posts.sql`을 실행하면 게시판 테이블과 기본 공개 읽기/쓰기 정책이 생성됩니다.

## GitHub Pages

이 프로젝트는 `portfolio-homepage` 저장소 기준으로 Vite `base`가 `/portfolio-homepage/`로 설정되어 있습니다.

1. GitHub에 `portfolio-homepage` 저장소를 만듭니다.
2. 이 프로젝트를 push합니다.
3. 저장소 Settings > Pages에서 Source를 `GitHub Actions`로 설정합니다.
4. Supabase를 배포 환경에서도 쓰려면 저장소 Secrets에 `.env.example`과 같은 이름의 값을 등록합니다.
