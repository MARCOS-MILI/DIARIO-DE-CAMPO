/* Livro de Invenções do Marck
   Paginação por colunas CSS: cada capítulo vira uma faixa de páginas lado a lado,
   e a "janela" mostra uma (celular) ou duas (tela larga) por vez. */
(function () {
  'use strict';

  var raiz = document.documentElement;
  var livro = document.getElementById('livro');
  var capa = document.getElementById('capa');
  var miolo = document.getElementById('miolo');
  var janela = document.getElementById('janela');
  var trilho = document.getElementById('trilho');
  if (!livro || !janela || !trilho) { return; }

  var caps = Array.prototype.slice.call(trilho.querySelectorAll('.cap'));
  var bAnt = document.getElementById('b-ant');
  var bProx = document.getElementById('b-prox');
  var bIndice = document.getElementById('b-indice');
  var bFita = document.getElementById('b-fita');
  var aviso = document.getElementById('aviso-pg');
  var cabE = document.getElementById('cab-e'), cabD = document.getElementById('cab-d');
  var folE = document.getElementById('fol-e'), folD = document.getElementById('fol-d');
  var vista = document.getElementById('prancha-vista');
  var vistaImg = document.getElementById('pv-img');
  var vistaTit = document.getElementById('pv-tit');
  var vistaOrig = document.getElementById('pv-orig');
  var vistaFechar = document.getElementById('pv-fechar');
  var btContinuar = capa ? capa.querySelector('.capa-continuar') : null;
  var btModo = document.getElementById('modo-livro');

  var CHAVE = 'livro-invencoes-marck-v1';
  var reduz = false;
  try { reduz = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* ---------- memória do leitor (só neste aparelho) ---------- */
  function ler() { try { return JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch (e) { return {}; } }
  function gravar(o) { try { localStorage.setItem(CHAVE, JSON.stringify(o)); } catch (e) {} }
  var salvo = ler();

  /* ---------- estado ---------- */
  var G = {
    estado: 'capa', P: 0, Hp: 0, vistas: 1, mx: 0, mt: 0, mb: 0, Hf: 0, colW: 0, gap: 0, fs: 16,
    paginas: [], info: [], total: 0, cur: 0
  };
  var larguraAnterior = 0, alturaAnterior = 0;

  function definirEstado(e) {
    G.estado = e;
    livro.setAttribute('data-estado', e);
    raiz.setAttribute('data-estado', e);
    if (e !== 'livro') { livro.classList.remove('duas'); }
  }

  /* ---------- medidas ---------- */
  function limitar(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function medidas() {
    var W = window.innerWidth, H = window.innerHeight;
    var largo = W >= 900 && H >= 520;
    var vistas = largo ? 2 : 1;
    var pad = W < 600 ? 8 : 26;
    var vpad = H < 500 ? 8 : (W < 600 ? 8 : 24);
    var dispW = W - 2 * pad, dispH = H - 2 * vpad;
    var P, Hp;
    if (vistas === 2) {
      P = Math.floor(Math.min(dispW / 2, dispH * 0.74, 640));
      Hp = Math.floor(Math.min(dispH, P / 0.6));
    } else {
      P = Math.floor(Math.min(dispW, 640));
      Hp = Math.floor(Math.min(dispH, P / 0.45));
    }
    var curto = Hp < 460;
    var mx = Math.round(limitar(P * 0.085, 18, 52));
    var mt = curto ? 36 : 52;
    var mb = curto ? 38 : 54;
    var fs = limitar(Math.round(P / 24 * 2) / 2, 16, 19.5);
    if (curto) { fs = Math.min(fs, 16); }
    var Hf = Hp - mt - mb;
    var colW = P - 2 * mx;
    return {
      vistas: vistas, P: P, Hp: Hp, mx: mx, mt: mt, mb: mb, fs: fs, Hf: Hf, colW: colW, gap: 2 * mx,
      prancha: Math.round(limitar(Hf * 0.3, 120, 320))
    };
  }

  function aplicarMedidas(m) {
    G.vistas = m.vistas; G.P = m.P; G.Hp = m.Hp; G.mx = m.mx; G.mt = m.mt; G.mb = m.mb;
    G.Hf = m.Hf; G.colW = m.colW; G.gap = m.gap; G.fs = m.fs;
    var s = livro.style;
    s.setProperty('--P', m.P + 'px');
    s.setProperty('--Hp', m.Hp + 'px');
    s.setProperty('--mx', m.mx + 'px');
    s.setProperty('--mt', m.mt + 'px');
    s.setProperty('--mb', m.mb + 'px');
    s.setProperty('--Hf', m.Hf + 'px');
    s.setProperty('--colW', m.colW + 'px');
    s.setProperty('--gap', m.gap + 'px');
    s.setProperty('--fs', m.fs + 'px');
    s.setProperty('--vistas', String(m.vistas));
    s.setProperty('--prancha-h', m.prancha + 'px');
    livro.classList.toggle('duas', m.vistas === 2);
  }

  function limparMedidas() {
    ['--P', '--Hp', '--mx', '--mt', '--mb', '--Hf', '--colW', '--gap', '--fs', '--vistas', '--prancha-h', '--x']
      .forEach(function (n) { livro.style.removeProperty(n); trilho.style.removeProperty(n); });
    caps.forEach(function (c) { c.style.width = ''; c.style.marginLeft = ''; });
    trilho.style.transform = '';
  }

  /* ---------- paginação ---------- */
  function contarPaginas(c) {
    var f = c.querySelector('.fluxo');
    var sw = f.scrollWidth;
    var n = Math.ceil((sw - G.colW - G.mx / 2) / G.P) + 1;
    return Math.max(1, n);
  }

  function paridade(c) {
    // só nas telas largas: rosto na direita, divisores de parte na esquerda
    if (G.vistas !== 2) { return null; }
    if (c.id === 'cap-rosto') { return 1; }
    if (c.getAttribute('data-tipo') === 'parte') { return 0; }
    return null;
  }

  function paginar() {
    caps.forEach(function (c) { c.style.width = G.P + 'px'; c.style.marginLeft = '0px'; });
    var contagens = caps.map(contarPaginas);
    var idx = 0;
    G.paginas = [];
    G.info = [];
    caps.forEach(function (c, k) {
      var n = contagens[k];
      var par = paridade(c);
      if (par !== null && idx % 2 !== par) {
        G.paginas.push({ branca: true, cap: k });
        idx++;
        c.style.marginLeft = G.P + 'px';
      } else {
        c.style.marginLeft = '0px';
      }
      c.style.width = (n * G.P) + 'px';
      G.info[k] = { el: c, id: c.id, tipo: c.getAttribute('data-tipo'), titulo: c.getAttribute('data-titulo') || '', ini: idx, n: n };
      for (var i = 0; i < n; i++) { G.paginas.push({ cap: k, i: i }); }
      idx += n;
    });
    G.total = G.paginas.length;
    preencherIndice();
  }

  function preencherIndice() {
    var links = trilho.querySelectorAll('.indice a[data-cap]');
    Array.prototype.forEach.call(links, function (a) {
      var id = a.getAttribute('data-cap');
      var k = caps.findIndex(function (c) { return c.id === id; });
      var num = a.querySelector('.pg-num');
      if (k >= 0 && num) { num.textContent = String(G.info[k].ini + 1); }
    });
  }

  function limparNumerosIndice() {
    Array.prototype.forEach.call(trilho.querySelectorAll('.indice .pg-num'), function (n) { n.textContent = ''; });
  }

  function indiceDaVista(i) {
    i = limitar(i, 0, Math.max(0, G.total - 1));
    return G.vistas === 2 ? i - (i % 2) : i;
  }

  function capDe(idx) {
    var p = G.paginas[idx];
    return p ? p.cap : 0;
  }

  /* ---------- navegação ---------- */
  var salvarTimer = null;
  // Âncora da vista: a página que melhor diz "onde estou". Nas telas largas, se a página da
  // direita abre um capítulo novo, é ela (começo de capítulo é um ponto firme que sobrevive a re-medidas).
  function ancora() {
    var idx = G.cur;
    if (G.vistas === 2) {
      var e = G.paginas[G.cur], d = G.paginas[G.cur + 1];
      if (d && !d.branca && d.i === 0 && (!e || e.branca || e.cap !== d.cap)) { idx = G.cur + 1; }
    }
    var pg = G.paginas[idx];
    if (!pg || pg.branca) {
      for (var j = G.cur; j < Math.min(G.total, G.cur + G.vistas); j++) {
        if (G.paginas[j] && !G.paginas[j].branca) { idx = j; pg = G.paginas[j]; break; }
      }
    }
    if (!pg || pg.branca) { return null; }
    return { idx: idx, k: pg.cap, i: pg.i };
  }

  function posicaoAtual() {
    var a = ancora();
    if (!a) { return null; }
    var inf = G.info[a.k];
    return { cap: inf.id, off: a.i, n: inf.n };
  }

  function guardarPosicao() {
    var pos = posicaoAtual();
    if (!pos) { return; }
    salvo.cap = pos.cap; salvo.off = pos.off; salvo.n = pos.n;
    clearTimeout(salvarTimer);
    salvarTimer = setTimeout(function () { gravar(salvo); }, 250);
    try { history.replaceState(null, '', '#' + pos.cap); } catch (e) {}
  }

  function textoCab(idx) {
    var p = G.paginas[idx];
    if (!p || p.branca) { return ''; }
    var inf = G.info[p.cap];
    if (inf.tipo === 'parte' || inf.tipo === 'fim' || inf.id === 'cap-rosto') { return ''; }
    if (p.i === 0) { return ''; }
    return inf.titulo;
  }

  function textoFolio(idx) {
    var p = G.paginas[idx];
    if (!p || p.branca) { return ''; }
    var inf = G.info[p.cap];
    if (inf.id === 'cap-rosto' || inf.tipo === 'parte') { return ''; }
    return String(idx + 1);
  }

  function atualizarCromo() {
    var c = G.cur;
    if (G.vistas === 2) {
      var ce = textoCab(c), cd = textoCab(c + 1);
      cabE.textContent = ce ? 'Livro de Invenções' : '';
      cabD.textContent = cd;
      folE.textContent = textoFolio(c);
      folD.textContent = textoFolio(c + 1);
    } else {
      cabE.textContent = textoCab(c);
      cabD.textContent = '';
      folE.textContent = textoFolio(c);
      folD.textContent = '';
    }
    bAnt.disabled = G.cur <= 0;
    bProx.disabled = G.cur + G.vistas >= G.total;
    var marcada = !!salvo.marca && marcaDaVista();
    bFita.setAttribute('aria-pressed', marcada ? 'true' : 'false');
    bFita.setAttribute('aria-label', marcada ? 'Tirar o marcador desta página' : 'Marcar esta página');
  }

  function marcaDaVista() {
    // vale se a página marcada está entre as páginas visíveis agora
    var m = salvo.marca;
    var k = caps.findIndex(function (c) { return c.id === m.cap; });
    if (k < 0 || !G.info[k]) { return false; }
    var alvo = G.info[k].ini + limitar(Math.round(m.off / Math.max(1, m.n) * G.info[k].n), 0, G.info[k].n - 1);
    return alvo >= G.cur && alvo < G.cur + G.vistas;
  }

  function pedirImagens() {
    var k = capDe(G.cur);
    for (var j = k - 1; j <= k + 1; j++) {
      if (!caps[j]) { continue; }
      Array.prototype.forEach.call(caps[j].querySelectorAll('img[loading="lazy"]'), function (im) { im.loading = 'eager'; });
    }
    if (G.vistas === 2) {
      var k2 = capDe(G.cur + 1);
      if (caps[k2]) { Array.prototype.forEach.call(caps[k2].querySelectorAll('img[loading="lazy"]'), function (im) { im.loading = 'eager'; }); }
    }
  }

  var fimAnim = null;
  function irPara(idx, opcoes) {
    opcoes = opcoes || {};
    var novo = indiceDaVista(idx);
    var antes = G.cur;
    G.cur = novo;
    var salto = Math.abs(novo - antes) > G.vistas * 2;
    janela.classList.remove('virando-p', 'virando-a', 'salto');
    trilho.classList.remove('arrastando');
    if (opcoes.instante || reduz || salto) {
      trilho.style.transition = 'none';
      trilho.style.transform = 'translate3d(' + (-novo * G.P) + 'px,0,0)';
      void trilho.offsetWidth;
      trilho.style.transition = '';
      if (!opcoes.instante && !reduz && salto) {
        void janela.offsetWidth;
        janela.classList.add('salto');
      }
    } else {
      trilho.style.transform = 'translate3d(' + (-novo * G.P) + 'px,0,0)';
      if (novo !== antes) {
        void janela.offsetWidth;
        janela.classList.add(novo > antes ? 'virando-p' : 'virando-a');
      }
    }
    clearTimeout(fimAnim);
    fimAnim = setTimeout(function () { janela.classList.remove('virando-p', 'virando-a', 'salto'); }, 600);
    atualizarCromo();
    pedirImagens();
    guardarPosicao();
  }

  function proxima() { if (G.cur + G.vistas < G.total) { irPara(G.cur + G.vistas); } }
  function anterior() { if (G.cur > 0) { irPara(G.cur - G.vistas); } }

  function irParaCap(id, off) {
    var k = caps.findIndex(function (c) { return c.id === id; });
    if (k < 0) { return false; }
    var inf = G.info[k];
    var o = limitar(off || 0, 0, inf.n - 1);
    irPara(inf.ini + o);
    return true;
  }

  function irParaIndice() { irParaCap('cap-indice'); }

  function paginaDoElemento(el) {
    var r = el.getBoundingClientRect();
    var t = trilho.getBoundingClientRect();
    var x = r.left - t.left + Math.min(r.width, 4) / 2;
    return limitar(Math.floor(x / G.P), 0, G.total - 1);
  }

  /* ---------- abrir / fechar ---------- */
  function mostrarContinuar() {
    if (!btContinuar) { return; }
    btContinuar.hidden = !(salvo.cap && document.getElementById(salvo.cap));
  }

  function entrarNoLivro(destino) {
    definirEstado('livro');
    var m = medidas();
    aplicarMedidas(m);
    larguraAnterior = window.innerWidth; alturaAnterior = window.innerHeight;
    paginar();
    var ok = false;
    if (destino && destino.cap) { ok = irParaCapRapido(destino.cap, destino.off, destino.n); }
    if (!ok) { G.cur = 0; irPara(0, { instante: true }); }
  }

  function irParaCapRapido(id, off, n) {
    var k = caps.findIndex(function (c) { return c.id === id; });
    if (k < 0) { return false; }
    var inf = G.info[k];
    var o = off || 0;
    if (n && n !== inf.n) { o = Math.round(o / Math.max(1, n) * inf.n); }
    irPara(inf.ini + limitar(o, 0, inf.n - 1), { instante: true });
    return true;
  }

  function abrir(destino) {
    if (capa && !reduz) {
      capa.classList.add('abrindo');
      setTimeout(function () { capa.classList.remove('abrindo'); }, 760);
    }
    entrarNoLivro(destino);
  }

  function continuar() {
    abrir({ cap: salvo.cap, off: salvo.off, n: salvo.n });
  }

  function fecharLivro() {
    definirEstado('capa');
    limparMedidas();
    mostrarContinuar();
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    window.scrollTo(0, 0);
  }

  function lerRolando(idCap) {
    definirEstado('rolagem');
    limparMedidas();
    limparNumerosIndice();
    if (btModo) { btModo.hidden = false; }
    if (idCap) {
      var el = document.getElementById(idCap);
      if (el) { setTimeout(function () { el.scrollIntoView(); }, 30); }
    } else {
      window.scrollTo(0, 0);
    }
  }

  function capMaisPerto() {
    var melhor = null, dist = Infinity;
    caps.forEach(function (c) {
      var d = Math.abs(c.getBoundingClientRect().top);
      if (d < dist) { dist = d; melhor = c; }
    });
    return melhor ? melhor.id : null;
  }

  function voltarAoLivro() {
    var id = capMaisPerto();
    if (btModo) { btModo.hidden = true; }
    entrarNoLivro(id ? { cap: id, off: 0 } : null);
  }

  /* ---------- remedir ao redimensionar ---------- */
  var remedirTimer = null;
  function remedir() {
    if (G.estado !== 'livro') { return; }
    var pos = posicaoAtual();
    var m = medidas();
    aplicarMedidas(m);
    larguraAnterior = window.innerWidth; alturaAnterior = window.innerHeight;
    paginar();
    if (pos) { irParaCapRapido(pos.cap, pos.off, pos.n); } else { irPara(0, { instante: true }); }
  }

  window.addEventListener('resize', function () {
    if (G.estado !== 'livro') { return; }
    if (Math.abs(window.innerWidth - larguraAnterior) < 2 && Math.abs(window.innerHeight - alturaAnterior) < 2) { return; }
    clearTimeout(remedirTimer);
    remedirTimer = setTimeout(remedir, 160);
  });
  window.addEventListener('orientationchange', function () {
    clearTimeout(remedirTimer);
    remedirTimer = setTimeout(remedir, 300);
  });

  /* ---------- gestos ---------- */
  var arrasto = null, suprimir = false, suprimirTimer = null;

  janela.addEventListener('pointerdown', function (e) {
    if (G.estado !== 'livro') { return; }
    if (e.pointerType === 'mouse' && e.button !== 0) { return; }
    arrasto = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), dx: 0, mov: false, tipo: e.pointerType };
  });

  janela.addEventListener('pointermove', function (e) {
    if (!arrasto || e.pointerId !== arrasto.id) { return; }
    var dx = e.clientX - arrasto.x, dy = e.clientY - arrasto.y;
    if (!arrasto.mov) {
      if (Math.abs(dx) > 9 && Math.abs(dx) > Math.abs(dy) * 1.25) {
        arrasto.mov = true;
        trilho.classList.add('arrastando');
        if (arrasto.tipo === 'mouse') { janela.classList.add('arrastando-mouse'); }
        try { janela.setPointerCapture(arrasto.id); } catch (err) {}
      } else if (Math.abs(dy) > 12) {
        arrasto = null;
        return;
      } else {
        return;
      }
    }
    var d = dx;
    var naPonta = (G.cur <= 0 && dx > 0) || (G.cur + G.vistas >= G.total && dx < 0);
    if (naPonta) { d = dx * 0.25; }
    arrasto.dx = dx;
    trilho.style.transform = 'translate3d(' + (-G.cur * G.P + d) + 'px,0,0)';
  });

  function soltar(e) {
    if (!arrasto || (e && e.pointerId !== arrasto.id)) { return; }
    var a = arrasto;
    arrasto = null;
    janela.classList.remove('arrastando-mouse');
    if (!a.mov) { return; }
    try { janela.releasePointerCapture(a.id); } catch (err) {}
    suprimir = true;
    clearTimeout(suprimirTimer);
    suprimirTimer = setTimeout(function () { suprimir = false; }, 350);
    var dt = Math.max(1, performance.now() - a.t);
    var v = a.dx / dt;
    var limite = Math.max(40, G.P * 0.16);
    trilho.classList.remove('arrastando');
    void trilho.offsetWidth;
    if ((a.dx < -limite || v < -0.45) && G.cur + G.vistas < G.total) { irPara(G.cur + G.vistas); }
    else if ((a.dx > limite || v > 0.45) && G.cur > 0) { irPara(G.cur - G.vistas); }
    else { trilho.style.transform = 'translate3d(' + (-G.cur * G.P) + 'px,0,0)'; }
  }
  janela.addEventListener('pointerup', soltar);
  janela.addEventListener('pointercancel', function (e) {
    if (!arrasto || e.pointerId !== arrasto.id) { return; }
    var mov = arrasto.mov;
    arrasto = null;
    janela.classList.remove('arrastando-mouse');
    if (mov) {
      trilho.classList.remove('arrastando');
      trilho.style.transform = 'translate3d(' + (-G.cur * G.P) + 'px,0,0)';
    }
  });

  janela.addEventListener('click', function (e) {
    if (suprimir) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  var rodaTrava = false;
  janela.addEventListener('wheel', function (e) {
    if (G.estado !== 'livro' || vistaAberta()) { return; }
    var d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(d) < 24) { return; }
    e.preventDefault();
    if (rodaTrava) { return; }
    rodaTrava = true;
    setTimeout(function () { rodaTrava = false; }, 520);
    if (d > 0) { proxima(); } else { anterior(); }
  }, { passive: false });

  // o foco (Tab) pode empurrar a janela; mantém tudo no lugar e vai pra página do elemento
  janela.addEventListener('scroll', function () {
    if (janela.scrollLeft !== 0) { janela.scrollLeft = 0; }
    if (janela.scrollTop !== 0) { janela.scrollTop = 0; }
  });
  janela.addEventListener('focusin', function (e) {
    if (G.estado !== 'livro') { return; }
    janela.scrollLeft = 0; janela.scrollTop = 0;
    var p = paginaDoElemento(e.target);
    if (p < G.cur || p >= G.cur + G.vistas) { irPara(p); }
  });

  /* ---------- teclado ---------- */
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) { return; }
    if (vistaAberta()) {
      if (e.key === 'Escape') { fecharVista(); e.preventDefault(); }
      else if (e.key === 'Tab') { prenderFoco(e); }
      return;
    }
    if (G.estado === 'capa') { return; }
    if (G.estado !== 'livro') { return; }
    var alvo = e.target && e.target.tagName;
    var emControle = alvo === 'BUTTON' || alvo === 'A' || alvo === 'INPUT';
    switch (e.key) {
      case 'ArrowRight': case 'PageDown': proxima(); e.preventDefault(); break;
      case 'ArrowLeft': case 'PageUp': anterior(); e.preventDefault(); break;
      case ' ': if (!emControle) { (e.shiftKey ? anterior : proxima)(); e.preventDefault(); } break;
      case 'Home': irPara(0); e.preventDefault(); break;
      case 'End': irPara(G.total - 1); e.preventDefault(); break;
      case 'i': case 'I': irParaIndice(); break;
      case 'm': case 'M': alternarMarca(); break;
    }
  });

  /* ---------- botões ---------- */
  bAnt.addEventListener('click', anterior);
  bProx.addEventListener('click', proxima);
  bIndice.addEventListener('click', irParaIndice);

  var avisoTimer = null;
  function dizer(t) {
    aviso.textContent = t;
    aviso.classList.add('on');
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(function () { aviso.classList.remove('on'); }, 1500);
  }

  function alternarMarca() {
    var pos = posicaoAtual();
    if (!pos) { return; }
    var marcada = bFita.getAttribute('aria-pressed') === 'true';
    if (marcada) { delete salvo.marca; dizer('Marcador tirado'); }
    else {
      var a = ancora();
      if (!a) { return; }
      salvo.marca = { cap: G.info[a.k].id, off: a.i, n: G.info[a.k].n };
      dizer('Página marcada');
    }
    gravar(salvo);
    atualizarCromo();
  }
  bFita.addEventListener('click', alternarMarca);

  // ações por data-acao em qualquer lugar (capa, índice, fim, botão flutuante)
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-acao]') : null;
    if (!b) { return; }
    var a = b.getAttribute('data-acao');
    if (a === 'abrir') { e.stopPropagation(); abrir(null); }
    else if (a === 'continuar') { e.stopPropagation(); continuar(); }
    else if (a === 'capa') { fecharLivro(); }
    else if (a === 'indice') { irParaIndice(); }
    else if (a === 'rolagem') { lerRolando(posicaoAtual() ? posicaoAtual().cap : null); }
    else if (a === 'livro') { voltarAoLivro(); }
  });

  if (capa) {
    capa.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('[data-acao]')) { return; }
      if (G.estado === 'capa') { abrir(null); }
    });
    capa.addEventListener('keydown', function (e) {
      if ((e.key === 'Enter' || e.key === ' ') && e.target === capa) { e.preventDefault(); abrir(null); }
    });
  }

  // links entre capítulos
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[data-cap]') : null;
    if (!a) { return; }
    var id = a.getAttribute('data-cap');
    if (G.estado === 'livro') { e.preventDefault(); irParaCap(id); }
    else if (G.estado === 'rolagem') {
      e.preventDefault();
      var el = document.getElementById(id);
      if (el) { el.scrollIntoView(); }
    }
  });

  window.addEventListener('hashchange', function () {
    var id = location.hash.replace('#', '');
    if (!/^cap-/.test(id)) { return; }
    if (G.estado === 'livro') { irParaCap(id); }
  });

  /* ---------- pranchas (zoom) ---------- */
  var voltarFoco = null;
  function vistaAberta() { return vista && !vista.hidden; }

  function abrirVista(a) {
    voltarFoco = a;
    vistaImg.removeAttribute('src');
    var capEl = a.closest ? a.closest('.cap') : null;
    var nomeCap = capEl ? capEl.getAttribute('data-titulo') : '';
    vistaImg.alt = a.getAttribute('data-titulo') || '';
    vistaImg.src = a.getAttribute('href');
    vistaTit.textContent = nomeCap ? 'Prancha · ' + nomeCap : 'Prancha';
    vistaOrig.href = a.getAttribute('href');
    vista.hidden = false;
    raiz.classList.add('com-prancha');
    document.getElementById('pv-corpo').scrollTop = 0;
    vistaFechar.focus();
  }

  function fecharVista() {
    vista.hidden = true;
    raiz.classList.remove('com-prancha');
    vistaImg.removeAttribute('src');
    if (voltarFoco && voltarFoco.focus) { try { voltarFoco.focus({ preventScroll: true }); } catch (e) {} }
  }

  function prenderFoco(e) {
    var itens = [vistaOrig, vistaFechar];
    var i = itens.indexOf(document.activeElement);
    if (e.shiftKey) { if (i <= 0) { itens[itens.length - 1].focus(); e.preventDefault(); } }
    else if (i === itens.length - 1 || i < 0) { itens[0].focus(); e.preventDefault(); }
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a.prancha-abrir') : null;
    if (!a) { return; }
    e.preventDefault();
    abrirVista(a);
  });
  if (vistaFechar) { vistaFechar.addEventListener('click', fecharVista); }
  if (vista) {
    vista.addEventListener('click', function (e) { if (e.target === vista) { fecharVista(); } });
  }

  /* ---------- fontes: a paginação depende delas, então mede de novo quando chegarem ---------- */
  var remedirFonteTimer = null;
  function remedirPorFonte() {
    clearTimeout(remedirFonteTimer);
    remedirFonteTimer = setTimeout(function () { if (G.estado === 'livro') { remedir(); } }, 120);
  }
  if (document.fonts && document.fonts.load) {
    var pedidas = [
      '400 16px "EB Garamond"', 'italic 400 16px "EB Garamond"', '600 16px "EB Garamond"',
      '400 16px "IM Fell English"', 'italic 400 16px "IM Fell English"', '400 16px "IM Fell English SC"'
    ].map(function (f) { return document.fonts.load(f, 'Aáçõ0'); });
    Promise.all(pedidas).then(remedirPorFonte, remedirPorFonte);
    if (document.fonts.addEventListener) { document.fonts.addEventListener('loadingdone', remedirPorFonte); }
  }

  /* ---------- início ---------- */
  mostrarContinuar();

  var hashInicial = location.hash.replace('#', '');
  if (/^cap-/.test(hashInicial) && document.getElementById(hashInicial)) {
    // link direto pra um capítulo: abre já no livro, sem a capa
    entrarNoLivro({ cap: hashInicial, off: salvo.cap === hashInicial ? salvo.off : 0, n: salvo.n });
  } else {
    definirEstado('capa');
  }

  // pra conferir pelo console / testes
  window.__livro = {
    estado: function () { return G; },
    irPara: irPara, proxima: proxima, anterior: anterior, irParaCap: irParaCap, remedir: remedir
  };
})();
