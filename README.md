# SOÑO · web de la cafetería

Web de SOÑO con carta, alérgenos, pedidos para llevar, galería, reservas de mesa, formulario de contacto y un panel para editarlo todo sin tocar código.

- **Web pública**: portada, nosotros, carta por grupos (cada producto se abre en grande con sus alérgenos), pedidos para llevar (recoger en el local a la hora elegida, o a domicilio), galería, contacto y reservas en una ventana emergente.
- **Panel**: se abre tocando el logo SOÑO de la cabecera y ocupa toda la pantalla. Desde ahí se crean, ordenan y borran los grupos de la carta; se cambian precios, productos, alérgenos, fotos, horarios y datos de contacto; se activan o desactivan los pedidos para llevar y la entrega a domicilio, y se ven las reservas, los pedidos (con su hora de recogida) y los mensajes que llegan.
- **Marca**: logo SOÑO en vector (el café de la Ñ se mueve), colores de la guía de marca y la tipografía Fredoka.

## Temas de color

Desde el panel, pestaña **Ajustes → Aspecto**, se elige un tema para la web y otro para el panel. Son los tres esquemas de la guía de marca:

| Tema | Fondo | Letras | Logo |
|---|---|---|---|
| Beige | beige rgb(243, 224, 166) | marrón rgb(86, 41, 18) | marrón |
| Marrón | marrón rgb(86, 41, 18) | beige | oliva rgb(128, 127, 91) |
| Lila | lila rgb(201, 173, 255) | marrón | beige |

Las bandas alternas y las ventanas usan el color contrario. La ventana de reservar mesa va al revés que las demás: con los colores de fondo de la web. Los campos de los formularios llevan siempre el color inverso de donde están.
- **Servidor**: Node.js sin dependencias. Guarda todo en la carpeta de datos (un volumen de Docker).

## Estructura

```
server.js              servidor web y API
datos-iniciales.json   carta y horarios de partida (solo se usan el primer arranque)
public/                la web: index.html, styles.css, app.js, tipografías
Dockerfile             imagen de la web
docker-compose.yml     stack para Portainer
.github/workflows/     construye la imagen y la publica en GitHub Container Registry
```

## Variables de entorno

| Variable | Para qué sirve | Valor por defecto |
|---|---|---|
| `ADMIN_PASSWORD` | Contraseña del panel. **Obligatoria**. | — |
| `ADMIN_USER` | Usuario del panel | `soño` (también vale `sono`) |
| `PUERTO` | Puerto del servidor donde se publica la web | `8080` |
| `TRUST_PROXY` | `true` si la web va detrás de un proxy (Nginx Proxy Manager, Traefik, Cloudflare Tunnel) | `true` |
| `COOKIE_SECURE` | `auto` marca la sesión como segura cuando la web va por HTTPS | `auto` |

## Probar en tu ordenador

Necesitas Node.js 20 o superior.

```bash
ADMIN_PASSWORD=2026 node server.js
```

Abre http://localhost:3000. Los datos se guardan en la carpeta `data/`.

## Publicar en el servidor con Portainer

### Opción A · Web editor (la más sencilla)

1. En Portainer: **Stacks** → **Add stack**, nombre `sono`, método **Web editor**.
2. Pega el contenido de `stack-portainer.yml`.
3. Cambia `ADMIN_PASSWORD` y, si el puerto 3070 está ocupado, el puerto de la izquierda en `ports`.
4. **Deploy the stack**.

En cada arranque el contenedor descarga la última versión de `main` desde GitHub, así que para actualizar la web basta con subir los cambios y reiniciar el contenedor desde Portainer. Los datos se guardan en el volumen `sono_datos` y no se pierden.

### Opción B · Imagen ya construida en GitHub

#### 1. La imagen se construye sola

Cada vez que se sube un cambio a la rama `main`, GitHub Actions construye la imagen para x86 y ARM (vale para Contabo, Oracle y las Raspberry Pi) y la publica en `ghcr.io/marcogugliandolo/sono:latest`. Puedes ver el progreso en la pestaña **Actions** del repositorio.

La primera vez, haz pública la imagen para que Portainer pueda descargarla sin contraseña: en GitHub ve a tu perfil → **Packages** → **sono** → **Package settings** → **Change visibility** → **Public**.

#### 2. Crear el stack

En Portainer, dentro del entorno donde quieras la web:

1. **Stacks** → **Add stack**, con nombre `sono`.
2. Método **Repository**:
   - Repository URL: la URL de este repositorio
   - Reference: `refs/heads/main`
   - Compose path: `docker-compose.yml`
3. En **Environment variables** añade `ADMIN_PASSWORD` (y si quieres `PUERTO`).
4. **Deploy the stack**.

La web queda en `http://IP-DEL-SERVIDOR:8080`. Para un dominio con HTTPS, apunta tu proxy (por ejemplo Nginx Proxy Manager) a ese puerto.

#### 3. Actualizar después de un cambio

1. Sube el cambio a `main` y espera a que termine la acción en **Actions** (marca verde).
2. En Portainer, abre el stack y pulsa **Pull and redeploy** con la opción de volver a descargar la imagen activada.

Los datos (carta, fotos, reservas) viven en el volumen y no se pierden al actualizar.

## Copia de seguridad

Todo está en el volumen del stack (Portainer lo llama `sono_sono_datos`): `contenido.json`, `reservas.json`, `pedidos.json`, `mensajes.json` y la carpeta `fotos/`.

```bash
docker run --rm -v sono_sono_datos:/datos -v "$PWD":/copia alpine \
  tar czf /copia/sono-copia-$(date +%F).tgz -C /datos .
```

## Seguridad

- El panel pide usuario y contraseña al servidor; la contraseña no está en el código de la web.
- Tras 5 intentos fallidos desde la misma IP, el acceso se bloquea 15 minutos.
- La sesión dura 12 horas y la cookie solo la puede leer el servidor.
- Las fotos se comprueban (solo JPG, PNG o WebP, hasta 10 MB) y el navegador las reduce antes de subirlas.
- Las reservas, los pedidos y los mensajes tienen límite de envíos por IP y una trampa para bots.
- El total de cada pedido lo calcula el servidor con los precios de la carta, no el navegador.

## Alérgenos

Los 14 alérgenos de declaración obligatoria (Reglamento UE 1169/2011) se marcan en cada producto desde el panel, pestaña **Carta**. Los que trae la carta de ejemplo son orientativos: revisadlos con vuestras recetas y proveedores antes de abrir.
- Usa una contraseña larga en `ADMIN_PASSWORD`, sobre todo si la web es pública.

## Tipografía e iconos

Fredoka, la misma letra redondeada del logo, alojada en `public/fuentes` con su licencia SIL Open Font License. No se carga desde Google, así que la web no hace peticiones a terceros.

El icono de la pestaña (`favicon.ico`, `favicon.svg` y `apple-touch-icon.png`) es el logo.

## Horas de recogida

Los pedidos para recoger se pueden programar para hoy, mañana o pasado mañana, en las mismas horas que las reservas (pestaña **Horarios** del panel). Si no hay horas puestas, el pedido se envía sin hora y se acuerda por teléfono.
