/**
 * UserSDK 认证相关契约类型（camelCase，与 UserSDK 接口一致）。
 * 本库仅依赖类型契约，不包含 SDK 实现；SDK 实例由外部注入。
 */

/** 注册请求契约 */
export interface RegisterContract {
  username: string;
  email: string;
  password: string;
  fullName?: string | null;
  serviceName?: string;
}

/** 令牌响应契约 */
export interface TokenResponseContract {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
}
