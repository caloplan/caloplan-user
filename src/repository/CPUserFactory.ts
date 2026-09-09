import { UserService } from "../service/UserService.js";
import { UserBodyRespository } from "./user-body/UserBodyRespository.js";
import { UserNutritionRespository } from "./user-nutrition/UserNutritionRespository.js";
import type { UserSdkLike } from "../sdk/user-sdk/index.js";
import type { MetaSdkLike } from "../sdk/meta-sdk/index.js";
import type { UserIdProvider } from "./type.js";

/**
 * CPUser 工厂：统一注入 UserSDK、MetaSDK 实例与登录态提供器，组装各 Service / Repository。
 * - UserSDK 由调用方创建并传入（含 token 管理、HTTP 等全部配置），用于用户认证与基础信息
 * - MetaSDK 由调用方创建并传入，用于用户身体指标、营养目标等业务数据存储
 * - userIdProvider 用于 MetaSDK 仓储按用户查询与写操作时自动注入 user_id
 */
export class CPUserFactory {
  /** 用户认证与基础信息（基于 UserSDK） */
  readonly user: UserService;
  /** 用户身体指标（基于 MetaSDK，每个用户单例） */
  readonly body: UserBodyRespository;
  /** 用户营养目标（基于 MetaSDK，每个用户单例） */
  readonly nutrition: UserNutritionRespository;

  constructor(
    userSdk: UserSdkLike,
    metaSdk: MetaSdkLike,
    userIdProvider: UserIdProvider,
  ) {
    this.user = new UserService(userSdk);
    this.body = new UserBodyRespository(metaSdk, userIdProvider);
    this.nutrition = new UserNutritionRespository(metaSdk, userIdProvider);
  }
}
