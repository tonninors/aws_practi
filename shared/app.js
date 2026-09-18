const SUPABASE_URL = "https://oevhsmdofoobgwebldeg.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_AYDqiQ5v5NWyfi7VPQdYbQ_QyzQ5Bbw";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { detectSessionInUrl: true, persistSession: true, autoRefreshToken: true }
});

/* ============================================================
   UTILIDADES: orden aleatorio estable de opciones y búsqueda
   ============================================================ */
function hashStr(s){
  let h=0; for(let i=0;i<s.length;i++){ h=(h*31+s.charCodeAt(i))>>>0; }
  return h;
}
function seededRand(seed){
  let s = seed % 2147483647; if(s<=0) s += 2147483646;
  return function(){ s = s*16807 % 2147483647; return (s-1)/2147483646; };
}
function ordenOpciones(q){
  const idx = q.opciones.map((_,i)=>i);
  const rnd = seededRand(hashStr(q.id));
  for(let i=idx.length-1;i>0;i--){
    const j = Math.floor(rnd()*(i+1));
    [idx[i],idx[j]] = [idx[j],idx[i]];
  }
  return idx;
}
function todasCasos(){ return CASOS.flatMap(c=>c.preguntas); }
function buscarPregunta(qid){
  return PREGUNTAS.find(x=>x.id===qid)
      || todasCasos().find(x=>x.id===qid)
      || PREGUNTAS_SERVICIOS.find(x=>x.id===qid);
}

/* ============================================================
   AUTENTICACIÓN (Supabase, login sin contraseña por correo)
   ============================================================ */
let usuarioActual = null;

/* La guía se usa sin cuenta por defecto (progreso en localStorage).
   Iniciar sesión es opcional y solo sirve para sincronizar entre dispositivos. */
function mostrarApp(session){
  usuarioActual = session.user.id;
  cerrarLogin();
  document.getElementById("userInfo").textContent = "· " + session.user.email;
  document.getElementById("loginHeaderBtn").style.display = "none";
  document.getElementById("logoutBtn").style.display = "";
  sincronizarProgreso(false);
}
function mostrarInvitado(){
  usuarioActual = null;
  document.getElementById("userInfo").textContent = "";
  document.getElementById("loginHeaderBtn").style.display = "";
  document.getElementById("logoutBtn").style.display = "none";
  marcarSync("local");
}
function abrirLogin(){
  document.getElementById("authOverlay").classList.add("open");
  document.getElementById("otpForm").style.display = "none";
  document.getElementById("loginForm").style.display = "";
  document.getElementById("loginError").textContent = "";
  document.getElementById("otpError").textContent = "";
  document.getElementById("authLead").textContent = "Ingresa tu correo para guardar tu progreso actual y continuar desde cualquier dispositivo.";
  document.getElementById("loginEmail").focus();
}
function cerrarLogin(){
  document.getElementById("authOverlay").classList.remove("open");
}
async function comprobarSesion(){
  const { data: { session } } = await supabaseClient.auth.getSession();
  if(session) mostrarApp(session); else mostrarInvitado();
}
supabaseClient.auth.onAuthStateChange((_event, session)=>{
  if(session) mostrarApp(session); else mostrarInvitado();
});

document.getElementById("authClose").addEventListener("click", cerrarLogin);
document.getElementById("authSkip").addEventListener("click", (e)=>{ e.preventDefault(); cerrarLogin(); });
document.getElementById("authOverlay").addEventListener("click", (e)=>{
  if(e.target.id === "authOverlay") cerrarLogin(); // clic fuera de la tarjeta
});
document.addEventListener("keydown", (e)=>{
  if(e.key === "Escape") cerrarLogin();
});
async function cerrarSesion(){
  await supabaseClient.auth.signOut();
  // el progreso ya está en Supabase; se limpia la copia local para no mezclarla
  // con la cuenta de quien inicie sesión después en este mismo navegador
  try{ localStorage.removeItem(LS_KEY); }catch(e){}
  location.reload();
}

let emailPendiente = "";
let resendCooldownInt = null;
function iniciarCooldownReenvio(segundos){
  const link = document.getElementById("otpResend");
  clearInterval(resendCooldownInt);
  let restante = segundos;
  link.style.pointerEvents = "none";
  link.style.opacity = "0.5";
  link.textContent = `Reenviar código (${restante}s)`;
  resendCooldownInt = setInterval(()=>{
    restante--;
    if(restante<=0){
      clearInterval(resendCooldownInt);
      link.style.pointerEvents = "";
      link.style.opacity = "";
      link.textContent = "Reenviar código";
    } else {
      link.textContent = `Reenviar código (${restante}s)`;
    }
  }, 1000);
}

async function enviarCodigo(email){
  const err = document.getElementById("loginError");
  err.textContent = "";
  const { error } = await supabaseClient.auth.signInWithOtp({ email });
  if(error){ err.textContent = error.message; return false; }
  emailPendiente = email;
  document.getElementById("loginForm").style.display = "none";
  document.getElementById("otpForm").style.display = "";
  document.getElementById("authLead").textContent = `Escribe el código que enviamos a ${email} (revisa también la carpeta de spam).`;
  document.getElementById("otpCode").value = "";
  iniciarCooldownReenvio(60);
  return true;
}

document.getElementById("loginForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const btn = document.getElementById("loginBtn");
  const email = document.getElementById("loginEmail").value.trim();
  btn.disabled = true;
  btn.textContent = "Enviando…";
  await enviarCodigo(email);
  btn.disabled = false;
  btn.textContent = "Enviar código";
});

document.getElementById("otpForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const btn = document.getElementById("otpBtn");
  const token = document.getElementById("otpCode").value.trim();
  const err = document.getElementById("otpError");
  err.textContent = "";
  btn.disabled = true;
  btn.textContent = "Verificando…";
  const { error } = await supabaseClient.auth.verifyOtp({ email: emailPendiente, token, type: "email" });
  if(error){
    err.textContent = error.message;
    btn.disabled = false;
    btn.textContent = "Verificar código";
  }
  // si es correcto, onAuthStateChange se encarga de mostrar la app
});

document.getElementById("otpResend").addEventListener("click", async (e)=>{
  e.preventDefault();
  const link = e.currentTarget;
  if(link.style.pointerEvents === "none") return; // evita doble clic mientras se envía
  link.style.pointerEvents = "none";
  link.style.opacity = "0.5";
  await enviarCodigo(emailPendiente);
});

document.getElementById("otpBack").addEventListener("click", (e)=>{
  e.preventDefault();
  clearInterval(resendCooldownInt);
  document.getElementById("otpForm").style.display = "none";
  document.getElementById("loginForm").style.display = "";
  document.getElementById("authLead").textContent = "Ingresa tu correo para guardar tu progreso actual y continuar desde cualquier dispositivo.";
  document.getElementById("otpError").textContent = "";
});

