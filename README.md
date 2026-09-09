# caloplan-user

CaloPlan 用户模块 — 封装 UserSDK 与 MetaSDK，提供 CaloPlan 层面的用户业务能力。

## 模块定位

caloplan-user 是 CaloPlan 模块化架构中的用户业务模块：

```
caloplan-user  ← 本模块（业务层封装）
   ├── UserSDK    ← 外部注入，负责 HTTP / JWT / token 生命周期 / 用户认证
   └── MetaSDK    ← 外部注入，负责用户身体指标、营养目标等业务数据存储（含版本历史）
```

### 职责边界

- **封装 UserSDK**，提供 CaloPlan 风格（snake_case）的用户认证与基础信息 API
- **封装 MetaSDK**，提供用户身体指标、营养目标的存储与历史版本能力
- **不重复实现** User Service / JWT / token 生命周期逻辑，这些由 UserSDK 负责
- **不直接处理 HTTP**
- **不自行创建 SDK**，从统一单例依赖注册中获取已初始化的实例
- **不引入额外 DI 框架**或复杂抽象

## 文件结构

```
caloplan-user/
├── .gitignore
├── package.json
├── tsconfig.json
├── tsconfig.build.json
└── src/
    ├── core/
    │   ├── index.ts                          # 领域模型聚合导出
    │   └── model/
    │       ├── index.ts
    │       ├── user.ts                       # UserProfile / AuthTokens / 参数类型
    │       ├── user-body.ts                  # UserBodyProfile / SaveUserBodyParams
    │       └── user-nutrition.ts             # UserNutritionGoal / SaveUserNutritionParams
    ├── sdk/
    │   ├── user-sdk/
    │   │   ├── index.ts
    │   │   └── types/
    │   │       ├── index.ts
    │   │       ├── auth.ts                   # RegisterContract / TokenResponseContract
    │   │       ├── user.ts                   # UserResponseContract / UpdateUserContract 等
    │   │       └── contract.ts               # UserSdkLike / UserSdkAuthClient / UserSdkUsersClient
    │   └── meta-sdk/
    │       ├── index.ts
    │       └── types/
    │           ├── index.ts
    │           ├── common.ts                 # PaginatedResponse / PaginationParams
    │           ├── entry.ts                  # MetadataEntry / MetadataVersion / 参数类型
    │           └── contract.ts               # MetaSdkLike / EntriesClient（含历史版本方法）
    ├── service/
    │   ├── type.ts                           # isNotFoundError 重新导出
    │   ├── UserService.ts                    # 用户认证与基础信息（基于 UserSDK）
    │   └── UserService.test.ts
    ├── repository/
    │   ├── type.ts                           # UserIdProvider / isNotFoundError
    │   ├── CPUserFactory.ts                  # 工厂：组装 UserService + 两个 Repository
    │   ├── user-body/
    │   │   ├── UserBodyRespository.ts        # 用户身体指标存储（含历史版本）
    │   │   └── UserBodyRespository.test.ts
    │   └── user-nutrition/
    │       ├── UserNutritionRespository.ts   # 用户营养目标存储（含历史版本）
    │       └── UserNutritionRespository.test.ts
    ├── cpuser.ts                             # 单例：createCPUser() / getCPUser()
    └── index.ts                              # 包入口，按段聚合导出
```

## 架构分层

| 层 | 职责 | 命名风格 |
|---|---|---|
| `core/model` | CaloPlan 领域模型（纯类型，无逻辑） | `snake_case`：`user_id`、`created_time` |
| `sdk/user-sdk/types` | UserSDK 类型契约（仅类型，无实现） | `camelCase`：`userId`、`createdAt` |
| `sdk/meta-sdk/types` | MetaSDK 类型契约（仅类型，无实现） | `camelCase`：`userId`、`createdAt` |
| `service/UserService` | 用户认证与基础信息，组合 UserSDK | 方法名业务语义：`login`、`getCurrentUser` |
| `repository/*` | 用户业务数据存储，组合 MetaSDK | 方法名业务语义：`getMine`、`save`、`listHistory` |
| `cpuser.ts` | 单例注册，SDK 外部注入 | `createCPUser` / `getCPUser` |

### 设计约束

- 不 `new UserSDK` / `new MetaSDK`，实例由上层统一初始化并注入
- 不实现 JWT / token 生命周期，由 UserSDK 负责，本模块仅透传 `AuthTokens`
- 不直接处理 HTTP
- 不引入额外 DI 框架
- 错误用 `isNotFoundError`（`statusCode === 404`），不依赖 SDK 具体错误类
- 数据转换集中在 Service / Repository 内部：CaloPlan 领域（snake_case）↔ SDK 契约（camelCase）
- 用户身体指标与营养目标为**用户单例数据**，`entityKey` 使用 `user_id`

## 领域模型（snake_case）

### UserProfile — 用户基础信息

```typescript
interface UserProfile {
  user_id: number;
  username: string;
  email: string;
  full_name: string | null;
  service_name: string;
  role: string;
  created_time: string;
  updated_time: string | null;
}
```

### UserBodyProfile — 用户身体指标

