import type { PaginationParams } from "./common.js";

export interface MetadataEntry {
  id: number;
  typeName: string;
  entityKey: string;
  data: Record<string, unknown>;
  tags: string[];
  version: number;
  ownerUserId: number;
  serviceName: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface CreateEntryParams {
  typeName: string;
  entityKey: string;
  data: Record<string, unknown>;
  tags?: string[];
  serviceName?: string;
}

export interface UpdateEntryParams {
  data?: Record<string, unknown>;
  tags?: string[];
}

export interface GetEntryOptions {
  version?: number;
}

export interface QueryEntriesParams extends PaginationParams {
  typeName?: string;
  serviceName?: string;
  ownerUserId?: number;
  filters?: Record<string, unknown>;
  tags?: string[];
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  createdAfter?: string;
  createdBefore?: string;
}

/** 历史版本元数据 */
export interface MetadataVersion {
  version: number;
  data: Record<string, unknown>;
  tags: string[];
  createdAt: string;
  createdByUserId: number;
}

/** 列出版本历史参数 */
export interface ListVersionsParams extends PaginationParams {}

/** 回滚到指定版本参数 */
export interface RollbackParams {
  version: number;
}
