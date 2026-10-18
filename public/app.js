/* SOÑO · lógica de la web y del panel */
(function () {
  'use strict';

  /* ---------- Constantes ---------- */
  var CATEGORIAS = [
    { id: 'espresso', nombre: 'Barra de espresso', icono: 'taza' },
    { id: 'desayunos', nombre: 'Desayunos', icono: 'cruasan' },
    { id: 'filtro', nombre: 'Café de filtro', icono: 'filtro' }
  ];
  var NOMBRE_CAT = {};
  CATEGORIAS.forEach(function (c) { NOMBRE_CAT[c.id] = c.nombre; });
  var DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  var PIES_GALERIA = ['El local', 'La barra', 'Latte art', 'Desayunos', 'Buenos ratos'];
  var CLAVE_DE = { carta: 'carta', fotos: 'galeria', horarios: 'horario', datos: 'datos' };
  var RE_PRECIO = /^\d{1,3}([.,]\d{1,2})?$/;
  var RE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

  /* ---------- Estado ---------- */
  var estado = { carta: null, galeria: null, horario: null, datos: null };
  var cargado = false;
  var sinDatos = false;

  /* ---------- Utilidades ---------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined && txt !== null) e.textContent = txt;
    return e;
  }
  function svgUso(simbolo) {
    var ns = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 100 100');
    s.setAttribute('aria-hidden', 'true');
    var u = document.createElementNS(ns, 'use');
    u.setAttribute('href', '#i-' + simbolo);
    s.appendChild(u);
    return s;
  }
  function urlFoto(id) { return '/fotos/' + id; }
  function pendiente(t) { return el('span', 'pendiente', t || 'Por confirmar'); }
  function clonar(o) { return JSON.parse(JSON.stringify(o)); }
  function texto(v) { return typeof v === 'string' ? v.trim() : ''; }
  function dos(n) { return (n < 10 ? '0' : '') + n; }
  function precioBonito(p) {
    var t = texto(p).replace('.', ',');
    if (!t) return '';
    if (t.indexOf(',') === -1) t += ',00';
    else if (t.split(',')[1].length === 1) t += '0';
    return t + '\u00a0€';
  }
  function productos() {
    return (estado.carta && Array.isArray(estado.carta.productos)) ? estado.carta.productos : [];
  }

  /* Llamadas al servidor */
  function api(metodo, ruta, datos, opciones) {
    var cabeceras = { 'X-Requested-With': 'sono' };
    var cuerpo;
    if (opciones && opciones.binario) {
      cabeceras['Content-Type'] = datos.type || 'application/octet-stream';
      cuerpo = datos;
    } else if (datos !== undefined) {
      cabeceras['Content-Type'] = 'application/json';
      cuerpo = JSON.stringify(datos);
    }
    return fetch(ruta, { method: metodo, headers: cabeceras, body: cuerpo, credentials: 'same-origin' })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) {
            var e = new Error(j.error || 'No se ha podido completar. Inténtalo de nuevo.');
            e.status = r.status;
            throw e;
          }
          return j;
        });
      }, function () {
        var e = new Error('No hay conexión con el servidor. Revisa tu conexión e inténtalo de nuevo.');
        e.status = 0;
        throw e;
      });
  }

  function pintarTodo() {
    pintarCarta();
    pintarGaleria();
    pintarHorario();
    pintarDatos();
  }

  /* ---------- Ventanas emergentes ---------- */
  var raiz = document.documentElement;
  function abrir(dialogo) {
    document.querySelectorAll('dialog[open]').forEach(function (d) { if (d !== dialogo) d.close(); });
    if (!dialogo.open) {
      if (typeof dialogo.showModal === 'function') dialogo.showModal();
      else dialogo.setAttribute('open', '');
    }
    raiz.classList.add('modal-abierto');
  }
  function cerrar(dialogo) {
    if (typeof dialogo.close === 'function') dialogo.close();
    else dialogo.removeAttribute('open');
  }
  document.querySelectorAll('dialog').forEach(function (d) {
    d.addEventListener('close', function () {
      if (!document.querySelector('dialog[open]')) raiz.classList.remove('modal-abierto');
    });
    d.addEventListener('click', function (e) { if (e.target === d) cerrar(d); });
    d.querySelectorAll('[data-cerrar]').forEach(function (b) {
      b.addEventListener('click', function () { cerrar(d); });
    });
  });

  var modalReserva = $('modal-reserva');
  var modalProducto = $('modal-producto');
  var modalLogin = $('modal-login');
  var modalAdmin = $('modal-admin');

  document.querySelectorAll('[data-abrir-reserva]').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); abrir(modalReserva); });
  });

  /* ---------- Carta pública ---------- */
  function pintarCarta() {
    var lista = productos();
    document.querySelectorAll('.carta__lista').forEach(function (ul) {
      var cat = ul.getAttribute('data-categoria');
      ul.innerHTML = '';
      if (!cargado) { ul.appendChild(el('li', 'estado-vacio', 'Cargando la carta…')); return; }
      if (sinDatos) { ul.appendChild(el('li', 'estado-vacio', 'No se ha podido cargar la carta. Recarga la página en unos segundos.')); return; }
      var items = [];
      lista.forEach(function (p, i) { if (p.cat === cat) items.push(i); });
      if (!items.length) { ul.appendChild(el('li', 'estado-vacio', 'Pronto habrá productos en esta sección.')); return; }
      items.forEach(function (i) {
        var p = lista[i];
        var li = el('li');
        var b = el('button', 'producto-boton');
        b.type = 'button';
        b.setAttribute('aria-haspopup', 'dialog');
        b.setAttribute('aria-label', (p.nombre || 'Producto') + ', ' + precioBonito(p.precio) + '. Ver en grande');
        b.appendChild(el('span', 'plato', p.nombre || 'Producto'));
        var puntos = el('span', 'puntos'); puntos.setAttribute('aria-hidden', 'true'); b.appendChild(puntos);
        b.appendChild(el('span', 'precio', precioBonito(p.precio)));
        var mas = el('span', 'mas', '+'); mas.setAttribute('aria-hidden', 'true'); b.appendChild(mas);
        b.addEventListener('click', function () { mostrarProducto(i); abrir(modalProducto); });
        li.appendChild(b);
        ul.appendChild(li);
      });
    });
  }

  var actual = 0;
  var visual = $('producto-visual');
  var dibujo = $('producto-dibujo');
  var icono = $('producto-icono');
  var imgProducto = $('producto-img');
  imgProducto.addEventListener('error', function () {
    imgProducto.hidden = true;
    visual.classList.remove('con-foto');
  });
  function animarEntrada(nodo) {
    nodo.classList.remove('entra');
    void nodo.getBoundingClientRect();
    nodo.classList.add('entra');
  }
  function mostrarProducto(i) {
    var lista = productos();
    if (!lista.length) return;
    actual = (i + lista.length) % lista.length;
    var p = lista[actual];
    $('producto-categoria').textContent = NOMBRE_CAT[p.cat] || '';
    $('producto-nombre').textContent = p.nombre || 'Producto';
    $('producto-precio').textContent = precioBonito(p.precio);
    $('producto-desc').textContent = p.desc || '';
    $('producto-cuenta').textContent = (actual + 1) + ' de ' + lista.length;
    var ul = $('producto-etiquetas');
    ul.innerHTML = '';
    (Array.isArray(p.etiquetas) ? p.etiquetas : []).forEach(function (t) { ul.appendChild(el('li', null, t)); });
    icono.setAttribute('href', '#i-' + (p.icono || 'taza'));
    dibujo.setAttribute('aria-label', 'Ilustración: ' + (p.nombre || 'producto'));
    if (p.foto) {
      visual.classList.add('con-foto');
      imgProducto.hidden = false;
      imgProducto.src = urlFoto(p.foto);
      imgProducto.alt = p.nombre || '';
      animarEntrada(imgProducto);
    } else {
      visual.classList.remove('con-foto');
      imgProducto.hidden = true;
      imgProducto.removeAttribute('src');
      animarEntrada(dibujo);
    }
  }
  $('producto-anterior').addEventListener('click', function () { mostrarProducto(actual - 1); });
  $('producto-siguiente').addEventListener('click', function () { mostrarProducto(actual + 1); });
  modalProducto.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') mostrarProducto(actual - 1);
    if (e.key === 'ArrowRight') mostrarProducto(actual + 1);
  });

  /* ---------- Galería pública (solo aparece cuando hay fotos) ---------- */
  function pintarGaleria() {
    var ul = $('galeria-lista');
    ul.innerHTML = '';
    var fotos = (estado.galeria && Array.isArray(estado.galeria.fotos) ? estado.galeria.fotos : [])
      .filter(function (f) { return f && f.foto; });
    document.querySelectorAll('[data-galeria]').forEach(function (n) { n.hidden = !fotos.length; });
    fotos.forEach(function (f) {
      var li = el('li');
      var fig = el('figure', 'foto');
      var img = el('img');
      img.src = urlFoto(f.foto);
      img.alt = f.pie || 'Foto de SOÑO';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.addEventListener('error', function () { li.remove(); });
      fig.appendChild(img);
      if (f.pie) fig.appendChild(el('figcaption', 'pie-foto', f.pie));
      li.appendChild(fig);
      ul.appendChild(li);
    });
  }

  /* ---------- Horario y horas de reserva ---------- */
  function pintarHorario() {
    var h = estado.horario || {};
    var dd = $('dato-horario');
    dd.innerHTML = '';
    var dias = Array.isArray(h.dias) ? h.dias.filter(function (d) { return d && texto(d.texto); }) : [];
    if (!dias.length) dd.appendChild(pendiente());
    else {
      var ul = el('ul', 'horario-lista');
      dias.forEach(function (d) {
        var li = el('li');
        li.appendChild(el('span', null, d.dia));
        li.appendChild(el('span', null, texto(d.texto)));
        ul.appendChild(li);
      });
      dd.appendChild(ul);
    }
    var elegida = seleccion('hora');
    pintarHoras('horas-manana', h.manana, 'm');
    pintarHoras('horas-tarde', h.tarde, 't');
    if (elegida) {
      var misma = formReserva.querySelector('input[name="hora"][value="' + elegida + '"]');
      if (misma) misma.checked = true;
    }
    actualizarResumen();
  }
  function pintarHoras(idCont, horas, pre) {
    var cont = $(idCont);
    cont.innerHTML = '';
    var lista = Array.isArray(horas) ? horas.filter(function (t) { return RE_HORA.test(t); }) : [];
    if (!lista.length) {
      cont.appendChild(el('p', 'estado-vacio', cargado ? 'Sin horas disponibles.' : 'Cargando horas…'));
      return;
    }
    lista.forEach(function (t) {
      var id = 'hora-' + pre + '-' + t.replace(':', '');
      var input = el('input', 'oculto');
      input.type = 'radio'; input.name = 'hora'; input.id = id; input.value = t;
      var label = el('label', 'chip chip--hora', t);
      label.htmlFor = id;
      cont.appendChild(input);
      cont.appendChild(label);
    });
  }

  /* ---------- Datos de contacto ---------- */
  function ponerDato(id, valor) {
    var dd = $(id);
    dd.innerHTML = '';
    var v = texto(valor);
    if (v) dd.textContent = v; else dd.appendChild(pendiente());
  }
  function pintarDatos() {
    var d = estado.datos || {};
    ponerDato('dato-direccion', d.direccion);
    ponerDato('dato-email', d.email);
    ponerDato('dato-telefono', d.telefono);
    var ig = texto(d.instagram).replace(/^@/, '');
    document.querySelectorAll('.dato-instagram').forEach(function (n) {
      n.innerHTML = '';
      if (ig) {
        var a = el('a', null, '@' + ig);
        a.href = 'https://www.instagram.com/' + encodeURIComponent(ig) + '/';
        a.target = '_blank';
        a.rel = 'noopener';
        n.appendChild(document.createTextNode('Instagram: '));
        n.appendChild(a);
      } else {
        n.appendChild(pendiente('Instagram por confirmar'));
      }
    });
    $('pegatina').hidden = d.abrimosPronto === false;
  }

  /* ---------- Reservas ---------- */
  var formReserva = $('form-reserva');
  var diasEl = $('dias');
  var personasEl = $('personas');
  var menos = $('menos');
  var mas = $('mas');
  var resumen = $('resumen');
  var avisoReserva = $('aviso-reserva');
  var confirmacion = $('confirmacion');
  var detalle = $('confirmacion-detalle');
  var otra = $('otra-reserva');
  var botonReservar = formReserva.querySelector('button[type="submit"]');

  var MIN = 1, MAX = 8, personas = 2;
  var dias = [];
  var fechas = [];

  function sinPunto(s) { return s.replace('.', ''); }
  var fCorto = new Intl.DateTimeFormat('es-ES', { weekday: 'short' });
  var fMes = new Intl.DateTimeFormat('es-ES', { month: 'short' });
  var fLargo = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  var hoy = new Date();
  hoy.setHours(12, 0, 0, 0);
  for (var i = 0; i < 7; i++) {
    var d = new Date(hoy);
    d.setDate(hoy.getDate() + i);
    var arriba = i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : sinPunto(fCorto.format(d));
    var largo = fLargo.format(d).replace(',', '');
    dias.push(i === 0 ? 'hoy, ' + largo : i === 1 ? 'mañana, ' + largo : largo);
    fechas.push(d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()));

    var input = el('input', 'oculto');
    input.type = 'radio';
    input.name = 'dia';
    input.id = 'dia-' + i;
    input.value = String(i);
    if (i === 0) { input.defaultChecked = true; input.checked = true; }

    var label = el('label', 'chip chip--dia');
    label.htmlFor = input.id;
    label.appendChild(el('span', 'arriba', arriba));
    label.appendChild(el('span', 'numero', String(d.getDate())));
    label.appendChild(el('span', 'abajo', sinPunto(fMes.format(d))));

    diasEl.appendChild(input);
    diasEl.appendChild(label);
  }

  function seleccion(nombre) {
    var e = formReserva.querySelector('input[name="' + nombre + '"]:checked');
    return e ? e.value : null;
  }
  function textoPersonas(n) { return n === 1 ? '1 persona' : n + ' personas'; }

  function actualizarResumen() {
    personasEl.textContent = personas;
    menos.disabled = personas <= MIN;
    mas.disabled = personas >= MAX;
    var dia = seleccion('dia');
    var hora = seleccion('hora');
    var partes = ['Mesa para ' + personas];
    partes.push(dia !== null ? dias[+dia] : 'elige día');
    partes.push(hora ? 'a las ' + hora : 'elige hora');
    resumen.textContent = partes.join(' · ');
  }

  menos.addEventListener('click', function () { if (personas > MIN) { personas--; actualizarResumen(); } });
  mas.addEventListener('click', function () { if (personas < MAX) { personas++; actualizarResumen(); } });
  formReserva.addEventListener('change', function () { avisoReserva.textContent = ''; actualizarResumen(); });

  formReserva.addEventListener('submit', function (e) {
    e.preventDefault();
    var dia = seleccion('dia');
    var hora = seleccion('hora');
    var nombre = formReserva.nombre.value.trim();
    var telefono = formReserva.telefono.value.trim();
    if (dia === null) { avisoReserva.textContent = 'Elige un día para la reserva.'; return; }
    if (!hora) { avisoReserva.textContent = 'Elige una hora para la reserva.'; return; }
    if (!nombre) { avisoReserva.textContent = 'Escribe tu nombre para guardar la mesa.'; formReserva.nombre.focus(); return; }
    if (telefono.replace(/[^\d]/g, '').length < 9) { avisoReserva.textContent = 'Revisa el teléfono: necesitamos al menos 9 cifras para avisarte.'; formReserva.telefono.focus(); return; }

    botonReservar.disabled = true;
    avisoReserva.textContent = 'Enviando la reserva…';
    api('POST', '/api/reservas', {
      fecha: fechas[+dia],
      hora: hora,
      personas: personas,
      nombre: nombre,
      telefono: telefono,
      notas: formReserva.notas.value,
      web: formReserva.web.value
    }).then(function () {
      avisoReserva.textContent = '';
      detalle.textContent = 'Mesa para ' + textoPersonas(personas) + ', ' + dias[+dia] + ' a las ' + hora + ', a nombre de ' + nombre + '.';
      formReserva.hidden = true;
      confirmacion.hidden = false;
      modalReserva.scrollTop = 0;
    }).catch(function (err) {
      avisoReserva.textContent = err.message;
    }).then(function () {
      botonReservar.disabled = false;
    });
  });

  function reiniciarReserva() {
    formReserva.reset();
    personas = 2;
    avisoReserva.textContent = '';
    confirmacion.hidden = true;
    formReserva.hidden = false;
    actualizarResumen();
  }
  otra.addEventListener('click', reiniciarReserva);
  modalReserva.addEventListener('close', function () {
    if (!confirmacion.hidden) reiniciarReserva();
  });

  /* ---------- Formulario de contacto ---------- */
  var fc = $('formulario-contacto');
  var avisoContacto = $('aviso');
  var botonContacto = fc.querySelector('button[type="submit"]');
  fc.addEventListener('submit', function (e) {
    e.preventDefault();
    var n = fc.nombre.value.trim();
    var c = fc.correo.value.trim();
    var m = fc.mensaje.value.trim();
    if (!n || !c || !m) { avisoContacto.textContent = 'Rellena nombre, email y mensaje para continuar.'; return; }
    if (c.indexOf('@') < 1) { avisoContacto.textContent = 'Revisa el email: parece que le falta algo.'; return; }
    botonContacto.disabled = true;
    avisoContacto.textContent = 'Enviando…';
    api('POST', '/api/mensajes', { nombre: n, email: c, mensaje: m, web: fc.web.value }).then(function () {
      fc.reset();
      avisoContacto.textContent = 'Mensaje enviado. Te responderemos lo antes posible.';
    }).catch(function (err) {
      avisoContacto.textContent = err.message;
    }).then(function () {
      botonContacto.disabled = false;
    });
  });

  /* ---------- Acceso al panel ---------- */
  function abrirLogin(mensaje) {
    $('form-login').reset();
    $('aviso-login').textContent = mensaje || '';
    abrir(modalLogin);
    setTimeout(function () { $('login-usuario').focus(); }, 50);
  }

  $('logo').addEventListener('click', function () {
    api('GET', '/api/sesion').then(function (r) {
      if (r.admin) abrirPanel(); else abrirLogin();
    }).catch(function () { abrirLogin(); });
  });

  $('form-login').addEventListener('submit', function (e) {
    e.preventDefault();
    var boton = e.target.querySelector('button[type="submit"]');
    boton.disabled = true;
    $('aviso-login').textContent = '';
    api('POST', '/api/login', { usuario: $('login-usuario').value, clave: $('login-clave').value }).then(function () {
      cerrar(modalLogin);
      abrirPanel();
    }).catch(function (err) {
      $('aviso-login').textContent = err.message;
      $('login-clave').value = '';
      $('login-clave').focus();
    }).then(function () {
      boton.disabled = false;
    });
  });

  $('cerrar-sesion').addEventListener('click', function () {
    api('POST', '/api/logout').catch(function () {}).then(function () { cerrar(modalAdmin); });
  });

  /* ---------- Panel de administración ---------- */
  var pestana = 'carta';
  var borradores = {};
  var sucio = {};
  var guardando = false;
  var cuerpo = $('admin-cuerpo');
  var estadoPanel = $('admin-estado');
  var btnGuardar = $('admin-guardar');
  var btnDescartar = $('admin-descartar');

  function sesionCaducada(err) {
    if (err && err.status === 401) {
      cerrar(modalAdmin);
      abrirLogin('Tu sesión ha caducado. Vuelve a entrar; tus cambios sin guardar siguen en el panel.');
      return true;
    }
    return false;
  }

  function vacio(k) {
    if (k === 'carta') return { productos: [] };
    if (k === 'galeria') return { fotos: PIES_GALERIA.map(function (pie, i) { return { id: 'g' + (i + 1), pie: pie, foto: null }; }) };
    if (k === 'horario') return { dias: DIAS_SEMANA.map(function (dia) { return { dia: dia, texto: '' }; }), manana: [], tarde: [] };
    return { direccion: '', email: '', telefono: '', instagram: '', abrimosPronto: true };
  }
  function normalizar(k, b) {
    if (k === 'carta' && !Array.isArray(b.productos)) b.productos = [];
    if (k === 'galeria' && (!Array.isArray(b.fotos) || !b.fotos.length)) b.fotos = vacio('galeria').fotos;
    if (k === 'horario') {
      var porDia = {};
      (Array.isArray(b.dias) ? b.dias : []).forEach(function (d) { if (d && d.dia) porDia[d.dia] = d.texto || ''; });
      b.dias = DIAS_SEMANA.map(function (dia) { return { dia: dia, texto: porDia[dia] || '' }; });
      if (!Array.isArray(b.manana)) b.manana = [];
      if (!Array.isArray(b.tarde)) b.tarde = [];
    }
    if (k === 'datos' && b.abrimosPronto === undefined) b.abrimosPronto = true;
    return b;
  }
  function borrador(k) {
    if (!borradores[k] || !sucio[k]) borradores[k] = normalizar(k, clonar(estado[k] || vacio(k)));
    return borradores[k];
  }
  function claveActual() { return CLAVE_DE[pestana] || null; }
  function marcar() {
    var k = claveActual();
    if (!k) return;
    sucio[k] = true;
    btnDescartar.disabled = false;
    mostrarEstado('Hay cambios sin guardar.');
  }
  function mostrarEstado(t, esError) {
    estadoPanel.textContent = t || '';
    estadoPanel.classList.toggle('es-error', !!esError);
  }

  function abrirPanel() {
    abrir(modalAdmin);
    pintarPanel();
    actualizarContadores();
  }

  document.querySelectorAll('.pestana').forEach(function (t) {
    t.addEventListener('click', function () { cambiarPestana(t.getAttribute('data-pestana')); });
    t.addEventListener('keydown', function (e) {
      var tabs = Array.prototype.slice.call(document.querySelectorAll('.pestana'));
      var i = tabs.indexOf(t);
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        var sig = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
        sig.focus();
        cambiarPestana(sig.getAttribute('data-pestana'));
      }
    });
  });
  function cambiarPestana(nombre) {
    pestana = nombre;
    document.querySelectorAll('.pestana').forEach(function (t) {
      var activa = t.getAttribute('data-pestana') === nombre;
      t.setAttribute('aria-selected', activa ? 'true' : 'false');
      t.tabIndex = activa ? 0 : -1;
      if (activa) cuerpo.setAttribute('aria-labelledby', t.id);
    });
    pintarPanel();
    cuerpo.scrollTop = 0;
  }

  function pintarPanel() {
    var k = claveActual();
    cuerpo.innerHTML = '';
    btnGuardar.hidden = !k;
    btnDescartar.hidden = !k;
    if (k && !cargado) { cuerpo.appendChild(el('p', 'estado-vacio', 'Cargando…')); return; }
    if (pestana === 'carta') panelCarta();
    if (pestana === 'fotos') panelFotos();
    if (pestana === 'horarios') panelHorarios();
    if (pestana === 'datos') panelDatos();
    if (pestana === 'reservas') panelReservas();
    if (pestana === 'mensajes') panelMensajes();
    if (!guardando) mostrarEstado(k && sucio[k] ? 'Hay cambios sin guardar.' : '');
    btnDescartar.disabled = !(k && sucio[k]);
    btnGuardar.disabled = guardando;
  }

  /* Campos reutilizables del panel */
  function campoTexto(id, etiqueta, valor, alCambiar, extra) {
    var c = el('div', 'campo');
    var l = el('label', null, etiqueta); l.htmlFor = id;
    var i = el('input'); i.id = id; i.type = 'text'; i.value = valor || '';
    if (extra) Object.keys(extra).forEach(function (a) { i.setAttribute(a, extra[a]); });
    i.addEventListener('input', function () { alCambiar(i.value); marcar(); });
    c.appendChild(l); c.appendChild(i);
    return c;
  }
  function campoArea(id, etiqueta, valor, alCambiar) {
    var c = el('div', 'campo');
    var l = el('label', null, etiqueta); l.htmlFor = id;
    var t = el('textarea'); t.id = id; t.value = valor || ''; t.style.minHeight = '76px';
    t.addEventListener('input', function () { alCambiar(t.value); marcar(); });
    c.appendChild(l); c.appendChild(t);
    return c;
  }
  function botonMini(textoBoton, alPulsar, peligro) {
    var b = el('button', 'boton boton--borde boton--mini' + (peligro ? ' boton--peligro' : ''), textoBoton);
    b.type = 'button';
    b.addEventListener('click', alPulsar);
    return b;
  }
  function botonBorrar(textoBoton, alConfirmar) {
    var b = botonMini(textoBoton, function () {
      if (b.getAttribute('data-confirmar') === '1') { alConfirmar(); return; }
      b.setAttribute('data-confirmar', '1');
      b.textContent = '¿Seguro? Toca otra vez';
      setTimeout(function () {
        if (b.isConnected) { b.removeAttribute('data-confirmar'); b.textContent = textoBoton; }
      }, 4000);
    }, true);
    return b;
  }
  function botonFoto(id, textoBoton, alElegir) {
    var w = el('span');
    var i = el('input', 'oculto');
    i.type = 'file'; i.id = id; i.accept = 'image/jpeg,image/png,image/webp';
    var l = el('label', 'boton boton--borde boton--mini', textoBoton);
    l.htmlFor = id;
    i.addEventListener('change', function () {
      var f = i.files && i.files[0];
      i.value = '';
      if (f) alElegir(f);
    });
    w.appendChild(i); w.appendChild(l);
    return w;
  }

  /* Pestaña: carta y precios */
  function panelCarta() {
    var b = borrador('carta');
    cuerpo.appendChild(el('p', 'admin__ayuda', 'Cambia nombres, precios, descripciones y fotos. Los cambios se ven en la web en cuanto pulsas «Guardar cambios».'));
    CATEGORIAS.forEach(function (cat) {
      var grupo = el('section', 'admin__grupo');
      grupo.appendChild(el('h3', null, cat.nombre));
      var lista = el('div', 'admin__lista');
      var deCat = b.productos.filter(function (p) { return p.cat === cat.id; });
      if (!deCat.length) lista.appendChild(el('p', 'estado-vacio', 'Sin productos todavía.'));
      deCat.forEach(function (p) { lista.appendChild(tarjetaProducto(b, p)); });
      grupo.appendChild(lista);
      grupo.appendChild(botonMini('+ Añadir producto', function () {
        var nuevo = { id: 'p' + Date.now().toString(36), cat: cat.id, nombre: '', precio: '', desc: '', icono: cat.icono, etiquetas: [], foto: null };
        b.productos.push(nuevo);
        marcar();
        pintarPanel();
        var campo = $('adm-nombre-' + nuevo.id);
        if (campo) { campo.focus(); campo.scrollIntoView({ block: 'center' }); }
      }));
      cuerpo.appendChild(grupo);
    });
  }
  function tarjetaProducto(b, p) {
    var t = el('div', 'tarjeta-admin');
    var mini = el('div', 'tarjeta-admin__mini');
    if (p.foto) { var im = el('img'); im.src = urlFoto(p.foto); im.alt = ''; mini.appendChild(im); }
    else mini.appendChild(svgUso(p.icono || 'taza'));
    t.appendChild(mini);

    var campos = el('div', 'tarjeta-admin__campos');
    var fila = el('div', 'fila-2');
    fila.appendChild(campoTexto('adm-nombre-' + p.id, 'Nombre', p.nombre, function (v) { p.nombre = v; }));
    fila.appendChild(campoTexto('adm-precio-' + p.id, 'Precio (€)', p.precio, function (v) { p.precio = v; }, { inputmode: 'decimal', placeholder: '2,50' }));
    campos.appendChild(fila);
    campos.appendChild(campoArea('adm-desc-' + p.id, 'Descripción', p.desc, function (v) { p.desc = v; }));
    campos.appendChild(campoTexto('adm-etiq-' + p.id, 'Etiquetas (separadas por comas)', (p.etiquetas || []).join(', '), function (v) {
      p.etiquetas = v.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    }, { placeholder: 'Caliente, Con leche' }));

    var acc = el('div', 'acciones-mini');
    acc.appendChild(botonFoto('adm-foto-' + p.id, p.foto ? 'Cambiar foto' : 'Subir foto', function (f) {
      subirFoto(f, function (idFoto) { p.foto = idFoto; });
    }));
    if (p.foto) acc.appendChild(botonMini('Quitar foto', function () { p.foto = null; marcar(); pintarPanel(); }));
    acc.appendChild(botonBorrar('Eliminar producto', function () {
      b.productos = b.productos.filter(function (x) { return x !== p; });
      marcar();
      pintarPanel();
    }));
    campos.appendChild(acc);
    t.appendChild(campos);
    return t;
  }

  /* Pestaña: fotos de la galería */
  function panelFotos() {
    var b = borrador('galeria');
    cuerpo.appendChild(el('p', 'admin__ayuda', 'Sube una foto para cada hueco. La primera sale en grande. La galería aparece en la web en cuanto hay al menos una foto; los huecos sin foto no se muestran.'));
    var rejilla = el('div', 'admin__fotos');
    b.fotos.forEach(function (f, i) {
      var tarjeta = el('div', 'tarjeta-foto');
      var vista = el('div', 'tarjeta-foto__vista' + (f.foto ? ' con-foto' : ''));
      if (f.foto) { var im = el('img'); im.src = urlFoto(f.foto); im.alt = f.pie || ''; vista.appendChild(im); }
      else vista.appendChild(svgUso('camara'));
      tarjeta.appendChild(vista);
      tarjeta.appendChild(campoTexto('adm-pie-' + f.id, i === 0 ? 'Pie de foto (foto grande)' : 'Pie de foto', f.pie, function (v) { f.pie = v; }));
      var acc = el('div', 'acciones-mini');
      acc.appendChild(botonFoto('adm-galeria-' + f.id, f.foto ? 'Cambiar foto' : 'Subir foto', function (file) {
        subirFoto(file, function (idFoto) { f.foto = idFoto; });
      }));
      if (f.foto) acc.appendChild(botonMini('Quitar foto', function () { f.foto = null; marcar(); pintarPanel(); }));
      tarjeta.appendChild(acc);
      rejilla.appendChild(tarjeta);
    });
    cuerpo.appendChild(rejilla);
  }

  /* Pestaña: horarios */
  function panelHorarios() {
    var b = borrador('horario');
    var g1 = el('section', 'admin__grupo');
    g1.appendChild(el('h3', null, 'Horario de apertura'));
    g1.appendChild(el('p', 'admin__ayuda', 'Escribe el horario de cada día, por ejemplo «08:00 – 20:00» o «Cerrado». Los días vacíos no se muestran.'));
    var lista = el('div', 'admin__dias');
    b.dias.forEach(function (d) {
      var fila = el('div', 'admin__dia');
      var id = 'adm-dia-' + d.dia.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      var l = el('label', null, d.dia); l.htmlFor = id;
      var i = el('input'); i.id = id; i.type = 'text'; i.value = d.texto || ''; i.placeholder = '08:00 – 20:00';
      i.addEventListener('input', function () { d.texto = i.value; marcar(); });
      fila.appendChild(l); fila.appendChild(i);
      lista.appendChild(fila);
    });
    g1.appendChild(lista);
    cuerpo.appendChild(g1);

    var g2 = el('section', 'admin__grupo');
    g2.appendChild(el('h3', null, 'Horas para reservar mesa'));
    g2.appendChild(el('p', 'admin__ayuda', 'Escribe las horas separadas por comas, así: 08:30, 09:00, 09:30. Son las que aparecen al reservar.'));
    var campos = el('div', 'admin__campos');
    campos.appendChild(campoTexto('adm-manana', 'Mañana', b.manana.join(', '), function (v) { b.manana = partirHoras(v); }, { placeholder: '08:30, 09:00, 09:30' }));
    campos.appendChild(campoTexto('adm-tarde', 'Tarde', b.tarde.join(', '), function (v) { b.tarde = partirHoras(v); }, { placeholder: '16:30, 17:00, 17:30' }));
    g2.appendChild(campos);
    cuerpo.appendChild(g2);
  }
  function partirHoras(v) {
    return v.split(/[,;\s]+/).map(function (s) {
      s = s.trim().replace('.', ':').replace('h', '');
      if (/^\d:\d\d$/.test(s)) s = '0' + s;
      if (/^\d{1,2}$/.test(s)) s = (s.length === 1 ? '0' + s : s) + ':00';
      return s;
    }).filter(Boolean);
  }

  /* Pestaña: contacto */
  function panelDatos() {
    var b = borrador('datos');
    cuerpo.appendChild(el('p', 'admin__ayuda', 'Estos datos salen en la sección de contacto y en el pie de la web. Deja un campo vacío para que aparezca «Por confirmar».'));
    var campos = el('div', 'admin__campos');
    campos.appendChild(campoTexto('adm-direccion', 'Dirección', b.direccion, function (v) { b.direccion = v; }, { autocomplete: 'off' }));
    campos.appendChild(campoTexto('adm-email', 'Email', b.email, function (v) { b.email = v; }, { inputmode: 'email', autocomplete: 'off' }));
    campos.appendChild(campoTexto('adm-telefono', 'Teléfono', b.telefono, function (v) { b.telefono = v; }, { inputmode: 'tel', autocomplete: 'off' }));
    campos.appendChild(campoTexto('adm-instagram', 'Instagram', b.instagram, function (v) { b.instagram = v; }, { placeholder: 'usuario', autocomplete: 'off' }));

    var casilla = el('label', 'casilla');
    var check = el('input'); check.type = 'checkbox'; check.id = 'adm-abrimos'; check.checked = b.abrimosPronto !== false;
    check.addEventListener('change', function () { b.abrimosPronto = check.checked; marcar(); });
    casilla.appendChild(check);
    casilla.appendChild(document.createTextNode('Mostrar la pegatina «Abrimos pronto» en la portada'));
    campos.appendChild(casilla);
    cuerpo.appendChild(campos);
  }

  /* Pestaña: reservas recibidas */
  var fDiaLargo = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  var fRecibido = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  function fechaBonita(iso) {
    var t = fDiaLargo.format(new Date(iso + 'T12:00:00'));
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function panelReservas() {
    cuerpo.appendChild(el('p', 'admin__ayuda', 'Aquí llegan las reservas que se hacen desde la web. Borra las que ya estén atendidas o canceladas. Las de hace más de 90 días se borran solas.'));
    var cont = el('div', 'registros');
    cont.appendChild(el('p', 'estado-vacio', 'Cargando reservas…'));
    cuerpo.appendChild(cont);
    api('GET', '/api/reservas').then(function (r) {
      if (pestana !== 'reservas') return;
      cont.innerHTML = '';
      var proximas = r.reservas.filter(function (x) { return x.fecha >= r.hoy; });
      var pasadas = r.reservas.filter(function (x) { return x.fecha < r.hoy; }).reverse();
      ponerContador('reservas', proximas.length);
      if (!r.reservas.length) { cont.appendChild(el('p', 'estado-vacio', 'Todavía no hay reservas.')); return; }
      var g1 = el('section', 'admin__grupo');
      g1.appendChild(el('h3', null, 'Próximas (' + proximas.length + ')'));
      if (!proximas.length) g1.appendChild(el('p', 'estado-vacio', 'No hay reservas para los próximos días.'));
      proximas.forEach(function (x) { g1.appendChild(tarjetaReserva(x, false)); });
      cont.appendChild(g1);
      if (pasadas.length) {
        var g2 = el('section', 'admin__grupo');
        g2.appendChild(el('h3', null, 'Anteriores (' + pasadas.length + ')'));
        pasadas.forEach(function (x) { g2.appendChild(tarjetaReserva(x, true)); });
        cont.appendChild(g2);
      }
    }).catch(function (err) {
      if (sesionCaducada(err)) return;
      cont.innerHTML = '';
      cont.appendChild(el('p', 'estado-vacio', err.message));
    });
  }
  function tarjetaReserva(x, pasada) {
    var t = el('article', 'registro' + (pasada ? ' registro--pasada' : ''));
    var cab = el('div', 'registro__cabecera');
    cab.appendChild(el('p', 'registro__titulo', fechaBonita(x.fecha) + ' · ' + x.hora + ' · ' + (x.personas === 1 ? '1 persona' : x.personas + ' personas')));
    cab.appendChild(el('p', 'registro__meta', 'Recibida ' + fRecibido.format(new Date(x.creada))));
    t.appendChild(cab);
    var datos = el('p', 'registro__datos');
    var n = el('span'); n.appendChild(el('strong', null, x.nombre)); datos.appendChild(n);
    var tel = el('a', null, x.telefono); tel.href = 'tel:' + x.telefono.replace(/[^\d+]/g, ''); datos.appendChild(tel);
    t.appendChild(datos);
    if (x.notas) t.appendChild(el('p', 'registro__texto', x.notas));
    var acc = el('div', 'acciones-mini');
    acc.appendChild(botonBorrar('Borrar reserva', function () {
      api('DELETE', '/api/reservas/' + x.id).then(function () { panelReservasDeNuevo(); })
        .catch(function (err) { if (!sesionCaducada(err)) mostrarEstado(err.message, true); });
    }));
    t.appendChild(acc);
    return t;
  }
  function panelReservasDeNuevo() { if (pestana === 'reservas') pintarPanel(); }

  /* Pestaña: mensajes del formulario de contacto */
  function panelMensajes() {
    cuerpo.appendChild(el('p', 'admin__ayuda', 'Mensajes que llegan desde el formulario «Escríbenos» de la web.'));
    var cont = el('div', 'registros');
    cont.appendChild(el('p', 'estado-vacio', 'Cargando mensajes…'));
    cuerpo.appendChild(cont);
    api('GET', '/api/mensajes').then(function (r) {
      if (pestana !== 'mensajes') return;
      cont.innerHTML = '';
      ponerContador('mensajes', r.mensajes.length);
      if (!r.mensajes.length) { cont.appendChild(el('p', 'estado-vacio', 'Todavía no hay mensajes.')); return; }
      r.mensajes.forEach(function (m) {
        var t = el('article', 'registro');
        var cab = el('div', 'registro__cabecera');
        cab.appendChild(el('p', 'registro__titulo', m.nombre));
        cab.appendChild(el('p', 'registro__meta', fRecibido.format(new Date(m.creado))));
        t.appendChild(cab);
        var datos = el('p', 'registro__datos');
        var mail = el('a', null, m.email); mail.href = 'mailto:' + m.email; datos.appendChild(mail);
        t.appendChild(datos);
        t.appendChild(el('p', 'registro__texto', m.mensaje));
        var acc = el('div', 'acciones-mini');
        acc.appendChild(botonBorrar('Borrar mensaje', function () {
          api('DELETE', '/api/mensajes/' + m.id).then(function () { if (pestana === 'mensajes') pintarPanel(); })
            .catch(function (err) { if (!sesionCaducada(err)) mostrarEstado(err.message, true); });
        }));
        t.appendChild(acc);
        cont.appendChild(t);
      });
    }).catch(function (err) {
      if (sesionCaducada(err)) return;
      cont.innerHTML = '';
      cont.appendChild(el('p', 'estado-vacio', err.message));
    });
  }

  function ponerContador(pest, n) {
    var tab = $('tab-' + pest);
    var base = pest === 'reservas' ? 'Reservas' : 'Mensajes';
    tab.textContent = n ? base + ' (' + n + ')' : base;
  }
  function actualizarContadores() {
    api('GET', '/api/reservas').then(function (r) {
      ponerContador('reservas', r.reservas.filter(function (x) { return x.fecha >= r.hoy; }).length);
    }).catch(function () {});
    api('GET', '/api/mensajes').then(function (r) { ponerContador('mensajes', r.mensajes.length); }).catch(function () {});
  }

  /* Validación y guardado */
  function validar(k, b) {
    if (k === 'carta') {
      for (var i = 0; i < b.productos.length; i++) {
        var p = b.productos[i];
        if (!texto(p.nombre)) return 'Hay un producto sin nombre en «' + (NOMBRE_CAT[p.cat] || 'la carta') + '». Escríbelo o elimina el producto.';
        if (!RE_PRECIO.test(texto(p.precio))) return 'Revisa el precio de «' + texto(p.nombre) + '»: escribe solo el número, por ejemplo 2,50.';
      }
    }
    if (k === 'horario') {
      var todas = b.manana.concat(b.tarde);
      for (var j = 0; j < todas.length; j++) {
        if (!RE_HORA.test(todas[j])) return 'La hora «' + todas[j] + '» no es válida. Escríbela así: 09:30.';
      }
    }
    if (k === 'datos' && texto(b.email) && texto(b.email).indexOf('@') < 1) {
      return 'Revisa el email: parece que le falta la @.';
    }
    return '';
  }

  function guardar() {
    var k = claveActual();
    if (!k) return Promise.resolve(false);
    var b = borradores[k] || borrador(k);
    var error = validar(k, b);
    if (error) { mostrarEstado(error, true); return Promise.resolve(false); }
    guardando = true;
    btnGuardar.disabled = true;
    mostrarEstado('Guardando…');
    return api('PUT', '/api/contenido/' + k, b).then(function (r) {
      estado[k] = r[k];
      borradores[k] = normalizar(k, clonar(r[k]));
      sucio[k] = false;
      guardando = false;
      var arriba = cuerpo.scrollTop;
      pintarPanel();
      cuerpo.scrollTop = arriba;
      pintarTodo();
      mostrarEstado('Guardado. Ya se ve en la web.');
      return true;
    }).catch(function (err) {
      guardando = false;
      btnGuardar.disabled = false;
      if (!sesionCaducada(err)) mostrarEstado(err.message, true);
      return false;
    });
  }
  btnGuardar.addEventListener('click', guardar);
  btnDescartar.addEventListener('click', function () {
    var k = claveActual();
    if (!k) return;
    sucio[k] = false;
    borradores[k] = null;
    pintarPanel();
    mostrarEstado('Cambios descartados.');
  });

  /* Fotos: reducir en el navegador y subir */
  function reducirImagen(file) {
    return new Promise(function (resolve) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { resolve(file); return; }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var max = 1800;
          var w = img.naturalWidth, h = img.naturalHeight;
          var k = Math.min(1, max / Math.max(w, h));
          var c = document.createElement('canvas');
          c.width = Math.round(w * k); c.height = Math.round(h * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          c.toBlob(function (bl) {
            URL.revokeObjectURL(url);
            resolve(bl && bl.size < file.size ? bl : file);
          }, 'image/jpeg', 0.82);
        } catch (e) { URL.revokeObjectURL(url); resolve(file); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }
  function subirFoto(file, alTerminar) {
    mostrarEstado('Subiendo foto…');
    reducirImagen(file).then(function (blob) {
      return api('POST', '/api/fotos', blob, { binario: true });
    }).then(function (r) {
      alTerminar(r.id);
      sucio[claveActual()] = true;
      pintarPanel();
      return guardar();
    }).catch(function (err) {
      if (!sesionCaducada(err)) mostrarEstado(err.message, true);
    });
  }

  /* ---------- Arranque ---------- */
  pintarTodo();
  api('GET', '/api/contenido').then(function (c) {
    estado = { carta: c.carta, galeria: c.galeria, horario: c.horario, datos: c.datos };
    cargado = true;
    pintarTodo();
  }).catch(function () {
    cargado = true;
    sinDatos = true;
    pintarTodo();
  });
  if (location.hash === '#reservar') abrir(modalReserva);
})();
