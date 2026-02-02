/* eslint-disable @typescript-eslint/no-explicit-any */

declare module "pg" {
  export interface QueryResult<R = any> {
    command: string;
    rowCount: number;
    oid: number;
    rows: R[];
  }

  export interface PoolConfig {
    connectionString?: string;
  }

  export interface PoolClient {
    query<R = any>(text: string, params?: any[]): Promise<QueryResult<R>>;
    release(): void;
  }

  export class Pool {
    constructor(config?: PoolConfig);
    query<R = any>(text: string, params?: any[]): Promise<QueryResult<R>>;
    connect(): Promise<PoolClient>;
    end(): Promise<void>;
  }
}
