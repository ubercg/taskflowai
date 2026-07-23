# Convención de claves i18n (TSK-019)

Fuente de verdad para las migraciones de TSK-020 (pantallas core) y TSK-021 (validaciones, errores y toasts).
Catálogos: `frontend/src/i18n/locales/{es,en}.json`.

## Namespaces por dominio

| Prefijo | Uso |
|---|---|
| `common.*` | Copy transversal reutilizable |
| `nav.*` | Ítems de navegación / sidebar |
| `auth.*` | Login, sesión, unauthorized |
| `profile.*` | Pantalla de perfil |
| `users.*` | Listado, admin, formularios y drawer de tareas de usuario |
| `projects.*` | Listado, detalle, tarjeta, formulario y panel de miembros |
| `objectives.*` | Formulario OKR, panel de tareas del objetivo y chart de progreso |
| `execution.*` | Tablero Kanban: `BoardPage` (header/tabs), `KanbanBoard`/`KanbanColumn` (columnas, WIP, bottleneck), `WipToast`, `TaskListView` |
| `tasks.*` | Formulario y detalle de tarea: `TaskFormModal` (`tasks.form.*`), `TaskModal` (`tasks.detail.*`), `TaskCard` (`tasks.card.*`) |
| `metrics.*` | Dashboard de métricas: `MetricsPage`, `MetricsDashboard` (KPIs), `DailySummary`, charts de `features/analytics/charts/*` |
| `calendar.*` | Calendario del proyecto: `CalendarView`, `CalendarDaySidebar`, bloque de métricas del PDF (`CalendarPdfReport`) |
| `myTasks.*` | Pantalla Mis Tareas (`MyTasksPage`) y el widget de registro de tiempo (`TimeLogWidget`); reusa `nav.myTasks`, `tasks.card.okr`, `tasks.detail.timeLog.submit`/`error` y `common.actions.cancel` |
| `errors.*` | Mensajes de API por código estable (`errors.WIP_LIMIT_EXCEEDED`, …). Resolver siempre vía `resolveApiError()` en `services/api/errors.js` — no leer `err.detail` a mano en la UI |
| `enums.*` | Etiquetas de enums (vía `i18n/enums.js`) |
| `language.*` | Nombres de idiomas en el selector |
| `errors.*` | Reservado para TSK-021 (`errors.{CODE}`) |

## Sufijos

| Sufijo | Cuándo |
|---|---|
| `.label` | Etiqueta visible de campo |
| `.placeholder` | Placeholder de input |
| `.title` | Título / heading |
| `.subtitle` / `.helper` / `.hint` | Texto de apoyo |
| `.button` / acciones en `common.actions.*` | CTAs |
| `.aria` | Accesibilidad (`aria-label`) |
| `.success` / `.error` / `.mismatch` | Feedback de formularios |

## Acciones repetidas

Viven en `common.actions.*` — **no** duplicar "Guardar" / "Cancelar" por pantalla:

- `common.actions.save`
- `common.actions.saving` — estado de envío de cualquier formulario
- `common.actions.cancel`
- `common.actions.back`
- `common.actions.close`
- `common.actions.settings`
- `common.actions.logout`

## Interpolación

Los valores dinámicos van como variables, **nunca** concatenando strings:

```jsx
// ✅  "Bienvenido, Ana"
t('profile.greeting', { name: user.name })   // "Bienvenido, {{name}}"

// ❌  imposible de traducir: el orden de las palabras cambia por idioma
t('profile.greetingPrefix') + ' ' + user.name
```

La concatenación rompe cualquier idioma cuyo orden sintáctico difiera del español. La clave debe contener la frase **completa**.

## Plurales

i18next elige la variante con la variable reservada `count` y los sufijos `_one` / `_other`. No inventar claves tipo `tareaSingular` / `tareaPlural`.

```json
{
  "tasks.count_one": "{{count}} tarea",
  "tasks.count_other": "{{count}} tareas"
}
```

```jsx
t('tasks.count', { count: n })
```

Verificado con i18next 26.3.6 en `es` y `en`:

| `count` | es | en |
|---|---|---|
| 0 | `0 tareas` (`_other`) | `0 tasks` (`_other`) |
| 1 | `1 tarea` (`_one`) | `1 task` (`_one`) |
| 2 | `2 tareas` (`_other`) | `2 tasks` (`_other`) |