/* ============================================================
   ESTADO Y PERSISTENCIA
   progreso[qid] = { intentos, correctas, ultima:timestamp, racha }
   ============================================================ */
const LS_KEY = `guia_progress_v1_${EXAM_META.id}`;
let progreso = cargarProgreso();
function cargarProgreso(){
  try{
    const raw = JSON.parse(localStorage.getItem(LS_KEY)) || {};
    const out = {};
    Object.keys(raw).forEach(k=>{
      const v = raw[k];
      if(typeof v === "string"){
        // formato antiguo (v1): "ok"|"no" -> migrar a objeto
        out[k] = { intentos:1, correctas: v==="ok"?1:0, ultima: Date.now(), racha: v==="ok"?1:0 };
      } else if(v && typeof v === "object"){
        out[k] = v;
      }
    });
    return out;
  }catch(e){ return {}; }
}
function guardarProgreso(){
  try{ localStorage.setItem(LS_KEY, JSON.stringify(progreso)); }catch(e){}
}
function registrar(qid, ok){
  const cur = progreso[qid] || {intentos:0, correctas:0, ultima:0, racha:0};
  cur.intentos++;
  if(ok){ cur.correctas++; cur.racha++; } else { cur.racha = 0; }
  cur.ultima = Date.now();
  progreso[qid] = cur;
  guardarProgreso();
  actualizarMiniProgreso();
  pushProgreso(); // sincroniza con el servidor en segundo plano (si está disponible)
}

/* ============================================================
   SINCRONIZACIÓN ENTRE DISPOSITIVOS (PC ↔ celular vía Supabase)
   Fuente de verdad: tabla "progreso" en Supabase. Se fusiona por
   pregunta usando el timestamp "ultima" más reciente, para no
   perder datos de ningún dispositivo.
   ============================================================ */
function mergeProgreso(local, remoto){
  const out = {...local};
  Object.keys(remoto||{}).forEach(qid=>{
    const r = remoto[qid], l = out[qid];
    if(!l || (r.ultima||0) > (l.ultima||0)) out[qid] = r;
  });
  return out;
}
function marcarSync(estado){
  const el = document.getElementById("syncStatus");
  if(!el) return;
  if(estado==="ok"){
    el.textContent = "· 🔄 Sincronizado";
    el.title = "Clic para sincronizar ahora";
  } else if(estado==="sync"){
    el.textContent = "· 🔄 Sincronizando…";
    el.title = "";
  } else if(estado==="local"){
    el.textContent = "";
    el.title = "Inicia sesión para sincronizar entre dispositivos";
  } else if(estado==="off"){
    el.textContent = "· ⚠️ Sin conexión (solo local)";
    el.title = "Clic para reintentar";
  }
}
async function pullProgreso(){
  if(!usuarioActual) return {};
  const { data, error } = await supabaseClient
    .from("progreso")
    .select("qid, intentos, correctas, ultima, racha")
    .eq("examen", EXAM_META.id);
  if(error) throw error;
  const remoto = {};
  (data||[]).forEach(row=>{
    remoto[row.qid] = { intentos: row.intentos, correctas: row.correctas, ultima: Number(row.ultima), racha: row.racha };
  });
  return remoto;
}
async function pushProgreso(){
  if(!usuarioActual){ marcarSync("local"); return; }
  try{
    const rows = Object.keys(progreso).map(qid => ({
      user_id: usuarioActual,
      examen: EXAM_META.id,
      qid,
      intentos: progreso[qid].intentos,
      correctas: progreso[qid].correctas,
      ultima: progreso[qid].ultima,
      racha: progreso[qid].racha
    }));
    if(rows.length){
      const { error } = await supabaseClient.from("progreso").upsert(rows, { onConflict: "user_id,examen,qid" });
      if(error) throw error;
    }
    marcarSync("ok");
  }catch(e){ marcarSync("off"); }
}
async function sincronizarProgreso(manual){
  marcarSync("sync");
  try{
    const remoto = await pullProgreso();
    progreso = mergeProgreso(progreso, remoto);
    guardarProgreso();
    await pushProgreso();
    actualizarMiniProgreso();
    // refresca la pestaña activa si muestra datos de progreso;
    // el banco de preguntas solo se redibuja en sync manual para no perder
    // respuestas a medio llenar (ej. preguntas de "emparejar" u "ordenar")
    const activo = document.querySelector("nav.tabs button.active");
    const tab = activo && activo.dataset.tab;
    if(tab==="inicio") renderInicio();
    if(tab==="progreso") renderProgreso();
    if(tab==="preguntas" && manual) renderPreguntas();
    marcarSync("ok");
  }catch(e){
    marcarSync("off");
  }
}
function statsProgreso(){
  const total = PREGUNTAS.length;
  const ids = PREGUNTAS.map(q=>q.id);
  const respondidas = ids.filter(id=>progreso[id] && progreso[id].intentos>0).length;
  const correctas = ids.filter(id=>progreso[id] && progreso[id].racha>0).length;
  return {total, respondidas, correctas, pct: total? Math.round(respondidas/total*100):0};
}
function statsPorDominio(){
  return DOMINIOS.map(d=>{
    const qs = PREGUNTAS.filter(q=>q.dominio===d.id);
    const respondidas = qs.filter(q=>progreso[q.id] && progreso[q.id].intentos>0);
    const correctas = qs.filter(q=>progreso[q.id] && progreso[q.id].racha>0);
    const pct = respondidas.length ? Math.round(correctas.length/respondidas.length*100) : 0;
    return {dominio:d, total:qs.length, respondidas:respondidas.length, correctas:correctas.length, pct};
  });
}
function actualizarMiniProgreso(){
  const s = statsProgreso();
  const el = document.getElementById("miniProgress");
  if(el) el.textContent = `Avance: ${s.pct}% · ${s.correctas}/${s.total} correctas`;
  const ini = document.getElementById("panel-inicio");
  if(ini && ini.classList.contains("active")) renderInicio();
}

/* ============================================================
   ALTURA DEL HEADER (para que las barras "sticky" no queden tapadas)
   ============================================================ */
function ajustarHeaderHeight(){
  const header = document.querySelector("header.top");
  if(header) document.documentElement.style.setProperty("--header-h", header.offsetHeight + "px");
}
new ResizeObserver(ajustarHeaderHeight).observe(document.querySelector("header.top"));

/* ============================================================
   NAVEGACIÓN
   ============================================================ */
const tabs = document.getElementById("tabs");
tabs.addEventListener("click", e=>{
  const b = e.target.closest("button[data-tab]");
  if(!b) return;
  activarTab(b.dataset.tab);
});

