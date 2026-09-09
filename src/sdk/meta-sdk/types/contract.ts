import type { PaginatedResponse } from "./common.js";
import type {
  CreateEntryParams,
  GetEntryOptions,
  ListVersionsParams,
  MetadataEntry,
  MetadataVersion,
  QueryEntriesParams,
  RollbackParams,
  UpdateEntryParams,
} from "./entry.js";

/**
 * Repository 依赖的 entries 客户端最小契约。
 * 外部 MetaSDK 实例（含完整实现）满足此结构即可注入，本库不包含 SDK 实现。
 */
export interface EntriesClient {
  create(params: CreateEntryParams): Promise<MetadataEntry>;
  get(
    typeName: string,
    entityKey: string,
    options?: GetEntryOptions,
  ): Promise<MetadataEntry>;
  update(
    typeName: string,
    entityKey: string,
    params: UpdateEntryParams,
  ): Promise<MetadataEntry>;
  delete(typeName: string, entityKey: string): Promise<void>;
  query(params: QueryEntriesParams): Promise<PaginatedResponse<MetadataEntry>>;
  /** 列出版本历史（MetaSDK 自带历史版本能力） */
  listVersions(
    typeName: string,
    entityKey: string,
    params?: ListVersionsParams,
  ): Promise<PaginatedResponse<MetadataVersion>>;
  /** 回滚到指定版本（生成新版本，数据取回滚目标） */
  rollback(
    typeName: string,
    entityKey: string,
    params: RollbackParams,
  ): Promise<MetadataEntry>;
}

/** Repository 依赖的 MetaSDK 最小结构契约 */
export interface MetaSdkLike {
  entries: EntriesClient;
}

/** SDK 错误的结构化形状：按字段判断（如 statusCode === 404），不依赖具体错误类 */
export interface SdkErrorLike {
  statusCode?: number;
}
