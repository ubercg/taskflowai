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

## Cómo agregar un idioma (RN-008)

1. Archivo `locales/{code}.json` con la misma jerarquía.
2. Registrar en `SUPPORTED_LOCALES` + `resources` en `i18n/index.js`.
3. Entrada en `language.{code}`.
4. Sin tocar componentes que ya usan `t()` / `enums.js`.