function actualizarFadesTabs(){
  const wrap = document.getElementById("tabsWrap");
  if(!wrap) return;
  const holgura = 2; // margen para evitar parpadeos por redondeo
  wrap.classList.toggle("can-scroll-left", tabs.scrollLeft > holgura);
  wrap.classList.toggle("can-scroll-right", tabs.scrollLeft + tabs.clientWidth < tabs.scrollWidth - holgura);
}
tabs.addEventListener("scroll", actualizarFadesTabs);
window.addEventListener("resize", actualizarFadesTabs);
new ResizeObserver(actualizarFadesTabs).observe(tabs);
function activarTab(tab){
  document.querySelectorAll("nav.tabs button").forEach(x=>x.classList.toggle("active", x.dataset.tab===tab));
  document.querySelectorAll(".panel").forEach(p=>p.classList.remove("active"));
  const panel = document.getElementById("panel-"+tab);
  panel.classList.add("active");
  window.scrollTo({top:0,behavior:"smooth"});
  if(tab==="inicio") renderInicio();
  if(tab==="repaso") renderRepaso();
  if(tab==="preguntas") renderPreguntas();
  if(tab==="casos") renderCasos();
  if(tab==="flashcards") renderFlashcards();
  if(tab==="glosario") renderGlosario();
  if(tab==="servicios") renderServicios();
  if(tab==="comparador") renderComparador();
  if(tab==="simulacro") renderSimulacroInicio();
  if(tab==="progreso") renderProgreso();
}

/* ============================================================
   INICIO
   ============================================================ */
function renderInicio(){
  const s = statsProgreso();
  const el = document.getElementById("panel-inicio");
  el.innerHTML = `
    <h2 class="section">Tu examen ${EXAM_META.nombreCompleto}</h2>
    <p class="lead">Guía de repaso interactiva en español basada en la guía de examen oficial. Estudia las notas por dominio, practica con el banco de preguntas y ponte a prueba con el simulacro cronometrado.</p>
    <div class="intro-choice">
      <div class="card intro-option practice">
        <h3>📚 Banco de práctica</h3>
        <p class="note">${PREGUNTAS.length} preguntas para repasar a tu ritmo, con retroalimentación inmediata y filtro por dominio. Ideal para aprender antes de medirte.</p>
        <button class="btn" onclick="activarTab('preguntas')">Practicar preguntas</button>
      </div>
      <div class="card intro-option exam">
        <h3>⏱️ Dar el simulacro</h3>
        <p class="note">${Math.min(capSimulacro(), poolSimulacro().length)} preguntas cronometradas y sin retroalimentación hasta el final, igual que el examen real.</p>
        <button class="btn blue" onclick="activarTab('simulacro')">Iniciar simulacro</button>
      </div>
    </div>
    <div class="stat-row">
      <div class="stat"><b>50</b><span>preguntas puntuadas (+15 sin puntaje)</span></div>
      <div class="stat"><b>700</b><span>puntaje mínimo (escala 100–1000)</span></div>
      <div class="stat"><b>~90</b><span>minutos de duración aprox.</span></div>
      <div class="stat"><b>${PREGUNTAS.length}</b><span>preguntas de práctica aquí</span></div>
    </div>
    <div class="card" style="margin-top:16px">
      <div class="progress-wrap">
        <div class="ring" style="--p:${s.pct}"><div><b>${s.pct}%</b><small>completado</small></div></div>
        <div style="flex:1;min-width:200px">
          <h3 style="margin:0 0 6px;color:var(--ink)">Tu progreso</h3>
          <p class="note" style="margin:0 0 8px">Respondidas: <b>${s.respondidas}/${s.total}</b> · Correctas: <b style="color:var(--green)">${s.correctas}</b></p>
          <button class="btn ghost" onclick="reiniciarProgreso()">Reiniciar progreso</button>
        </div>
      </div>
    </div>
    <div class="card">
      <h3 style="margin:0 0 6px;color:var(--ink)">Ponderación de los dominios</h3>
      <p class="note" style="margin:0 0 6px">El modelo de puntaje es compensatorio: solo necesitas aprobar el examen general, no cada dominio.</p>
      <table class="weights">
        <thead><tr><th>Dominio</th><th style="width:150px">Peso</th><th style="width:70px">Preguntas aquí</th></tr></thead>
        <tbody>
          ${(()=>{ const pesoMax = Math.max(...DOMINIOS.map(d=>d.peso)); return DOMINIOS.map(d=>`<tr>
            <td><b>${d.id}.</b> ${d.titulo}</td>
            <td><div style="display:flex;align-items:center;gap:8px"><div class="bar"><i style="width:${d.peso*100/pesoMax}%"></i></div><b>${d.peso}%</b></div></td>
            <td>${PREGUNTAS.filter(q=>q.dominio===d.id).length}</td>
          </tr>`).join(""); })()}
        </tbody>
      </table>
    </div>
  `;
}
async function reiniciarProgreso(){
  if(confirm("¿Seguro que quieres borrar todo tu progreso guardado?")){
    progreso = {}; guardarProgreso(); actualizarMiniProgreso(); renderInicio();
    if(usuarioActual){
      try{ await supabaseClient.from("progreso").delete().eq("user_id", usuarioActual).eq("examen", EXAM_META.id); }catch(e){}
    }
  }
}

/* ============================================================
   REPASO POR DOMINIO
   ============================================================ */
function renderRepaso(){
  const el = document.getElementById("panel-repaso");
  el.innerHTML = `
    <h2 class="section">Repaso por dominio</h2>
    <p class="lead">Notas de estudio concisas por cada enunciado de tarea de la guía oficial. Haz clic para expandir cada tema.</p>
    ${DOMINIOS.map(d=>`
      <div class="domain-head">
        <span class="pill">Dominio ${d.id}</span>
        <h3>${d.titulo}</h3>
        <span class="w">${d.peso}% del examen</span>
      </div>
      ${d.tareas.map(t=>`
        <div class="acc">
          <button onclick="this.parentElement.classList.toggle('open')">
            <span class="tno">${t.id}</span> ${t.titulo}
            <span class="chev">▼</span>
          </button>
          <div class="body">
            <ul>${t.puntos.map(p=>`<li>${p}</li>`).join("")}</ul>
            ${t.servicios && t.servicios.length ? `<div class="tags">${t.servicios.map(s=>`<span class="tag">${s}</span>`).join("")}</div>`:""}
          </div>
        </div>
      `).join("")}
    `).join("")}
  `;
}

/* ============================================================
   BANCO DE PREGUNTAS
   ============================================================ */
