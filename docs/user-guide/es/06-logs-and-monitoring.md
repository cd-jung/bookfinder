# Registros y monitorización

La página **Registros y monitorización** muestra el estado del servicio y permite buscar en los registros de solicitudes.

> **Solo administradores.** Esta página está en el sitio de administración. Inicia sesión con un correo autorizado; recibirás un código de un solo uso. Sin iniciar sesión verás **Debes iniciar sesión**.

## Panel

Las tarjetas de arriba muestran las últimas 24 horas:

- **Solicitudes**: número de solicitudes a la API.
- **Tasa de errores**: proporción de solicitudes que fallaron con un error del servidor (5xx).
- **Latencia p95**: el 95 % de las solicitudes fue más rápido que este valor.
- **Errores del cliente**: solicitudes rechazadas por no ser válidas (4xx).

El gráfico muestra las solicitudes y los errores del servidor por hora. Cambia el intervalo con **Periodo**.

## Margen de recursos

Cada indicador muestra qué parte de un límite está en uso, con un porcentaje, un color y una etiqueta:
**Bien** (verde, menos del 60 %), **Vigilar** (ámbar, 60–85 %) y **Crítico** (rojo, 85 % o más).

- **Aplicación (últimas 24 horas)**: tiempo de respuesta p95 frente a un objetivo de 1 s, el presupuesto de errores 5xx, las llamadas de IA de hoy frente al presupuesto diario, la proporción de solicitudes limitadas (429) y el almacenamiento vectorial usado.
- **Cloudflare**: tiempo de CPU p99 frente al límite por solicitud, solicitudes de este mes, almacenamiento de D1 y filas de D1 leídas y escritas este mes frente a lo incluido. Si estas métricas no están configuradas, un aviso lo indica.

## Buscar registros en lenguaje natural

1. Escribe una pregunta como `errores en la última hora` o `solicitudes lentas de más de 500 ms`.
2. Pulsa **Enter**. La búsqueda muestra cómo entendió la pregunta en **Interpretado como**.
3. La tabla muestra las solicitudes que coinciden, de la más reciente a la más antigua.

Solo se pueden buscar campos de los registros: hora, método, ruta, estado, duración, nivel, mensaje y país.
Si la pregunta no se puede convertir en una búsqueda de registros, se te pide que la reformules.

## Búsqueda por palabra clave

Cambia a **Palabra clave** para buscar en la ruta y el texto del mensaje, con la opción de limitarlo a un nivel.
