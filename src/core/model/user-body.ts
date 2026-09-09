/**
 * CaloPlan 用户身体指标领域模型（snake_case 命名）。
 * 用户按天记录数据，entityKey 使用独立 id（nanoid），date 字段标识记录日期。
 */

/** 用户身体指标（按天记录） */
export interface UserBodyProfile {
  id: string;
  user_id: string;
  date: string;
  age: number;
  height: number;
  weight: number;
  created_time: string;
  updated_time: string | null;
}

/** 创建身体指标参数（由登录态自动注入 user_id，date 不传默认当天） */
export interface CreateUserBodyParams {
  date?: string;
  age: number;
  height: number;
  weight: number;
}

/** 更新身体指标参数（按 id 更新，仅传变更字段） */
export interface UpdateUserBodyParams {
  id: string;
  age?: number;
  height?: number;
  weight?: number;
}

/** 查询身体指标列表参数（按时间范围 + 分页） */
export interface ListUserBodyParams {
  date?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  pageSize?: number;
}