let filtroDominio = "todos";
let modoAdaptativo = false;
function puntuarAdaptativo(q){
  const p = progreso[q.id];
  if(!p || !p.intentos) return 0;      // nunca respondida: máxima prioridad
  if(p.racha===0) return 1;            // fallada la última vez
  const dias = (Date.now()-p.ultima)/86400000;
  if(p.racha===1 && dias>1) return 2;  // acertada una vez, ya toca repasar
  if(p.racha>=2 && dias>7) return 3;   // dominada pero hace tiempo
  return 4;                             // dominada y reciente: baja prioridad
}
function ordenAdaptativo(lista){
  return [...lista].sort((a,b)=>puntuarAdaptativo(a)-puntuarAdaptativo(b));
}
function toggleAdaptativo(){ modoAdaptativo = !modoAdaptativo; renderPreguntas(); }
function iniciarRepasoAdaptativo(){ modoAdaptativo = true; activarTab("preguntas"); }
function renderPreguntas(){
  const el = document.getElementById("panel-preguntas");
  let lista = filtroDominio==="todos" ? PREGUNTAS : PREGUNTAS.filter(q=>q.dominio===filtroDominio);
  if(modoAdaptativo) lista = ordenAdaptativo(lista);
  el.innerHTML = `
    <h2 class="section">Banco de preguntas ${modoAdaptativo?'· <span style="color:var(--orange-d)">repaso adaptativo</span>':''}</h2>
    <p class="lead">Responde y pulsa “Comprobar” para ver la retroalimentación y la explicación. Tu progreso se guarda automáticamente.</p>
    <div class="filters">
      <span class="chip ${filtroDominio==='todos'?'active':''}" role="button" tabindex="0" onclick="setFiltro('todos')" onkeydown="chipKey(event,this)">Todos (${PREGUNTAS.length})</span>
      ${DOMINIOS.map(d=>`<span class="chip ${filtroDominio===d.id?'active':''}" role="button" tabindex="0" onclick="setFiltro('${d.id}')" onkeydown="chipKey(event,this)">D${d.id} (${PREGUNTAS.filter(q=>q.dominio===d.id).length})</span>`).join("")}
      <span class="chip ${modoAdaptativo?'active':''}" style="margin-left:auto" role="button" tabindex="0" onclick="toggleAdaptativo()" onkeydown="chipKey(event,this)">${modoAdaptativo?'✕ Salir del repaso adaptativo':'🎯 Repaso adaptativo'}</span>
    </div>
    <div id="qlist">${lista.map(q=>tarjetaPregunta(q)).join("")}</div>
  `;
  lista.forEach(q=>{ if(progreso[q.id]) repintarResuelta(q.id); });
}
function setFiltro(d){ filtroDominio=d; renderPreguntas(); }
function tipoLabel(t){
  return t==="multi" ? "Respuesta múltiple" : t==="ordering" ? "Ordenar pasos" : t==="matching" ? "Emparejar" : "Opción múltiple";
}
function tarjetaPregunta(q){
  const multi = q.tipo==="multi";
  if(q.tipo==="ordering"){
    const idx = ordenOpciones({id:q.id, opciones:q.pasos});
    return `<div class="q" id="q-${q.id}" data-tipo="ordering">
      <div class="meta">
        <span class="d">Dominio ${q.dominio} · ${q.tarea}</span>
        <span class="ty">${tipoLabel(q.tipo)}</span>
        <span class="st" id="st-${q.id}" style="display:none"></span>
      </div>
      <div class="stem">${q.stem}</div>
      <p class="note" style="margin:0 0 10px">Asigna a cada paso su posición correcta (1 = primero).</p>
      <div class="opts" id="opts-${q.id}">
        ${idx.map(i=>`<div class="dd-row" data-i="${i}">
          <span>${q.pasos[i]}</span>
          <select onchange="setOrden('${q.id}',${i},this.value)">
            <option value="">Posición…</option>
            ${q.pasos.map((_,p)=>`<option value="${p}">${p+1}</option>`).join("")}
          </select>
        </div>`).join("")}
      </div>
      <div class="actions">
        <button class="btn" id="chk-${q.id}" onclick="comprobar('${q.id}')">Comprobar</button>
        <button class="btn ghost" onclick="reiniciarPregunta('${q.id}')">Reintentar</button>
      </div>
      <div class="explain" id="ex-${q.id}"><b>Explicación:</b> </div>
    </div>`;
  }
  if(q.tipo==="matching"){
    return `<div class="q" id="q-${q.id}" data-tipo="matching">
      <div class="meta">
        <span class="d">Dominio ${q.dominio} · ${q.tarea}</span>
        <span class="ty">${tipoLabel(q.tipo)}</span>
        <span class="st" id="st-${q.id}" style="display:none"></span>
      </div>
      <div class="stem">${q.stem}</div>
      <p class="note" style="margin:0 0 10px">Empareja cada elemento con la opción correcta.</p>
      <div class="opts" id="opts-${q.id}">
        ${q.prompts.map((p,pi)=>`<div class="dd-row" data-i="${pi}">
          <span>${p}</span>
          <select onchange="setMatch('${q.id}',${pi},this.value)">
            <option value="">Selecciona…</option>
            ${q.opciones.map((o,oi)=>`<option value="${oi}">${o}</option>`).join("")}
          </select>
        </div>`).join("")}
      </div>
      <div class="actions">
        <button class="btn" id="chk-${q.id}" onclick="comprobar('${q.id}')">Comprobar</button>
        <button class="btn ghost" onclick="reiniciarPregunta('${q.id}')">Reintentar</button>
      </div>
      <div class="explain" id="ex-${q.id}"><b>Explicación:</b> </div>
    </div>`;
  }
  return `<div class="q" id="q-${q.id}" data-tipo="${q.tipo}">
    <div class="meta">
      <span class="d">Dominio ${q.dominio} · ${q.tarea}</span>
      <span class="ty">${tipoLabel(q.tipo)}</span>
      <span class="st" id="st-${q.id}" style="display:none"></span>
    </div>
    <div class="stem">${q.stem}</div>
    <div class="opts" id="opts-${q.id}">
      ${ordenOpciones(q).map(i=>`
        <div class="opt ${multi?'':'radio'}" data-i="${i}" role="${multi?'checkbox':'radio'}" tabindex="0" onclick="toggleOpt('${q.id}',${i},${multi})" onkeydown="chipKey(event,this)">
          <span class="box"></span><span>${q.opciones[i]}</span>
        </div>`).join("")}
    </div>
    <div class="actions">
      <button class="btn" id="chk-${q.id}" onclick="comprobar('${q.id}')">Comprobar</button>
      <button class="btn ghost" onclick="reiniciarPregunta('${q.id}')">Reintentar</button>
    </div>
    <div class="explain" id="ex-${q.id}"><b>Explicación:</b> </div>
  </div>`;
}
function chipKey(event, el){
  if(event.key==="Enter" || event.key===" "){
    event.preventDefault();
    el.click();
  }
}
const seleccion = {}; // qid -> Set(idx) para single/multi, u objeto {posición/prompt: valor} para ordering/matching
function toggleOpt(qid, i, multi){
  const cont = document.getElementById("q-"+qid);
  if(cont.classList.contains("resuelta")) return;
  if(!seleccion[qid]) seleccion[qid]=new Set();
  const set = seleccion[qid];
  if(multi){
    set.has(i)?set.delete(i):set.add(i);
  }else{
    set.clear(); set.add(i);
  }
  cont.querySelectorAll(".opt").forEach(op=>{
    op.classList.toggle("sel", set.has(+op.dataset.i));
  });
}
function setOrden(qid, itemIdx, val){
  if(!seleccion[qid]) seleccion[qid] = {};
  seleccion[qid][itemIdx] = val==="" ? null : parseInt(val,10);
}
function setMatch(qid, promptIdx, val){
  if(!seleccion[qid]) seleccion[qid] = {};
  seleccion[qid][promptIdx] = val==="" ? null : parseInt(val,10);
}
function marcarResuelta(qid, ok, explain){
  const st = document.getElementById("st-"+qid);
  st.style.display="inline-block";
  st.className = "st "+(ok?"ok":"no");
  st.textContent = ok ? "Correcto" : "Incorrecto";
  const ex = document.getElementById("ex-"+qid);
  ex.innerHTML = "<b>Explicación:</b> "+explain;
  ex.classList.add("show");
  document.getElementById("chk-"+qid).disabled = true;
  registrar(qid, ok);
}
function comprobar(qid){
  const q = buscarPregunta(qid);
  const cont = document.getElementById("q-"+qid);
  if(q.tipo==="ordering"){
    const sel = seleccion[qid] || {};
    const completo = q.pasos.every((_,i)=> sel[i]!==null && sel[i]!==undefined);
    if(!completo){ alert("Asigna una posición a cada paso."); return; }
    cont.classList.add("resuelta");
    const ok = q.pasos.every((_,i)=> sel[i]===i);
    cont.querySelectorAll(".dd-row").forEach(row=>{
      const i = +row.dataset.i;
      row.querySelector("select").disabled = true;
      row.classList.add(sel[i]===i ? "correct" : "wrong");
    });
    marcarResuelta(qid, ok, q.explain);
    return;
  }
  if(q.tipo==="matching"){
    const sel = seleccion[qid] || {};
    const completo = q.prompts.every((_,i)=> sel[i]!==null && sel[i]!==undefined);
    if(!completo){ alert("Empareja todos los elementos."); return; }
    cont.classList.add("resuelta");
    const ok = q.prompts.every((_,i)=> sel[i]===q.correctas[i]);
    cont.querySelectorAll(".dd-row").forEach(row=>{
      const i = +row.dataset.i;
      row.querySelector("select").disabled = true;
      row.classList.add(sel[i]===q.correctas[i] ? "correct" : "wrong");
    });
    marcarResuelta(qid, ok, q.explain);
    return;
  }
  const set = seleccion[qid] || new Set();
  if(set.size===0){ alert("Selecciona al menos una opción."); return; }
  cont.classList.add("resuelta");
  const correctas = new Set(q.correctas);
  let ok = set.size===correctas.size && [...set].every(i=>correctas.has(i));
  cont.querySelectorAll(".opt").forEach(op=>{
    const i = +op.dataset.i;
    op.classList.add("locked");
    if(correctas.has(i)) op.classList.add("correct");
    else if(set.has(i)) op.classList.add("wrong");
    op.classList.remove("sel");
    const box = op.querySelector(".box");
    if(correctas.has(i)) box.textContent="✓";
    else if(set.has(i)) box.textContent="✗";
  });
  marcarResuelta(qid, ok, q.explain);
}
function reiniciarPregunta(qid){
  const cont = document.getElementById("q-"+qid);
  const tipo = cont.dataset.tipo;
  if(tipo==="ordering" || tipo==="matching"){
    seleccion[qid] = {};
    cont.classList.remove("resuelta");
    cont.querySelectorAll(".dd-row").forEach(row=>{
      row.className = "dd-row";
      const sel = row.querySelector("select");
      sel.disabled = false; sel.value = "";
    });
  }else{
    seleccion[qid]=new Set();
    cont.classList.remove("resuelta");
    cont.querySelectorAll(".opt").forEach(op=>{
      op.className = "opt "+(cont.dataset.tipo==="multi"?"":"radio");
      op.querySelector(".box").textContent="";
    });
  }
  document.getElementById("st-"+qid).style.display="none";
  document.getElementById("ex-"+qid).classList.remove("show");
  document.getElementById("chk-"+qid).disabled=false;
}
function repintarResuelta(qid){
  // Marca visualmente el estado guardado (correcto/incorrecto) sin las opciones concretas
  const st = document.getElementById("st-"+qid);
  const v = progreso[qid];
  if(!st || !v || !v.intentos) return;
  const ok = v.racha>0;
  st.style.display="inline-block";
  st.className="st "+(ok?"ok":"no");
  st.textContent = ok ? "Ya respondida ✓" : "Ya respondida ✗";
}

