# 🔍 ĐÁP GIÁ KĨ CÀNG - SPORT TOURNAMENT PROJECT

## **PHẦN 1: KIẾN TRÚC & THIẾT KẾ BACKEND**

### **1.1 Anti-Pattern: Injection Repository Chung** ⚠️

**Vấn Đề Hiện Tại:**

Toàn bộ services inject `User` repository nhưng dùng nó như query runner chung cho mọi bảng:

```typescript
// ❌ StagesService, TeamsService, MatchesService, DashboardService...
@Injectable()
export class StagesService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findByTournament(tournamentId: number) {
    const rows = await this.usersRepository.query(`
      SELECT * FROM stages WHERE tournament_id = $1
    `, [tournamentId]);
  }
}
```

**Tại sao là Problem:**
- **Mất Type Safety:** `usersRepository` type là `Repository<User>` nhưng code query bảng `stages`
- **Gây Nhầm Lẫn:** Ai đọc code sẽ confused vì tên biến không match hành động thực tế
- **Khó Maintain:** Khó refactor, khó test vì dependency gây confusing
- **Trải Nghiệm Tệ:** IDE autocomplete & type hints hoàn toàn sai lệch

**Giải Pháp:**

```typescript
// ✅ Tạo entity + repository đúng
@Entity('stages')
export class Stage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'tournament_id' })
  tournamentId: number;
  
  // ... các column khác
}

// ✅ Inject repository đúng
@Injectable()
export class StagesService {
  constructor(
    @InjectRepository(Stage)
    private readonly stagesRepository: Repository<Stage>,
  ) {}

  async findByTournament(tournamentId: number) {
    return this.stagesRepository.find({
      where: { tournamentId },
      order: { sortOrder: 'ASC' },
    });
  }
}
```

**Tác Động:** 🔴 CAO - Ảnh hưởng đến code clarity, maintainability, type safety

---

### **1.2 Phụ Thuộc Quá Nhiều Vào Raw SQL Queries**

**Vấn Đề:**

Services tránh TypeORM QueryBuilder, dùng raw SQL ở mọi nơi:

```typescript
// Matches, Dashboard, Tournament, Teams services đều vậy
const rows = await this.usersRepository.query(`
  SELECT m.id, m.tournament_id AS "tournamentId", ...
  FROM matches m
  JOIN tournaments t ON t.id = m.tournament_id
  WHERE ...
`);
```

**Hậu Quả:**
- ❌ Lỗi mapping: Phải convert type thủ công (`Number(row.id)`)
- ❌ String literals ở khắp nơi → khó refactor column names
- ❌ Không thể load relationships (mất lợi `.leftJoinAndSelect()`)
- ❌ WHERE logic phức tạp với string concatenation (trong `MatchesService.findAll`)

**Thực Tế:**
```typescript
// MatchesService dynamic WHERE clause - pattern fragile
const values: unknown[] = [];
const where: string[] = [];

if (filters.status && filters.status !== 'ALL') {
  values.push(filters.status.toUpperCase());
  where.push(`m.status = $${values.length}`);  // ← Cách này dễ lỗi
}

// Cách tốt hơn:
const queryBuilder = this.matchesRepository.createQueryBuilder('m')
  .where(filters.status && filters.status !== 'ALL' ? 'm.status = :status' : '1=1', 
    { status: filters.status?.toUpperCase() });
```

**Tác Động:** 🟡 TRUNG BÌNH - Chạy được nhưng khó maintain khi scale

---

### **1.3 Controllers Trống Hoặc Chưa Hoàn Thành**

| Controller | Trạng Thái | Vấn Đề |
|-----------|-----------|--------|
| `LeaderboardController` | 🔴 Trống | Không có `@Get()` endpoint lấy ranking |
| `PredictionsController` | 🔴 Trống | Không có endpoints tạo/xem predictions |
| Prediction features | ❌ Missing | `PredictionsService` không có methods |

