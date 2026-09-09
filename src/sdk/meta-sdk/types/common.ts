export interface PaginatedResponse<T> {
  total: number;
  items: T[];
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}