function estadoVacio(titulo, detalle){
  return `<div class="card empty-state">
    <h3 style="margin:0 0 6px;color:var(--ink)">${titulo}</h3>
    <p class="note" style="margin:0">${detalle}</p>
  </div>`;
}

/* ============================================================
   FLASHCARDS
   ============================================================ */
function renderFlashcards(){
  const el = document.getElementById("panel-flashcards");
  el.innerHTML = `
    <h2 class="section">Flashcards</h2>
    <p class="lead">Haz clic en una tarjeta para revelar la respuesta. Ideal para repaso rápido de conceptos y servicios.</p>
    ${FLASHCARDS.length===0 ? estadoVacio("Las flashcards de este examen están en preparación","Vuelve más adelante, o repasa mientras tanto en la pestaña Repaso por dominio.") : `
    <div class="fc-grid">
      ${FLASHCARDS.map((f,i)=>`
        <div class="fc" role="button" tabindex="0" aria-label="Tarjeta de repaso, pulsa para voltear" onclick="this.classList.toggle('flip')" onkeydown="chipKey(event,this)">
          <div class="fc-inner">
            <div class="fc-face fc-front">${f.frente}<small>Toca para ver</small></div>
            <div class="fc-face fc-back">${f.reverso}</div>
          </div>
        </div>`).join("")}
    </div>`}
  `;
}

/* ============================================================
   GLOSARIO
   ============================================================ */
