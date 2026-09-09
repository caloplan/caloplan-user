import { CPUserFactory } from "./repository/CPUserFactory.js";
import type { UserSdkLike } from "./sdk/user-sdk/index.js";
import type { MetaSdkLike } from "./sdk/meta-sdk/index.js";
import type { UserIdProvider } from "./repository/type.js";

let instance: CPUserFactory | null = null;

/**
 * 初始化 caloplan-user 单例：注入外部 UserSDK、MetaSDK 实例与登录态提供器。
 * - userSdk: 由上层应用统一创建并传入（含 token 管理、HTTP 等全部配置），用于用户认证与基础信息
 * - metaSdk: 由上层应用统一创建并传入，用于用户身体指标、营养目标等业务数据存储
 * - userIdProvider: 提供当前登录用户 ID（MetaSDK 仓储写操作与按用户查询时自动注入 user_id）
 */
export function createCPUser(
  userSdk: UserSdkLike,
  metaSdk: MetaSdkLike,
  userIdProvider: UserIdProvider,
): CPUserFactory {
  instance = new CPUserFactory(userSdk, metaSdk, userIdProvider);
  return instance;
}

/**
 * 获取 caloplan-user 单例：
 * - cpUser.user → UserService（登录/注册/当前用户等）
 * - cpUser.body → UserBodyRespository（身体指标 getMine/save/delete）
 * - cpUser.nutrition → UserNutritionRespository（营养目标 getMine/save/delete）
 */
export function getCPUser(): CPUserFactory {
  if (instance == null) {
    throw new Error(
      "CPUser 未初始化：请先调用 createCPUser() 注入 UserSDK、MetaSDK 与 userIdProvider",
    );
  }
  return instance;
}
