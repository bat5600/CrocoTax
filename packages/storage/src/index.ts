import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";

export interface StoredObject {
  key: string;
  etag?: string;
}

export interface StorageClient {
  putObject(key: string, body: Buffer, contentType?: string): Promise<StoredObject>;
  getObject(key: string): Promise<Buffer>;
}

export interface StorageConfig {
  mode: "filesystem" | "minio";
  localPath?: string;
  endpoint?: string;
  accessKey?: string;
  secretKey?: string;
  bucket?: string;
}

class FileStorageClient implements StorageClient {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  async putObject(key: string, body: Buffer): Promise<StoredObject> {
    const target = join(this.basePath, key);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, body);
    return { key };
  }

  async getObject(key: string): Promise<Buffer> {
    const target = join(this.basePath, key);
    return readFileSync(target);
  }
}

class MinioStorageClient implements StorageClient {
  private client: {
    putObject: (
      bucket: string,
      key: string,
      body: Buffer,
      size: number,
      meta: Record<string, string>
    ) => Promise<unknown>;
    getObject: (bucket: string, key: string) => Promise<AsyncIterable<Buffer | Uint8Array>>;
  };
  private bucket: string;

  constructor(
    client: {
      putObject: (
        bucket: string,
        key: string,
        body: Buffer,
        size: number,
        meta: Record<string, string>
      ) => Promise<unknown>;
      getObject: (bucket: string, key: string) => Promise<AsyncIterable<Buffer | Uint8Array>>;
    },
    bucket: string
  ) {
    this.client = client;
    this.bucket = bucket;
  }

  async putObject(key: string, body: Buffer, contentType?: string): Promise<StoredObject> {
    await this.client.putObject(this.bucket, key, body, body.length, {
      "Content-Type": contentType ?? "application/octet-stream"
    });
    return { key };
  }

  async getObject(key: string): Promise<Buffer> {
    const stream = await this.client.getObject(this.bucket, key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}

function parseEndpoint(endpoint: string): { endPoint: string; port: number; useSSL: boolean } {
  const url = new URL(endpoint);
  return {
    endPoint: url.hostname,
    port: Number(url.port || (url.protocol === "https:" ? 443 : 80)),
    useSSL: url.protocol === "https:"
  };
}

export function createStorageClient(config?: Partial<StorageConfig>): StorageClient {
  const mode = (config?.mode ?? process.env.STORAGE_MODE ?? "filesystem") as StorageConfig["mode"];
  if (mode === "filesystem") {
    const basePath = config?.localPath ?? process.env.STORAGE_LOCAL_PATH ?? "./storage";
    mkdirSync(basePath, { recursive: true });
    return new FileStorageClient(basePath);
  }

  const endpoint = config?.endpoint ?? process.env.OBJECT_STORE_ENDPOINT;
  const accessKey = config?.accessKey ?? process.env.OBJECT_STORE_ACCESS_KEY;
  const secretKey = config?.secretKey ?? process.env.OBJECT_STORE_SECRET_KEY;
  const bucket = config?.bucket ?? process.env.OBJECT_STORE_BUCKET;

  if (!endpoint || !accessKey || !secretKey || !bucket) {
    throw new Error("Object storage configuration is missing");
  }

  const { endPoint, port, useSSL } = parseEndpoint(endpoint);
  // Lazy import so tests can run without minio if using filesystem mode.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Client } = require("minio");
  const client = new Client({ endPoint, port, useSSL, accessKey, secretKey });
  return new MinioStorageClient(client, bucket);
}