```typescript
// ❌ LeaderboardController - hoàn toàn trống
@Controller('leaderboard')
export class LeaderboardController {}

// ❌ PredictionsController - hoàn toàn trống
@Controller('predictions')
export class PredictionsController {}

// ❌ PredictionsService - không có implementation
@Injectable()
export class PredictionsService {}
```

**Endpoints Cần Thiết:**
- `GET /leaderboard/:tournamentId` - Lấy ranking người chơi
- `POST /predictions` - Tạo prediction mới
- `GET /predictions/:matchId` - Lấy prediction của người dùng
- `PUT /predictions/:predictionId` - Update prediction

**Tác Động:** 🔴 TẠI TRỌNG - Core feature chưa hoàn thành

---

### **1.4 Không Có Global Error Handling**

**Trạng Thái Hiện Tại:**
- Controllers throw exception thủ công
- Không có format response error thống nhất
- Không có logging/monitoring

```typescript
// Mỗi controller handle error khác nhau
@Post('login')
async login(@Body() body: { email: string; password: string }) {
  const user = await this.authService.login(body.email, body.password);
  return { message: 'Login successful.', user, accessToken };
  // Nếu login fail, throw UnauthorizedException nhưng format inconsistent
}

@Get()
async findAll(@Headers('authorization') authorization: string | undefined) {
  await this.authService.verifyAdminToken(authorization);
  return this.usersService.findAll();
  // Không có try-catch, error tự bubble lên
}
```

**Giải Pháp: Global Exception Filter**
```typescript
// ✅ exception.filter.ts
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status = exception instanceof HttpException 
      ? exception.getStatus() 
      : 500;
    
    const message = exception instanceof Error 
      ? exception.message 
      : 'Internal server error';

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
```

**Tác Động:** 🟡 TRUNG BÌNH - API responses không consistent

---

### **1.5 Thiếu Input Validation & DTOs**

**Vấn Đề:**
```typescript
// ❌ Không validate request
@Post('admin/create')
async createPlayerByAdmin(
  @Headers('authorization') authorization: string | undefined,
  @Body()
  body: { email: string; fullName: string; role?: 'ADMIN' | 'PLAYER' },
) {
  // Không validate email format, độ dài fullName, enum role
  const user = await this.usersService.createPlayerByAdmin(body, admin.role);
}
```

**Thiếu:**
- Email format validation
- Constraint độ dài tên
- Validate enum role
- Không có `BadRequestException` cho invalid inputs

**Giải Pháp:**
```typescript
// ✅ validation.dto.ts
import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreatePlayerDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(2)
  fullName: string;

  @IsEnum(['ADMIN', 'PLAYER'])
  role?: 'ADMIN' | 'PLAYER';
}

// ✅ Trong controller
@Post('admin/create')
async createPlayerByAdmin(
  @Headers('authorization') authorization: string | undefined,
  @Body() body: CreatePlayerDto,  // Auto-validated bởi NestJS
) {
  // body đảm bảo valid
}
```

**Tác Động:** 🟡 TRUNG BÌNH - Không validate input, dễ bugs

---

### **1.6 Review Bảo Mật Authentication**

**✅ Điểm Tốt:**
- JWT với expiration 7 ngày ✓
- Google OAuth 2.0 implement đúng ✓
- Password hashing bằng bcrypt ✓
- Token verification trên protected routes ✓
- Role-based access control (SUPER_ADMIN, ADMIN, PLAYER) ✓

**⚠️ Vấn Đề:**
```typescript
// auth.service.ts - Email-based role override
const responseUser = {
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  role: normalizedEmail === ADMIN_EMAIL ? 'SUPER_ADMIN' : user.role,  // ❌ Nguy hiểm!
};
```

**Rủi Ro:** Nếu `ADMIN_EMAIL` thay đổi hoặc bị spoof, có thể privilege escalation.

**Cách Tốt Hơn:**
```typescript
// ✅ Luôn kiểm tra database role
return {
  ...responseUser,
  role: user.role,  // Chỉ dùng giá trị từ database
};
```

