import { describe, test } from "node:test";
import assert from "node:assert/strict";

import type {
  CreateEntryParams,
  EntriesClient,
  MetadataEntry,
} from "../../sdk/meta-sdk/index.js";
import type { UserBodyProfile } from "../../core/model/index.js";
import { UserBodyRespository } from "./UserBodyRespository.js";

/* ──────────────── 测试数据 ──────────────── */

/** raw data：严格对齐 MetaSDK entity schema，只含业务字段 */
const userBodyRawData = {
  date: "2026-09-09",
  age: 25,
  height: 180,
  weight: 75,
};

/** 期望的领域模型（snake_case，特殊字段从 entry 元数据取） */
const expectedUserBody: UserBodyProfile = {
  id: "body-1",
  user_id: "1",
  date: "2026-09-09",
  age: 25,
  height: 180,
  weight: 75,
  created_time: "2026-09-09T00:00:00.000Z",
  updated_time: null,
};

function makeEntryResponse(overrides: Partial<MetadataEntry> = {}): MetadataEntry {
  return {
    id: 1,
    typeName: "user_body",
    entityKey: "body-1",
    data: userBodyRawData as unknown as Record<string, unknown>,
    tags: [],
    version: 1,
    ownerUserId: 1,
    serviceName: "caloplan",
    createdAt: "2026-09-09T00:00:00.000Z",
    updatedAt: null,
    ...overrides,
  };
}

/* ──────────────── SDK Stub 工厂 ──────────────── */

interface Call {
  method: string;
  args: unknown[];
}

function makeEntries(overrides: Partial<EntriesClient> = {}): {
  entries: EntriesClient;
  calls: Call[];
} {
  const calls: Call[] = [];
  const base: EntriesClient = {
    create: async () => ({} as MetadataEntry),
    get: async () => ({} as MetadataEntry),
    update: async () => ({} as MetadataEntry),
    delete: async () => {},
    query: async () => ({ total: 0, items: [] }),
    listVersions: async () => ({ total: 0, items: [] }),
    rollback: async () => ({} as MetadataEntry),
  };
  const entries = {} as EntriesClient;
  (Object.keys(base) as (keyof EntriesClient)[]).forEach((key) => {
    entries[key] = (async (...args: unknown[]) => {
      calls.push({ method: key, args });
      const impl = overrides[key] ?? base[key];
      return (impl as (...a: unknown[]) => unknown)(...args);
    }) as never;
  });
  return { entries, calls };
}

function makeRepo(
  overrides: Partial<EntriesClient> = {},
  userIdProvider: () => string | null | Promise<string | null> = () => "1",
): {
  repo: UserBodyRespository;
  calls: Call[];
} {
  const { entries, calls } = makeEntries(overrides);
  return { repo: new UserBodyRespository({ entries }, userIdProvider), calls };
}

/* ──────────────── 测试 ──────────────── */

