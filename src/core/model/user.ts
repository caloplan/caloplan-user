/**
 * CaloPlan 用户领域模型（snake_case 命名，与 caloplan-core 风格一致）。
 * 纯类型定义，不含任何逻辑。
 */

/** 用户资料信息 */
export interface UserProfile {
  user_id: number;
  username: string;
  email: string;
  full_name: string | null;
  service_name: string;
  role: string;
  created_time: string;
  updated_time: string | null;
}

/** 认证令牌对（由 UserSDK 管理生命周期，本模块仅透传） */
export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

/** 登录参数 */
export interface LoginParams {
  username: string;
  password: string;
}

/** 注册参数 */
export interface RegisterParams {
  username: string;
  email: string;
  password: string;
  full_name?: string | null;
  service_name?: string;
}

/** 更新用户资料参数 */
export interface UpdateProfileParams {
  full_name?: string | null;
  service_name?: string;
}

/** 修改密码参数 */
export interface ChangePasswordParams {
  old_password: string;
  new_password: string;
}

/** 分页查询用户列表参数 */
export interface ListUsersParams {
  skip?: number;
  limit?: number;
  service_name?: string;
}

/** 分页用户列表 */
export interface PaginatedUsers {
  total: number;
  items: UserProfile[];
}
