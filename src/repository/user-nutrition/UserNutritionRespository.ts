import type { MetaSdkLike } from "../../sdk/meta-sdk/index.js";
import type { MetadataVersion } from "../../sdk/meta-sdk/index.js";
import type {
  SaveUserNutritionParams,
  UserNutritionGoal,
} from "../../core/model/index.js";
import type { UserIdProvider } from "../type.js";
import { isNotFoundError } from "../type.js";

/** meta 微服务中 user_nutrition_goal 类型的 type_name */
const USER_NUTRITION_TYPE_NAME = "user_nutrition_goal";

/**
 * 存储层用户营养目标数据（camelCase，与 MetaSDK 契约一致）。
 * 每个用户单例数据，entityKey 使用 user_id。
 */
interface UserNutritionData {
  userId: string;
  carbon: number;
  protein: number;
  fat: number;
  salt: number;
  calorie: number;
  createdTime: string;
  updatedTime: string | null;
}

/** core UserNutritionGoal → 存储 data（camelCase） */
function toUserNutritionData(goal: UserNutritionGoal): UserNutritionData {
  return {
    userId: goal.user_id,
    carbon: goal.carbon,
    protein: goal.protein,
    fat: goal.fat,
    salt: goal.salt,
    calorie: goal.calorie,
    createdTime: goal.created_time,
    updatedTime: goal.updated_time,
  };
}

/** 存储 data → core UserNutritionGoal（entityKey 即 user_id） */
function toUserNutritionGoal(
  entityKey: string,
  data: UserNutritionData,
): UserNutritionGoal {
  return {
    user_id: entityKey,
    carbon: data.carbon,
    protein: data.protein,
    fat: data.fat,
    salt: data.salt,
    calorie: data.calorie,
    created_time: data.createdTime,
    updated_time: data.updatedTime,
  };
}

/** 历史版本项：版本号 + 对应时间点的营养目标数据 */
export interface UserNutritionHistoryItem {
  version: number;
  data: UserNutritionGoal;
  created_time: string;
  created_by_user_id: number;
}

/** MetadataVersion → UserNutritionHistoryItem（entityKey 即 user_id） */
function toUserNutritionHistoryItem(
  entityKey: string,
  version: MetadataVersion,
): UserNutritionHistoryItem {
  return {
    version: version.version,
    data: toUserNutritionGoal(
      entityKey,
      version.data as unknown as UserNutritionData,
    ),
    created_time: version.createdAt,
    created_by_user_id: version.createdByUserId,
  };
}

/**
 * 用户营养目标仓储：基于 MetaSDK 存储，每个用户单例数据。
 * - entityKey 使用 user_id
 * - save 为 upsert 语义：存在则更新，不存在则创建
 */
export class UserNutritionRespository {
  private readonly sdk: MetaSdkLike;
  private readonly userIdProvider: UserIdProvider;

  constructor(sdk: MetaSdkLike, userIdProvider: UserIdProvider) {
    this.sdk = sdk;
    this.userIdProvider = userIdProvider;
  }

  /** 解析当前登录用户；无有效登录态时抛错 */
  private async resolveUserId(): Promise<string> {
    const userId = await this.userIdProvider();
    if (userId == null || userId === "") {
      throw new Error("无法解析当前登录用户：userIdProvider 返回空");
    }
    return userId;
  }

  /** 获取当前登录用户的营养目标，不存在返回 null */
  async getMine(): Promise<UserNutritionGoal | null> {
    const userId = await this.resolveUserId();
    try {
      const entry = await this.sdk.entries.get(USER_NUTRITION_TYPE_NAME, userId);
      return toUserNutritionGoal(
        entry.entityKey,
        entry.data as unknown as UserNutritionData,
      );
    } catch (err) {
      if (isNotFoundError(err)) return null;
      throw err;
    }
  }

  /**
   * 保存当前登录用户的营养目标（upsert）。
   * - 已存在：更新字段与 updated_time
   * - 不存在：创建新记录，设置 created_time
   */
  async save(params: SaveUserNutritionParams): Promise<UserNutritionGoal> {
    const userId = await this.resolveUserId();
    const existing = await this.getMine();

    if (existing != null) {
      const updated: UserNutritionGoal = {
        ...existing,
        carbon: params.carbon,
        protein: params.protein,
        fat: params.fat,
        salt: params.salt,
        calorie: params.calorie,
        updated_time: new Date().toISOString(),
      };
      await this.sdk.entries.update(USER_NUTRITION_TYPE_NAME, userId, {
        data: toUserNutritionData(updated) as unknown as Record<string, unknown>,
      });
      return updated;
    }

    const created: UserNutritionGoal = {
      user_id: userId,
      carbon: params.carbon,
      protein: params.protein,
      fat: params.fat,
      salt: params.salt,
      calorie: params.calorie,
      created_time: new Date().toISOString(),
      updated_time: null,
    };
    await this.sdk.entries.create({
      typeName: USER_NUTRITION_TYPE_NAME,
      entityKey: userId,
      data: toUserNutritionData(created) as unknown as Record<string, unknown>,
    });
    return created;
  }

  /** 删除当前登录用户的营养目标（重置） */
  async delete(): Promise<void> {
    const userId = await this.resolveUserId();
    await this.sdk.entries.delete(USER_NUTRITION_TYPE_NAME, userId);
  }

  /* ── 历史版本（MetaSDK 自带版本历史能力） ── */

  /** 获取当前登录用户营养目标的历史版本列表（按版本倒序，最新在前） */
  async listHistory(params?: {
    page?: number;
    pageSize?: number;
  }): Promise<{ total: number; items: UserNutritionHistoryItem[] }> {
    const userId = await this.resolveUserId();
    const result = await this.sdk.entries.listVersions(
      USER_NUTRITION_TYPE_NAME,
      userId,
      params,
    );
    return {
      total: result.total,
      items: result.items.map((v) => toUserNutritionHistoryItem(userId, v)),
    };
  }

  /** 获取当前登录用户营养目标的指定历史版本 */
  async getByVersion(version: number): Promise<UserNutritionGoal | null> {
    const userId = await this.resolveUserId();
    try {
      const entry = await this.sdk.entries.get(USER_NUTRITION_TYPE_NAME, userId, {
        version,
      });
      return toUserNutritionGoal(
        entry.entityKey,
        entry.data as unknown as UserNutritionData,
      );
    } catch (err) {
      if (isNotFoundError(err)) return null;
      throw err;
    }
  }

  /** 回滚当前登录用户的营养目标到指定版本（生成新版本，数据取回滚目标） */
  async rollback(version: number): Promise<UserNutritionGoal> {
    const userId = await this.resolveUserId();
    const entry = await this.sdk.entries.rollback(USER_NUTRITION_TYPE_NAME, userId, {
      version,
    });
    return toUserNutritionGoal(
      entry.entityKey,
      entry.data as unknown as UserNutritionData,
    );
  }
}
