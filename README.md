# Grafana Rules Uploader

Script para cargar reglas de alerta en Grafana desde la consola del navegador.

## 🚀 Cómo usar

### 1. **Preparar el script**

Edita el archivo `upload-grafana-rules.js` y configura:

- **DRY_RUN** (línea 1):
  - `true` = Solo simula los cambios (modo prueba)
  - `false` = Ejecuta los cambios reales

```javascript
const DRY_RUN = false; // Cambiar a true para modo prueba
```

### 2. **Abrir Grafana**

1. Navega a tu instancia de Grafana en el navegador
2. Asegúrate de estar logueado con permisos adecuados

### 3. **Abrir la consola del navegador**

**Dónde encontrar la consola:**
- **Chrome/Edge**: F12 → Pestaña "Console"
- **Firefox**: F12 → Pestaña "Console"
- **Safari**: Cmd+Option+C → Console

### 4. **Copiar y pegar el script**

1. Abre el archivo `upload-grafana-rules.js` en tu editor
2. Copia TODO el contenido (Ctrl+A → Ctrl+C)
3. Pégalo en la consola del navegador (Ctrl+V)
4. Presiona Enter para ejecutar

## 📝 Configuración

### Dry Run (Modo Prueba)

**SIEMPRE** ejecuta primero en modo dry run para verificar:

```javascript
const DRY_RUN = true; // Modo prueba
```

Esto mostrará en la consola qué cambios se harían sin ejecutarlos.

### Desactivar Provenance

```javascript
const DISABLE_PROVENANCE = true; // Desactiva el header de provenance
```

### Estructura de Reglas

Las reglas están en el objeto `rulesConfig`:
- **groups**: Array de grupos de reglas
- **folder**: Carpeta donde se guardarán las alertas
- **interval**: Intervalo de evaluación
- **rules**: Array con las reglas individuales

## 🔍 Verificación

Después de ejecutar:

1. Revisa los logs en la consola:
   - `[Upserter]` = Mensajes del script
   - Verifica que no haya errores rojos

2. En Grafana:
   - Ve a **Alerting → Alert rules**
   - Busca la carpeta configurada (ej: "B24U Alerts")
   - Verifica que las reglas estén creadas/actualizadas

## ⚠️ Notas importantes

- **SIEMPRE** haz backup antes de ejecutar cambios masivos
- El script necesita que estés autenticado en Grafana
- Las reglas existentes con el mismo UID serán **actualizadas**, no duplicadas
- Si una regla falla, el script continúa con las demás

## 🛠️ Troubleshooting

**Error: "Unauthorized"**
→ No estás logueado o no tienes permisos

**Error: "Folder not found"**
→ La carpeta especificada no existe, el script intentará crearla o usar una existente

**No pasa nada al pegar**
→ Asegúrate de estar en la pestaña correcta de Grafana (cualquier página sirve)