**Vấn Đề Khác:**
- ❌ Không có refresh token mechanism (JWT expire 7 ngày, user không thể stay logged in lâu dài)
- ❌ Không có token revocation/blacklist
- ❌ CORS config phụ thuộc env var - có thể expose private tournaments nếu sai

**Tác Động:** 🟡 TRUNG BÌNH - Có security concern

---

## **PHẦN 2: PHÂN TÍCH FRONTEND**

### **2.1 State Management & Architecture**

**Trạng Thái Hiện Tại:**
```typescript
// frontend/app/api.ts
export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const accessToken =
    typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  // ... fetch call
}
```

**Vấn Đề:**
- ❌ localStorage synchronous & block rendering
- ❌ Không có React Context cho auth state
- ❌ Không có provider/hook pattern (vd: `useAuth()`)
- ❌ Token stored trong localStorage (XSS vulnerability nếu eval() được dùng)

**Thiếu:**
- Auth context provider
- useAuth hook
- Protected route wrapper
- Redirect nếu không authenticated

**Ví Dụ:**
```typescript
// ✅ auth-context.tsx
'use client';
import { createContext, useContext } from 'react';
import type { CurrentUser } from './api';

type AuthContextType = {
  user: CurrentUser | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Load auth state từ localStorage/session
  return <AuthContext.Provider value={...}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
```

**Tác Động:** 🔴 CAO - Không có proper state management

---

### **2.2 Cấu Trúc Page & Routing**

**Trạng Thái Hiện Tại:**
```
frontend/app/
  page.tsx           → Redirect to login
  layout.tsx         → Root layout (metadata = "TWENTY-TECH Auth" - placeholder!)
  api.ts            → API helper
  globals.css       → Tailwind + dark theme
  login/            → ❓ (tồn tại dựa trên page.tsx import)
  admin/            → Admin dashboard (chi tiết, nhưng protected bằng cách nào?)
  notice-banner.tsx → Reusable notification component
```

**Vấn Đề:**
1. ❌ **Page `/` redirect to login** - Không có public dashboard sau login?
2. ❌ **Metadata chưa update** - "TWENTY-TECH Auth" là placeholder
3. ❌ **Protected routes không rõ** - Không có middleware/wrapper cho auth check
4. ❌ **Admin section visible?** - Admin section protected bằng cách nào?

**Cấu Trúc Mong Đợi:**
```
frontend/app/
  page.tsx              → Redirect to /login hoặc /dashboard
  layout.tsx            → Auth provider wrapper
  (auth)/
    layout.tsx          → Auth-only layout
    login/page.tsx      → Login page
    register/page.tsx   → Registration page
  (protected)/
    layout.tsx          → Protected route wrapper
    dashboard/page.tsx  → Player dashboard
    matches/page.tsx    → Browse matches
    predictions/page.tsx → View/make predictions
  admin/                → Admin pages
```

**Tác Động:** 🟡 TRUNG BÌNH - Navigation structure không rõ ràng

---

### **2.3 Chất Lượng Component**

**✅ Tốt:**
- `NoticeBanner.tsx` - Reusable notification component với proper typing
- Responsive design với dark theme
- Lucide React icons dùng tốt
- Tailwind CSS (v4) setup modern

**❌ Vấn Đề:**
```typescript
// ❌ NoticeBanner có tone classes hardcoded
const toneClass =
  tone === "success"
    ? "border-emerald-300/40 bg-emerald-950/90 text-emerald-100"
    : tone === "warning"
      ? "border-[#f4c95d80] bg-[#302713]/95 text-[#ffe8a3]"
      // ... repetitive và khó maintain
```

**Tốt Hơn:**
```typescript
// ✅ Dùng CSS variables hoặc constants
const toneStyles = {
  success: 'border-emerald-300/40 bg-emerald-950/90 text-emerald-100',
  warning: 'border-[#f4c95d80] bg-[#302713]/95 text-[#ffe8a3]',
  // ...
} as const;

const toneClass = toneStyles[tone] ?? toneStyles.info;
```

**Thiếu:**
- ❌ Không có form components (đã implement trong admin nhưng chưa export)
- ❌ Không có loading states/skeletons
- ❌ Không có error boundary
- ❌ ARIA labels minimal

