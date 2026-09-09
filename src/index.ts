// 领域模型（纯类型定义，snake_case）
export type {
  UserProfile,
  AuthTokens,
  LoginParams,
  RegisterParams,
  UpdateProfileParams,
  ChangePasswordParams,
  ListUsersParams,
  PaginatedUsers,
} from "./core/index.js";

// 用户身体指标（snake_case）
export type {
  UserBodyProfile,
  SaveUserBodyParams,
} from "./core/index.js";

// 用户营养目标（snake_case）
export type {
  UserNutritionGoal,
  SaveUserNutritionParams,
} from "./core/index.js";

// UserService：CaloPlan 层面的用户业务封装（基于 UserSDK）
export { UserService } from "./service/UserService.js";

// Repository：基于 MetaSDK 的用户业务数据存储
export { UserBodyRespository } from "./repository/user-body/UserBodyRespository.js";
export type { UserBodyHistoryItem } from "./repository/user-body/UserBodyRespository.js";
export { UserNutritionRespository } from "./repository/user-nutrition/UserNutritionRespository.js";
export type { UserNutritionHistoryItem } from "./repository/user-nutrition/UserNutritionRespository.js";
export { CPUserFactory } from "./repository/CPUserFactory.js";
export type { UserIdProvider } from "./repository/type.js";
export { isNotFoundError } from "./repository/type.js";

// caloplan-user 单例：createCPUser() 初始化 / getCPUser() 获取
export { createCPUser, getCPUser } from "./cpuser.js";

// user-sdk 类型契约（本库不包含 SDK 实现，仅供类型规范；SDK 实例由外部注入）
export type {
  UserSdkLike,
  UserSdkAuthClient,
  UserSdkUsersClient,
  RegisterContract,
  TokenResponseContract,
  UserResponseContract,
  UpdateUserContract,
  ChangePasswordContract,
  ListUsersContract,
  PaginatedUsersContract,
} from "./sdk/user-sdk/index.js";

// meta-sdk 类型契约（本库不包含 SDK 实现，仅供类型规范；SDK 实例由外部注入）
export type {
  MetaSdkLike,
  EntriesClient,
  MetadataEntry,
  MetadataVersion,
  CreateEntryParams,
  UpdateEntryParams,
  GetEntryOptions,
  QueryEntriesParams,
  ListVersionsParams,
  RollbackParams,
  PaginatedResponse,
} from "./sdk/meta-sdk/index.js";
