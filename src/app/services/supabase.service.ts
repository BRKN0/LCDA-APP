import { Injectable } from '@angular/core';
import {
  AuthChangeEvent,
  AuthSession,
  createClient,
  PostgrestSingleResponse,
  Session,
  SupabaseClient,
  User,
} from '@supabase/supabase-js';
import { defer, Observable, startWith } from 'rxjs';
import { environment } from '../../environments/environment';
import { PostgrestFilterBuilder } from '@supabase/postgrest-js';
import { GenericSchema } from '@supabase/supabase-js/dist/module/lib/types';
import { SupabaseErrorMapperService } from './supabase-error-mapper.service';

/**
 * Profile is the interface that represents the profile of a user.
 */
export interface Profile {
  /**
   * id is the id of the profile.
   */
  id?: string;
  /**
   * username is the username of the user.
   */
  username: string;
  /**
   * website is the website of the user.
   */
  website: string;
  /**
   * avatar_url is the url of the avatar of the user.
   */
  avatar_url: string;
}

/**
 * SupabaseService is a service that provides the supabase client.
 * It also provides some methods to interact with supabase.
 */
@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  /**
   * Supabase client.
   */
  private supabase: SupabaseClient;
  /**
   * The session of the user.
   */
  _session: AuthSession | null = null;

  /**
   * Constructor.
   */
  constructor(
    private readonly supabaseErrorMapper: SupabaseErrorMapperService
  ) {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey,
      {
        auth: {
          debug: true,
        },
      }
    );
    // Retrieve the session during initialization
    this.initializeSession();
  }

  private async initializeSession(): Promise<void> {
    const { data } = await this.supabase.auth.getSession();
    this._session = data.session || null;
  }

  /**
   * Session getter.
   */
  get session() {
    this.supabase.auth.getSession().then(({ data }) => {
      this._session = data.session;
    });
    return this._session;
  }

  /**
   * from returns a PostgrestQueryBuilder instance. It is used to make queries to the database.
   * @param table The table name.
   */
  from(table: string) {
    return this.supabase.from(table);
  }

  /**
   * rpc$ returns an observable that emits the response of a stored procedure.
   * @param fn The name of the stored procedure.
   * @param args The arguments of the stored procedure.
   * @param options The options of the stored procedure.
   */
  rpc$<T>(
    fn: string,
    args: any,
    options?: {
      head?: boolean;
      count?: 'exact' | 'planned' | 'estimated';
    }
  ): Observable<PostgrestSingleResponse<T>> {
    return defer(() => this.supabase.rpc(fn, args, options));
  }

  /**
   * getProfile returns an observable that emits the profile of a user.
   * @param user The user.
   */
  profile(user: User) {
    return this.supabase
      .from('profiles')
      .select(`username, website, avatar_url`)
      .eq('id', user.id)
      .single();
  }

  /**
   * getProfileById returns an observable that emits the profile of a user.
   * @param id The id of the user.
   */
  authChanges(
    callback: (event: AuthChangeEvent, session: Session | null) => void
  ) {
    return this.supabase.auth.onAuthStateChange(callback);
  }

  /**
   * authChanges$ returns an observable that emits the session of the user.
   */
  authChanges$() {
    return new Observable<Session | null>((subscriber) => {
      const subscription = this.authChanges((_, session) => {
        subscriber.next(session);
      });

      return () => subscription.data.subscription.unsubscribe();
    }).pipe(startWith(this.session));
  }

  /**
   * signIn returns a promise that resolves to the session of the user.
   * @param email The email of the user.
   */
  signIn(email: string) {
    return this.supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
  }

  /**
   * signIn using password
   */
  signInWithPassword(email: string, password: string) {
    return this.supabase.auth.signInWithPassword({
      email,
      password,
    });
  }

  /**
   * SignOut ends the session of the user.
   * @param token The token of the user.
   */
  signOut() {
    return this.supabase.auth.signOut();
  }

  /**
   * signInWithToken returns a promise that resolves to the session of the user.
   * @param token The token of the user.
   */
  updateProfile(profile: Profile) {
    const update = {
      ...profile,
      updated_at: new Date(),
    };

    return this.supabase.from('profiles').upsert(update);
  }

  /**
   * downLoadImage returns a promise that resolves to the image.
   * @param path Path of the image to download.
   * @returns Returns a promise that resolves to the image.
   */
  downLoadImage(path: string) {
    return this.supabase.storage.from('avatars').download(path);
  }

  /**
   * uploadAvatar uploads an avatar to the database.
   * @param filePath The path of the avatar.
   * @param file The file to upload.
   * @returns Returns a promise that resolves to the response of the upload.
   */
  uploadAvatar(filePath: string, file: File) {
    return this.supabase.storage.from('avatars').upload(filePath, file);
  }

  /**
   * Uploads a file to the database to the specified bucket.
   * @param filePath File path in the bucket
   * @param file File to upload
   * @param bucketName Bucket name
   * @returns Returns a promise that resolves to the response of the upload.
   */
  uploadFile(filePath: string, file: File, bucketName: string) {
    return this.supabase.storage
      .from(bucketName)
      .upload(filePath, file, { upsert: true });
  }

  downloadFile(filePath: string, bucketName: string) {
    return this.supabase.storage.from(bucketName).createSignedUrl(filePath, 60);
  }
  /**
   * signUp signs up a user.
   * @param email The email of the user.
   * @returns Returns a promise that resolves to the response of the sign up.
   */
  async signUp(
    email: string
  ): Promise<{ data: any | null; error: any | null }> {
    try {
      const response = await fetch(
        `${environment.supabaseUrl}/auth/v1/signup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: `${environment.supabaseKey}`,
          },
          body: JSON.stringify({
            email: email,
            password: this.generateSecurePassword(),
            options: { emailRedirectTo: window.location.origin },
          }),
        }
      );
      return { data: { user: await response.json() }, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }
  /**
   * signUp signs up a user.
   * @param email The email of the user.
   * @returns Returns a promise that resolves to the response of the sign up.
   */
  async signUpWithPassword(
    email: string,
    password: string
  ): Promise<{ data: any | null; error: any | null }> {
    try {
      const response = await fetch(
        `${environment.supabaseUrl}/auth/v1/signup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: `${environment.supabaseKey}`,
          },
          body: JSON.stringify({
            email,
            password,
            options: { emailRedirectTo: window.location.origin },
          }),
        }
      );
      return { data: { user: await response.json() }, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * generateSecurePassword generates a secure password.
   * This method is taken from https://stackoverflow.com/questions/1497481/javascript-password-generator
   * We use this method to
   * @param length The length of the password.
   * @returns Returns a secure password.
   */
  private generateSecurePassword(length = 12) {
    var charset =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=';
    var password = '';
    var values = new Uint32Array(length);
    window.crypto.getRandomValues(values);
    for (var i = 0; i < length; i++) {
      password += charset[values[i] % charset.length];
    }
    return password;
  }

  /**
   * fetchInBatches fetches data in batches.
   * @param query The query to fetch the data.
   * @param batchSize The size of the batch.
   * @returns Returns an observable that emits the data in batches.
   */
  fetchInBatches<
    Schema extends GenericSchema,
    Row extends Record<string, unknown>,
    Result,
    Relationships = unknown
  >(
    query: PostgrestFilterBuilder<Schema, Row, Result[], Relationships>,
    batchSize: number
  ) {
    return new Observable<Result[]>((observer) => {
      let offset = 0;

      const fetchNextBatch = () => {
        query.range(offset, offset + batchSize - 1).then(({ data, error }) => {
          if (error) {
            observer.error(error);
            return;
          }
          if (data && data.length > 0) {
            observer.next(data);
            if (data.length < batchSize) {
              observer.complete();
            } else {
              offset += batchSize;
              fetchNextBatch();
            }
          } else {
            observer.complete();
          }
        });
      };

      fetchNextBatch();
    });
  }
}
