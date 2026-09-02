import { HttpClient } from '../http/client.js';
import { toQueryString } from '../utils/query.js';

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  modifiedTime?: string;
  webViewLink?: string;
  webContentLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
  parents?: string[];
  isFolder: boolean;
}

export interface ListDriveFilesResult {
  files: DriveFileItem[];
  nextPageToken?: string;
}

export interface ListDriveFilesOptions {
  folderId?: string | undefined;
  search?: string | undefined;
  pageToken?: string | undefined;
  pageSize?: number | undefined;
}

export interface DriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  webViewLink?: string | null;
  webContentLink?: string | null;
  thumbnailLink?: string | null;
  modifiedTime?: string | null;
}

export interface DriveAboutInfo {
  user: { displayName?: string; emailAddress?: string };
  storageQuota: { limit?: number; usage?: number; usageInDrive?: number };
}

export class DriveModule {
  constructor(private client: HttpClient) {}

  /**
   * Lists files and folders from a workspace-authorized Google Drive connection.
   */
  public async listFiles(
    connectionId: string,
    options?: ListDriveFilesOptions
  ): Promise<ListDriveFilesResult> {
    const query = toQueryString(options);
    return this.client.get<ListDriveFilesResult>(`/google-connections/${connectionId}/drive/files${query}`);
  }

  /**
   * Retrieves single file metadata from Google Drive.
   */
  public async getFile(connectionId: string, fileId: string): Promise<DriveFileMetadata> {
    return this.client.get<DriveFileMetadata>(`/google-connections/${connectionId}/drive/files/${fileId}`);
  }

  /**
   * Retrieves user info and storage quota from Google Drive.
   */
  public async getAbout(connectionId: string): Promise<DriveAboutInfo> {
    return this.client.get<DriveAboutInfo>(`/google-connections/${connectionId}/drive/about`);
  }
}
