# taskflowai - Instrucciones para IAs (Claude, Cursor, Opencode)

## GUÍA TÉCNICA: DÓNDE ENCONTRARLA

Este repositorio **no contiene** la guía técnica del proyecto (stack, estructura de carpetas, modelo de dominio, auth, capa de IA, comandos, convenciones y gotchas). Vive en el vault de Obsidian:

- **Resumen técnico / onboarding**: `100-🎯-Proyectos/taskflowai/20-Arquitectura/ARQ-000-Resumen-Tecnico.md`
- **Decisiones de arquitectura**: `100-🎯-Proyectos/taskflowai/20-Arquitectura/ARQ-001-Decisiones-Core.md`
- **Modelo de base de datos**: `100-🎯-Proyectos/taskflowai/20-Arquitectura/ARQ-002-Modelo-Base-Datos.md`
- **Contratos de endpoints**: `100-🎯-Proyectos/taskflowai/30-API/`

Ruta absoluta del vault:
`/Users/ubercg/Library/CloudStorage/GoogleDrive-ubercgar@gmail.com/Mi unidad/personal/ubercg-box/`

Leé `ARQ-000-Resumen-Tecnico.md` ANTES de tocar código si no tenés contexto del proyecto. Estos archivos no se cargan solos en el contexto: hay que abrirlos explícitamente.

## REGLA OBLIGATORIA: DOCUMENTACIÓN VIVA (LIVING DOCUMENTATION)

Al INICIAR tu sesión, revisa si hay bitácoras activas en `100-🎯-Proyectos/taskflowai/50-Bitacora/` para entender en qué estado quedó el proyecto (Handover).

Cada vez que desarrolles una funcionalidad, crees un endpoint, agregues una tabla a la base de datos o completes un requerimiento, ESTÁS OBLIGADO a actualizar el Vault de Obsidian del proyecto en tiempo real. 

La documentación oficial **NO VIVE EN ESTE REPOSITORIO**. Vive en el vault de Obsidian del usuario, ruta absoluta:
`/Users/ubercg/Library/CloudStorage/GoogleDrive-ubercgar@gmail.com/Mi unidad/personal/ubercg-box/`

Dentro del vault, el proyecto es: `100-🎯-Proyectos/taskflowai`

**Pasos OBLIGATORIOS al terminar cada iteración de código:**
1. **API**: Si creaste/modificaste un endpoint, abrí y actualizá el archivo de API correspondiente en `100-🎯-Proyectos/taskflowai/30-API/`
2. **Arquitectura**: Si creaste/modificaste una tabla, actualizá `100-🎯-Proyectos/taskflowai/20-Arquitectura/ARQ-001-Decisiones-Core.md` (o el modelo de base de datos que corresponda).
3. **Requerimientos (DoD)**: Si estás atendiendo un archivo de Requerimiento (ej: `100-🎯-Proyectos/taskflowai/10-Requerimientos/REQ-XXX.md`), al finalizar tu trabajo DEBÉS abrir ese archivo y marcar los checkboxes de la sección "Criterios de Aceptación (DoD)" cambiando los `[ ]` por `[x]`.
4. **Tareas**: Actualizá el estado a `status: done` en el frontmatter de la tarea correspondiente en `40-Ejecucion/`.
5. **Bitácora (Handover)**: Al finalizar tu sesión o hito de desarrollo, creá o actualizá un archivo de progreso en `100-🎯-Proyectos/taskflowai/50-Bitacora/` (Ej: `BIT-[Número]-Estatus-[Requerimiento].md`). Registrá qué se implementó, resultados de pruebas locales (smoke tests) y qué queda pendiente para el siguiente turno.

Jamás respondas "Terminé la tarea" o "Listo" sin haber abierto, editado y guardado los archivos correspondientes en Obsidian.

---

### Estructura Obligatoria de Documentación en Obsidian
Toda documentación que leas, crees o edites en el vault debe respetar esta estructura:
- `10-Requerimientos/`: Problema, Historias de Usuario, Reglas de Negocio. (Nomenclatura: `REQ-[Número]-[Nombre].md`)
- `20-Arquitectura/`: Solución, Modelo de Base de Datos, Diagramas ERD, Stack. (Nomenclatura: `ARQ-[Número]-[Nombre].md`)
- `30-API/`: Contratos de endpoints (Método, Ruta, Payload). (Nomenclatura: `API-[Número]-[Nombre].md`)
- `40-Ejecucion/`: Tareas técnicas de desarrollo. (Nomenclatura: `TSK-[Número]-[Nombre].md`)
- `50-Bitacora/`: Minutas, notas de investigación y estatus táctico de la sesión. (Nomenclatura: `BIT-[Número]-[Nombre].md`)

### Regla de Oro: Frontmatter (YAML)
TODOS los archivos `.md` que crees o modifiques en el vault de Obsidian deben incluir/mantener este bloque YAML al inicio:

```yaml
---
id: TSK-001 # (o REQ-001, ARQ-001) - Según corresponda
project: taskflowai
type: requirement | architecture | api | task | note
status: draft | active | approved | done | archived | todo | in_progress
module: nombre_del_modulo
created: YYYY-MM-DD
tags: []
---
```

## Memoria
Usa Engram MCP de manera proactiva para:
- Registrar progreso y bugs fijados.
- Guardar decisiones arquitectónicas y descubrimientos.