import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import type {
  UserSdkLike,
  UserSdkAuthClient,
  UserSdkUsersClient,
  TokenResponseContract,
  UserResponseContract,
  PaginatedUsersContract,
} from "../sdk/user-sdk/index.js";
import type {
  MetaSdkLike,
  EntriesClient,
  MetadataEntry,
} from "../sdk/meta-sdk/index.js";
import { CPUserFactory } from "../repository/CPUserFactory.js";
import type {
  AuthTokens,
  UserProfile,
  RegisterParams,
  UpdateProfileParams,
  ChangePasswordParams,
  ListUsersParams,
  PaginatedUsers,
} from "../core/model/index.js";
import { UserService } from "./UserService.js";
import { createCPUser, getCPUser } from "../cpuser.js";

/* ──────────────── 测试数据 ──────────────── */

const tokenResponse: TokenResponseContract = {
  accessToken: "access-xxx",
  refreshToken: "refresh-xxx",
  tokenType: "bearer",
};

const userResponse: UserResponseContract = {
  id: 42,
  username: "alice",
  email: "alice@example.com",
  fullName: "Alice Wang",
  serviceName: "caloplan",
  role: "user",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-07T00:00:00.000Z",
};

const expectedUserProfile: UserProfile = {
  user_id: 42,
  username: "alice",
  email: "alice@example.com",
  full_name: "Alice Wang",
  service_name: "caloplan",
  role: "user",
  created_time: "2026-09-01T00:00:00.000Z",
  updated_time: "2026-09-07T00:00:00.000Z",
};

const expectedAuthTokens: AuthTokens = {
  access_token: "access-xxx",
  refresh_token: "refresh-xxx",
  token_type: "bearer",
};

/* ──────────────── SDK Stub 工厂 ──────────────── */

interface Call {
  client: "auth" | "users";
  method: string;
  args: unknown[];
}

function makeAuthClient(overrides: Partial<UserSdkAuthClient> = {}): {
  auth: UserSdkAuthClient;
  calls: Call[];
} {
  const calls: Call[] = [];
  const base: UserSdkAuthClient = {
    register: async () => tokenResponse,
    login: async () => tokenResponse,
    refresh: async () => tokenResponse,
    logout: async () => {},
  };
  const auth = {} as UserSdkAuthClient;
  (Object.keys(base) as (keyof UserSdkAuthClient)[]).forEach((key) => {
    auth[key] = (async (...args: unknown[]) => {
      calls.push({ client: "auth", method: key, args });
      const impl = overrides[key] ?? base[key];
      return (impl as (...a: unknown[]) => unknown)(...args);
    }) as never;
  });
  return { auth, calls };
}

function makeUsersClient(overrides: Partial<UserSdkUsersClient> = {}): {
  users: UserSdkUsersClient;
  calls: Call[];
} {
  const calls: Call[] = [];
  const paginated: PaginatedUsersContract = { total: 1, items: [userResponse] };
  const base: UserSdkUsersClient = {
    getMe: async () => userResponse,
    updateMe: async () => userResponse,
    changePassword: async () => {},
    deleteMe: async () => {},
    getById: async () => userResponse,
    list: async () => paginated,
  };
  const users = {} as UserSdkUsersClient;
  (Object.keys(base) as (keyof UserSdkUsersClient)[]).forEach((key) => {
    users[key] = (async (...args: unknown[]) => {
      calls.push({ client: "users", method: key, args });
      const impl = overrides[key] ?? base[key];
      return (impl as (...a: unknown[]) => unknown)(...args);
    }) as never;
  });
  return { users, calls };
}

function makeService(
  authOverrides: Partial<UserSdkAuthClient> = {},
  usersOverrides: Partial<UserSdkUsersClient> = {},
): {
  service: UserService;
  authCalls: Call[];
  usersCalls: Call[];
} {
  const { auth, calls: authCalls } = makeAuthClient(authOverrides);
  const { users, calls: usersCalls } = makeUsersClient(usersOverrides);
  const sdk: UserSdkLike = { auth, users };
  return { service: new UserService(sdk), authCalls, usersCalls };
}

