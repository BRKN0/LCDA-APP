import { inject } from '@angular/core';
import {
  Router,
  Route,
  UrlSegment,
  CanMatchFn,
  UrlTree,
} from '@angular/router';
import { RoleService } from '../services/role.service';
import { SupabaseService } from '../services/supabase.service';
import { of, from, Observable } from 'rxjs';
import { switchMap, filter, take, map, catchError } from 'rxjs/operators';
import type { Session } from '@supabase/supabase-js';
export const roleGuard: CanMatchFn = (
  route: Route,
  _segments: UrlSegment[]
): boolean | UrlTree | Observable<boolean | UrlTree> => {
  const router = inject(Router);
  const supabase = inject(SupabaseService);
  const roleService = inject(RoleService);

  const allowedRoles = (route.data?.['roles'] as string[]) ?? null;
  const requireAbsoluteAdmin = route.data?.['absoluteAdmin'] === true;

  // Get cached session immediately if available
  const cached = supabase.session;

  if (cached?.user) {
    return validateUser(cached.user.id);
  }

  // Otherwise wait for authChanges$
  return supabase.getSessionOnce$().pipe(
    switchMap((session: Session | null) => {
      if (!session?.user) {
        // return UrlTree instead of navigate()
        return of(router.createUrlTree(['/login']));
      }
      return validateUser(session.user.id);
    }),
    catchError(() => of(router.createUrlTree(['/login'])))
  );

  // Helpers
  function validateUser(userId: string) {
    const existingRole = roleService.currentRole;

    // If role is already known, skip fetching role again
    if (existingRole) {
      return checkAbsoluteAdmin(userId, existingRole);
    }

    // Otherwise fetch role once, then continue
    return from(roleService.fetchAndSetUserRole(userId)).pipe(
      switchMap(() => roleService.role$),
      filter((r): r is string => !!r),
      take(1),
      switchMap((role) => checkAbsoluteAdmin(userId, role))
    );
  }

  // Check if user is absolute admin
  function checkAbsoluteAdmin(userId: string, role: string) {
    return from(
      supabase
        .from('admins')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle()
    ).pipe(
      map(({ data }) => {
        const isAbsoluteAdmin = !!data;

        // If route requires absolute admin:
        if (requireAbsoluteAdmin && !isAbsoluteAdmin) {
          return router.createUrlTree(['/home']);
        }

        // Now check usual allowed roles
        if (!allowedRoles || allowedRoles.length === 0) {
          return true; // only needs login
        }

        // Admins bypass roles
        if (isAbsoluteAdmin) return true;

        // Normal role check
        if (allowedRoles.includes(role)) {
          return true;
        }

        return router.createUrlTree(['/home']);
      })
    );
  }
};
