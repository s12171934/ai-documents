# 배포 가이드

이 저장소는 세 가지 대상을 각각 다른 플랫폼에 배포합니다.

- `apps/server`: Cloudflare Workers
- `apps/client`: Cloudflare Pages
- `apps/cli`: npm 패키지 `@s-dante/cli`

## GitHub Actions

| 워크플로 | 파일 | 실행 조건 | 역할 |
| --- | --- | --- | --- |
| Deploy Cloudflare Apps | `.github/workflows/deploy-cloudflare.yml` | `main` 브랜치 push, 수동 실행 | 전체 빌드 후 server Worker와 client Pages 배포 |
| Publish CLI | `.github/workflows/publish-cli.yml` | `cli-v*` 태그 push, 수동 실행 | CLI 빌드 후 `@s-dante/cli`를 npm에 publish |

## GitHub Secrets

GitHub 저장소의 **Settings → Secrets and variables → Actions → Secrets**에 아래 값을 추가합니다.

| Secret | 사용 위치 | 설명 |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | client/server 배포 | Wrangler가 Cloudflare 리소스를 배포하기 위해 사용하는 API 토큰 |
| `CLOUDFLARE_ACCOUNT_ID` | client/server 배포 | Workers, Pages, R2, KV, Durable Object가 속한 Cloudflare 계정 ID |
| `NPM_TOKEN` | CLI publish | `@s-dante/cli`를 npm에 publish할 수 있는 npm 토큰 |

## GitHub Variables

GitHub 저장소의 **Settings → Secrets and variables → Actions → Variables**에 아래 값을 추가합니다.

| Variable | 사용 위치 | 예시 | 설명 |
| --- | --- | --- | --- |
| `CLOUDFLARE_PAGES_PROJECT_NAME` | client 배포 | `ai-documents-client` | Cloudflare Pages 프로젝트 이름 |
| `VITE_API_BASE_URL` | client 빌드 | `https://ai-documents-server.<account>.workers.dev` | Vite 클라이언트 빌드에 포함될 공개 server Worker URL |

## 애플리케이션 설정

클라이언트는 서버 주소를 화면에 매번 입력하지 않도록 환경변수를 사용합니다. CLI는 홈 디렉터리의 `.dante-config` 파일에 서버 주소를 저장합니다.

| 환경변수 | 사용 위치 | 예시 | 설명 |
| --- | --- | --- | --- |
| `VITE_API_BASE_URL` | `apps/client` | `https://ai-documents-server.<account>.workers.dev` | 클라이언트가 문서 목록과 HTML 문서를 가져올 server Worker URL |
| `VAPID_PUBLIC_KEY` | `apps/server` | `BD...` | 브라우저 Push API 구독에 사용하는 공개 VAPID 키 |
| `VAPID_PRIVATE_KEY` | `apps/server` | `w4...` | server Worker가 웹푸시 payload를 서명/암호화할 때 사용하는 비밀 VAPID 키 |
| `VAPID_SUBJECT` | `apps/server` | `mailto:admin@example.com` | 푸시 서비스에 전달할 연락처 식별자 |

## 배포 서버 추가 설정

웹푸시 자동 갱신을 사용하려면 배포된 server Worker에 VAPID 설정을 추가해야 합니다. 이 값이 없으면 클라이언트의 `/push/vapid-public-key` 요청이 `503 Service Unavailable`로 응답하고, 브라우저 Push API 구독이 생성되지 않습니다.

### 1. VAPID 키 생성

배포 환경마다 한 쌍의 VAPID 키를 생성합니다. 공개키와 비밀키는 함께 쓰는 한 쌍이므로, 공개키만 바꾸거나 비밀키만 바꾸면 기존 브라우저 구독이 깨질 수 있습니다.

```bash
npx web-push generate-vapid-keys
```

생성 결과에서 아래 값을 사용합니다.

| 생성값 | 저장 위치 |
| --- | --- |
| `Public Key` | `VAPID_PUBLIC_KEY` |
| `Private Key` | `VAPID_PRIVATE_KEY` |

### 2. Cloudflare Worker Secret 추가

`apps/server` 디렉터리에서 배포 대상 Worker에 secret을 등록합니다.

```bash
cd apps/server
wrangler secret put VAPID_PUBLIC_KEY
wrangler secret put VAPID_PRIVATE_KEY
wrangler secret put VAPID_SUBJECT
```

`VAPID_SUBJECT`는 푸시 서비스가 운영자에게 연락할 수 있는 식별자입니다. 보통 아래처럼 설정합니다.

```text
mailto:admin@example.com
```

### 3. 클라이언트 서버 주소 확인

Cloudflare Pages 또는 GitHub Actions Variable에 `VITE_API_BASE_URL`이 배포된 server Worker 주소로 설정되어 있어야 합니다.

```text
VITE_API_BASE_URL=https://ai-documents-server.<account>.workers.dev
```

이 값이 로컬 주소나 다른 Worker를 가리키면 클라이언트가 잘못된 서버에 구독을 등록하거나 문서를 요청합니다.