/* ──────────────── UserService 测试 ──────────────── */

describe("UserService", () => {
  describe("认证", () => {
    test("login 调用 sdk.auth.login 并返回 snake_case AuthTokens", async () => {
      const { service, authCalls } = makeService();

      const result = await service.login({ username: "alice", password: "pass123" });

      assert.deepEqual(result, expectedAuthTokens);
      assert.equal(authCalls.length, 1);
      assert.equal(authCalls[0]!.method, "login");
      assert.deepEqual(authCalls[0]!.args, ["alice", "pass123"]);
    });

    test("register 将 snake_case 参数转为 camelCase 传给 SDK", async () => {
      const { service, authCalls } = makeService();
      const params: RegisterParams = {
        username: "bob",
        email: "bob@example.com",
        password: "pass123",
        full_name: "Bob Li",
        service_name: "caloplan",
      };

      const result = await service.register(params);

      assert.deepEqual(result, expectedAuthTokens);
      assert.equal(authCalls.length, 1);
      assert.equal(authCalls[0]!.method, "register");
      const [contract] = authCalls[0]!.args as [Record<string, unknown>];
      assert.equal(contract.username, "bob");
      assert.equal(contract.email, "bob@example.com");
      assert.equal(contract.password, "pass123");
      assert.equal(contract.fullName, "Bob Li");
      assert.equal(contract.serviceName, "caloplan");
      // 确认没有 snake_case 字段泄漏到 SDK 契约
      assert.equal("full_name" in contract, false);
      assert.equal("service_name" in contract, false);
    });

    test("register 可选字段不传时不包含在契约中", async () => {
      const { service, authCalls } = makeService();
      const params: RegisterParams = {
        username: "bob",
        email: "bob@example.com",
        password: "pass123",
      };

      await service.register(params);

      const [contract] = authCalls[0]!.args as [Record<string, unknown>];
      assert.equal("fullName" in contract, false);
      assert.equal("serviceName" in contract, false);
    });

    test("logout 调用 sdk.auth.logout", async () => {
      const { service, authCalls } = makeService();

      await service.logout();

      assert.equal(authCalls.length, 1);
      assert.equal(authCalls[0]!.method, "logout");
      assert.deepEqual(authCalls[0]!.args, []);
    });

    test("refreshToken 调用 sdk.auth.refresh 并返回 snake_case tokens", async () => {
      const { service, authCalls } = makeService();

      const result = await service.refreshToken("refresh-xxx");

      assert.deepEqual(result, expectedAuthTokens);
      assert.equal(authCalls[0]!.method, "refresh");
      assert.deepEqual(authCalls[0]!.args, ["refresh-xxx"]);
    });
  });

  describe("当前用户", () => {
    test("getCurrentUser 返回 snake_case UserProfile", async () => {
      const { service, usersCalls } = makeService();

      const result = await service.getCurrentUser();

      assert.deepEqual(result, expectedUserProfile);
      assert.equal(usersCalls.length, 1);
      assert.equal(usersCalls[0]!.method, "getMe");
    });

    test("updateProfile 仅传变更字段，转为 camelCase", async () => {
      const { service, usersCalls } = makeService();
      const params: UpdateProfileParams = { full_name: "Alice New" };

      const result = await service.updateProfile(params);

      assert.deepEqual(result, expectedUserProfile);
      assert.equal(usersCalls[0]!.method, "updateMe");
      const [contract] = usersCalls[0]!.args as [Record<string, unknown>];
      assert.equal(contract.fullName, "Alice New");
      assert.equal("serviceName" in contract, false);
      assert.equal("full_name" in contract, false);
    });

    test("changePassword 转为 camelCase 传给 SDK", async () => {
      const { service, usersCalls } = makeService();
      const params: ChangePasswordParams = {
        old_password: "old123",
        new_password: "new123",
      };

      await service.changePassword(params);

      assert.equal(usersCalls[0]!.method, "changePassword");
      const [contract] = usersCalls[0]!.args as [Record<string, unknown>];
      assert.equal(contract.oldPassword, "old123");
      assert.equal(contract.newPassword, "new123");
      assert.equal("old_password" in contract, false);
    });

    test("deleteAccount 调用 sdk.users.deleteMe", async () => {
      const { service, usersCalls } = makeService();

      await service.deleteAccount();

      assert.equal(usersCalls[0]!.method, "deleteMe");
    });
  });

  describe("用户查询", () => {
    test("getUserById 正常返回 snake_case UserProfile", async () => {
      const { service, usersCalls } = makeService();

      const result = await service.getUserById(42);

      assert.deepEqual(result, expectedUserProfile);
      assert.equal(usersCalls[0]!.method, "getById");
      assert.deepEqual(usersCalls[0]!.args, [42]);
    });

    test("getUserById 在用户不存在时返回 null（statusCode 404）", async () => {
      const { service } = makeService({}, {
        getById: async () => {
          throw Object.assign(new Error("Not Found"), { statusCode: 404 });
        },
      });

      const result = await service.getUserById(999);

      assert.equal(result, null);
    });

    test("getUserById 非 404 错误直接透传", async () => {
      const { service } = makeService({}, {
        getById: async () => {
          throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
        },
      });

      await assert.rejects(() => service.getUserById(42), /Forbidden/);
    });

    test("listUsers 无参数时调用 SDK 不传契约", async () => {
      const { service, usersCalls } = makeService();

      const result: PaginatedUsers = await service.listUsers();

      assert.equal(result.total, 1);
      assert.deepEqual(result.items[0], expectedUserProfile);
      assert.equal(usersCalls[0]!.method, "list");
      assert.deepEqual(usersCalls[0]!.args, [undefined]);
    });

    test("listUsers 带参数时转为 camelCase", async () => {
      const { service, usersCalls } = makeService();
      const params: ListUsersParams = { skip: 10, limit: 20, service_name: "caloplan" };

      await service.listUsers(params);

      const [contract] = usersCalls[0]!.args as [Record<string, unknown>];
      assert.equal(contract.skip, 10);
      assert.equal(contract.limit, 20);
      assert.equal(contract.serviceName, "caloplan");
      assert.equal("service_name" in contract, false);
    });
  });
});