**Tác Động:** 🟡 TRUNG BÌNH - Component library chưa đầy đủ

---

## **PHẦN 3: PHÂN TÍCH DATABASE SCHEMA**

### **3.1 Đánh Giá Chất Lượng Schema** ✅ TỐT

**Điểm Mạnh:**
```sql
-- ✅ Constraints đúng
CONSTRAINT chk_predictions_outcome CHECK (predicted_outcome IN ('HOME_WIN', 'DRAW', 'AWAY_WIN'))
CONSTRAINT chk_tournaments_sport_type CHECK (sport_type IN ('FOOTBALL', 'F1', 'LOL', 'OTHER'))

-- ✅ Unique constraints
UNIQUE (tournament_id, user_id)  -- predictions
UNIQUE (tournament_id, sort_order) -- stages
UNIQUE (tournament_id, name) -- teams

-- ✅ Cascading deletes
FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE

-- ✅ Indexes trên common queries
CREATE INDEX idx_predictions_match ON predictions(match_id);
CREATE INDEX idx_predictions_user ON predictions(user_id);
CREATE INDEX idx_matches_tournament_time ON matches(tournament_id, scheduled_time);

-- ✅ Views cho leaderboard
CREATE VIEW vw_leaderboard AS
  SELECT t.id AS tournament_id, u.id AS user_id, u.full_name,
         SUM(p.points_earned) AS total_points, ...
```

**⚠️ Vấn Đề Tiềm Ẩn:**

```sql
-- ⚠️ Lock logic trong application, không ở DB
-- Nên có trigger để enforce?
lock_minutes_before_start INTEGER NOT NULL DEFAULT 15,

-- ⚠️ Status hardcoded trong schema
-- PENDING, LIVE, FINISHED, CANCELLED
-- Nếu external API return status khác thì sao?
-- Giải pháp: Thêm sync_status column (đã có, tốt!)
```

**Missing Indexes:**
```sql
-- ⚠️ Không có index trên users.email (lookups by email thường xuyên)
CREATE INDEX idx_users_email_lower ON users(LOWER(email));

-- ⚠️ Không có composite index cho leaderboard queries
CREATE INDEX idx_leaderboard_tournament_user ON leaderboard_snapshots(tournament_id, user_id, snapshot_date DESC);
```

**Tác Động:** 🟢 THẤP - Schema tốt, chỉ cần minor index improvements

---

## **PHẦN 4: REVIEW THAY ĐỔI GẦN ĐÂY**

**PRs Mới Nhất (merged 2-7 ngày trước):**

| PR | Loại | Trạng Thái | Concern |
|----|------|-----------|----------|
| #65 "fix api teams tab" | Bug Fix | ✅ Merged | API endpoint cho teams |
| #64 "change default view after login" | Feature | ✅ Merged | Login flow |
| #63 "fix dashboard (tournament view)" | UI Fix | ✅ Merged | Dashboard layout |
| #62 "change UI dashboard" | UI | ✅ Merged | UI iteration |

**Pattern:** Rapid UI/bug fixes, nhưng **không có tests thêm vào**. Mỗi PR có 1 comment nhưng commits merged directly.

**Rủi Ro:** Accumulating tech debt với mỗi merge.

---

## **PHẦN 5: DEPLOYMENT & CI/CD**

### **Phân Tích render.yaml**

```yaml
services:
  - type: web
    name: sport-tournament-backend
    rootDir: backend
    buildCommand: npm ci --include=dev && npm run build
    startCommand: npm run start:prod
```

**✅ Tốt:**
- Backend service riêng
- Build & start commands đúng
- Environment variables configured

**❌ Vấn Đề:**
```yaml
envVars:
  - key: THESPORTSDB_API_KEY
    value: 123  # ❌ HARDCODED DEFAULT! Public security risk!

  - key: FOOTBALL_DATA_ORG_API_KEY
    sync: false  # ✅ Không sync, phải set thủ công

  - key: FRONTEND_URL
    sync: false  # ❌ Nếu không set, CORS sẽ fail
```

