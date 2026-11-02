import crypto from 'node:crypto';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/env.js';
import { MEDIA_CONSTRAINTS } from '@localman/constants';

export interface PresignedUploadParams {
  storageKey: string;
  contentType: string;
  fileSizeBytes: number;
  expiresInSeconds?: number;
  metadata?: Record<string, string>;
}

export interface PresignedUploadResult {
  uploadUrl: string;
  fileUrl: string;
  storageKey: string;
  expiresInSeconds: number;
  headers: Record<string, string>;
}

export interface IStorageProvider {
  providerName: string;
  generatePresignedUploadUrl(params: PresignedUploadParams): Promise<PresignedUploadResult>;
  generatePresignedReadUrl(storageKey: string, expiresInSeconds?: number): Promise<string>;
  deleteFile(storageKey: string): Promise<boolean>;
}

/**
 * Deterministic Mock Storage Provider for Local Development, CI and Automated Tests.
 * Does not require external cloud credentials.
 */
export class MockStorageProvider implements IStorageProvider {
  public readonly providerName = 'mock';
  private uploadedKeys = new Set<string>();

  async generatePresignedUploadUrl(params: PresignedUploadParams): Promise<PresignedUploadResult> {
    const expiresInSeconds = params.expiresInSeconds || MEDIA_CONSTRAINTS.PRESIGNED_URL_EXPIRY_SECONDS;
    const expiresAt = Date.now() + expiresInSeconds * 1000;

    const signaturePayload = `${params.storageKey}:${params.contentType}:${expiresAt}`;
    const hmac = crypto
      .createHmac('sha256', env.JWT_SECRET)
      .update(signaturePayload)
      .digest('hex');

    const bucket = env.S3_BUCKET_NAME || 'localman-media-production';
    const uploadUrl = `https://storage.localman.in/mock-upload/${encodeURIComponent(
      params.storageKey
    )}?sig=${hmac}&exp=${expiresAt}`;
    const fileUrl = `https://storage.localman.in/${bucket}/${params.storageKey}`;

    return {
      uploadUrl,
      fileUrl,
      storageKey: params.storageKey,
      expiresInSeconds,
      headers: {
        'Content-Type': params.contentType,
        'x-amz-server-side-encryption': 'AES256',
      },
    };
  }

  async generatePresignedReadUrl(storageKey: string, _expiresInSeconds = 3600): Promise<string> {
    const bucket = env.S3_BUCKET_NAME || 'localman-media-production';
    return `https://storage.localman.in/${bucket}/${storageKey}`;
  }

  async deleteFile(storageKey: string): Promise<boolean> {
    this.uploadedKeys.delete(storageKey);
    return true;
  }

  // Helper for test assertions
  markUploaded(storageKey: string) {
    this.uploadedKeys.add(storageKey);
  }

  isUploaded(storageKey: string): boolean {
    return this.uploadedKeys.has(storageKey);
  }
}

/**
 * Production AWS S3 / Cloudflare R2 Provider with SigV4 Presigned URL Generation
 */
export class S3StorageProvider implements IStorageProvider {
  public readonly providerName: string;
  private accessKeyId: string;
  private secretAccessKey: string;
  private bucket: string;
  private region: string;
  private endpoint: string | null;
  private s3Client: S3Client | null = null;

  constructor(providerName = 's3') {
    this.providerName = providerName;
    this.accessKeyId = process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID || env.S3_ACCESS_KEY_ID || '';
    this.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY || env.S3_SECRET_ACCESS_KEY || '';
    this.bucket = env.S3_BUCKET_NAME || 'localman-documents';
    this.region = env.S3_REGION || 'ap-south-1';
    this.endpoint = process.env.S3_ENDPOINT || env.S3_ENDPOINT || null;

    if (this.accessKeyId && this.secretAccessKey && this.accessKeyId !== 'mock_access_key') {
      try {
        this.s3Client = new S3Client({
          region: this.region,
          endpoint: this.endpoint || undefined,
          credentials: {
            accessKeyId: this.accessKeyId,
            secretAccessKey: this.secretAccessKey,
          },
          forcePathStyle: Boolean(this.endpoint), // Needed for Cloudflare R2, MinIO, or custom endpoints
        });
      } catch (err) {
        console.warn('[Storage] Failed to initialize S3Client, falling back to SigV4 signer:', err);
        this.s3Client = null;
      }
    }
  }

  public getClient(): S3Client | null {
    return this.s3Client;
  }

