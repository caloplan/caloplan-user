import { describe, test } from "node:test";
import assert from "node:assert/strict";

import type {
  EntriesClient,
  MetadataEntry,
} from "../../sdk/meta-sdk/index.js";
import type { UserBodyProfile } from "../../core/model/index.js";
import { UserBodyRespository } from "./UserBodyRespository.js";

/* ──────────────── 测试数据 ──────────────── */

const userBodyData = {
  userId: "user-1",
  age: 25,
  height: 180,
  weight: 75,
  createdTime: "2026-09-01T00:00:00.000Z",
  updatedTime: "2026-09-07T00:00:00.000Z",
};

const expectedUserBody: UserBodyProfile = {
  user_id: "user-1",
  age: 25,
  height: 180,
  weight: 75,
  created_time: "2026-09-01T00:00:00.000Z",
  updated_time: "2026-09-07T00:00:00.000Z",
};

function makeEntryResponse(): MetadataEntry {
  return {
    id: 1,
    typeName: "user_body",
    entityKey: "user-1",
    data: userBodyData as unknown as Record<string, unknown>,
    tags: [],
    version: 1,
    ownerUserId: 1,
    serviceName: "caloplan",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-07T00:00:00.000Z",
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
  userIdProvider: () => string | null | Promise<string | null> = () => "user-1",
): {
  repo: UserBodyRespository;
  calls: Call[];
} {
  const { entries, calls } = makeEntries(overrides);
  return { repo: new UserBodyRespository({ entries }, userIdProvider), calls };
}

/* ──────────────── 测试 ──────────────── */

describe("UserBodyRespository", () => {
  test("getMine 返回 snake_case UserBodyProfile", async () => {
    const { repo, calls } = makeRepo({ get: async () => makeEntryResponse() });

    const result = await repo.getMine();

    assert.deepEqual(result, expectedUserBody);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.method, "get");
    assert.deepEqual(calls[0]!.args, ["user_body", "user-1"]);
  });

  test("getMine 在记录不存在时返回 null（statusCode 404）", async () => {
    const { repo } = makeRepo({
      get: async () => {
        throw Object.assign(new Error("Not Found"), { statusCode: 404 });
      },
    });

    const result = await repo.getMine();

    assert.equal(result, null);
  });

  test("getMine 非 404 错误直接透传", async () => {
    const { repo } = makeRepo({
      get: async () => {
        throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
      },
    });

    await assert.rejects(() => repo.getMine(), /Forbidden/);
  });

  test("save 在记录不存在时创建新记录，调用 entries.create", async () => {
    const { repo, calls } = makeRepo({
      get: async () => {
        throw Object.assign(new Error("Not Found"), { statusCode: 404 });
      },
    });

    const result = await repo.save({ age: 25, height: 180, weight: 75 });

    assert.equal(result.user_id, "user-1");
    assert.equal(result.age, 25);
    assert.equal(result.height, 180);
    assert.equal(result.weight, 75);
    assert.equal(result.updated_time, null);
    // get（404）+ create
    assert.equal(calls.length, 2);
    assert.equal(calls[1]!.method, "create");
    const [params] = calls[1]!.args as [Record<string, unknown>];
    assert.equal(params.typeName, "user_body");
    assert.equal(params.entityKey, "user-1");
    const data = params.data as Record<string, unknown>;
    assert.equal(data.userId, "user-1");
    assert.equal(data.age, 25);
    assert.equal(data.height, 180);
    assert.equal(data.weight, 75);
    // 确认没有 snake_case 字段泄漏到 SDK 契约
    assert.equal("user_id" in data, false);
    assert.equal("created_time" in data, false);
  });

  test("save 在记录已存在时更新，调用 entries.update", async () => {
    const { repo, calls } = makeRepo({ get: async () => makeEntryResponse() });

    const result = await repo.save({ age: 26, height: 181, weight: 76 });

    assert.equal(result.user_id, "user-1");
    assert.equal(result.age, 26);
    assert.equal(result.height, 181);
    assert.equal(result.weight, 76);
    // 保留原 created_time，更新 updated_time
    assert.equal(result.created_time, "2026-09-01T00:00:00.000Z");
    assert.notEqual(result.updated_time, null);
    // get + update
    assert.equal(calls.length, 2);
    assert.equal(calls[1]!.method, "update");
    const [typeName, entityKey, params] = calls[1]!.args as [
      string,
      string,
      Record<string, unknown>,
    ];
    assert.equal(typeName, "user_body");
    assert.equal(entityKey, "user-1");
    const data = params.data as Record<string, unknown>;
    assert.equal(data.userId, "user-1");
    assert.equal(data.age, 26);
    assert.equal(data.height, 181);
    assert.equal(data.weight, 76);
  });

  test("delete 调用 entries.delete", async () => {
    const { repo, calls } = makeRepo();

    await repo.delete();

    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.method, "delete");
    assert.deepEqual(calls[0]!.args, ["user_body", "user-1"]);
  });

  test("getMine 无登录态时抛错且不调用 SDK", async () => {
    const { repo, calls } = makeRepo({}, () => null);

    await assert.rejects(() => repo.getMine(), /无法解析当前登录用户/);
    assert.equal(calls.length, 0);
  });

  test("save 无登录态时抛错且不调用 SDK", async () => {
    const { repo, calls } = makeRepo({}, () => null);

    await assert.rejects(
      () => repo.save({ age: 25, height: 180, weight: 75 }),
      /无法解析当前登录用户/,
    );
    assert.equal(calls.length, 0);
  });

  /* ── 历史版本 ── */

  test("listHistory 调用 entries.listVersions 并返回 snake_case 历史项", async () => {
    const { repo, calls } = makeRepo({
      listVersions: async () => ({
        total: 2,
        items: [
          {
            version: 2,
            data: userBodyData,
            tags: [],
            createdAt: "2026-09-07T00:00:00.000Z",
            createdByUserId: 1,
          },
          {
            version: 1,
            data: { ...userBodyData, age: 24 },
            tags: [],
            createdAt: "2026-09-01T00:00:00.000Z",
            createdByUserId: 1,
          },
        ],
      }),
    });

    const result = await repo.listHistory();

    assert.equal(result.total, 2);
    assert.equal(result.items.length, 2);
    assert.equal(result.items[0]!.version, 2);
    assert.equal(result.items[0]!.data.age, 25);
    assert.equal(result.items[0]!.data.user_id, "user-1");
    assert.equal(result.items[1]!.version, 1);
    assert.equal(result.items[1]!.data.age, 24);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.method, "listVersions");
    assert.deepEqual(calls[0]!.args, ["user_body", "user-1", undefined]);
  });

  test("listHistory 支持分页参数", async () => {
    const { repo, calls } = makeRepo({
      listVersions: async () => ({ total: 0, items: [] }),
    });

    await repo.listHistory({ page: 2, pageSize: 10 });

    const [, , params] = calls[0]!.args as [string, string, Record<string, unknown>];
    assert.equal(params.page, 2);
    assert.equal(params.pageSize, 10);
  });

  test("getByVersion 调用 entries.get 并传入 version 参数", async () => {
    const { repo, calls } = makeRepo({ get: async () => makeEntryResponse() });

    const result = await repo.getByVersion(1);

    assert.deepEqual(result, expectedUserBody);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.method, "get");
    const [typeName, entityKey, options] = calls[0]!.args as [
      string,
      string,
      Record<string, unknown>,
    ];
    assert.equal(typeName, "user_body");
    assert.equal(entityKey, "user-1");
    assert.equal(options.version, 1);
  });

  test("getByVersion 版本不存在时返回 null（statusCode 404）", async () => {
    const { repo } = makeRepo({
      get: async () => {
        throw Object.assign(new Error("Not Found"), { statusCode: 404 });
      },
    });

    const result = await repo.getByVersion(999);

    assert.equal(result, null);
  });

  test("rollback 调用 entries.rollback 并返回回滚后的 snake_case 数据", async () => {
    const { repo, calls } = makeRepo({
      rollback: async () => makeEntryResponse(),
    });

    const result = await repo.rollback(1);

    assert.deepEqual(result, expectedUserBody);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.method, "rollback");
    const [typeName, entityKey, params] = calls[0]!.args as [
      string,
      string,
      Record<string, unknown>,
    ];
    assert.equal(typeName, "user_body");
    assert.equal(entityKey, "user-1");
    assert.equal(params.version, 1);
  });
});