**Thiếu:**
- ❌ Không có health check endpoint configured
- ❌ Không có logs/monitoring
- ❌ Frontend deployment config không có trong file
- ❌ Không có auto-scaling hoặc resource limits

**Tác Động:** 🟡 TRUNG BÌNH - Deployment config chưa đầy đủ

---

## **PHẦN 6: CHIẾN LƯỢC TESTING**

| Layer | Coverage | Chất Lượng |
|-------|----------|----------|
| Unit Tests (Backend) | ~5-10% | ✅ Cấu trúc tốt, tests ít |
| E2E Tests | 0% | ❌ Không có |
| Frontend Tests | 0% | ❌ Không có |
| Integration Tests | 0% | ❌ Không có |

**Ví Dụ Test Tốt:**
```typescript
// dashboard.service.spec.ts
describe('DashboardService', () => {
  it('counts inactive and pending players separately', async () => {
    // Properly mocks repository
    const usersRepository = {
      query: queryMock,
    } as unknown as Repository<User>;
    const service = new DashboardService(usersRepository);
    
    const dashboard = await service.getDashboard({
      includeAttentionDetails: true,
    });

    expect(dashboard.stats.attentionNeeded).toBe(2);
  });
});
```

**Test Coverage Thiếu:**
- ❌ Auth flows (login, OAuth, token refresh)
- ❌ Tournament CRUD operations
- ❌ Prediction scoring logic
- ❌ API sync service (logic phức tạp, không có tests!)
- ❌ Frontend component tests
- ❌ User permission checks (CRITICAL!)

**Tác Động:** 🔴 TẠI TRỌNG - Không có test coverage cho core logic

---

## **PHẦN 7: PERFORMANCE & SCALABILITY**

### **Database Queries**

**Concern 1: Large JOIN queries**
```typescript
// TeamsService.findAll - complex nested query với CTEs
// Sẽ load toàn bộ tournament history
// Nên paginate?

// DashboardService - 6 concurrent queries mỗi lần getDashboard() được gọi
// Không có caching, recalculates metrics constantly
```

**Concern 2: Không có pagination trên matches**
```typescript
async findAll(filters) {
  const rows = await this.usersRepository.query(`...LIMIT 300`);
  // Hard-coded LIMIT 300 - chạy được bây giờ nhưng không scale
  // Nên support offset-based hoặc cursor-based pagination
}
```

**Giải Pháp:**
```typescript
async findAll(filters, page = 1, pageSize = 20) {
  const offset = (page - 1) * pageSize;
  const rows = await this.usersRepository.query(`
    ... LIMIT $${values.length + 1} OFFSET $${values.length + 2}
  `, [...values, pageSize, offset]);
  
  return { data: rows, page, pageSize, total: countResult };
}
```

**Concern 3: N+1 queries trong sports sync**
```typescript
// SportsApiSyncService có complex nested loops
// Có thể trigger hàng trăm queries cho single sync
// Nên dùng bulk insert/update operations
```

**Tác Động:** 🟡 TRUNG BÌNH - Scalability concerns ở volumes cao

---

## **🎯 TOP 10 VẤN ĐỀ TẠI TRỌNG THEO THỨ TỰ**

| # | Vấn Đề | Mức Độ | Effort | Tác Động |
|---|--------|--------|--------|----------|
| 1 | **Predictions feature chưa hoàn thành** | 🔴 TẠI TRỌNG | 4h | Core feature |
| 2 | **Generic repository anti-pattern** | 🔴 CAO | 8h | Type safety, maintainability |
| 3 | **Không có global error handling** | 🔴 CAO | 2h | API consistency |
| 4 | **Zero test coverage** | 🔴 CAO | 20h | Confidence trong changes |
| 5 | **Không có input validation/DTOs** | 🟡 TRUNG BÌNH | 3h | Data integrity |
| 6 | **Leaderboard endpoints missing** | 🟡 TRUNG BÌNH | 3h | Core feature |
| 7 | **Auth state management missing** | 🟡 TRUNG BÌNH | 6h | Frontend quality |
| 8 | **Không có protected route middleware** | 🟡 TRUNG BÌNH | 2h | Security |
| 9 | **Hardcoded API keys trong config** | 🟡 TRUNG BÌNH | 1h | Security |
| 10 | **Không có pagination support** | 🟡 TRUNG BÌNH | 4h | Scalability |

