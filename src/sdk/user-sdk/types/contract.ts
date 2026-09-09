import type { RegisterContract, TokenResponseContract } from "./auth.js";
import type {
  ChangePasswordContract,
  ListUsersContract,
  PaginatedUsersContract,
  UpdateUserContract,
  UserResponseContract,
} from "./user.js";

/**
 * UserSDK 认证客户端最小契约。
 * 外部 UserSDK 实例（含完整实现、token 管理、HTTP 等）满足此结构即可注入。
 */
export interface UserSdkAuthClient {
  register(params: RegisterContract): Promise<TokenResponseContract>;
  login(username: string, password: string): Promise<TokenResponseContract>;
  refresh(refreshToken: string): Promise<TokenResponseContract>;
  logout(): Promise<void>;
}

/**
 * UserSDK 用户管理客户端最小契约。
 */
export interface UserSdkUsersClient {
  getMe(): Promise<UserResponseContract>;
  updateMe(params: UpdateUserContract): Promise<UserResponseContract>;
  changePassword(params: ChangePasswordContract): Promise<void>;
  deleteMe(): Promise<void>;
  getById(userId: number): Promise<UserResponseContract>;
  list(params?: ListUsersContract): Promise<PaginatedUsersContract>;
}

/**
 * Repository / Service 依赖的 UserSDK 最小结构契约。
 * 本库不包含 SDK 实现，实例由上层应用统一初始化并注入。
 */
export interface UserSdkLike {
  auth: UserSdkAuthClient;
  users: UserSdkUsersClient;
}

/** SDK 错误的结构化形状：按字段判断（如 statusCode === 404），不依赖具体错误类 */
export interface SdkErrorLike {
  statusCode?: number;
}
