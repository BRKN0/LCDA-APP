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

  private async requestAccessToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: environment.googleClientId,
        scope: environment.googleScope,
        callback: (response: any) => {
          if (response.error) {
            reject(response);
            return;
          }

          this.accessToken = response.access_token;
          resolve(this.accessToken);
        },
        error_callback: (error: any) => {
          reject(error);
        }
      });

      tokenClient.requestAccessToken({
        prompt: this.accessToken ? '' : 'consent'
      });
    });
  }

  async deleteDriveFile(fileId: string): Promise<void> {
    if (!fileId) return;

    const token = this.accessToken || await this.requestAccessToken();

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

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

    const token = this.accessToken || await this.requestAccessToken();
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
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone'
        })
      }
    );

    if (!response.ok) {
      throw new Error('No se pudo hacer público el archivo en Drive.');
    }
  }

  async uploadBlobToDrive(
    blob: Blob,
    fileName: string,
    mimeType: string = 'application/octet-stream'
  ): Promise<DrivePickedFile> {
    const token = this.accessToken || await this.requestAccessToken();

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
}