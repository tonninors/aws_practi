# Guías interactivas de certificación AWS

Guías de estudio **interactivas, en español y autocontenidas** para preparar exámenes de
certificación de AWS. Actualmente incluye:

- **AWS Certified AI Practitioner (AIF-C01)** — `/guia-ai-practitioner`
- **AWS Certified Cloud Practitioner (CLF-C02)** — `/guia-cloud-practitioner` (contenido en progreso)

Todo el contenido de cada examen está basado en su guía de examen oficial de AWS (dominios,
ponderaciones y enunciados de tarea).

👉 **Ejecuta `node server.js`** y abre `http://localhost:8787` en el navegador — verás un
selector para elegir el examen. El servidor solo sirve archivos estáticos (no hay backend propio);
el login (con solo tu correo, sin contraseña) y el progreso en la nube los maneja Supabase
directamente desde el navegador.

## Estructura del repo

```
/shared/styles.css, shared/app.js     → motor de la app: una sola vez, compartido por todos los exámenes
/exams/<examen>/data.js               → contenido de cada examen (dominios, preguntas, flashcards, glosario, servicios)
/guia-<examen>.html                   → shell delgado por examen (define window.EXAM_META y carga shared/app.js + su data.js)
/index.html                           → selector de examen
```

Un fix o mejora de UX en `shared/app.js` o `shared/styles.css` aplica a todos los exámenes a la
vez. Para agregar un examen nuevo: crea `exams/<id>/data.js` con el mismo formato, un
`guia-<id>.html` (copia uno existente y cambia `window.EXAM_META`), y agrega una entrada al
arreglo `EXAMENES` en `shared/app.js` (así aparece en el botón "Cambiar examen" del header).

## Contenido

| Sección | Qué incluye |
|---|---|
| **Inicio** | Formato real del examen (50 preguntas puntuadas + 15 sin puntaje, aprobación 700/1000), ponderación de dominios y tu progreso |
| **Repaso por dominio** | Los 11 enunciados de tarea (1.1–5.2) en bloques colapsables, cubriendo cada objetivo oficial |
| **Banco de preguntas** | 138 preguntas, incluyendo los 4 tipos oficiales del examen real: opción única, respuesta múltiple, **ordenar pasos** y **emparejar** (con menús desplegables, igual que en el examen). Retroalimentación inmediata y explicación, filtrables por dominio, con modo de **repaso adaptativo** que prioriza lo que fallaste o nunca respondiste |
| **Casos de estudio** | 4 escenarios extensos basados en casos de uso reales, cada uno con 3 preguntas ligadas al mismo contexto |
| **Simulacro** | 50 preguntas al azar, cronómetro de 90 min, puntaje escalado 100–1000 y desglose por dominio |
| **Mi progreso** | Precisión por dominio calculada de tus respuestas guardadas, con aviso de dominios débiles |
| **Flashcards** | 28 tarjetas de repaso rápido (concepto → definición) |
| **Glosario** | 30 términos clave con su equivalente en inglés |
| **Servicios AWS** | 53 servicios dentro del alcance, con "para qué sirve" cada uno |
| **Comparador IA** | Tabla comparativa de los servicios de IA que más se confunden entre sí (Comprehend/Rekognition/Textract/Kendra, Transcribe/Polly, Bedrock/SageMaker, etc.) + 14 preguntas de práctica dedicadas |

## Ponderación de los dominios

| Dominio | Peso | Preguntas aquí |
|---|---|---|
| 1. Aspectos básicos de la IA y el ML | 20 % | 26 |
| 2. Aspectos básicos de la IA generativa | 24 % | 32 |
| 3. Aplicaciones de los modelos fundacionales | 28 % | 38 |
| 4. Pautas para una IA responsable | 14 % | 21 |
| 5. Seguridad, cumplimiento y gobernanza | 14 % | 21 |

El banco de preguntas replica la distribución oficial para que practiques con el mismo énfasis
que tendrá el examen real. Las opciones se muestran en orden aleatorio (distinto por pregunta) para
que la respuesta correcta no se concentre siempre en la misma letra.

### Tipos de pregunta (según la guía de examen oficial de AWS)

