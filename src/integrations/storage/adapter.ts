export interface StoredObject {
  body: Buffer;
  contentType: string;
  contentLength: number;
}

export interface PutObjectInput {
  keyPrefix: string;
  contentType: string;
  body: Buffer;
  extension: string;
}

export interface ObjectStorageAdapter {
  putObject(input: PutObjectInput): Promise<{ objectKey: string }>;
  getObject(objectKey: string): Promise<StoredObject>;
  deleteObject(objectKey: string): Promise<void>;
}
