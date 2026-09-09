import { nanoid } from "nanoid";
import type { MetaSdkLike } from "../../sdk/meta-sdk/index.js";
import type {
  MetadataEntry,
  MetadataVersion,
} from "../../sdk/meta-sdk/index.js";
import type {
  CreateUserNutritionParams,
  ListUserNutritionParams,
  UpdateUserNutritionParams,
  UserNutritionGoal,
} from "../../core/model/index.js";
import type { UserIdProvider } from "../type.js";
import { isNotFoundError } from "../type.js";

/** meta 微服务中 user_nutrition_goal 类型的 type_name */
const USER_NUTRITION_TYPE_NAME = "user_nutrition_goal";

/**
 * 存储层 raw data（严格对齐 MetaSDK entity schema，只含业务字段）。
 * id / userId / createdTime / updatedTime 由 MetaSDK entry 元数据承载，不存入 data。
 */
interface UserNutritionRawData {
  date: string;
  carbon: number;
  protein: number;
  fat: number;
  salt: number;
  calorie: number;
}

/** MetadataEntry → core UserNutritionGoal（特殊字段从 entry 元数据取） */
function toUserNutritionGoal(entry: MetadataEntry): UserNutritionGoal {
  const data = entry.data as unknown as UserNutritionRawData;
  return {
    id: entry.entityKey,
    user_id: String(entry.ownerUserId),
    date: data.date,
    carbon: data.carbon,
    protein: data.protein,
    fat: data.fat,
    salt: data.salt,
    calorie: data.calorie,
    created_time: entry.createdAt,
    updated_time: entry.updatedAt,
  };
}

/** core CreateUserNutritionParams → 存储 raw data（只含业务字段） */
function toUserNutritionRawData(params: CreateUserNutritionParams): UserNutritionRawData {
  return {
    date: params.date ?? todayString(),
    carbon: params.carbon,
    protein: params.protein,
    fat: params.fat,
    salt: params.salt,
    calorie: params.calorie,
  };
}

/** 历史版本项：版本号 + 对应时间点的营养目标数据 */
export interface UserNutritionHistoryItem {
  version: number;
  data: UserNutritionGoal;
  created_time: string;
  created_by_user_id: number;
}

/** MetadataVersion → UserNutritionHistoryItem（entityKey 即 id，owner 从 version 取） */
function toUserNutritionHistoryItem(
  entityKey: string,
  version: MetadataVersion,
): UserNutritionHistoryItem {
  const data = version.data as unknown as UserNutritionRawData;
  return {
    version: version.version,
    data: {
      id: entityKey,
      user_id: String(version.createdByUserId),
      date: data.date,
      carbon: data.carbon,
      protein: data.protein,
      fat: data.fat,
      salt: data.salt,
      calorie: data.calorie,
      created_time: version.createdAt,
      updated_time: null,
    },
    created_time: version.createdAt,
    created_by_user_id: version.createdByUserId,
  };
}

/** 获取当天日期字符串 YYYY-MM-DD（本地时区） */
function todayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** date 字符串转 ISO 时间（当天 00:00:00），用于 createdAfter/createdBefore 查询 */
function dateToStartOfDay(date: string): string {
  return `${date}T00:00:00.000Z`;
}

function dateToEndOfDay(date: string): string {
  return `${date}T23:59:59.999Z`;
}

