/**
 * CaloPlan 用户营养目标领域模型（snake_case 命名）。
 * 用户按天记录数据，entityKey 使用独立 id（nanoid），date 字段标识记录日期。
 */

/** 用户营养目标（按天记录） */
export interface UserNutritionGoal {
  id: string;
  user_id: string;
  date: string;
  carbon: number;
  protein: number;
  fat: number;
  salt: number;
  calorie: number;
  created_time: string;
  updated_time: string | null;
}

/** 创建营养目标参数（由登录态自动注入 user_id，date 不传默认当天） */
export interface CreateUserNutritionParams {
  date?: string;
  carbon: number;
  protein: number;
  fat: number;
  salt: number;
  calorie: number;
}

/** 更新营养目标参数（按 id 更新，仅传变更字段） */
export interface UpdateUserNutritionParams {
  id: string;
  carbon?: number;
  protein?: number;
  fat?: number;
  salt?: number;
  calorie?: number;
}

/** 查询营养目标列表参数（按时间范围 + 分页） */
export interface ListUserNutritionParams {
  date?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  pageSize?: number;
}