describe("UserBodyRespository", () => {
  describe("CRUD", () => {
    test("create 生成 nanoid id，data 只存业务字段（不含 id/userId/createdTime）", async () => {
      const { repo, calls } = makeRepo({
        create: async (params: CreateEntryParams) =>
          makeEntryResponse({ entityKey: params.entityKey, data: params.data }),
      });

      const result = await repo.create({ age: 25, height: 180, weight: 75 });

      assert.equal(result.user_id, "1");
      assert.equal(result.age, 25);
      assert.equal(result.height, 180);
      assert.equal(result.weight, 75);
      assert.ok(result.id.length > 0);
      assert.ok(result.date.match(/^\d{4}-\d{2}-\d{2}$/));
      assert.equal(calls.length, 1);
      assert.equal(calls[0]!.method, "create");
      const [params] = calls[0]!.args as [Record<string, unknown>];
      assert.equal(params.typeName, "user_body");
      assert.equal(params.entityKey, result.id);
      const data = params.data as Record<string, unknown>;
      // data 只含业务字段
      assert.equal(data.age, 25);
      assert.equal(data.height, 180);
      assert.equal(data.weight, 75);
      assert.ok("date" in data);
      // 不含 meta 字段
      assert.equal("id" in data, false);
      assert.equal("userId" in data, false);
      assert.equal("user_id" in data, false);
      assert.equal("createdTime" in data, false);
      assert.equal("updatedTime" in data, false);
    });

    test("create 支持指定 date", async () => {
      const { repo } = makeRepo({
        create: async (params: CreateEntryParams) =>
          makeEntryResponse({ entityKey: params.entityKey, data: params.data }),
      });

      const result = await repo.create({
        date: "2026-01-01",
        age: 25,
        height: 180,
        weight: 75,
      });

      assert.equal(result.date, "2026-01-01");
    });

    test("getById 从 entry 元数据取 id/user_id/created_time，返回 snake_case", async () => {
      const { repo, calls } = makeRepo({ get: async () => makeEntryResponse() });

      const result = await repo.getById("body-1");

      assert.deepEqual(result, expectedUserBody);
      assert.equal(calls.length, 1);
      assert.deepEqual(calls[0]!.args, ["user_body", "body-1"]);
    });

    test("getById 不存在时返回 null（statusCode 404）", async () => {
      const { repo } = makeRepo({
        get: async () => {
          throw Object.assign(new Error("Not Found"), { statusCode: 404 });
        },
      });

      assert.equal(await repo.getById("not-exist"), null);
    });

    test("getByDate 用 ownerUserId + date 过滤，取第一条", async () => {
      const { repo, calls } = makeRepo({
        query: async () => ({ total: 1, items: [makeEntryResponse()] }),
      });

      const result = await repo.getByDate("2026-09-09");

      assert.deepEqual(result, expectedUserBody);
      assert.equal(calls.length, 1);
      assert.equal(calls[0]!.method, "query");
      const [params] = calls[0]!.args as [Record<string, unknown>];
      assert.equal(params.typeName, "user_body");
      assert.equal(params.ownerUserId, 1);
      assert.deepEqual(params.filters, { date: "2026-09-09" });
      // 不再用 filters.user_id
      assert.equal("user_id" in (params.filters as object), false);
    });

    test("getByDate 无匹配时返回 null", async () => {
      const { repo } = makeRepo({ query: async () => ({ total: 0, items: [] }) });

      assert.equal(await repo.getByDate("2026-01-01"), null);
    });

    test("update 按 id 更新，data 只存业务字段，保留原 date", async () => {
      const { repo, calls } = makeRepo({
        get: async () => makeEntryResponse(),
        update: async () => makeEntryResponse({ data: { ...userBodyRawData, weight: 80 } }),
      });

      const result = await repo.update({ id: "body-1", weight: 80 });

      assert.equal(result.id, "body-1");
      assert.equal(result.weight, 80);
      assert.equal(result.age, 25); // 未变更字段保留
      assert.equal(result.height, 180);
      assert.equal(result.created_time, "2026-09-09T00:00:00.000Z");
      // get（获取现有数据）+ update
      assert.equal(calls.length, 2);
      assert.equal(calls[1]!.method, "update");
      const [typeName, entityKey, params] = calls[1]!.args as [
        string,
        string,
        Record<string, unknown>,
      ];
      assert.equal(typeName, "user_body");
      assert.equal(entityKey, "body-1");
      const data = params.data as Record<string, unknown>;
      assert.equal(data.weight, 80);
      assert.equal(data.age, 25);
      assert.equal(data.date, "2026-09-09");
      // 不含 meta 字段
      assert.equal("id" in data, false);
      assert.equal("userId" in data, false);
    });

    test("update 记录不存在时抛 404", async () => {
      const { repo, calls } = makeRepo({
        get: async () => {
          throw Object.assign(new Error("Not Found"), { statusCode: 404 });
        },
      });

      await assert.rejects(() => repo.update({ id: "not-exist", weight: 80 }), /不存在/);
      assert.equal(calls.length, 1); // 只有 get，没有 update
    });

    test("delete 按 id 删除", async () => {
      const { repo, calls } = makeRepo();

      await repo.delete("body-1");

      assert.equal(calls.length, 1);
      assert.equal(calls[0]!.method, "delete");
      assert.deepEqual(calls[0]!.args, ["user_body", "body-1"]);
    });
  });

  describe("listMine", () => {
    test("listMine 无参数时用 ownerUserId 过滤当前用户", async () => {
      const { repo, calls } = makeRepo({
        query: async () => ({ total: 1, items: [makeEntryResponse()] }),
      });

      const result = await repo.listMine();

      assert.equal(result.total, 1);
      assert.deepEqual(result.items[0], expectedUserBody);
      const [params] = calls[0]!.args as [Record<string, unknown>];
      assert.equal(params.typeName, "user_body");
      assert.equal(params.ownerUserId, 1);
      assert.equal(params.filters, undefined);
    });

    test("listMine 精确 date 查询用 ownerUserId + filters.date", async () => {
      const { repo, calls } = makeRepo({
        query: async () => ({ total: 1, items: [makeEntryResponse()] }),
      });

      await repo.listMine({ date: "2026-09-09" });

      const [params] = calls[0]!.args as [Record<string, unknown>];
      assert.equal(params.ownerUserId, 1);
      assert.deepEqual(params.filters, { date: "2026-09-09" });
    });

    test("listMine 时间范围查询用 ownerUserId + createdAfter/createdBefore + 内存过滤", async () => {
      const { repo, calls } = makeRepo({
        query: async () => ({ total: 1, items: [makeEntryResponse()] }),
      });

      const result = await repo.listMine({
        start_date: "2026-09-01",
        end_date: "2026-09-30",
      });

      assert.equal(result.total, 1);
      const [params] = calls[0]!.args as [Record<string, unknown>];
      assert.equal(params.ownerUserId, 1);
      assert.equal(params.createdAfter, "2026-09-01T00:00:00.000Z");
      assert.equal(params.createdBefore, "2026-09-30T23:59:59.999Z");
    });

    test("listMine 时间范围内存过滤掉范围外的记录", async () => {
      const outOfRangeEntry: MetadataEntry = makeEntryResponse({
        entityKey: "body-2",
        data: { ...userBodyRawData, date: "2026-08-01" },
      });
      const { repo } = makeRepo({
        query: async () => ({
          total: 2,
          items: [makeEntryResponse(), outOfRangeEntry],
        }),
      });

      const result = await repo.listMine({
        start_date: "2026-09-01",
        end_date: "2026-09-30",
      });

      assert.equal(result.total, 1);
      assert.equal(result.items[0]!.date, "2026-09-09");
    });

    test("listMine 无登录态时抛错且不调用 SDK", async () => {
      const { repo, calls } = makeRepo({}, () => null);

      await assert.rejects(() => repo.listMine(), /无法解析当前登录用户/);
      assert.equal(calls.length, 0);
    });
  });

  describe("历史版本", () => {
    test("listHistory 调用 entries.listVersions，data 只含业务字段，owner 从 version 取", async () => {
      const { repo, calls } = makeRepo({
        listVersions: async () => ({
          total: 1,
          items: [
            {
              version: 2,
              data: userBodyRawData,
              tags: [],
              createdAt: "2026-09-10T00:00:00.000Z",
              createdByUserId: 1,
            },
          ],
        }),
      });

      const result = await repo.listHistory("body-1");

      assert.equal(result.total, 1);
      assert.equal(result.items[0]!.version, 2);
      assert.equal(result.items[0]!.data.age, 25);
      assert.equal(result.items[0]!.data.user_id, "1");
      assert.equal(result.items[0]!.data.id, "body-1");
      assert.equal(calls.length, 1);
      assert.equal(calls[0]!.method, "listVersions");
      assert.deepEqual(calls[0]!.args, ["user_body", "body-1", undefined]);
    });

    test("getByVersion 调用 entries.get 并传入 version 参数", async () => {
      const { repo, calls } = makeRepo({ get: async () => makeEntryResponse() });

      const result = await repo.getByVersion("body-1", 1);

      assert.deepEqual(result, expectedUserBody);
      const [, , options] = calls[0]!.args as [string, string, Record<string, unknown>];
      assert.equal(options.version, 1);
    });

    test("rollback 调用 entries.rollback 并返回回滚后的 snake_case 数据", async () => {
      const { repo, calls } = makeRepo({
        rollback: async () => makeEntryResponse(),
      });

      const result = await repo.rollback("body-1", 1);

      assert.deepEqual(result, expectedUserBody);
      assert.equal(calls.length, 1);
      assert.equal(calls[0]!.method, "rollback");
      const [typeName, entityKey, params] = calls[0]!.args as [
        string,
        string,
        Record<string, unknown>,
      ];
      assert.equal(typeName, "user_body");
      assert.equal(entityKey, "body-1");
      assert.equal(params.version, 1);
    });
  });
});