  private getHost(): string {
    if (this.endpoint) {
      try {
        const parsed = new URL(this.endpoint);
        return parsed.host;
      } catch {
        return `${this.bucket}.s3.${this.region}.amazonaws.com`;
      }
    }
    return `${this.bucket}.s3.${this.region}.amazonaws.com`;
  }

  private signUrl(method: 'GET' | 'PUT', storageKey: string, expiresInSeconds: number): string {
    const host = this.getHost();
    const now = new Date();
    const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;

    if (!this.accessKeyId || !this.secretAccessKey) {
      return `https://${host}/${storageKey}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=${encodeURIComponent(
        `MOCK_KEY/${credentialScope}`
      )}&X-Amz-Date=${amzDate}&X-Amz-Expires=${expiresInSeconds}&X-Amz-SignedHeaders=host&X-Amz-Signature=mock_sigv4_signature`;
    }

    const queryParams: Record<string, string> = {
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${this.accessKeyId}/${credentialScope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': String(expiresInSeconds),
      'X-Amz-SignedHeaders': 'host',
    };

    const sortedQuery = Object.keys(queryParams)
      .sort()
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
      .join('&');

    const canonicalUri = `/${storageKey.split('/').map(encodeURIComponent).join('/')}`;
    const canonicalHeaders = `host:${host}\n`;
    const signedHeaders = 'host';
    const payloadHash = 'UNSIGNED-PAYLOAD';

    const canonicalRequest = `${method}\n${canonicalUri}\n${sortedQuery}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
    const hashedCanonicalRequest = crypto.createHash('sha256').update(canonicalRequest).digest('hex');

    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${hashedCanonicalRequest}`;

    const kDate = crypto.createHmac('sha256', `AWS4${this.secretAccessKey}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(this.region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update('s3').digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();

    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    return `https://${host}${canonicalUri}?${sortedQuery}&X-Amz-Signature=${signature}`;
  }

  async generatePresignedUploadUrl(params: PresignedUploadParams): Promise<PresignedUploadResult> {
    const expiresInSeconds = params.expiresInSeconds || MEDIA_CONSTRAINTS.PRESIGNED_URL_EXPIRY_SECONDS;
    const host = this.getHost();
    const fileUrl = env.S3_PUBLIC_DOMAIN
      ? `${env.S3_PUBLIC_DOMAIN.replace(/\/$/, '')}/${params.storageKey}`
      : `https://${host}/${params.storageKey}`;

    if (this.s3Client) {
      try {
        const command = new PutObjectCommand({
          Bucket: this.bucket,
          Key: params.storageKey,
          ContentType: params.contentType,
          Metadata: params.metadata,
          ServerSideEncryption: 'AES256',
        });
        const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
        return {
          uploadUrl,
          fileUrl,
          storageKey: params.storageKey,
          expiresInSeconds,
          headers: {
            'Content-Type': params.contentType,
            'x-amz-server-side-encryption': 'AES256',
          },
        };
      } catch (err) {
        console.warn('[Storage] getSignedUrl via AWS SDK failed, falling back to SigV4 signer:', err);
      }
    }

    const uploadUrl = this.signUrl('PUT', params.storageKey, expiresInSeconds);
    return {
      uploadUrl,
      fileUrl,
      storageKey: params.storageKey,
      expiresInSeconds,
      headers: {
        'Content-Type': params.contentType,
        'x-amz-server-side-encryption': 'AES256',
      },
    };
  }

  async generatePresignedReadUrl(storageKey: string, expiresInSeconds = 3600): Promise<string> {
    if (this.s3Client) {
      try {
        const command = new GetObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
        });
        return await getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
      } catch (err) {
        console.warn('[Storage] getSignedUrl GET via AWS SDK failed, falling back to SigV4 signer:', err);
      }
    }
    return this.signUrl('GET', storageKey, expiresInSeconds);
  }

  async deleteFile(storageKey: string): Promise<boolean> {
    if (this.s3Client) {
      try {
        const command = new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
        });
        await this.s3Client.send(command);
        return true;
      } catch (err) {
        console.warn('[Storage] deleteFile via AWS SDK failed:', err);
        return false;
      }
    }
    return true;
  }
}

let activeProvider: IStorageProvider | null = null;

export function getStorageProvider(): IStorageProvider {
  if (!activeProvider) {
    if (env.STORAGE_PROVIDER === 's3') {
      activeProvider = new S3StorageProvider('s3');
    } else if (env.STORAGE_PROVIDER === 'r2') {
      activeProvider = new S3StorageProvider('r2');
    } else {
      activeProvider = new MockStorageProvider();
    }
  }
  return activeProvider;
}

export function setStorageProviderForTest(provider: IStorageProvider) {
  activeProvider = provider;
}
