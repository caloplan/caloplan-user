/**
 * CaloPlan 用户营养目标领域模型（snake_case 命名）。
 * 每个用户单例数据，entityKey 使用 user_id。
 */

/** 用户营养目标 */
export interface UserNutritionGoal {
  user_id: string;
  carbon: number;
  protein: number;
  fat: number;
  salt: number;
  calorie: number;
  created_time: string;
  updated_time: string | null;
}

/** 保存营养目标参数（由登录态自动注入 user_id） */
export interface SaveUserNutritionParams {
  carbon: number;
  protein: number;
  fat: number;
  salt: number;
  calorie: number;
}
