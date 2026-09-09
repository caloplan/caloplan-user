// 领域模型（纯类型定义）
export type {
  UserProfile,
  AuthTokens,
  LoginParams,
  RegisterParams,
  UpdateProfileParams,
  ChangePasswordParams,
  ListUsersParams,
  PaginatedUsers,
} from "./model/index.js";

// 用户身体指标（按天记录）
export type {
  UserBodyProfile,
  CreateUserBodyParams,
  UpdateUserBodyParams,
  ListUserBodyParams,
} from "./model/index.js";

// 用户营养目标（按天记录）
export type {
  UserNutritionGoal,
  CreateUserNutritionParams,
  UpdateUserNutritionParams,
  ListUserNutritionParams,
} from "./model/index.js";
