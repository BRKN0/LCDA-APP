import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

declare const google: any;
declare const gapi: any;

export interface DrivePickedFile {
  drive_file_id: string;
  file_url: string;
  download_url?: string;
  name?: string;
}

@Injectable({
  providedIn: 'root'
})
export class GoogleDriveService {
  private accessToken = '';
  private accessTokenExpiresAt = 0;

  private readonly TOKEN_KEY = 'lcda_google_access_token';
  private readonly TOKEN_EXPIRES_KEY = 'lcda_google_access_token_expires_at';

  constructor() {
    const savedToken = sessionStorage.getItem(this.TOKEN_KEY);
    const savedExpiresAt = Number(
      sessionStorage.getItem(this.TOKEN_EXPIRES_KEY) || 0
    );

    if (savedToken && savedExpiresAt > Date.now()) {
      this.accessToken = savedToken;
      this.accessTokenExpiresAt = savedExpiresAt;
    }
  }

  private async requestAccessToken(
    prompt: '' | 'consent' | 'select_account' = ''
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: environment.googleClientId,
        scope: environment.googleScope,
        callback: (response: any) => {
          if (response.error) {
            this.clearAccessToken();
            reject(response);
            return;
          }

          this.accessToken = response.access_token;

          const expiresInSeconds = Number(response.expires_in || 3600);

          this.accessTokenExpiresAt =
            Date.now() + expiresInSeconds * 1000;

          sessionStorage.setItem(this.TOKEN_KEY, this.accessToken);
          sessionStorage.setItem(
            this.TOKEN_EXPIRES_KEY,
            String(this.accessTokenExpiresAt)
          );

          resolve(this.accessToken);
        },
        error_callback: (error: any) => {
          this.clearAccessToken();
          reject(error);
        },
      });

      tokenClient.requestAccessToken({ prompt });
    });
  }

  async deleteDriveFile(fileId: string): Promise<void> {
    if (!fileId) return;

    let token = await this.ensureAccessToken();

    let response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.status === 401 || response.status === 403 || response.status === 404) {
      console.warn('Token inválido, vencido o sin acceso. Reintentando con nuevo token...');

      token = await this.reconnectGoogleDrive();

      response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`No se pudo eliminar el archivo de Drive: ${errorText}`);
    }
  }

  private async loadPicker(): Promise<void> {
    return new Promise((resolve) => {
      gapi.load('picker', () => resolve());
    });
  }

  async openPicker(): Promise<DrivePickedFile> {
    const pageScrollY = window.scrollY || document.documentElement.scrollTop || 0;

    const token = await this.ensureAccessToken();
    await this.loadPicker();

    return new Promise((resolve, reject) => {
      const uploadView = new google.picker.DocsUploadView()
        .setParent(environment.googleDriveFolderId);

      const docsView = new google.picker.DocsView()
        .setIncludeFolders(true)
        .setParent(environment.googleDriveFolderId);

      const picker = new google.picker.PickerBuilder()
        .setOAuthToken(token)
        .setDeveloperKey(environment.googleApiKey)
        .setAppId(environment.googleAppId)
        .addView(uploadView)
        .addView(docsView)
        .setCallback(async (data: any) => {
          if (data.action === google.picker.Action.PICKED) {
            const doc = data.docs[0];
            const driveFileId = doc.id;

            const viewUrl = `https://drive.google.com/file/d/${driveFileId}/view`;
            const downloadUrl = `https://drive.google.com/uc?export=download&id=${driveFileId}`;

            try {
              await this.makeFilePublic(driveFileId);

              window.scrollTo(0, pageScrollY);

              resolve({
                drive_file_id: driveFileId,
                file_url: viewUrl,
                download_url: downloadUrl,
                name: doc.name,
              });
            } catch (error) {
              window.scrollTo(0, pageScrollY);
              reject(error);
            }
          }

          if (data.action === google.picker.Action.CANCEL) {
            window.scrollTo(0, pageScrollY);
            reject('El usuario canceló el selector.');
          }
        })
        .build();

      picker.setVisible(true);

      setTimeout(() => {
        window.scrollTo(0, pageScrollY);
      }, 0);
    });
  }

  private async makeFilePublic(fileId: string): Promise<void> {
    if (!fileId) return;

    const token = await this.ensureAccessToken();

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone',
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`No se pudo hacer público el archivo: ${errorText}`);
    }
  }

  async uploadBlobToDrive(
    blob: Blob,
    fileName: string,
    mimeType: string = 'application/octet-stream'
  ): Promise<DrivePickedFile> {
    const token = await this.ensureAccessToken();

    const metadata = {
      name: fileName,
      mimeType,
      parents: [environment.googleDriveFolderId],
    };

    const boundary = '-------lcda_drive_upload_boundary';

    const body = new Blob(
      [
        `--${boundary}\r\n`,
        'Content-Type: application/json; charset=UTF-8\r\n\r\n',
        JSON.stringify(metadata),
        `\r\n--${boundary}\r\n`,
        `Content-Type: ${mimeType}\r\n\r\n`,
        blob,
        `\r\n--${boundary}--`,
      ],
      {
        type: `multipart/related; boundary=${boundary}`,
      }
    );

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error subiendo archivo a Drive: ${errorText}`);
    }

    const uploaded = await response.json();

    try {
      await this.makeFilePublic(uploaded.id);
    } catch (error) {
      console.warn('No se pudo hacer público el archivo:', error);
    }

    return {
      drive_file_id: uploaded.id,
      file_url: `https://drive.google.com/file/d/${uploaded.id}/view`,
      download_url: `https://drive.google.com/uc?export=download&id=${uploaded.id}`,
      name: uploaded.name || fileName,
    };
  }

  private hasValidAccessToken(): boolean {
    return (
      !!this.accessToken &&
      this.accessTokenExpiresAt > Date.now() + 2 * 60 * 1000
    );
  }

  private clearAccessToken(): void {
    this.accessToken = '';
    this.accessTokenExpiresAt = 0;

    sessionStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.TOKEN_EXPIRES_KEY);
  }

  public async ensureAccessToken(): Promise<string> {
    if (this.hasValidAccessToken()) {
      return this.accessToken;
    }

    this.clearAccessToken();
    return await this.requestAccessToken('');
  }

  public async reconnectGoogleDrive(): Promise<string> {
    this.clearAccessToken();
    return await this.requestAccessToken('select_account');
  }
}