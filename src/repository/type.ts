/**
 * 当前登录用户 ID 提供器：由外部（认证层）注入，Repository 不实现认证逻辑。
 * 返回 null / 空串表示无有效登录态，写操作与按用户查询将抛错。
 */
export type UserIdProvider = () => string | null | Promise<string | null>;

/**
 * 判断错误是否为「资源不存在」。
 * 本库不依赖 SDK 具体错误类，按结构化字段（statusCode === 404）判断。
 */
export function isNotFoundError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err as { statusCode?: number }).statusCode === 404
  );
}