function renderGlosario(){
  const el = document.getElementById("panel-glosario");
  el.innerHTML = `
    <h2 class="section">Glosario de términos clave</h2>
    <p class="lead">Los términos de mayor rendimiento para el examen, con su equivalente en inglés (útil si rindes en inglés).</p>
    ${GLOSARIO.length===0 ? estadoVacio("El glosario de este examen está en preparación","Vuelve más adelante, o repasa mientras tanto en la pestaña Repaso por dominio.") : `
    <div class="card"><dl class="glos">
      ${GLOSARIO.map(g=>`<dt>${g.t} <span class="en">· ${g.en}</span></dt><dd>${g.d}</dd>`).join("")}
    </dl></div>`}
  `;
}

/* ============================================================
   SERVICIOS AWS
   ============================================================ */
function renderServicios(){
  const el = document.getElementById("panel-servicios");
  el.innerHTML = `
    <h2 class="section">Servicios de AWS dentro del alcance</h2>
    <p class="lead">Saber “para qué sirve cada servicio” es de los temas más rentables del examen. Repásalos por categoría.</p>
    ${SERVICIOS.length===0 ? estadoVacio("La tabla de servicios de este examen está en preparación","Vuelve más adelante, o repasa mientras tanto en la pestaña Repaso por dominio, que ya incluye los servicios relevantes por tarea.") : `
    <div class="card" style="padding:0;overflow:hidden">
      <table class="svc">
        <tbody>
        ${SERVICIOS.map(cat=>`
          <tr class="cat-row"><td colspan="2">${cat.cat}</td></tr>
          ${cat.items.map(s=>`<tr><td class="name">${s.n}</td><td>${s.d}</td></tr>`).join("")}
        `).join("")}
        </tbody>
      </table>
    </div>`}
  `;
}

/* ============================================================
   SIMULACRO
   ============================================================ */