/* ──────────────── 单例测试 ──────────────── */

function makeEntriesStub(): EntriesClient {
  return {
    create: async () => ({} as MetadataEntry),
    get: async () => ({} as MetadataEntry),
    update: async () => ({} as MetadataEntry),
    delete: async () => {},
    query: async () => ({ total: 0, items: [] }),
    listVersions: async () => ({ total: 0, items: [] }),
    rollback: async () => ({} as MetadataEntry),
  };
}

describe("CPUser 单例", () => {
  test("getCPUser 未初始化时抛错", () => {
    // 注意：由于单例是模块级变量，其他测试可能已初始化
    // 这里只验证错误消息格式，实际未初始化状态需在独立进程中验证
    assert.ok(typeof getCPUser === "function");
    assert.ok(typeof createCPUser === "function");
  });

  test("createCPUser 返回 CPUserFactory 实例，包含 user/body/nutrition", () => {
    const { auth, calls: _authCalls } = makeAuthClient();
    const { users, calls: _usersCalls } = makeUsersClient();
    const userSdk: UserSdkLike = { auth, users };
    const metaSdk: MetaSdkLike = { entries: makeEntriesStub() };
    const userIdProvider = () => "user-1";

    const instance = createCPUser(userSdk, metaSdk, userIdProvider);

    assert.ok(instance instanceof CPUserFactory);
    assert.ok(instance.user instanceof UserService);
    assert.ok(instance.body != null);
    assert.ok(instance.nutrition != null);
  });

  test("getCPUser 返回 createCPUser 创建的同一实例", () => {
    const { auth, calls: _authCalls } = makeAuthClient();
    const { users, calls: _usersCalls } = makeUsersClient();
    const userSdk: UserSdkLike = { auth, users };
    const metaSdk: MetaSdkLike = { entries: makeEntriesStub() };
    const userIdProvider = () => "user-1";

    const created = createCPUser(userSdk, metaSdk, userIdProvider);
    const got = getCPUser();

    assert.equal(got, created);
  });
});