Según la [guía de examen oficial](https://docs.aws.amazon.com/aws-certification/latest/ai-practitioner-01/ai-practitioner-01.html),
el AIF-C01 usa 4 tipos de pregunta, y esta guía los replica todos:

- **Opción múltiple (multiple choice)** — 1 respuesta correcta y 3 distractores.
- **Respuesta múltiple (multiple response)** — 2 o más correctas de 5+ opciones; hay que marcar TODAS.
- **Ordenar (ordering)** — asignar el orden correcto a 3-5 pasos/elementos (con menús desplegables, igual que en el examen real).
- **Emparejar (matching)** — emparejar una lista de elementos con sus respuestas correctas.

El examen real tiene 65 preguntas (50 puntúan, 15 no), puntaje escalado 100–1000, aprobación ≥700,
y un modelo de puntaje **compensatorio** (no hace falta aprobar cada dominio, solo el total).

## Características

- **Login sin contraseña** — inicias sesión con un enlace mágico enviado a tu correo (magic link),
  usando [Supabase Auth](https://supabase.com/auth). No hay contraseñas que recordar ni que filtrar.
- **Progreso por cuenta** — cada usuario tiene su propio progreso, guardado en una tabla de Supabase
  (Postgres) protegida con Row Level Security, y respaldado en `localStorage` del navegador para
  seguir viendo tus datos sin conexión.
- **Repaso adaptativo** — reordena el banco de preguntas priorizando lo nunca respondido, lo fallado y lo que ya toca repasar.
- **Responsivo** — pensado también para estudiar desde el celular.

## Cuentas y hosting

El login y el progreso los maneja [Supabase](https://supabase.com) directamente desde el navegador
(el SDK de Supabase habla con su API usando la clave pública `anon`, protegida por políticas de
Row Level Security). `server.js` es solo un servidor Node sin dependencias que sirve el HTML estático.

Para usar tu propio proyecto de Supabase:

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En *Authentication → URL Configuration*, agrega la URL donde sirvas la guía (por ejemplo
   `http://localhost:8787` o tu dominio de producción) como **Site URL** y en **Redirect URLs**.
3. En el *SQL Editor*, crea la tabla `progreso` con Row Level Security, incluyendo la columna
   `examen` (separa el progreso de cada certificación aunque compartan `qid`):
   ```sql
   create table if not exists public.progreso (
     user_id uuid not null references auth.users(id) on delete cascade,
     examen text not null,
     qid text not null,
     intentos int not null default 0,
     correctas int not null default 0,
     ultima bigint not null default 0,
     racha int not null default 0,
     primary key (user_id, examen, qid)
   );
   alter table public.progreso enable row level security;
   create policy "select own progreso" on public.progreso for select using (auth.uid() = user_id);
   create policy "insert own progreso" on public.progreso for insert with check (auth.uid() = user_id);
   create policy "update own progreso" on public.progreso for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
   create policy "delete own progreso" on public.progreso for delete using (auth.uid() = user_id);
   ```
4. En *Project Settings → API*, copia el **Project URL** y la **Publishable/anon key** (nunca la
   `secret key`) y reemplázalas en las constantes `SUPABASE_URL` / `SUPABASE_ANON_KEY` al inicio de
   `shared/app.js` (son compartidas por todos los exámenes).

Para hostear en la nube: al no depender de ningún estado en el servidor, basta con servir
`guia-ai-practitioner.html` como archivo estático — no hace falta disco persistente ni variables de
entorno. `server.js` (con `node server.js`) sigue funcionando si prefieres un hosting con Node
(Render, Railway, Fly.io, un VPS), pero **no es necesario**: cualquier hosting estático sirve.

### Desplegar en Cloudflare Pages (recomendado)

1. En el [dashboard de Cloudflare](https://dash.cloudflare.com) → **Workers & Pages → Create → Pages
   → Connect to Git**, elige este repositorio (`tonninors/aws_practi`).
2. Configuración de build: **déjala vacía** (no hay build; el sitio es HTML plano). "Build output
   directory" → `/` (raíz del repo).
3. Deploy. Cloudflare te da una URL gratis tipo `aws-practi.pages.dev` — la raíz (`/`) sirve
   `index.html` (selector de examen) automáticamente, y cada `guia-<examen>.html` queda disponible
   también sin la extensión (ej. `/guia-ai-practitioner`); el archivo [`_redirects`](_redirects)
   solo lo deja explícito como red de seguridad.
4. (Opcional) **Dominio propio**: compra un dominio en *Cloudflare → Registrar* (lo vende al costo,
   sin margen) y en el proyecto de Pages ve a **Custom domains → Set up a domain** — al estar en la
   misma cuenta, Cloudflare configura el DNS automáticamente.
5. Actualiza en Supabase (*Authentication → URL Configuration*) la **Site URL** y **Redirect URLs**
   con la URL final (`https://aws-practi.pages.dev` y/o tu dominio propio).
6. Si vas a verificar un dominio en **Resend** para que el login por correo funcione con cualquier
   destinatario, puede ser el mismo dominio o uno distinto al de Pages — son configuraciones
   independientes (ver *Domains → Add Domain* en Resend y pegar los registros DNS que pide).

## Sugerencia de estudio

1. Lee el **Repaso por dominio**, priorizando los dominios 2 y 3 (juntos son el 52 % del examen).
2. Repasa las **Flashcards**, la tabla de **Servicios AWS** y el **Comparador IA** — identificar el
   servicio correcto según el caso de uso es de los temas más rentables del examen.
3. Resuelve el **Banco de preguntas** completo (usa el **repaso adaptativo** en la segunda pasada),
   los **Casos de estudio** y termina con 1–2 **Simulacros**. Revisa **Mi progreso** para detectar
   dominios débiles antes del examen.

## Aviso

Material de estudio **no oficial**, creado como complemento de repaso. No está afiliado a
Amazon Web Services ni respaldado por AWS. La guía de examen oficial incluida en este
repositorio es propiedad de Amazon Web Services, Inc. y se rige por sus propios términos de uso.
Consulta siempre la [página oficial de la certificación](https://aws.amazon.com/certification/certified-ai-practitioner/)
para la información más actualizada.