let sim = null;
function poolSimulacro(){
  return PREGUNTAS.filter(q=>q.dificultad!=="facil");
}
function capSimulacro(){
  return typeof SIMULACRO_N!=="undefined" ? SIMULACRO_N : 50;
}
function renderSimulacroInicio(){
  const el = document.getElementById("panel-simulacro");
  if(sim && sim.enCurso){ renderSimulacroPreguntas(); return; }
  const pool = poolSimulacro();
  const n = Math.min(capSimulacro(), pool.length);
  if(n===0){
    el.innerHTML = `
      <h2 class="section">Simulacro de examen</h2>
      <p class="lead">Un examen de práctica con preguntas seleccionadas al azar, cronómetro y puntaje escalado 100–1000 (aprobación ≥700), igual que el examen real.</p>
      <div class="card">
        <h3 style="margin:0 0 8px;color:var(--ink)">Aún no hay preguntas cargadas para este examen</h3>
        <p style="margin:0;color:var(--muted);font-size:14px">El banco de preguntas de este examen todavía está en preparación. Vuelve más adelante para hacer el simulacro.</p>
      </div>
    `;
    return;
  }
  el.innerHTML = `
    <h2 class="section">Simulacro de examen</h2>
    <p class="lead">Un examen de práctica con ${n} preguntas seleccionadas al azar, cronómetro y puntaje escalado 100–1000 (aprobación ≥700), igual que el examen real. No verás la retroalimentación hasta terminar.</p>
    <div class="card">
      <h3 style="margin:0 0 8px;color:var(--ink)">¿List@ para empezar?</h3>
      <ul style="margin:0 0 14px;color:var(--muted);font-size:14px">
        <li>${n} preguntas al azar de los ${DOMINIOS.length} dominios.</li>
        <li>Cronómetro de referencia (90 minutos).</li>
        <li>Al final: puntaje escalado, veredicto y desglose por dominio.</li>
      </ul>
      <button class="btn" onclick="iniciarSimulacro()">Iniciar simulacro</button>
    </div>
  `;
}
function iniciarSimulacro(){
  const pool = poolSimulacro();
  const n = Math.min(capSimulacro(), pool.length);
  const barajado = [...pool].sort(()=>Math.random()-0.5).slice(0,n);
  sim = { preguntas:barajado, respuestas:{}, enCurso:true, inicio:Date.now(), limite:90*60 };
  seleccion._sim = {};
  renderSimulacroPreguntas();
  iniciarTimer();
}
let timerInt = null;
function iniciarTimer(){
  clearInterval(timerInt);
  timerInt = setInterval(()=>{
    if(!sim || !sim.enCurso){ clearInterval(timerInt); return; }
    const trans = Math.floor((Date.now()-sim.inicio)/1000);
    const rest = sim.limite - trans;
    const t = document.getElementById("sim-timer");
    if(t){
      if(rest<=0){ t.textContent="00:00"; finalizarSimulacro(); return; }
      const m = String(Math.floor(rest/60)).padStart(2,"0");
      const s = String(rest%60).padStart(2,"0");
      t.textContent = `${m}:${s}`;
    }
  },1000);
}
function renderSimulacroPreguntas(){
  const el = document.getElementById("panel-simulacro");
  el.innerHTML = `
    <div class="sim-bar">
      <span class="timer" id="sim-timer">90:00</span>
      <span class="count">Respondidas: <b id="sim-count">0</b>/${sim.preguntas.length}</span>
      <button class="btn blue" style="margin-left:auto" onclick="finalizarSimulacro()">Terminar y ver resultado</button>
    </div>
    ${sim.preguntas.map((q,idx)=>{
      const multi = q.tipo==="multi";
      if(q.tipo==="ordering"){
        const idxOrd = ordenOpciones({id:q.id, opciones:q.pasos});
        return `<div class="q" id="sq-${q.id}">
          <div class="meta"><span class="d">Pregunta ${idx+1} · Dominio ${q.dominio}</span><span class="ty">${tipoLabel(q.tipo)}</span></div>
          <div class="stem">${q.stem}</div>
          <p class="note" style="margin:0 0 10px">Asigna a cada paso su posición correcta (1 = primero).</p>
          <div class="opts">
            ${idxOrd.map(i=>`<div class="dd-row" data-i="${i}">
              <span>${q.pasos[i]}</span>
              <select onchange="simOrden('${q.id}',${i},this.value)">
                <option value="">Posición…</option>
                ${q.pasos.map((_,p)=>`<option value="${p}">${p+1}</option>`).join("")}
              </select>
            </div>`).join("")}
          </div>
        </div>`;
      }
      if(q.tipo==="matching"){
        return `<div class="q" id="sq-${q.id}">
          <div class="meta"><span class="d">Pregunta ${idx+1} · Dominio ${q.dominio}</span><span class="ty">${tipoLabel(q.tipo)}</span></div>
          <div class="stem">${q.stem}</div>
          <p class="note" style="margin:0 0 10px">Empareja cada elemento con la opción correcta.</p>
          <div class="opts">
            ${q.prompts.map((p,pi)=>`<div class="dd-row" data-i="${pi}">
              <span>${p}</span>
              <select onchange="simMatch('${q.id}',${pi},this.value)">
                <option value="">Selecciona…</option>
                ${q.opciones.map((o,oi)=>`<option value="${oi}">${o}</option>`).join("")}
              </select>
            </div>`).join("")}
          </div>
        </div>`;
      }
      return `<div class="q" id="sq-${q.id}">
        <div class="meta"><span class="d">Pregunta ${idx+1} · Dominio ${q.dominio}</span><span class="ty">${tipoLabel(q.tipo)}</span></div>
        <div class="stem">${q.stem}</div>
        <div class="opts">
          ${ordenOpciones(q).map(i=>`<div class="opt ${multi?'':'radio'}" data-i="${i}" role="${multi?'checkbox':'radio'}" tabindex="0" onclick="simSel('${q.id}',${i},${multi})" onkeydown="chipKey(event,this)"><span class="box"></span><span>${q.opciones[i]}</span></div>`).join("")}
        </div>
      </div>`;
    }).join("")}
    <div style="text-align:center;margin-top:8px">
      <button class="btn blue" onclick="finalizarSimulacro()">Terminar y ver resultado</button>
    </div>
  `;
}
function simSel(qid,i,multi){
  if(!sim.respuestas[qid]) sim.respuestas[qid]=new Set();
  const set = sim.respuestas[qid];
  if(multi){ set.has(i)?set.delete(i):set.add(i); } else { set.clear(); set.add(i); }
  if(set.size===0) delete sim.respuestas[qid];
  const cont = document.getElementById("sq-"+qid);
  cont.querySelectorAll(".opt").forEach(op=>op.classList.toggle("sel", set.has(+op.dataset.i)));
  document.getElementById("sim-count").textContent = Object.keys(sim.respuestas).length;
}
function simOrden(qid, itemIdx, val){
  if(!sim.respuestas[qid]) sim.respuestas[qid] = {};
  sim.respuestas[qid][itemIdx] = val===""? null : parseInt(val,10);
  document.getElementById("sim-count").textContent = Object.keys(sim.respuestas).length;
}
function simMatch(qid, promptIdx, val){
  if(!sim.respuestas[qid]) sim.respuestas[qid] = {};
  sim.respuestas[qid][promptIdx] = val===""? null : parseInt(val,10);
  document.getElementById("sim-count").textContent = Object.keys(sim.respuestas).length;
}
function simEsCorrecta(q){
  const resp = sim.respuestas[q.id];
  if(q.tipo==="ordering"){
    if(!resp) return false;
    return q.pasos.every((_,i)=> resp[i]===i);
  }
  if(q.tipo==="matching"){
    if(!resp) return false;
    return q.prompts.every((_,i)=> resp[i]===q.correctas[i]);
  }
  const set = resp || new Set();
  const cor = new Set(q.correctas);
  return set.size===cor.size && [...set].every(i=>cor.has(i));
}
function finalizarSimulacro(){
  if(!sim || !sim.enCurso) return;
  if(Object.keys(sim.respuestas).length < sim.preguntas.length){
    if(!confirm("Aún tienes preguntas sin responder (contarán como incorrectas). ¿Terminar de todos modos?")) return;
  }
  sim.enCurso=false; clearInterval(timerInt);
  let correctas=0; const porDom={};
  DOMINIOS.forEach(d=>porDom[d.id]={ok:0,total:0});
  sim.preguntas.forEach(q=>{
    porDom[q.dominio].total++;
    const ok = simEsCorrecta(q);
    if(ok){ correctas++; porDom[q.dominio].ok++; }
    if(sim.respuestas[q.id]!==undefined) registrar(q.id, ok);
  });
  const total = sim.preguntas.length;
  const ratio = correctas/total;
  const escala = Math.round(100 + ratio*900); // 100–1000
  const aprob = escala>=700;
  const trans = Math.floor((Date.now()-sim.inicio)/1000);
  const mm = String(Math.floor(trans/60)).padStart(2,"0"), ss=String(trans%60).padStart(2,"0");
  const el = document.getElementById("panel-simulacro");
  el.innerHTML = `
    <h2 class="section">Resultado del simulacro</h2>
    <div class="card" style="text-align:center">
      <div class="result-score ${aprob?'pass':'fail'}">${escala}</div>
      <div class="verdict ${aprob?'pass':'fail'}">${aprob?'APROBADO ✓':'REPROBADO ✗'}</div>
      <p class="note">Acertaste <b>${correctas}</b> de <b>${total}</b> (${Math.round(ratio*100)}%). Puntaje mínimo para aprobar: 700. Tiempo: ${mm}:${ss}.</p>
      <div class="dom-break">
        ${DOMINIOS.map(d=>{
          const p=porDom[d.id]; const pc = p.total? Math.round(p.ok/p.total*100):0;
          return `<div class="row"><div>D${d.id} · ${d.titulo}</div><div><div class="bar" style="width:120px;display:inline-block;vertical-align:middle"><i style="width:${pc}%"></i></div> <b>${p.ok}/${p.total}</b></div></div>`;
        }).join("")}
      </div>
      <div style="margin-top:18px">
        <button class="btn" onclick="iniciarSimulacro()">Repetir simulacro</button>
        <button class="btn ghost" onclick="renderSimulacroInicio()">Volver</button>
      </div>
    </div>
    ${aprob?'<div class="callout">🎉 ¡Buen trabajo! Repasa igualmente las preguntas que fallaste en el Banco de preguntas.</div>':'<div class="callout">📚 Sigue repasando los dominios con menor puntaje y vuelve a intentarlo. ¡Tú puedes!</div>'}
  `;
  window.scrollTo({top:0,behavior:"smooth"});
}

/* ============================================================
   CASOS DE ESTUDIO (render)
   ============================================================ */
function renderCasos(){
  const el = document.getElementById("panel-casos");
  el.innerHTML = `
    <h2 class="section">Casos de estudio</h2>
    <p class="lead">Escenarios extensos basados en casos de uso reales: lee todo el contexto antes de responder las preguntas ligadas a cada uno.</p>
    ${CASOS.length===0 ? estadoVacio("Los casos de estudio de este examen están en preparación","Vuelve más adelante, o practica mientras tanto en el Banco de preguntas.") : CASOS.map(c=>`
      <div class="card">
        <h3 style="margin:0 0 8px;color:var(--ink)">${c.titulo}</h3>
        <p style="font-size:14.5px;color:var(--text);margin:0">${c.contexto}</p>
      </div>
      ${c.preguntas.map(q=>tarjetaPregunta(q)).join("")}
    `).join("")}
  `;
  todasCasos().forEach(q=>{ if(progreso[q.id]) repintarResuelta(q.id); });
}

