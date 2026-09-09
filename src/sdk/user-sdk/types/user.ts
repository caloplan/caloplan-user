/**
 * UserSDK 用户数据契约类型（camelCase，与 UserSDK 接口一致）。
 * 本库仅依赖类型契约，不包含 SDK 实现；SDK 实例由外部注入。
 */

/** 用户响应契约 */
export interface UserResponseContract {
  id: number;
  username: string;
  email: string;
  fullName: string | null;
  serviceName: string;
  role: string;
  createdAt: string;
  updatedAt: string | null;
}

/** 更新用户请求契约 */
export interface UpdateUserContract {
  fullName?: string | null;
  serviceName?: string;
}

/** 修改密码请求契约 */
export interface ChangePasswordContract {
  oldPassword: string;
  newPassword: string;
}

/** 分页查询用户列表请求契约 */
export interface ListUsersContract {
  skip?: number;
  limit?: number;
  serviceName?: string;
}

/** 分页用户列表响应契约 */
export interface PaginatedUsersContract {
  total: number;
  items: UserResponseContract[];
}