---

## **📋 ROADMAP TÁI CẤU TRÚC**

### **Phase 1: Security & Stability (Tuần 1)**
- [ ] Fix hardcoded `THESPORTSDB_API_KEY` trong render.yaml
- [ ] Thêm global exception filter
- [ ] Implement DTOs + class-validator
- [ ] Review email-based role check

### **Phase 2: Backend Architecture (Tuần 2-3)**
- [ ] Tạo entity classes cho Stage, Team, Match, Prediction, Leaderboard
- [ ] Thay generic User repository bằng specific repositories
- [ ] Convert raw SQL thành QueryBuilder ở những nơi có thể
- [ ] Implement leaderboard controller & service
- [ ] Implement predictions controller & endpoints

### **Phase 3: Frontend Structure (Tuần 3-4)**
- [ ] Thêm Auth context provider
- [ ] Tạo protected route wrapper
- [ ] Implement useAuth hook
- [ ] Thêm error boundary component
- [ ] Improve page routing structure

### **Phase 4: Testing & QA (Tuần 4-5)**
- [ ] Thêm unit tests cho services (target 60%+ coverage)
- [ ] Thêm E2E tests cho auth flows
- [ ] Thêm frontend component tests
- [ ] Document API endpoints (Swagger/OpenAPI)

### **Phase 5: Performance (Tuần 5-6)**
- [ ] Thêm pagination cho tất cả list endpoints
- [ ] Implement query result caching
- [ ] Optimize complex JOIN queries
- [ ] Thêm database index analysis

---

## **✅ ĐIỂM MẠNH CẦN GIỮ LẠI**

1. ✅ **Database schema design tốt** - Constraints, indexes, views solid
2. ✅ **Authentication flow sạch** - JWT + Google OAuth properly integrated
3. ✅ **NestJS structure modular** - Controllers, services, modules well-organized
4. ✅ **Admin dashboard feature-rich** - Tournaments, matches, sync, rules
5. ✅ **External API integrations** - Football-Data, F1, LoL sync working
6. ✅ **Type-safe TypeScript** - Backend & frontend cả hai properly typed
7. ✅ **Testing foundation** - Cấu trúc test tốt trong existing tests

---

## **🎬 BƯỚC TIẾP THEO**

### **Ngay Hôm Nay:**
- [ ] Fix `THESPORTSDB_API_KEY` value
- [ ] Tạo GitHub issues cho mỗi critical item
- [ ] Setup ESLint rule cho unused variables

### **Tuần Này:**
- [ ] Implement global exception filter
- [ ] Tạo prediction endpoints
- [ ] Thêm Auth context vào frontend

### **Sau Này:**
- [ ] Lên kế hoạch refactoring sprints
- [ ] Setup automated testing trong CI/CD
- [ ] Lên kế hoạch performance optimization

---

## **📊 ĐÁNH GIÁ TỔNG THỂ: 6.5/10**

- **Backend:** 6/10 (good foundation, cần cleanup)
- **Frontend:** 5/10 (thiếu state management)
- **Database:** 8.5/10 (solid)
- **DevOps:** 5/10 (minimal)
- **Testing:** 2/10 (almost none)

---

## **📌 SUMMARY**

**Dự án có nền tảng tốt nhưng cần:**
1. Hoàn thành core features (predictions, leaderboard)
2. Cleanup backend architecture (repositories, error handling)
3. Thêm comprehensive tests
4. Improve frontend state management
5. Document & monitor deployment

**Tiềm năng:** Cao - Good team velocity, feature-rich admin panel
**Rủi ro:** Medium - Missing tests, incomplete features có thể dẫn đến bugs
