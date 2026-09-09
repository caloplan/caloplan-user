import type { MetaSdkLike } from "../../sdk/meta-sdk/index.js";
import type { MetadataVersion } from "../../sdk/meta-sdk/index.js";
import type {
  SaveUserBodyParams,
  UserBodyProfile,
} from "../../core/model/index.js";
import type { UserIdProvider } from "../type.js";
import { isNotFoundError } from "../type.js";

/** meta 微服务中 user_body 类型的 type_name */
const USER_BODY_TYPE_NAME = "user_body";

/**
 * 存储层用户身体指标数据（camelCase，与 MetaSDK 契约一致）。
 * 每个用户单例数据，entityKey 使用 user_id。
 */
interface UserBodyData {
  userId: string;
  age: number;
  height: number;
  weight: number;
  createdTime: string;
  updatedTime: string | null;
}

/** core UserBodyProfile → 存储 data（camelCase） */
function toUserBodyData(profile: UserBodyProfile): UserBodyData {
  return {
    userId: profile.user_id,
    age: profile.age,
    height: profile.height,
    weight: profile.weight,
    createdTime: profile.created_time,
    updatedTime: profile.updated_time,
  };
}

/** 存储 data → core UserBodyProfile（entityKey 即 user_id） */
function toUserBodyProfile(entityKey: string, data: UserBodyData): UserBodyProfile {
  return {
    user_id: entityKey,
    age: data.age,
    height: data.height,
    weight: data.weight,
    created_time: data.createdTime,
    updated_time: data.updatedTime,
  };
}

/** 历史版本项：版本号 + 对应时间点的身体指标数据 */
export interface UserBodyHistoryItem {
  version: number;
  data: UserBodyProfile;
  created_time: string;
  created_by_user_id: number;
}

/** MetadataVersion → UserBodyHistoryItem（entityKey 即 user_id） */
function toUserBodyHistoryItem(
  entityKey: string,
  version: MetadataVersion,
): UserBodyHistoryItem {
  return {
    version: version.version,
    data: toUserBodyProfile(entityKey, version.data as unknown as UserBodyData),
    created_time: version.createdAt,
    created_by_user_id: version.createdByUserId,
  };
}

/**
 * 用户身体指标仓储：基于 MetaSDK 存储，每个用户单例数据。
 * - entityKey 使用 user_id
 * - save 为 upsert 语义：存在则更新，不存在则创建
 */
export class UserBodyRespository {
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

  /** 获取当前登录用户的身体指标，不存在返回 null */
  async getMine(): Promise<UserBodyProfile | null> {
    const userId = await this.resolveUserId();
    try {
      const entry = await this.sdk.entries.get(USER_BODY_TYPE_NAME, userId);
      return toUserBodyProfile(entry.entityKey, entry.data as unknown as UserBodyData);
    } catch (err) {
      if (isNotFoundError(err)) return null;
      throw err;
    }
  }

  /**
   * 保存当前登录用户的身体指标（upsert）。
   * - 已存在：更新字段与 updated_time
   * - 不存在：创建新记录，设置 created_time
   */
  async save(params: SaveUserBodyParams): Promise<UserBodyProfile> {
    const userId = await this.resolveUserId();
    const existing = await this.getMine();

    if (existing != null) {
      const updated: UserBodyProfile = {
        ...existing,
        age: params.age,
        height: params.height,
        weight: params.weight,
        updated_time: new Date().toISOString(),
      };
      await this.sdk.entries.update(USER_BODY_TYPE_NAME, userId, {
        data: toUserBodyData(updated) as unknown as Record<string, unknown>,
      });
      return updated;
    }

    const created: UserBodyProfile = {
      user_id: userId,
      age: params.age,
      height: params.height,
      weight: params.weight,
      created_time: new Date().toISOString(),
      updated_time: null,
    };
    await this.sdk.entries.create({
      typeName: USER_BODY_TYPE_NAME,
      entityKey: userId,
      data: toUserBodyData(created) as unknown as Record<string, unknown>,
    });
    return created;
  }

  /** 删除当前登录用户的身体指标（重置） */
  async delete(): Promise<void> {
    const userId = await this.resolveUserId();
    await this.sdk.entries.delete(USER_BODY_TYPE_NAME, userId);
  }

  /* ── 历史版本（MetaSDK 自带版本历史能力） ── */

  /** 获取当前登录用户身体指标的历史版本列表（按版本倒序，最新在前） */
  async listHistory(params?: {
    page?: number;
    pageSize?: number;
  }): Promise<{ total: number; items: UserBodyHistoryItem[] }> {
    const userId = await this.resolveUserId();
    const result = await this.sdk.entries.listVersions(
      USER_BODY_TYPE_NAME,
      userId,
      params,
    );
    return {
      total: result.total,
      items: result.items.map((v) => toUserBodyHistoryItem(userId, v)),
    };
  }

  /** 获取当前登录用户身体指标的指定历史版本 */
  async getByVersion(version: number): Promise<UserBodyProfile | null> {
    const userId = await this.resolveUserId();
    try {
      const entry = await this.sdk.entries.get(USER_BODY_TYPE_NAME, userId, {
        version,
      });
      return toUserBodyProfile(entry.entityKey, entry.data as unknown as UserBodyData);
    } catch (err) {
      if (isNotFoundError(err)) return null;
      throw err;
    }
  }

  /** 回滚当前登录用户的身体指标到指定版本（生成新版本，数据取回滚目标） */
  async rollback(version: number): Promise<UserBodyProfile> {
    const userId = await this.resolveUserId();
    const entry = await this.sdk.entries.rollback(USER_BODY_TYPE_NAME, userId, {
      version,
    });
    return toUserBodyProfile(entry.entityKey, entry.data as unknown as UserBodyData);
  }
}
