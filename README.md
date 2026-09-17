# caloplan-user

CaloPlan 用户模块 — 封装 UserSDK（认证/用户信息）与 MetaSDK（身体指标/营养目标存储）的业务层用户能力。

## 相关项目（CaloPlan 全家桶）

CaloPlan 全栈项目统一托管在 GitHub Organization [caloplan](https://github.com/caloplan)：

| 类型 | 项目 | 与本项目关系 |
| --- | --- | --- |
| 前端 | [coloplan-v2](https://github.com/caloplan/coloplan-v2) | 上层客户端：复用本模块的用户 / 身体 / 营养能力 |
| SDK | [caloplan-core](https://github.com/caloplan/caloplan-core) | 餐食 / 食物模块（兄弟 SDK） |
| SDK（本仓库） | [caloplan-user](https://github.com/caloplan/caloplan-user) | 用户认证与身体 / 营养目标模块 |
| SDK | [caloplan-chat](https://github.com/caloplan/caloplan-chat) | AI 对话模块（兄弟 SDK） |
| SDK | [caloplan-cache](https://github.com/caloplan/caloplan-cache) | 通用缓存（Token 持久化等） |
| 服务 | [fastapi-chat-service](https://github.com/caloplan/fastapi-chat-service) | AI 对话后端（消费本服务 JWT） |
| 服务 | [fastapi-file-service](https://github.com/caloplan/fastapi-file-service) | 图片上传后端（消费本服务 JWT） |
| 服务 | [mservice-fastapi-user](https://github.com/caloplan/mservice-fastapi-user) | 认证 / 用户微服务（UserSDK 后端） |
| 服务 | [mservice-fastapi-metastorage](https://github.com/caloplan/mservice-fastapi-metastorage) | 元数据微服务（身体 / 营养存储后端） |

本模块经 UserSDK 对接 `mservice-fastapi-user`，经 MetaSDK 对接 `mservice-fastapi-metastorage`。

## 架构

```
caloplan-user
├── UserService          ← 封装 UserSDK（认证 + 用户基础信息）
├── UserBodyRespository  ← 封装 MetaSDK（用户身体指标，按天记录）
├── UserNutritionRespository ← 封装 MetaSDK（用户营养目标，按天记录）
└── CPUserFactory        ← 组装以上三者
```

- **不重复实现** User Service / JWT / token 生命周期，这些由 UserSDK 负责
- **不直接处理 HTTP**
- **不自行创建** UserSDK / MetaSDK / Cache，从统一单例依赖注册中获取
- **不引入**额外 DI 框架或复杂抽象

## 依赖关系

```
caloplan-user
    ↓
  UserSDK
    ↓
User Service

caloplan-user
    ↓
  MetaSDK
    ↓
Meta Storage
```

## 安装

```bash
pnpm add caloplan-user
```

## 快速开始

```typescript
import { createCPUser, getCPUser } from "caloplan-user";
import type { UserSdkLike, MetaSdkLike } from "caloplan-user";

// 从统一单例依赖注册中获取已初始化的 SDK
const userSdk: UserSdkLike = getSingletonUserSdk();
const metaSdk: MetaSdkLike = getSingletonMetaSdk();

// 初始化 caloplan-user 单例
createCPUser(userSdk, metaSdk, () => getCurrentUserId());

// 获取使用
const cp = getCPUser();

// 用户认证
const tokens = await cp.user.login({ email: "a@b.com", password: "123456" });
const user = await cp.user.getCurrentUser();

// 身体指标（按天记录）
const body = await cp.body.create({ age: 25, height: 180, weight: 75 });
const todayBody = await cp.body.getByDate("2026-09-09");
await cp.body.update({ id: body.id, weight: 74 });

// 营养目标（按天记录）
const nutrition = await cp.nutrition.create({
  carbon: 250, protein: 150, fat: 60, salt: 5, calorie: 2000,
});
const weekNutrition = await cp.nutrition.listMine({
  start_date: "2026-09-01",
  end_date: "2026-09-07",
});
```

## API

### UserService

封装 UserSDK，提供 CaloPlan 层面的用户能力。领域模型使用 **snake_case**。

| 方法 | 说明 |
| --- | --- |
| `login(params: LoginParams): Promise<AuthTokens>` | 用户登录 |
| `register(params: RegisterParams): Promise<AuthTokens>` | 用户注册 |
| `logout(): Promise<void>` | 登出 |
| `refreshToken(): Promise<AuthTokens>` | 刷新 token |
| `getCurrentUser(): Promise<UserProfile>` | 获取当前用户 |
| `updateProfile(params: UpdateProfileParams): Promise<UserProfile>` | 更新用户基础信息 |
| `changePassword(params: ChangePasswordParams): Promise<void>` | 修改密码 |
| `deleteAccount(): Promise<void>` | 注销账号 |
| `getUserById(userId: string): Promise<UserProfile \| null>` | 按 ID 查询用户 |
| `listUsers(params?: ListUsersParams): Promise<PaginatedUsers>` | 分页查询用户列表 |

**领域模型（snake_case）：**

```typescript
interface UserProfile {
  user_id: string;
  email: string;
  username: string | null;
  nickname: string | null;
  avatar_url: string | null;
  created_time: string;
  updated_time: string | null;
}

interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}
```

### 数据分层（raw data vs meta 字段）

身体指标和营养目标的存储严格区分两类字段：

| 类别 | 字段 | 存储位置 | 说明 |
| --- | --- | --- | --- |
| **raw data**（业务字段） | `date`、`age`、`height`、`weight` / `carbon`、`protein`、`fat`、`salt`、`calorie` | `MetaSDK entry.data` | 严格对齐 entity schema，只存业务字段 |
| **meta 字段**（元数据） | `id`、`user_id`、`created_time`、`updated_time` | `MetaSDK entry` 元数据 | 从 `entityKey` / `ownerUserId` / `createdAt` / `updatedAt` 取，不存入 data |

**用户过滤**使用 MetaSDK 原生的 `ownerUserId` 参数，不在 data 中存 `user_id` 字段。

### UserBodyRespository

用户身体指标仓储，基于 MetaSDK 存储。**用户按天记录**，entityKey 使用独立 id（nanoid）。

| 方法 | 说明 |
| --- | --- |
| `create(params: CreateUserBodyParams): Promise<UserBodyProfile>` | 创建身体指标记录（date 不传默认当天） |
| `getById(id: string): Promise<UserBodyProfile \| null>` | 按 id 查询 |
| `getByDate(date: string): Promise<UserBodyProfile \| null>` | 按日期查询当前用户的记录 |
| `update(params: UpdateUserBodyParams): Promise<UserBodyProfile>` | 按 id 更新（仅传变更字段） |
| `delete(id: string): Promise<void>` | 按 id 删除 |
| `listMine(params?: ListUserBodyParams): Promise<{ total, items }>` | 查询当前用户的记录列表（支持时间范围） |
| `listHistory(id, params?): Promise<{ total, items }>` | 获取指定记录的历史版本列表 |
| `getByVersion(id, version): Promise<UserBodyProfile \| null>` | 获取指定记录的指定历史版本 |
| `rollback(id, version): Promise<UserBodyProfile>` | 回滚指定记录到指定版本 |

**领域模型（snake_case）：**

```typescript
interface UserBodyProfile {
  id: string;              // nanoid
  user_id: string;
  date: string;            // YYYY-MM-DD
  age: number;
  height: number;
  weight: number;
  created_time: string;
  updated_time: string | null;
}

interface CreateUserBodyParams {
  date?: string;           // 不传默认当天
  age: number;
  height: number;
  weight: number;
}

interface UpdateUserBodyParams {
  id: string;
  age?: number;
  height?: number;
  weight?: number;
}

interface ListUserBodyParams {
  date?: string;           // 精确匹配某一天
  start_date?: string;     // 时间范围（含边界）
  end_date?: string;
  page?: number;
  pageSize?: number;
}
```

**时间范围查询实现：** MetaSDK 的 `field_filters` 只支持精确匹配，不支持范围查询。`listMine` 的时间范围查询采用「`createdAfter/createdBefore` 缩小查询范围 + 内存按 `date` 精确过滤」的策略，确保范围准确。

### UserNutritionRespository

用户营养目标仓储，基于 MetaSDK 存储。**用户按天记录**，entityKey 使用独立 id（nanoid）。

| 方法 | 说明 |
| --- | --- |
| `create(params: CreateUserNutritionParams): Promise<UserNutritionGoal>` | 创建营养目标记录（date 不传默认当天） |
| `getById(id: string): Promise<UserNutritionGoal \| null>` | 按 id 查询 |
| `getByDate(date: string): Promise<UserNutritionGoal \| null>` | 按日期查询当前用户的记录 |
| `update(params: UpdateUserNutritionParams): Promise<UserNutritionGoal>` | 按 id 更新（仅传变更字段） |
| `delete(id: string): Promise<void>` | 按 id 删除 |
| `listMine(params?: ListUserNutritionParams): Promise<{ total, items }>` | 查询当前用户的记录列表（支持时间范围） |
| `listHistory(id, params?): Promise<{ total, items }>` | 获取指定记录的历史版本列表 |
| `getByVersion(id, version): Promise<UserNutritionGoal \| null>` | 获取指定记录的指定历史版本 |
| `rollback(id, version): Promise<UserNutritionGoal>` | 回滚指定记录到指定版本 |

**领域模型（snake_case）：**

```typescript
interface UserNutritionGoal {
  id: string;              // nanoid
  user_id: string;
  date: string;            // YYYY-MM-DD
  carbon: number;
  protein: number;
  fat: number;
  salt: number;
  calorie: number;
  created_time: string;
  updated_time: string | null;
}

interface CreateUserNutritionParams {
  date?: string;           // 不传默认当天
  carbon: number;
  protein: number;
  fat: number;
  salt: number;
  calorie: number;
}

interface UpdateUserNutritionParams {
  id: string;
  carbon?: number;
  protein?: number;
  fat?: number;
  salt?: number;
  calorie?: number;
}

interface ListUserNutritionParams {
  date?: string;           // 精确匹配某一天
  start_date?: string;     // 时间范围（含边界）
  end_date?: string;
  page?: number;
  pageSize?: number;
}
```

**历史版本项：**

```typescript
interface UserBodyHistoryItem {
  version: number;
  data: UserBodyProfile;
  created_time: string;
  created_by_user_id: number;
}

interface UserNutritionHistoryItem {
  version: number;
  data: UserNutritionGoal;
  created_time: string;
  created_by_user_id: number;
}
```

## 单例

```typescript
import { createCPUser, getCPUser } from "caloplan-user";

// 初始化（应用启动时调用一次）
createCPUser(userSdk, metaSdk, userIdProvider);

// 获取
const cp = getCPUser();
cp.user          // UserService
cp.body          // UserBodyRespository
cp.nutrition     // UserNutritionRespository
```

`userIdProvider: () => string | null | Promise<string | null>` — 从当前登录态中解析用户 ID。无登录态时仓储层方法会抛错且不调用 SDK。

## 常见使用场景

### 场景 1：用户登录后初始化身体指标

```typescript
// 登录
const tokens = await cp.user.login({ email, password });

// 检查今天是否已有身体指标记录
const todayBody = await cp.body.getByDate(today());

if (!todayBody) {
  // 今天还没有记录，创建一条
  await cp.body.create({ age: 25, height: 180, weight: 75 });
}
```

### 场景 2：更新当天的营养目标

```typescript
// 获取当天的营养目标
const todayNutrition = await cp.nutrition.getByDate(today());

if (todayNutrition) {
  // 更新卡路里目标（仅传变更字段）
  await cp.nutrition.update({ id: todayNutrition.id, calorie: 2100 });
} else {
  // 当天还没有记录，创建
  await cp.nutrition.create({ carbon: 250, protein: 150, fat: 60, salt: 5, calorie: 2100 });
}
```

### 场景 3：查询一周的身体数据趋势

```typescript
const weekBody = await cp.body.listMine({
  start_date: "2026-09-01",
  end_date: "2026-09-07",
});

// 按日期排序
weekBody.items.sort((a, b) => a.date.localeCompare(b.date));

// 计算平均体重
const avgWeight = weekBody.items.reduce((sum, item) => sum + item.weight, 0) / weekBody.items.length;
```

### 场景 4：查看某条记录的修改历史并回滚

```typescript
// 获取历史版本列表
const history = await cp.body.listHistory(recordId);

// 查看某个历史版本的数据
const oldVersion = await cp.body.getByVersion(recordId, 1);

// 回滚到指定版本（生成新版本，不删除历史）
const rolledBack = await cp.body.rollback(recordId, 1);
```

## 设计原则

1. **业务层封装**：不简单把 UserSDK / MetaSDK API 原样暴露，而是根据 CaloPlan 领域模型设计接口
2. **复用优先**：UserSDK 已支持的能力直接复用，不重新实现
3. **token 管理留在 UserSDK**：caloplan-user 不管理 token 生命周期
4. **缓存不写死**：Cache 通过统一注册获取，不在模块内硬编码缓存逻辑
5. **不过度设计**：不为扩展性增加没有实际用途的 interface / factory / service 层
6. **按天记录**：身体指标和营养目标支持按天记录与时间范围查询，entityKey 使用 nanoid 独立 id
7. **create 唯一性上移业务层**：Repository 层纯 CRUD 不做每天一次的唯一性检查，由业务层接口限制

## 开发

```bash
pnpm install
pnpm typecheck   # TypeScript 类型检查
pnpm test        # 运行测试
pnpm build       # 构建
```

## 文件结构

```
src/
├── core/
│   ├── model/
│   │   ├── user.ts            # UserProfile / AuthTokens 等
│   │   ├── user-body.ts       # UserBodyProfile（按天记录）
│   │   ├── user-nutrition.ts  # UserNutritionGoal（按天记录）
│   │   └── index.ts
│   └── index.ts
├── sdk/
│   ├── user-sdk/types/        # UserSDK 类型契约（camelCase）
│   └── meta-sdk/types/        # MetaSDK 类型契约（camelCase）
├── service/
│   └── UserService.ts         # 用户认证与基础信息封装
├── repository/
│   ├── type.ts                # UserIdProvider + isNotFoundError
│   ├── CPUserFactory.ts       # 组装 user/body/nutrition
│   ├── user-body/
│   │   └── UserBodyRespository.ts
│   └── user-nutrition/
│       └── UserNutritionRespository.ts
├── cpuser.ts                  # 单例 createCPUser / getCPUser
└── index.ts                   # 包入口
```