/* ============================================================
   MI PROGRESO
   ============================================================ */
function renderProgreso(){
  const el = document.getElementById("panel-progreso");
  const doms = statsPorDominio();
  const conRespuestas = doms.filter(d=>d.respondidas>0);
  const debiles = doms.filter(d=>d.respondidas>=3 && d.pct<70);
  el.innerHTML = `
    <h2 class="section">Mi progreso</h2>
    <p class="lead">Precisión por dominio calculada a partir de tus respuestas guardadas en este navegador. Úsalo para decidir qué repasar antes del examen.</p>
    <div class="card">
      <h3 style="margin:0 0 10px;color:var(--ink)">Precisión por dominio</h3>
      ${conRespuestas.length===0 ? '<p class="note">Aún no has respondido preguntas. Ve al Banco de preguntas o haz un Simulacro para empezar a registrar tu progreso.</p>' : `
      <div class="dom-break">
        ${doms.map(d=>`<div class="row">
          <div>D${d.dominio.id} · ${d.dominio.titulo} <span class="note">(${d.respondidas}/${d.total} respondidas)</span></div>
          <div><div class="bar" style="width:120px;display:inline-block;vertical-align:middle"><i style="width:${d.pct}%"></i></div> <b>${d.pct}%</b></div>
        </div>`).join("")}
      </div>`}
    </div>
    ${debiles.length ? `<div class="callout">⚠️ Dominios a reforzar (precisión &lt;70%): ${debiles.map(d=>`<b>D${d.dominio.id}</b>`).join(", ")}. <button class="btn ghost" style="margin-left:8px" onclick="setFiltro('${debiles[0].dominio.id}');activarTab('preguntas')">Ir a practicar</button></div>` : (conRespuestas.length ? `<div class="callout">✅ Vas bien en los dominios que has respondido. Sigue practicando los que te faltan.</div>` : "")}
    <div class="card">
      <h3 style="margin:0 0 8px;color:var(--ink)">Repaso adaptativo</h3>
      <p class="note" style="margin:0 0 10px">Genera un orden de preguntas priorizando lo que nunca respondiste o fallaste, en vez de repasar el banco completo por igual.</p>
      <button class="btn" onclick="iniciarRepasoAdaptativo()">Iniciar repaso adaptativo</button>
    </div>
  `;
}

/* ============================================================
   COMPARADOR DE SERVICIOS DE IA
   ============================================================ */
function renderComparador(){
  const el = document.getElementById("panel-comparador");
  el.innerHTML = `
    <h2 class="section">${EXAM_META.comparadorTitulo}</h2>
    <p class="lead">Los servicios que más se confunden entre sí, agrupados por familia, con cuándo usar cada uno y un ejemplo concreto.</p>
    ${CONFUSIBLES.length===0 ? estadoVacio("El comparador de este examen está en preparación","Vuelve más adelante, o repasa mientras tanto en la pestaña Repaso por dominio.") : CONFUSIBLES.map(g=>`
      <div class="card" style="padding:0;overflow:hidden">
        <h3 style="margin:0;padding:14px 18px 8px;color:var(--ink)">${g.titulo}</h3>
        <table class="svc">
          <thead><tr><th>Servicio</th><th>Cuándo usarlo</th><th>Ejemplo</th></tr></thead>
          <tbody>
          ${g.items.map(s=>`<tr><td class="name">${s.n}</td><td>${s.uso}</td><td>${s.ejemplo}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
    `).join("")}
    ${PREGUNTAS_SERVICIOS.length>0 ? `
    <h2 class="section" style="margin-top:26px">Ponte a prueba</h2>
    <p class="lead">Preguntas centradas solo en elegir el servicio correcto entre opciones que se confunden fácilmente.</p>
    <div id="cmplist">${PREGUNTAS_SERVICIOS.map(q=>tarjetaPregunta(q)).join("")}</div>` : ""}
  `;
  PREGUNTAS_SERVICIOS.forEach(q=>{ if(progreso[q.id]) repintarResuelta(q.id); });
}

/* ============================================================
   SELECTOR DE EXAMEN (header)
   ============================================================ */
const EXAMENES = [
  { id:"ai-practitioner", slug:"guia-ai-practitioner", nombre:"AI Practitioner" },
  { id:"cloud-practitioner", slug:"guia-cloud-practitioner", nombre:"Cloud Practitioner" }
];
function initExamChrome(){
  document.title = `Guía interactiva · ${EXAM_META.nombreCompleto}`;
  const logo = document.getElementById("examLogo");
  if(logo) logo.textContent = `AWS · ${EXAM_META.codigo}`;
  const titulo = document.getElementById("examTitulo");
  if(titulo) titulo.textContent = `Guía interactiva · ${EXAM_META.nombre}`;
  const tabComparador = document.querySelector('nav.tabs button[data-tab="comparador"]');
  if(tabComparador) tabComparador.textContent = EXAM_META.comparadorTabLabel || "Comparador";
  const footer = document.getElementById("appFooter");
  if(footer) footer.innerHTML = `Guía de estudio no oficial basada en la Guía de examen oficial ${EXAM_META.nombreCompleto}.
  Úsala como complemento de repaso. ¡Mucho éxito en tu examen! 🚀`;
  const switchWrap = document.getElementById("examSwitch");
  if(switchWrap && EXAMENES.length > 1){
    switchWrap.innerHTML = `
      <div class="exam-switch">
        <button class="btn ghost" id="examSwitchBtn" type="button">Cambiar examen ▾</button>
        <div class="exam-switch-menu" id="examSwitchMenu">
          ${EXAMENES.map(e=>{
            const activo = e.id === EXAM_META.id;
            return activo
              ? `<span class="current">${e.nombre} ✓</span>`
              : `<a href="/${e.slug}">${e.nombre}</a>`;
          }).join("")}
        </div>
      </div>`;
    const btn = document.getElementById("examSwitchBtn");
    const menu = document.getElementById("examSwitchMenu");
    btn.addEventListener("click", (e)=>{ e.stopPropagation(); menu.classList.toggle("open"); });
    document.addEventListener("click", (e)=>{ if(!switchWrap.contains(e.target)) menu.classList.remove("open"); });
    document.addEventListener("keydown", (e)=>{ if(e.key === "Escape") menu.classList.remove("open"); });
  }
}

/* ============================================================
   INIT
   ============================================================ */
initExamChrome();
renderInicio();
actualizarMiniProgreso();
actualizarFadesTabs();
comprobarSesion();
setInterval(()=>{ if(usuarioActual) sincronizarProgreso(); }, 20000);