```typescript
interface UserBodyProfile {
  user_id: string;
  age: number;
  height: number;
  weight: number;
  created_time: string;
  updated_time: string | null;
}
```

### UserNutritionGoal — 用户营养目标

```typescript
interface UserNutritionGoal {
  user_id: string;
  carbon: number;
  protein: number;
  fat: number;
  salt: number;
  calorie: number;
  created_time: string;
  updated_time: string | null;
}
```

### AuthTokens — 认证令牌对

```typescript
interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}
```

## API 使用示例

### 1. 初始化（上层应用统一完成）

```typescript
import { createCPUser } from "caloplan-user";
import type { UserSdkLike, MetaSdkLike, UserIdProvider } from "caloplan-user";

// UserSDK 与 MetaSDK 由上层统一初始化（含 HTTP 客户端、token 管理等配置）
const userSdk: UserSdkLike = { auth: userSdkAuthClient, users: userSdkUsersClient };
const metaSdk: MetaSdkLike = { entries: metaSdkEntriesClient };

// 登录态提供器：返回当前登录用户 ID（MetaSDK 仓储自动注入 user_id）
const userIdProvider: UserIdProvider = () => currentUserId;

// 注入并初始化单例
createCPUser(userSdk, metaSdk, userIdProvider);
```

### 2. 用户认证与基础信息（cpUser.user）

```typescript
import { getCPUser } from "caloplan-user";

const cpUser = getCPUser();

// 登录
const tokens = await cpUser.user.login({ username: "alice", password: "pass123" });

// 注册
const tokens = await cpUser.user.register({
  username: "bob",
  email: "bob@example.com",
  password: "pass123",
  full_name: "Bob Li",
  service_name: "caloplan",
});

// 获取当前用户
const user = await cpUser.user.getCurrentUser();

// 更新用户资料（仅传变更字段）
const updated = await cpUser.user.updateProfile({ full_name: "Alice New" });

// 修改密码
await cpUser.user.changePassword({ old_password: "old123", new_password: "new123" });

// 登出
await cpUser.user.logout();
```

### 3. 用户身体指标（cpUser.body）

```typescript
// 获取当前用户身体指标（不存在返回 null）
const body = await cpUser.body.getMine();

// 保存（upsert：已存在则更新，不存在则创建）
const saved = await cpUser.body.save({ age: 25, height: 180, weight: 75 });

// 删除（重置）
await cpUser.body.delete();

// 获取历史版本列表（按版本倒序，最新在前）
const history = await cpUser.body.listHistory({ page: 1, pageSize: 20 });
// history.total / history.items: UserBodyHistoryItem[]
// history.items[0].version / .data / .created_time / .created_by_user_id

// 获取指定历史版本
const oldBody = await cpUser.body.getByVersion(1);

// 回滚到指定版本（生成新版本，数据取回滚目标）
const rolledBack = await cpUser.body.rollback(1);
```

### 4. 用户营养目标（cpUser.nutrition）

```typescript
// 获取当前用户营养目标（不存在返回 null）
const goal = await cpUser.nutrition.getMine();

// 保存（upsert）
const saved = await cpUser.nutrition.save({
  carbon: 250,
  protein: 150,
  fat: 60,
  salt: 5,
  calorie: 2000,
});

// 删除（重置）
await cpUser.nutrition.delete();

// 历史版本（同身体指标）
const history = await cpUser.nutrition.listHistory();
const oldGoal = await cpUser.nutrition.getByVersion(1);
const rolledBack = await cpUser.nutrition.rollback(1);
```

## 历史版本能力

基于 MetaSDK 自带的版本历史能力，用户身体指标与营养目标均支持：

| 方法 | 说明 |
|---|---|
| `listHistory(params?)` | 获取历史版本列表，支持分页（`page` / `pageSize`），按版本倒序 |
| `getByVersion(version)` | 获取指定版本的数据快照，不存在返回 null |
| `rollback(version)` | 回滚到指定版本（生成新版本，数据取回滚目标，不删除历史） |

历史版本项结构：

```typescript
interface UserBodyHistoryItem {
  version: number;
  data: UserBodyProfile;       // 该版本的 snake_case 数据
  created_time: string;
  created_by_user_id: number;
}
```

## 开发命令

```bash
# 类型检查
npm run typecheck

# 运行测试
npm test

# 监听模式测试
npm run test:watch

# 构建
npm run build

# 清理构建产物
npm run clean
```

## 验证结果

- `npx tsc --noEmit` — 通过
- `npx tsx --test "src/**/*.test.ts"` — 43 tests, 43 pass, 0 fail
- `npx tsc -p tsconfig.build.json` — 构建通过

### 测试覆盖

| 模块 | 用例数 | 覆盖点 |
|---|---|---|
| UserService | 17 | 登录/注册/登出/刷新令牌、当前用户 CRUD、修改密码、用户查询、单例 |
| UserBodyRespository | 13 | getMine/404/错误透传、save 创建/更新、delete、无登录态、历史版本 listHistory/getByVersion/rollback |
| UserNutritionRespository | 13 | 同 UserBodyRespository |
| **合计** | **43** | |
