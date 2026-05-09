# LCDA-APP (Logistics-Centric Distribution for Acrylics)

Este proyecto fue generado con [Angular CLI](https://github.com/angular/angular-cli) versión 19.0.5.

## Descripción del Proyecto

LCDA-APP es una plataforma web modular diseñada para digitalizar y optimizar los procesos operativos y administrativos de La Casa del Acrílico. El sistema centraliza en una única interfaz la gestión comercial, logística y financiera, eliminando procesos manuales y garantizando la trazabilidad absoluta mediante registros inmutables.

### Stack Tecnológico

* **Frontend:** Angular v19, TailwindCSS.
* **Backend (BaaS):** Supabase (PostgreSQL 15, Auth, Storage).
* **Despliegue:** Vercel (Frontend), GitHub (CI/CD).

## Documentación Básica

El sistema opera bajo una arquitectura de confianza cero (Zero-Trust) apoyada en Row Level Security (RLS) en la base de datos. Se compone de los siguientes módulos funcionales principales:

* **Gestión de Pedidos:** Creación de órdenes de trabajo con soporte para cargos extras dinámicos (estructuras JSONB), historial de estados y descuento atómico de stock al confirmar el pedido.
* **Control de Inventario (Kárdex):** Trazabilidad estricta de entradas y salidas de materias primas (acrílico, MDF) y productos terminados, con alertas de stock crítico.
* **Facturación Interna:** Generación de facturas PDF con numeración consecutiva segura delegada a funciones SQL, incluyendo cálculo automatizado de IVA y retenciones.
* **Tesorería y Egresos:** Control de salidas de capital por categorías, gestión de abonos parciales y adjuntos digitales para evidencias de pago.
* **Accesos y Roles:** Control de visibilidad granular para perfiles de Administrador, Agendador, Empleados operativos y Visitantes.

## Comandos Útiles de Desarrollo

A continuación se detallan los comandos de Angular CLI necesarios para la operación, modificación y compilación del proyecto.

### Servidor de Desarrollo local

Para iniciar un servidor de desarrollo local, ejecuta:

```bash
ng serve

```

Una vez que el servidor esté en ejecución, abre tu navegador y navega a `http://localhost:4200/`. La aplicación se recargará automáticamente siempre que modifiques alguno de los archivos fuente.

### Generación de Código (Scaffolding)

Angular CLI incluye herramientas para la generación rápida de código. Para generar un nuevo componente, ejecuta:

```bash
ng generate component nombre-del-componente

```

Para consultar la lista completa de esquemas disponibles (como `components`, `directives`, `services` o `pipes`), ejecuta:

```bash
ng generate --help

```

### Compilación para Producción (Build)

Para compilar el proyecto y prepararlo para su despliegue, ejecuta:

```bash
ng build

```

Este comando compilará el proyecto y almacenará los artefactos en el directorio `dist/`. Por defecto, la compilación de producción optimiza la aplicación para garantizar el máximo rendimiento y velocidad de carga.

### Ejecución de Pruebas (Testing)

Para ejecutar las pruebas unitarias utilizando el entorno de [Karma](https://karma-runner.github.io), utiliza el siguiente comando:

```bash
ng test

```

Para la ejecución de pruebas end-to-end (e2e):

```bash
ng e2e

```

*Nota: Angular CLI no incluye un framework e2e por defecto en sus versiones recientes, asegúrate de configurar Cypress, Playwright o tu herramienta de preferencia antes de ejecutar este comando.*

[Deepwiki - Repositorio Documental LCDA-APP](https://deepwiki.com/BRKN0/LCDA-APP)

Para obtener más información sobre el uso general de Angular CLI, visita la página oficial de [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli).
