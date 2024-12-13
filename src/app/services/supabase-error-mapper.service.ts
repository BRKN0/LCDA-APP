import { Injectable } from '@angular/core';
import { PostgrestError } from '@supabase/supabase-js';

/**
 * Postgrest error codes and their corresponding messages.
 * If the error code is not found in this map, the default message will be returned.
 */
const ERROR_MAPPINGS = new Map<string, string>([
  ['42501', 'Permisos insuficientes'],
  ['23503', 'Existen referencias al registro en otras tablas'],
]);

/**
 * Service to map Supabase errors to user-friendly messages.
 */
@Injectable({
  providedIn: 'root',
})
export class SupabaseErrorMapperService {
  /**
   * Constructor.
   */
  constructor() {}

  /**
   * Returns a user-friendly message for the given error.
   * @param postgrestError The error to map.
   * @param defaultMessage The default message to return if the error code is not found in the map.
   * @returns A user-friendly message for the given error.
   */
  getMessage(postgrestError: PostgrestError, defaultMessage: string) {
    if (postgrestError.message.startsWith('HR:')) {
      return postgrestError.message.replace('HR:', '');
    }

    const mappedError = ERROR_MAPPINGS.get(postgrestError.code);

    if (!mappedError) return defaultMessage;

    return mappedError;
  }
}
