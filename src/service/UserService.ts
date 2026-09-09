import type { UserSdkLike } from "../sdk/user-sdk/index.js";
import type {
  AuthTokens,
  ChangePasswordParams,
  ListUsersParams,
  LoginParams,
  PaginatedUsers,
  RegisterParams,
  UpdateProfileParams,
  UserProfile,
} from "../core/model/index.js";
import type {
  ChangePasswordContract,
  ListUsersContract,
  PaginatedUsersContract,
  RegisterContract,
  TokenResponseContract,
  UpdateUserContract,
  UserResponseContract,
} from "../sdk/user-sdk/index.js";
import { isNotFoundError } from "./type.js";

/* ──────────────── 数据转换：CaloPlan 领域(snake_case) ↔ SDK 契约(camelCase) ──────────────── */

/** SDK 契约 → CaloPlan 用户领域模型 */
function toUserProfile(data: UserResponseContract): UserProfile {
  return {
    user_id: data.id,
    username: data.username,
    email: data.email,
    full_name: data.fullName,
    service_name: data.serviceName,
    role: data.role,
    created_time: data.createdAt,
    updated_time: data.updatedAt,
  };
}

/** SDK 契约 → CaloPlan 认证令牌 */
function toAuthTokens(data: TokenResponseContract): AuthTokens {
  return {
    access_token: data.accessToken,
    refresh_token: data.refreshToken,
    token_type: data.tokenType,
  };
}

/** CaloPlan 注册参数 → SDK 契约 */
function toRegisterContract(params: RegisterParams): RegisterContract {
  const contract: RegisterContract = {
    username: params.username,
    email: params.email,
    password: params.password,
  };
  if (params.full_name !== undefined) contract.fullName = params.full_name;
  if (params.service_name !== undefined) contract.serviceName = params.service_name;
  return contract;
}

/** CaloPlan 更新资料参数 → SDK 契约（仅传变更字段） */
function toUpdateUserContract(params: UpdateProfileParams): UpdateUserContract {
  const contract: UpdateUserContract = {};
  if (params.full_name !== undefined) contract.fullName = params.full_name;
  if (params.service_name !== undefined) contract.serviceName = params.service_name;
  return contract;
}

/** CaloPlan 修改密码参数 → SDK 契约 */
function toChangePasswordContract(params: ChangePasswordParams): ChangePasswordContract {
  return {
    oldPassword: params.old_password,
    newPassword: params.new_password,
  };
}

/** CaloPlan 分页查询参数 → SDK 契约 */
function toListUsersContract(params?: ListUsersParams): ListUsersContract | undefined {
  if (params == null) return undefined;
  const contract: ListUsersContract = {};
  if (params.skip !== undefined) contract.skip = params.skip;
  if (params.limit !== undefined) contract.limit = params.limit;
  if (params.service_name !== undefined) contract.serviceName = params.service_name;
  return contract;
}

/** SDK 分页响应 → CaloPlan 分页用户列表 */
function toPaginatedUsers(data: PaginatedUsersContract): PaginatedUsers {
  return {
    total: data.total,
    items: data.items.map(toUserProfile),
  };
}

/* ──────────────── UserService：CaloPlan 层面的用户业务封装 ──────────────── */

/**
 * CaloPlan 用户服务：封装 UserSDK，提供 CaloPlan 风格（snake_case）的用户能力。
 * - 不重复实现 User Service / JWT / token 生命周期，这些由 UserSDK 负责
 * - 不直接处理 HTTP
 * - UserSDK 实例由外部统一初始化并注入，本类不自行创建
 */
export class UserService {
  private readonly sdk: UserSdkLike;

  constructor(sdk: UserSdkLike) {
    this.sdk = sdk;
  }

  /* ── 认证 ── */

  /** 用户登录，返回认证令牌对（token 生命周期由 UserSDK 管理） */
  async login(params: LoginParams): Promise<AuthTokens> {
    const data = await this.sdk.auth.login(params.username, params.password);
    return toAuthTokens(data);
  }

  /** 用户注册，注册成功后返回认证令牌对 */
  async register(params: RegisterParams): Promise<AuthTokens> {
    const data = await this.sdk.auth.register(toRegisterContract(params));
    return toAuthTokens(data);
  }

  /** 用户登出（无状态 JWT，由 UserSDK 处理本地 token 清理） */
  async logout(): Promise<void> {
    await this.sdk.auth.logout();
  }

  /** 使用刷新令牌换取新的访问令牌 */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    const data = await this.sdk.auth.refresh(refreshToken);
    return toAuthTokens(data);
  }

  /* ── 当前用户 ── */

  /** 获取当前登录用户资料 */
  async getCurrentUser(): Promise<UserProfile> {
    const data = await this.sdk.users.getMe();
    return toUserProfile(data);
  }

  /** 更新当前登录用户资料（仅传变更字段） */
  async updateProfile(params: UpdateProfileParams): Promise<UserProfile> {
    const data = await this.sdk.users.updateMe(toUpdateUserContract(params));
    return toUserProfile(data);
  }

  /** 修改当前登录用户密码 */
  async changePassword(params: ChangePasswordParams): Promise<void> {
    await this.sdk.users.changePassword(toChangePasswordContract(params));
  }

  /** 注销当前登录用户账户（软删除） */
  async deleteAccount(): Promise<void> {
    await this.sdk.users.deleteMe();
  }

  /* ── 用户查询 ── */

  /** 按用户 ID 查询用户资料，不存在返回 null */
  async getUserById(userId: number): Promise<UserProfile | null> {
    try {
      const data = await this.sdk.users.getById(userId);
      return toUserProfile(data);
    } catch (err) {
      if (isNotFoundError(err)) return null;
      throw err;
    }
  }

  /** 分页查询用户列表（可按 service_name 筛选） */
  async listUsers(params?: ListUsersParams): Promise<PaginatedUsers> {
    const data = await this.sdk.users.list(toListUsersContract(params));
    return toPaginatedUsers(data);
  }
}
