import { Injectable } from '@angular/core';
import { defer, map, Observable, switchMap, shareReplay } from 'rxjs';

/**
 * City interface.
 */
interface City {
  /**
   * City name, this is the value that is going to be used in the dropdowns.
   */
  name: string;
  /**
   * City title, this is the text that is going to be displayed in the dropdowns.
   */
  title: string;
}

/**
 * Department interface.
 */
interface Department {
  /**
   * Department name, this is the value that is going to be used in the dropdowns.
   */
  departmentName: string;
  /**
   * Department title, this is the text that is going to be displayed in the dropdowns.
   */
  departmentTitle: string;
  /**
   * List of cities in the department.
   */
  cities: City[];
}

/**
 * This service is used to provide the Colombia JSON. It is used to populate the dropdowns.
 */
@Injectable({
  providedIn: 'root',
})
export class ColombiaJsonService {
  /**
   * List of departments in Colombia. It is used to populate the dropdowns.
   */
  colombia$: Observable<Department[]> = defer(() =>
    fetch('/assets/colombia.json')
  ).pipe(
    switchMap((response) => defer(() => response.json())),
    map((colombia: { departamento: string; ciudades: string[] }[]) => {
      return colombia.map((department) => ({
        departmentName: department.departamento
          .trim()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toUpperCase(),
        departmentTitle: department.departamento,
        cities: department.ciudades.map((city) => ({
          name: city
            .trim()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase(),
          title: city,
        })),
      }));
    }),
    shareReplay()
  );
}