**El cero usa `_other`, no `_one`.** Si un texto para cero necesita otra redacción ("Sin tareas" en vez de "0 tareas"), agregar `_zero` explícitamente — i18next lo respeta cuando existe.

Al sumar un idioma con más categorías plurales (ruso, árabe, polaco), ese locale agrega sus propios sufijos (`_few`, `_many`) sin tocar `es` ni `en`.

## `t()` vs `<Trans>`

Usar `t()` por defecto. `<Trans>` **sólo** cuando la frase lleva markup embebido y partirla rompería el orden de las palabras:

```jsx
// ✅  t() — texto plano, aunque tenga variables
<p>{t('auth.login.forgotPassword')}</p>

// ✅  <Trans> — hay un <strong> en medio de la frase
<Trans i18nKey="session.expiresIn">
  Tu sesión expira en <strong>{{ minutes }}</strong> minutos
</Trans>

// ❌  partir la frase para insertar el markup
{t('session.expiresPrefix')} <strong>{minutes}</strong> {t('session.expiresSuffix')}
```

La regla de fondo es la misma que en interpolación: **una frase, una clave.** Los fragmentos sueltos no se pueden traducir bien porque el traductor no ve la oración completa.

## Fechas y horas: nunca locale hardcodeado (RN-011)

Nombres de mes/día y formatos `toLocaleDateString`/`toLocaleTimeString` deben
seguir el locale activo de i18n, nunca `'es'` / `'es-ES'` fijo:

- Nombres de mes/día (`MonthSelector`, grilla de `CalendarView`): `formatLocalized(date, pattern)` (`utils/dateUtils.js`), que aplica el locale de `date-fns` correspondiente (`es` / `enUS`).
- `toLocaleTimeString` / `toLocaleDateString` nativos: `getBcp47Locale()` en vez de `[]` o un string fijo (ej. `DailySummary` — hora de generación del resumen).
- Encabezados de día de semana (`CalendarView`, `LUN/MAR/...`) se derivan de `formatLocalized(day, 'EEE')` sobre la primera semana de la grilla, no de un array hardcodeado — así siguen el locale sin tocar el componente al agregar un idioma (RN-008).

`CalendarPdfReport` no formatea fechas directamente (delega en los charts /
`CalendarView`), pero sí debía traducir su propio copy (`"Métricas del
Proyecto"` → `calendar.pdf.metricsTitle`, KPIs reusando `metrics.kpi.*`) para
que el PDF exportado respete el idioma activo y no quede fijo en español
mientras el resto de la UI está en otro idioma.

## Charts (Recharts): nunca constantes a nivel de módulo

Los charts (`features/analytics/charts/*`, y por extensión el bloque de métricas
del PDF en `CalendarPdfReport`) resuelven `title`, `name` de series/barras y
textos de tooltip/legend/empty-state con `t()` **dentro del render**, llamando
`useTranslation()` en el propio componente (patrón de `OkrProgressChart`,
replicado en TSK-020 slice 5 a `BurndownChart`, `VelocityChart`, `AgingChart`).

```jsx
// ✅ — se re-evalúa en cada render con el idioma activo
const { t } = useTranslation();
<Line dataKey="ideal" name={t('metrics.charts.burndown.idealLine')} />

// ❌ — congela el string en el idioma que estaba activo al importar el módulo
const LABELS = { ideal: 'Ritmo Ideal' };
<Line dataKey="ideal" name={LABELS.ideal} />
```

`chartTheme.js` es la única excepción: solo expone paletas de color y clases
CSS compartidas (`CHART_CARD`, `CHART_TITLE`, `CHART_EMPTY`), nunca copy
traducible. Los mapas de color por status en `CalendarView`/`CalendarDaySidebar`
(`STATUS_STYLE`) siguen el mismo criterio — guardan `bg`/`color`, nunca un
`label`; la etiqueta se resuelve con `taskStatusLabel(status)` en el punto de uso.

## Datos de negocio en español vs. copy de UI (RN-002)

Algunos endpoints devuelven texto en español generado por el backend
(rule-based o LLM), no copy de interfaz. El caso de referencia es
`GET /api/v1/ai/daily-summary`, consumido por `DailySummary`:

| Campo | Origen | ¿Se traduce en frontend? |
|---|---|---|
| `summary_text` | Rule-based o Gemini, siempre en español (`daily_summary.py`) | **No.** Es dato, no copy. |
| `blocked.blocked_since` (ej. `"48h"`, `"reciente"`) | Rule-based, en español | **No.** Mismo criterio. |
| `risks[].reason` (ej. `"Fecha límite vencida"`) | Rule-based, en español | **No.** Mismo criterio. |
| `advanced[].from_status` / `to_status` | Código de enum (`todo`, `in_progress`, ...) | **Sí** — no es prosa, es un enum: se resuelve con `taskStatusLabel()`. |

Regla: si el backend devuelve **prosa libre en español**, se renderiza tal
cual (es un dato del dominio, como un nombre o un comentario de usuario) — no
se le pasa por `t()` ni se intenta traducir client-side. Si el backend
devuelve un **código de enum**, sí se traduce, porque el enum ya tiene
catálogo en `enums.task.status.*`.

Cuando el locale activo (`useLocale().locale`) no es `es` y se está mostrando
`summary_text` real (no el fallback de "sin actividad", que sí está en el
catálogo como `metrics.summary.noActivity`), `DailySummary` muestra un badge
con la clave `metrics.summary.generatedInSpanish` para que quede claro que
ese fragmento específico está en español aunque el resto de la UI esté en
inglés. El chrome alrededor (título, botón de refresh, categorías, error,
detalle) sí está 100% traducido.

Si en el futuro se agrega traducción real de `summary_text` (vía LLM
multi-idioma en el backend), este criterio se revisita — hoy es una decisión
explícita de scope, no un olvido.

## Tests: buscar por clave, con red

Los tests resuelven el texto con `i18n.t('...')` en vez de hardcodear el copy, para que un retoque de redacción no rompa la suite.

El riesgo de hacerlo así: componente y aserción resuelven **la misma clave por el mismo catálogo**. Si la clave falta, i18next devuelve la clave en ambos lados, coinciden, y el test pasa mientras la pantalla muestra `users.form.createTitle` como texto visible.

Por eso `src/test/setup.js` hace que una clave faltante **lance**:

```js
i18n.options.parseMissingKeyHandler = (key) => {
  throw new Error(`Missing i18n key: "${key}". …`)
}
```

El fallo ocurre en el lookup, dentro del render, antes de que haya dos lados que comparar.

**La paridad de catálogos no cubre esto.** Un typo como `t('users.form.creatTitle')` no existe en ningún idioma, así que `es` y `en` siguen sincronizados mientras la pantalla está rota. Son dos chequeos distintos:

| Chequeo | Detecta |
|---|---|
| Paridad `es` ↔ `en` | clave en un idioma y no en el otro → fallback silencioso |
| Guard de clave faltante | clave que no existe en ninguno → clave cruda en pantalla |

Único caso donde una clave faltante es intencional: el test de RN-007, que verifica el fallback. Ese desactiva el guard y lo restaura en un `finally`.

## Emojis e iconos

El emoji/icono es presentación, **no** va dentro de la clave traducible.

```jsx
// ✅
<span aria-hidden="true">🛡️</span> {t('nav.admin')}

// ❌
{t('nav.adminWithEmoji')} // "Admin 🛡️"
```

## Marca

`common.brand` = `TaskFlow` en ambos locales (nombre propio). No localizar.

## Errores de API y copy fuera de React (TSK-021)

`i18next/no-literal-string` usa `markupOnly: true` — **sólo ve JSX**. Stores, `alert()` y helpers son invisibles al lint.

Para traducir fuera de componentes, usar el singleton:

```js
import i18n from '../i18n'
import { resolveApiError } from '../services/api/errors'

// En un store / módulo:
set({ error: resolveApiError(err, 'errors.LOGIN_FAILED') })

// En un catch de UI (también válido con useTranslation):
alert(resolveApiError(err, 'projects.form.errors.save'))
```

`resolveApiError` (RN-013):

1. Si existe `errors.{code}` → `i18n.t` con meta (sin `suggestion` del backend).
2. Si no, `error.detail` (fallback RN-007).
3. Si no, la clave `fallback` / `errors.UNKNOWN_ERROR`.

Validaciones de formulario viven en `*.form.errors.*` del dominio (patrón de TSK-020) — **no** se renombraron a `validation.*`.

## Cómo agregar un idioma (RN-008)

1. Archivo `locales/{code}.json` con la misma jerarquía.
2. Registrar en `SUPPORTED_LOCALES` + `resources` en `i18n/index.js`.
3. Entrada en `language.{code}`.
4. Sin tocar componentes que ya usan `t()` / `enums.js`.
