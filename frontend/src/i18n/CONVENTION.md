# Convención de claves i18n (TSK-019)

Fuente de verdad para migraciones [[TSK-020-i18n-Pantallas-Core]] y [[TSK-021-i18n-Validaciones-Errores-Toasts]].
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
