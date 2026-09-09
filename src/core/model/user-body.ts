/**
 * CaloPlan 用户身体指标领域模型（snake_case 命名）。
 * 每个用户单例数据，entityKey 使用 user_id。
 */

/** 用户身体指标 */
export interface UserBodyProfile {
  user_id: string;
  age: number;
  height: number;
  weight: number;
  created_time: string;
  updated_time: string | null;
}

/** 保存身体指标参数（由登录态自动注入 user_id） */
export interface SaveUserBodyParams {
  age: number;
  height: number;
  weight: number;
}
