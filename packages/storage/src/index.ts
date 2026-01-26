export interface StoredObject {
  key: string;
  etag?: string;
}

export interface StorageClient {
  putObject(key: string, body: Buffer, contentType?: string): Promise<StoredObject>;
  getObject(key: string): Promise<Buffer>;
}

export function createStorageClient(): StorageClient {
  return {
    async putObject(_key: string, _body: Buffer, _contentType?: string): Promise<StoredObject> {
      throw new Error("Object storage not implemented");
    },
    async getObject(_key: string): Promise<Buffer> {
      throw new Error("Object storage not implemented");
    }
  };
}
