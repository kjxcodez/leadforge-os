import { GoogleAuthService, DRIVE_FILE_SCOPE } from './auth.service.js';
import { GoogleConnectionModel } from '../../db/models/google-connection.model.js';
import { logger } from '../../config/index.js';

const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';

export interface UploadDriveFileOptions {
  connectionId: string;
  filename: string;
  mimeType: string;
  data: Buffer;
  idempotencyKey?: string;
}

export interface DriveUploadResult {
  fileId: string;
  filename: string;
  mimeType: string;
  size: number;
}

export class GoogleDriveProvider {
  constructor(private readonly authService: GoogleAuthService) {}

  /**
   * Validates whether the given Google connection possesses the drive.file scope.
   */
  public async isDriveAuthorized(connectionId: string): Promise<boolean> {
    const connection = await GoogleConnectionModel.findById(connectionId);
    if (!connection) return false;
    return (
      connection.driveStatus === 'authorized' ||
      connection.grantedScopes.includes(DRIVE_FILE_SCOPE)
    );
  }

  /**
   * Uploads an attachment binary to Google Drive via multipart upload.
   */
  public async uploadFile(options: UploadDriveFileOptions): Promise<DriveUploadResult> {
    const connection = await GoogleConnectionModel.findById(options.connectionId);
    if (!connection) {
      throw new Error(`Google connection "${options.connectionId}" not found.`);
    }

    const hasScope = connection.grantedScopes.some(
      (s: string) => s === DRIVE_FILE_SCOPE || s === 'https://www.googleapis.com/auth/drive'
    );

    if (!hasScope && connection.driveStatus !== 'authorized') {
      throw new Error(
        `Drive authorization required: The connection "${connection.email}" has not granted the drive.file scope. Incremental reauthorization is required.`
      );
    }

    const accessToken = await this.authService.getValidAccessToken(options.connectionId);

    const boundary = `----=_Drive_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const metadata = JSON.stringify({
      name: options.filename,
      mimeType: options.mimeType,
      description: 'LeadForge OS Campaign Attachment'
    });

    const header = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${options.mimeType}\r\n\r\n`;
    const footer = `\r\n--${boundary}--`;

    const multipartBody = Buffer.concat([
      Buffer.from(header, 'utf8'),
      options.data,
      Buffer.from(footer, 'utf8')
    ]);

    const res = await fetch(DRIVE_UPLOAD_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
        'Content-Length': String(multipartBody.length)
      },
      body: multipartBody
    });

    const body: any = await res.json().catch(() => ({}));

    if (!res.ok) {
      logger.error({ status: res.status, error: body?.error }, 'Google Drive upload failed');
      throw new Error(
        `Google Drive upload failed (HTTP ${res.status}): ${body?.error?.message || 'unknown error'}`
      );
    }

    return {
      fileId: body.id,
      filename: options.filename,
      mimeType: options.mimeType,
      size: options.data.length
    };
  }

  /**
   * Downloads binary content for a file from Google Drive.
   */
  public async downloadFile(connectionId: string, fileId: string): Promise<Buffer> {
    const accessToken = await this.authService.getValidAccessToken(connectionId);
    const res = await fetch(`${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!res.ok) {
      throw new Error(`Google Drive download failed (HTTP ${res.status}) for fileId "${fileId}"`);
    }

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Retrieves metadata for a file in Google Drive.
   */
  public async getFileMetadata(
    connectionId: string,
    fileId: string
  ): Promise<{ id: string; name: string; mimeType: string; size: number }> {
    const accessToken = await this.authService.getValidAccessToken(connectionId);
    const res = await fetch(
      `${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`Google Drive getMetadata failed (HTTP ${res.status}): ${body?.error?.message || 'unknown'}`);
    }

    return {
      id: body.id,
      name: body.name || 'unnamed',
      mimeType: body.mimeType || 'application/octet-stream',
      size: Number(body.size) || 0
    };
  }

  /**
   * Deletes a file from Google Drive.
   */
  public async deleteFile(connectionId: string, fileId: string): Promise<void> {
    const accessToken = await this.authService.getValidAccessToken(connectionId);
    const res = await fetch(`${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!res.ok && res.status !== 404) {
      throw new Error(`Google Drive deleteFile failed (HTTP ${res.status})`);
    }
  }

  /**
   * Verifies if a given Google connection can access a specific Drive file.
   */
  public async verifyAccess(connectionId: string, fileId: string): Promise<boolean> {
    try {
      await this.getFileMetadata(connectionId, fileId);
      return true;
    } catch {
      return false;
    }
  }
}