/**
 * 用户营养目标仓储：基于 MetaSDK 存储，用户按天记录。
 *
 * 数据分层：
 * - raw data（存入 MetaSDK entry.data）：只含业务字段 date/carbon/protein/fat/salt/calorie，严格对齐 entity schema
 * - meta 字段（MetaSDK entry 元数据）：entityKey(id) / ownerUserId(user_id) / createdAt / updatedAt
 *
 * - entityKey 使用独立 id（nanoid）
 * - create 纯创建，不做唯一性限制（业务层限制每天一次）
 * - update 按 id 更新，仅传变更字段
 * - listMine 支持按 date 精确匹配 / start_date~end_date 时间范围查询
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

  /* ── CRUD ── */

  /** 创建营养目标记录（date 不传默认当天） */
  async create(params: CreateUserNutritionParams): Promise<UserNutritionGoal> {
    const userId = await this.resolveUserId();
    const id = nanoid();
    const rawData = toUserNutritionRawData(params);

    const entry = await this.sdk.entries.create({
      typeName: USER_NUTRITION_TYPE_NAME,
      entityKey: id,
      data: rawData as unknown as Record<string, unknown>,
    });
    return toUserNutritionGoal(entry);
  }

  /** 按 id 查询营养目标，不存在返回 null */
  async getById(id: string): Promise<UserNutritionGoal | null> {
    try {
      const entry = await this.sdk.entries.get(USER_NUTRITION_TYPE_NAME, id);
      return toUserNutritionGoal(entry);
    } catch (err) {
      if (isNotFoundError(err)) return null;
      throw err;
    }
  }

  /** 按日期查询当前用户的营养目标，不存在返回 null */
  async getByDate(date: string): Promise<UserNutritionGoal | null> {
    const userId = await this.resolveUserId();
    const { items } = await this.sdk.entries.query({
      typeName: USER_NUTRITION_TYPE_NAME,
      ownerUserId: Number(userId),
      filters: { date },
    });
    if (items.length === 0) return null;
    return toUserNutritionGoal(items[0]!);
  }

  /** 按 id 更新营养目标（仅传变更字段，保留原 created_time） */
  async update(params: UpdateUserNutritionParams): Promise<UserNutritionGoal> {
    const existing = await this.getById(params.id);
    if (existing == null) {
      throw Object.assign(new Error("营养目标记录不存在"), { statusCode: 404 });
    }

    // 合并变更字段到 raw data
    const rawData: UserNutritionRawData = {
      date: existing.date,
      carbon: params.carbon ?? existing.carbon,
      protein: params.protein ?? existing.protein,
      fat: params.fat ?? existing.fat,
      salt: params.salt ?? existing.salt,
      calorie: params.calorie ?? existing.calorie,
    };

    const entry = await this.sdk.entries.update(USER_NUTRITION_TYPE_NAME, params.id, {
      data: rawData as unknown as Record<string, unknown>,
    });
    return toUserNutritionGoal(entry);
  }

  /** 按 id 删除营养目标 */
  async delete(id: string): Promise<void> {
    await this.sdk.entries.delete(USER_NUTRITION_TYPE_NAME, id);
  }

  /**
   * 查询当前用户的营养目标列表。
   * - date: 精确匹配某一天
   * - start_date / end_date: 时间范围（含边界），用 createdAfter/createdBefore 缩小范围 + 内存按 date 过滤
   * - page / pageSize: 分页
   */
  async listMine(
    params?: ListUserNutritionParams,
  ): Promise<{ total: number; items: UserNutritionGoal[] }> {
    const userId = await this.resolveUserId();

    // 精确 date 查询：ownerUserId + field_filters
    if (params?.date != null) {
      const { items, total } = await this.sdk.entries.query({
        typeName: USER_NUTRITION_TYPE_NAME,
        ownerUserId: Number(userId),
        filters: { date: params.date },
        page: params.page,
        pageSize: params.pageSize,
      });
      return {
        total,
        items: items.map((entry) => toUserNutritionGoal(entry)),
      };
    }

    // 时间范围查询：用 createdAfter/createdBefore 缩小范围，再内存按 date 过滤
    const queryParams: Record<string, unknown> = {
      typeName: USER_NUTRITION_TYPE_NAME,
      ownerUserId: Number(userId),
    };
    if (params?.start_date != null) {
      queryParams.createdAfter = dateToStartOfDay(params.start_date);
    }
    if (params?.end_date != null) {
      queryParams.createdBefore = dateToEndOfDay(params.end_date);
    }
    if (params?.page != null) queryParams.page = params.page;
    if (params?.pageSize != null) queryParams.pageSize = params.pageSize;

    const { items, total } = await this.sdk.entries.query(
      queryParams as Parameters<MetaSdkLike["entries"]["query"]>[0],
    );

    const goals = items.map((entry) => toUserNutritionGoal(entry));

    // 内存中按 date 精确过滤（确保范围准确）
    const filtered = goals.filter((g) => {
      if (params?.start_date != null && g.date < params.start_date) return false;
      if (params?.end_date != null && g.date > params.end_date) return false;
      return true;
    });

    return { total: filtered.length, items: filtered };
  }

  /* ── 历史版本（MetaSDK 自带版本历史能力） ── */

  /** 获取指定记录的历史版本列表（按版本倒序，最新在前） */
  async listHistory(
    id: string,
    params?: { page?: number; pageSize?: number },
  ): Promise<{ total: number; items: UserNutritionHistoryItem[] }> {
    const result = await this.sdk.entries.listVersions(
      USER_NUTRITION_TYPE_NAME,
      id,
      params,
    );
    return {
      total: result.total,
      items: result.items.map((v) => toUserNutritionHistoryItem(id, v)),
    };
  }

  /** 获取指定记录的指定历史版本 */
  async getByVersion(id: string, version: number): Promise<UserNutritionGoal | null> {
    try {
      const entry = await this.sdk.entries.get(USER_NUTRITION_TYPE_NAME, id, { version });
      return toUserNutritionGoal(entry);
    } catch (err) {
      if (isNotFoundError(err)) return null;
      throw err;
    }
  }

  /** 回滚指定记录到指定版本（生成新版本，数据取回滚目标，不删除历史） */
  async rollback(id: string, version: number): Promise<UserNutritionGoal> {
    const entry = await this.sdk.entries.rollback(USER_NUTRITION_TYPE_NAME, id, {
      version,
    });
    return toUserNutritionGoal(entry);
  }
}