### 4. 재배포와 확인

secret과 Pages 변수를 변경한 뒤 server Worker와 client Pages를 다시 배포합니다. 배포 후 아래 요청이 200으로 응답하면 VAPID 공개키 설정이 정상입니다.

```bash
curl -i https://ai-documents-server.<account>.workers.dev/push/vapid-public-key
```

정상 응답 예시:

```json
{"publicKey":"BD..."}
```

로컬 개발에서는 `apps/server/.dev.vars`에 같은 값을 넣을 수 있습니다. `.dev.vars`는 비밀값을 포함하므로 git에 커밋하지 않습니다.

로컬 개발에서는 클라이언트 예시 파일을 복사해 사용합니다.

```bash
cp apps/client/.env.example apps/client/.env
```

프로덕션 클라이언트는 GitHub Variable `VITE_API_BASE_URL`을 통해 빌드 시 값이 주입됩니다.

CLI는 npm으로 설치한 뒤 `dante init`으로 서버 주소를 저장합니다.

```bash
dante init --server-url https://ai-documents-server.<account>.workers.dev
dante save test-document.html --id test-document
```

## Cloudflare 리소스

첫 프로덕션 배포 전에 아래 리소스를 Cloudflare에 만들어 둡니다.

| 리소스 | 설정 위치 | 비고 |
| --- | --- | --- |
| Worker | `apps/server/wrangler.toml` | 현재 이름은 `ai-documents-server` |
| R2 bucket | `apps/server/wrangler.toml` | 현재 bucket 이름은 `ai-documents-html` |
| KV namespace | `apps/server/wrangler.toml` | `replace-with-document-metadata-kv-id`를 실제 namespace id로 교체해야 함 |
| Durable Object | `apps/server/wrangler.toml` | Wrangler migration을 통해 생성됨 |
| Pages project | GitHub Variable | `CLOUDFLARE_PAGES_PROJECT_NAME`과 이름이 같아야 함 |

## Cloudflare API Token 생성

1. Cloudflare Dashboard를 엽니다.
2. **My Profile → API Tokens**로 이동합니다.
3. 이 저장소에서 사용할 custom token을 생성합니다.
4. 대상 계정에 대해 아래 권한을 부여합니다.
   - Workers Scripts edit access
   - Workers KV Storage edit access
   - R2 edit access
   - Cloudflare Pages edit access
   - Account read access
5. 생성된 토큰을 복사해 GitHub Secret `CLOUDFLARE_API_TOKEN`으로 저장합니다.

Cloudflare의 GitHub Actions 예시는 `cloudflare/wrangler-action`에 `apiToken`과 `accountId`를 전달하는 방식입니다. 이 저장소의 workflow도 같은 방식을 사용합니다.

## Cloudflare Account ID 확인

1. Cloudflare Dashboard에서 대상 계정을 엽니다.
2. 계정 overview 또는 sidebar에서 account id를 복사합니다.
3. GitHub Secret `CLOUDFLARE_ACCOUNT_ID`로 저장합니다.

## Cloudflare Pages 프로젝트 생성

Cloudflare Pages에 `CLOUDFLARE_PAGES_PROJECT_NAME`과 같은 이름의 프로젝트를 생성합니다.

workflow는 GitHub Actions에서 이미 빌드된 디렉터리를 아래 명령으로 배포합니다.

```bash
wrangler pages deploy apps/client/dist --project-name=$CLOUDFLARE_PAGES_PROJECT_NAME
```

## npm Token 생성

1. npmjs.com을 엽니다.
2. 프로필 메뉴에서 **Access Tokens**로 이동합니다.
3. 패키지 또는 scope에 publish 권한이 있는 토큰을 생성합니다.
4. GitHub Secret `NPM_TOKEN`으로 저장합니다.

CLI publish workflow는 `NODE_AUTH_TOKEN` 환경변수에 `NPM_TOKEN`을 넣고 `npm publish`를 실행합니다.

## CLI 배포

CLI를 배포하기 전에 아래 절차를 진행합니다.

1. `apps/cli/package.json`의 `version`을 새 버전으로 변경합니다.
2. 버전 변경을 commit합니다.
3. `cli-v*` 형식의 태그를 생성하고 push합니다.

예시:

```bash
git tag cli-v0.1.0
git push origin cli-v0.1.0
```

CLI 패키지는 scoped public 패키지로 배포됩니다.

```json
"publishConfig": {
  "access": "public"
}
```

배포 후 사용자는 아래처럼 설치하고 사용할 수 있습니다.

```bash
npm install -g @s-dante/cli
dante init --server-url https://your-worker-url
dante save test-document.html --id test-document
```

## 로컬 스모크 테스트

서버 실행:

```bash
bun --filter @ai-documents/server dev
```

클라이언트 실행:

```bash
bun --filter @ai-documents/client dev
```

문서 업로드:

```bash
bun apps/cli/src/index.ts init --server-url http://localhost:8787
bun apps/cli/src/index.ts save test-document.html --id test-document
```
