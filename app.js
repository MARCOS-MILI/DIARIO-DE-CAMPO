(function () {
  var abas = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
  var chaves = abas.map(function (a) { return a.getAttribute('data-id'); });

  function mostrar(chave, opcoes) {
    if (chaves.indexOf(chave) === -1) chave = chaves[0];
    abas.forEach(function (aba) {
      var ativa = aba.getAttribute('data-id') === chave;
      aba.setAttribute('aria-selected', ativa ? 'true' : 'false');
      aba.tabIndex = ativa ? 0 : -1;
      document.getElementById('painel-' + aba.getAttribute('data-id')).hidden = !ativa;
      if (ativa && opcoes && opcoes.foco) aba.focus();
      if (ativa) aba.parentNode.scrollLeft = Math.max(0, aba.offsetLeft - 24);
    });
    try { history.replaceState(null, '', '#' + chave); } catch (e) {}
    if (!opcoes || !opcoes.inicial) window.scrollTo(0, 0);
  }

  abas.forEach(function (aba, i) {
    aba.addEventListener('click', function () {
      mostrar(aba.getAttribute('data-id'));
    });
    aba.addEventListener('keydown', function (ev) {
      var alvo = null;
      if (ev.key === 'ArrowRight') alvo = (i + 1) % abas.length;
      if (ev.key === 'ArrowLeft') alvo = (i - 1 + abas.length) % abas.length;
      if (ev.key === 'Home') alvo = 0;
      if (ev.key === 'End') alvo = abas.length - 1;
      if (alvo !== null) {
        ev.preventDefault();
        mostrar(chaves[alvo], { foco: true });
      }
    });
  });

  document.querySelector('.marca').addEventListener('click', function (ev) {
    ev.preventDefault();
    mostrar('ficha');
  });

  // abre um cartão de projeto e leva a tela até ele
  function abrirCartao(id) {
    var cartao = document.getElementById(id);
    if (!cartao) return;
    var det = cartao.querySelector('details');
    if (det) det.open = true;
    cartao.scrollIntoView({ block: 'start' });
  }

  // aceita o nome de uma aba, o nome antigo (#experimentos) ou um cartão (#projeto-02)
  function entrar(hash, inicial) {
    var h = hash.replace('#', '');
    if (h === 'experimentos') h = 'projetos';
    if (/^projeto-\d+$/.test(h) && document.getElementById(h)) {
      mostrar('projetos', { inicial: true });
      abrirCartao(h);
      return;
    }
    mostrar(h, { inicial: inicial });
  }

  window.addEventListener('hashchange', function () {
    entrar(location.hash, true);
  });

  entrar(location.hash, true);

  // links internos que levam a outra aba (ex.: "Abrir a bolsa") ou a um cartão (data-abrir)
  Array.prototype.slice.call(document.querySelectorAll('a.ir')).forEach(function (a) {
    a.addEventListener('click', function (ev) {
      ev.preventDefault();
      mostrar(a.getAttribute('data-aba'));
      var alvo = a.getAttribute('data-abrir');
      if (alvo) abrirCartao(alvo);
    });
  });
})();

/* ---------- Bolsa: livro-caixa em dólares, salvo no aparelho ---------- */
(function () {
  var CHAVE = 'kairon-bolsa-v1';
  // valores em centavos, pra não errar conta com vírgula
  var SEMENTE = [{ id: 'saldo-inicial', c: 37500, nota: 'Saldo inicial', em: '2026-10-20T23:21:00.000Z' }];
  var memoria = null;

  var fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  var dataFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  function $(id) { return document.getElementById(id); }
  var totalEl = $('bolsa-total'), unEl = $('bolsa-un'), livroEl = $('bolsa-livro'), vazioEl = $('bolsa-vazio');
  var erroEl = $('bolsa-erro'), valorEl = $('bolsa-valor'), notaEl = $('bolsa-nota'), certoEl = $('bolsa-certo');
  var zerarEl = $('bolsa-zerar');
  if (!totalEl) return;

  function valido(m) {
    return m && typeof m.c === 'number' && isFinite(m.c) && typeof m.em === 'string' && typeof m.id === 'string';
  }

  function ler() {
    try {
      var cru = localStorage.getItem(CHAVE);
      if (cru) {
        var lista = JSON.parse(cru);
        if (Array.isArray(lista)) return lista.filter(valido);
      }
    } catch (e) {}
    return memoria ? memoria.slice() : SEMENTE.slice();
  }

  function gravar(lista) {
    memoria = lista.slice();
    try { localStorage.setItem(CHAVE, JSON.stringify(lista)); } catch (e) {}
  }

  function soma(lista) {
    return lista.reduce(function (s, m) { return s + Math.round(m.c); }, 0);
  }

  function dinheiro(c) { return fmt.format(c / 100); }
  function unidade(c) { return Math.abs(c) === 100 ? 'dólar' : 'dólares'; }

  // aceita 12, 12,5, 12.50 e 1.200,50
  function lerCentavos(texto) {
    var t = String(texto).replace(/\s|\$|US/gi, '');
    if (t.indexOf(',') !== -1) t = t.replace(/\./g, '').replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
    return Math.round(parseFloat(t) * 100);
  }

  function mostrarErro(msg) { erroEl.textContent = msg; erroEl.hidden = false; }
  function limparErro() { erroEl.hidden = true; }

  function novoId() { return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function render() {
    var lista = ler();
    var total = soma(lista);

    totalEl.textContent = dinheiro(total);
    totalEl.classList.toggle('negativo', total < 0);
    unEl.textContent = unidade(total);

    Array.prototype.slice.call(document.querySelectorAll('[data-saldo]')).forEach(function (el) {
      el.textContent = dinheiro(total) + ' ' + unidade(total);
    });

    livroEl.innerHTML = '';
    vazioEl.hidden = lista.length > 0;

    var corrente = 0;
    var linhas = lista.map(function (m) {
      corrente += Math.round(m.c);
      return { m: m, saldo: corrente };
    });

    linhas.reverse().forEach(function (l) {
      var m = l.m;
      var entrada = m.c >= 0;
      var li = document.createElement('li');
      li.className = entrada ? 'entrada' : 'saida';

      var motivo = document.createElement('span');
      motivo.className = 'motivo';
      motivo.textContent = m.nota || (entrada ? 'Entrada' : 'Saída');

      var q = document.createElement('span');
      q.className = 'quantia';
      q.textContent = (entrada ? '+' : '−') + dinheiro(Math.abs(m.c));
      q.setAttribute('aria-label', (entrada ? 'Entrou ' : 'Saiu ') + dinheiro(Math.abs(m.c)) + ' ' + unidade(m.c));

      var meta = document.createElement('div');
      meta.className = 'bolsa-meta';
      var quando = document.createElement('span');
      var d = new Date(m.em);
      quando.textContent = isNaN(d) ? '' : dataFmt.format(d);
      var ap = document.createElement('button');
      ap.type = 'button';
      ap.className = 'bolsa-apagar';
      ap.textContent = 'Apagar';
      ap.addEventListener('click', function () { apagar(m.id, ap); });
      meta.appendChild(quando);
      meta.appendChild(ap);

      var sp = document.createElement('span');
      sp.className = 'saldo-parcial';
      sp.textContent = 'saldo ' + dinheiro(l.saldo);

      li.appendChild(motivo);
      li.appendChild(q);
      li.appendChild(meta);
      li.appendChild(sp);
      livroEl.appendChild(li);
    });
  }

  // dois toques pra confirmar, sem janela de alerta
  function doisToques(botao, textoPronto, acao) {
    if (!botao.classList.contains('pronto')) {
      var antes = botao.textContent;
      botao.classList.add('pronto');
      botao.textContent = textoPronto;
      setTimeout(function () {
        botao.classList.remove('pronto');
        botao.textContent = antes;
      }, 4000);
      return;
    }
    acao();
  }

  function apagar(id, botao) {
    doisToques(botao, 'Toque de novo pra apagar', function () {
      limparErro();
      gravar(ler().filter(function (m) { return m.id !== id; }));
      render();
    });
  }

  function lancar(c, nota) {
    var lista = ler();
    lista.push({ id: novoId(), c: c, nota: nota, em: new Date().toISOString() });
    gravar(lista);
    render();
  }

  function lancamento(sinal) {
    var c = lerCentavos(valorEl.value);
    if (c === null || c === 0) {
      mostrarErro('Digite o valor só com números. Pros centavos, use vírgula.');
      valorEl.focus();
      return;
    }
    limparErro();
    lancar(sinal * c, notaEl.value.trim());
    valorEl.value = '';
    notaEl.value = '';
    valorEl.focus();
  }

  $('bolsa-entrou').addEventListener('click', function () { lancamento(1); });
  $('bolsa-saiu').addEventListener('click', function () { lancamento(-1); });

  $('bolsa-ajustar').addEventListener('click', function () {
    var alvo = lerCentavos(certoEl.value);
    if (alvo === null) {
      mostrarErro('Digite o saldo só com números. Pros centavos, use vírgula.');
      certoEl.focus();
      return;
    }
    var dif = alvo - soma(ler());
    if (dif === 0) {
      mostrarErro('O saldo já está em ' + dinheiro(alvo) + ' ' + unidade(alvo) + '.');
      return;
    }
    limparErro();
    lancar(dif, 'Ajuste de saldo');
    certoEl.value = '';
  });

  zerarEl.addEventListener('click', function () {
    doisToques(zerarEl, 'Toque de novo pra apagar tudo', function () {
      memoria = null;
      try { localStorage.removeItem(CHAVE); } catch (e) {}
      limparErro();
      render();
    });
  });

  render();
})();

/* ---------- Vida: barra com perder e curar, salva no aparelho ---------- */
(function () {
  var CHAVE = 'kairon-vida-v1';
  var PADRAO = { atual: 10, max: 10 };
  var memoria = null;

  function $(id) { return document.getElementById(id); }
  var caixa = $('vida');
  if (!caixa) return;

  var atualEl = $('vida-atual'), maxEl = $('vida-max'), barra = $('vida-barra'), fill = $('vida-fill');
  var infoEl = $('vida-info'), erroEl = $('vida-erro'), erro2El = $('vida-erro2');
  var valorEl = $('vida-valor'), novoMaxEl = $('vida-novomax'), novaAtualEl = $('vida-novaatual');

  function inteiro(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n; }

  function valido(e) {
    return e && inteiro(e.atual) && inteiro(e.max) && e.max >= 1 && e.max <= 999 && e.atual >= 0 && e.atual <= e.max;
  }

  function ler() {
    try {
      var cru = localStorage.getItem(CHAVE);
      if (cru) {
        var e = JSON.parse(cru);
        if (valido(e)) return { atual: e.atual, max: e.max };
      }
    } catch (x) {}
    var base = memoria || PADRAO;
    return { atual: base.atual, max: base.max };
  }

  function gravar(e) {
    memoria = { atual: e.atual, max: e.max };
    try { localStorage.setItem(CHAVE, JSON.stringify(memoria)); } catch (x) {}
  }

  // só números inteiros, até 3 dígitos
  function lerInteiro(texto) {
    var t = String(texto).replace(/\s/g, '');
    if (!/^\d{1,3}$/.test(t)) return null;
    return parseInt(t, 10);
  }

  function mostrarErro(el, msg) { el.textContent = msg; el.hidden = false; }
  function limparErros() { erroEl.hidden = true; erro2El.hidden = true; }

  function render(mensagem) {
    var e = ler();
    var pct = Math.round(e.atual / e.max * 100);

    atualEl.textContent = e.atual;
    maxEl.textContent = e.max;
    barra.setAttribute('aria-valuenow', e.atual);
    barra.setAttribute('aria-valuemax', e.max);
    barra.style.setProperty('--max', e.max);
    barra.classList.toggle('com-marcas', e.max <= 30);
    fill.style.setProperty('--p', pct + '%');
    caixa.classList.toggle('vida-baixo', pct <= 30);
    caixa.classList.toggle('vida-medio', pct > 30 && pct <= 60);
    novoMaxEl.placeholder = e.max;
    novaAtualEl.placeholder = e.atual;

    if (typeof mensagem === 'string') infoEl.textContent = mensagem;
    else infoEl.textContent = e.atual === 0 ? 'Sem vida.' : '';
  }

  function mudar(sinal) {
    var q = valorEl.value.trim() === '' ? 1 : lerInteiro(valorEl.value);
    if (q === null || q === 0) {
      mostrarErro(erroEl, 'Digite só números inteiros, sem vírgula. Em branco vale 1.');
      valorEl.focus();
      return;
    }
    limparErros();
    var e = ler();
    var novo = Math.max(0, Math.min(e.max, e.atual + sinal * q));
    var real = novo - e.atual;

    if (real === 0) {
      render(sinal < 0 ? 'Já está sem vida.' : 'Já está na vida máxima.');
      return;
    }

    gravar({ atual: novo, max: e.max });
    valorEl.value = '';
    if (real < 0) {
      render('Perdeu ' + (-real) + (-real < q ? ', que era o que restava.' : '.'));
    } else {
      render('Curou ' + real + (real < q ? ', até a vida máxima.' : '.'));
    }
  }

  $('vida-perdeu').addEventListener('click', function () { mudar(-1); });
  $('vida-curou').addEventListener('click', function () { mudar(1); });

  $('vida-cheia').addEventListener('click', function () {
    limparErros();
    var e = ler();
    if (e.atual === e.max) { render('Já está na vida máxima.'); return; }
    gravar({ atual: e.max, max: e.max });
    render('Vida cheia.');
  });

  $('vida-salvar').addEventListener('click', function () {
    var m = novoMaxEl.value.trim();
    var a = novaAtualEl.value.trim();
    if (m === '' && a === '') {
      mostrarErro(erro2El, 'Digite a vida máxima, a vida agora, ou as duas.');
      return;
    }

    var e = ler();
    var max = e.max, atual = e.atual;

    if (m !== '') {
      var mm = lerInteiro(m);
      if (mm === null || mm < 1) {
        mostrarErro(erro2El, 'A vida máxima precisa ser um número inteiro, de 1 pra cima.');
        novoMaxEl.focus();
        return;
      }
      max = mm;
      atual = Math.min(atual, max);
    }

    if (a !== '') {
      var aa = lerInteiro(a);
      if (aa === null) {
        mostrarErro(erro2El, 'A vida agora precisa ser um número inteiro, de 0 pra cima.');
        novaAtualEl.focus();
        return;
      }
      if (aa > max) {
        mostrarErro(erro2El, 'A vida agora não pode passar da máxima, que é ' + max + '.');
        novaAtualEl.focus();
        return;
      }
      atual = aa;
    }

    limparErros();
    gravar({ atual: atual, max: max });
    novoMaxEl.value = '';
    novaAtualEl.value = '';
    render('Salvo.');
  });

  render();
})();

/* ---------- Atributos: críticos clicáveis, salvos no aparelho ---------- */
(function () {
  var CHAVE = 'kairon-atributos-v1';
  var lista = document.querySelector('.tubos');
  if (!lista) return;

  var semente = lista.getAttribute('data-semente') || '1';
  var itens = Array.prototype.slice.call(lista.querySelectorAll('li[data-attr]'));
  var chaves = itens.map(function (li) { return li.getAttribute('data-attr'); });
  var nomes = {}, padrao = {}, memoria = null, refs = {};

  itens.forEach(function (li) {
    var k = li.getAttribute('data-attr');
    var m = li.getAttribute('data-m');
    nomes[k] = li.getAttribute('data-nome');
    padrao[k] = {
      v: parseInt(li.getAttribute('data-v'), 10),
      c: parseInt(li.getAttribute('data-c'), 10),
      m: (m === null || m === '') ? null : parseInt(m, 10)
    };
  });

  function inteiro(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n; }

  function validoUm(e) {
    if (!e || !inteiro(e.v) || e.v < 0 || e.v > 10) return false;
    if (!inteiro(e.c) || e.c < 0 || e.c > 99) return false;
    if (e.m !== null && (!inteiro(e.m) || e.m < 1 || e.m > 99 || e.c > e.m)) return false;
    return true;
  }

  function copiar(o) {
    var r = {};
    chaves.forEach(function (k) { r[k] = { v: o[k].v, c: o[k].c, m: o[k].m }; });
    return r;
  }

  function ler() {
    try {
      var cru = localStorage.getItem(CHAVE);
      if (cru) {
        var o = JSON.parse(cru);
        if (o && o.semente === semente && o.dados && chaves.every(function (k) { return validoUm(o.dados[k]); })) {
          return copiar(o.dados);
        }
      }
    } catch (x) {}
    return copiar(memoria || padrao);
  }

  function gravar(dados) {
    memoria = copiar(dados);
    try { localStorage.setItem(CHAVE, JSON.stringify({ semente: semente, dados: memoria })); } catch (x) {}
  }

  function el(tag, classe, texto) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto !== undefined && texto !== null) e.textContent = texto;
    return e;
  }

  function botao(classe, texto, rotulo) {
    var b = el('button', classe, texto);
    b.type = 'button';
    if (rotulo) b.setAttribute('aria-label', rotulo);
    return b;
  }

  // controles de cada atributo: − contagem +, e o botão de subir
  itens.forEach(function (li) {
    var k = li.getAttribute('data-attr'), nome = nomes[k];
    var crit = li.querySelector('.crit');
    crit.innerHTML = '';

    var linha = el('span', 'crit-linha');
    var menos = botao('crit-btn', '−', 'Tirar 1 crítico de ' + nome);
    var txt = el('span', 'crit-txt');
    var mais = botao('crit-btn', '+', 'Somar 1 crítico em ' + nome);
    linha.appendChild(menos);
    linha.appendChild(txt);
    linha.appendChild(mais);

    var subir = botao('crit-subir', '');
    subir.hidden = true;

    crit.appendChild(linha);
    crit.appendChild(subir);
    refs[k] = { li: li, menos: menos, mais: mais, txt: txt, subir: subir };

    menos.addEventListener('click', function () { somar(k, -1); });
    mais.addEventListener('click', function () { somar(k, 1); });
    subir.addEventListener('click', function () { subirAtributo(k); });
  });

  // aviso embaixo da lista (lido pelo leitor de tela)
  var infoEl = el('p', 'tubos-info');
  infoEl.setAttribute('aria-live', 'polite');
  lista.parentNode.insertBefore(infoEl, lista.nextSibling);

  // área de ajuste: valor, críticos e meta de cada atributo
  var det = el('details', 'crit-ajuste');
  var resumo = el('summary', null, 'Ajustar atributos e críticos');
  det.appendChild(resumo);
  var form = el('div', 'crit-form');
  form.appendChild(el('p', 'nota', 'Valor do atributo, críticos feitos e a meta, que é quantos críticos pedem pra subir. Deixe a meta em branco se ainda não sabe.'));

  var grade = el('div', 'crit-grade');
  var cab = el('div', 'crit-grade-linha crit-grade-cab');
  cab.appendChild(el('span', null, ''));
  ['Valor', 'Críticos', 'Meta'].forEach(function (t) { cab.appendChild(el('span', null, t)); });
  grade.appendChild(cab);

  function campo(rotulo, k) {
    var i = el('input');
    i.type = 'text';
    i.setAttribute('inputmode', 'numeric');
    i.setAttribute('autocomplete', 'off');
    i.maxLength = 2;
    i.setAttribute('aria-label', nomes[k] + ': ' + rotulo);
    return i;
  }

  itens.forEach(function (li) {
    var k = li.getAttribute('data-attr');
    var linha = el('div', 'crit-grade-linha');
    linha.appendChild(el('span', 'crit-grade-nome', nomes[k]));
    var iv = campo('valor, de 0 a 10', k);
    var ic = campo('críticos feitos', k);
    var im = campo('meta de críticos, em branco se não sabe', k);
    linha.appendChild(iv);
    linha.appendChild(ic);
    linha.appendChild(im);
    grade.appendChild(linha);
    refs[k].iv = iv;
    refs[k].ic = ic;
    refs[k].im = im;
  });
  form.appendChild(grade);

  var erroEl = el('p', 'crit-erro');
  erroEl.setAttribute('role', 'alert');
  erroEl.hidden = true;
  form.appendChild(erroEl);

  var salvar = botao('crit-salvar', 'Salvar');
  var zerar = botao('crit-zerar', 'Voltar aos valores do site');
  form.appendChild(salvar);
  form.appendChild(zerar);
  det.appendChild(form);
  infoEl.parentNode.insertBefore(det, infoEl.nextSibling);

  function textoContagem(e) {
    if (e.m === null) return e.c + (e.c === 1 ? ' crítico' : ' críticos');
    return e.c + ' de ' + e.m + (e.m === 1 ? ' crítico' : ' críticos');
  }

  function render(mensagem) {
    var d = ler();
    chaves.forEach(function (k) {
      var e = d[k], r = refs[k], nome = nomes[k];
      var tubo = r.li.querySelector('.tubo');

      r.li.querySelector('.valor').textContent = e.v;
      tubo.setAttribute('aria-label', nome + ' ' + e.v + ' de 10');
      tubo.querySelector('i').style.setProperty('--v', e.v);
      r.li.classList.toggle('cheio', e.v > 0);

      var batida = e.m !== null && e.c >= e.m;
      r.txt.innerHTML = '';
      var b = document.createElement('b');
      b.textContent = e.c;
      r.txt.appendChild(b);
      r.txt.appendChild(document.createTextNode(textoContagem(e).slice(String(e.c).length)));
      r.txt.classList.toggle('batida', batida);

      r.menos.disabled = e.c <= 0;
      r.mais.disabled = batida || e.c >= 99;

      if (batida && e.v < 10) {
        r.subir.textContent = 'Subir pra ' + (e.v + 1);
        r.subir.setAttribute('aria-label', 'Subir ' + nome + ' pra ' + (e.v + 1) + ' e zerar os críticos');
        r.subir.hidden = false;
      } else {
        r.subir.hidden = true;
      }

      [['iv', e.v], ['ic', e.c], ['im', e.m === null ? '' : e.m]].forEach(function (par) {
        if (document.activeElement !== r[par[0]]) r[par[0]].value = par[1];
      });
    });
    if (typeof mensagem === 'string') infoEl.textContent = mensagem;
  }

  function somar(k, delta) {
    var d = ler(), e = d[k];
    var novo = e.c + delta;
    if (novo < 0 || novo > 99 || (e.m !== null && novo > e.m)) return;
    e.c = novo;
    gravar(d);
    if (e.m !== null && e.c >= e.m) {
      render(nomes[k] + ' bateu a meta de ' + e.m + ' críticos.' + (e.v < 10 ? ' Toque em Subir pra ' + (e.v + 1) + '.' : ''));
    } else {
      render(nomes[k] + ': ' + textoContagem(e) + '.');
    }
  }

  function subirAtributo(k) {
    var d = ler(), e = d[k];
    if (e.v >= 10) return;
    e.v += 1;
    e.c = 0;
    e.m = null;
    gravar(d);
    render(nomes[k] + ' subiu pra ' + e.v + '. Os críticos zeraram. Em Ajustar atributos e críticos, dá pra definir a nova meta.');
  }

  function mostrarErro(msg) { erroEl.textContent = msg; erroEl.hidden = false; }

  salvar.addEventListener('click', function () {
    var d = ler();
    var i, k, v, c, m, tv, tc, tm;
    for (i = 0; i < chaves.length; i++) {
      k = chaves[i];
      tv = refs[k].iv.value.trim();
      tc = refs[k].ic.value.trim();
      tm = refs[k].im.value.trim();
      if (!/^\d{1,2}$/.test(tv) || parseInt(tv, 10) > 10) { mostrarErro(nomes[k] + ': o valor vai de 0 a 10, só números inteiros.'); refs[k].iv.focus(); return; }
      if (!/^\d{1,2}$/.test(tc)) { mostrarErro(nomes[k] + ': digite os críticos só com números inteiros.'); refs[k].ic.focus(); return; }
      if (tm !== '' && (!/^\d{1,2}$/.test(tm) || parseInt(tm, 10) < 1)) { mostrarErro(nomes[k] + ': a meta é um número inteiro de 1 pra cima, ou fica em branco.'); refs[k].im.focus(); return; }
      v = parseInt(tv, 10);
      c = parseInt(tc, 10);
      m = tm === '' ? null : parseInt(tm, 10);
      if (m !== null && c > m) { mostrarErro(nomes[k] + ': os críticos (' + c + ') passam da meta (' + m + ').'); refs[k].ic.focus(); return; }
      d[k] = { v: v, c: c, m: m };
    }
    erroEl.hidden = true;
    gravar(d);
    render('Salvo.');
  });

  // dois toques pra voltar ao que está no site, sem janela de alerta
  zerar.addEventListener('click', function () {
    if (!zerar.classList.contains('pronto')) {
      var antes = zerar.textContent;
      zerar.classList.add('pronto');
      zerar.textContent = 'Toque de novo pra voltar';
      setTimeout(function () { zerar.classList.remove('pronto'); zerar.textContent = antes; }, 4000);
      return;
    }
    memoria = null;
    try { localStorage.removeItem(CHAVE); } catch (x) {}
    zerar.classList.remove('pronto');
    zerar.textContent = 'Voltar aos valores do site';
    erroEl.hidden = true;
    render('Voltou aos valores do site.');
  });

  render();
})();

/* ---------- Status: energia, fome e sede, com − e +, salvos no aparelho ---------- */
(function () {
  var CHAVE = 'kairon-status-v1';
  var caixa = document.getElementById('status');
  if (!caixa) return;

  var semente = caixa.getAttribute('data-semente') || '1';
  var blocos = Array.prototype.slice.call(caixa.querySelectorAll('.stat'));
  var chaves = blocos.map(function (b) { return b.getAttribute('data-chave'); });
  var nomes = {}, padrao = {}, refs = {}, memoria = null;

  blocos.forEach(function (b) {
    var k = b.getAttribute('data-chave');
    nomes[k] = b.getAttribute('data-nome');
    padrao[k] = { atual: parseInt(b.getAttribute('data-atual'), 10), max: parseInt(b.getAttribute('data-max'), 10) };
  });

  function inteiro(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n; }

  function validoUm(e) {
    return e && inteiro(e.atual) && inteiro(e.max) && e.max >= 1 && e.max <= 999 && e.atual >= 0 && e.atual <= e.max;
  }

  function copiar(o) {
    var r = {};
    chaves.forEach(function (k) { r[k] = { atual: o[k].atual, max: o[k].max }; });
    return r;
  }

  function ler() {
    try {
      var cru = localStorage.getItem(CHAVE);
      if (cru) {
        var o = JSON.parse(cru);
        if (o && o.semente === semente && o.dados && chaves.every(function (k) { return validoUm(o.dados[k]); })) {
          return copiar(o.dados);
        }
      }
    } catch (x) {}
    return copiar(memoria || padrao);
  }

  function gravar(dados) {
    memoria = copiar(dados);
    try { localStorage.setItem(CHAVE, JSON.stringify({ semente: semente, dados: memoria })); } catch (x) {}
  }

  function el(tag, classe, texto) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto !== undefined && texto !== null) e.textContent = texto;
    return e;
  }

  function botao(classe, texto, rotulo) {
    var b = el('button', classe, texto);
    b.type = 'button';
    if (rotulo) b.setAttribute('aria-label', rotulo);
    return b;
  }

  blocos.forEach(function (b) {
    var k = b.getAttribute('data-chave'), nome = nomes[k];
    b.innerHTML = '';

    var topo = el('div', 'stat-topo');
    topo.appendChild(el('span', 'stat-rot', nome));
    var num = el('strong', 'stat-num');
    num.setAttribute('aria-live', 'polite');
    var atualEl = el('span');
    var maxEl = el('span');
    var peq = el('small');
    peq.appendChild(document.createTextNode(' / '));
    peq.appendChild(maxEl);
    num.appendChild(atualEl);
    num.appendChild(peq);
    topo.appendChild(num);

    var linha = el('div', 'stat-linha');
    var menos = botao('stat-btn', '−', 'Tirar 1 de ' + nome);
    var mais = botao('stat-btn', '+', 'Somar 1 em ' + nome);
    var barra = el('div', 'stat-barra');
    barra.setAttribute('role', 'progressbar');
    barra.setAttribute('aria-label', nome);
    barra.setAttribute('aria-valuemin', '0');
    var fill = document.createElement('i');
    barra.appendChild(fill);
    linha.appendChild(menos);
    linha.appendChild(barra);
    linha.appendChild(mais);

    b.appendChild(topo);
    b.appendChild(linha);
    refs[k] = { bloco: b, atual: atualEl, max: maxEl, barra: barra, fill: fill, menos: menos, mais: mais };

    menos.addEventListener('click', function () { mudar(k, -1); });
    mais.addEventListener('click', function () { mudar(k, 1); });
  });

  // área de ajuste: valor e máximo de cada um
  var det = el('details', 'stat-ajuste');
  det.appendChild(el('summary', null, 'Ajustar energia, fome e sede'));
  var form = el('div', 'stat-form');
  var grade = el('div', 'stat-grade');
  var cab = el('div', 'stat-grade-linha stat-grade-cab');
  cab.appendChild(el('span', null, ''));
  cab.appendChild(el('span', null, 'Agora'));
  cab.appendChild(el('span', null, 'Máximo'));
  grade.appendChild(cab);

  function campo(rotulo, k) {
    var i = el('input');
    i.type = 'text';
    i.setAttribute('inputmode', 'numeric');
    i.setAttribute('autocomplete', 'off');
    i.maxLength = 3;
    i.setAttribute('aria-label', nomes[k] + ': ' + rotulo);
    return i;
  }

  chaves.forEach(function (k) {
    var linha = el('div', 'stat-grade-linha');
    linha.appendChild(el('span', 'stat-grade-nome', nomes[k]));
    var ia = campo('valor agora', k);
    var im = campo('valor máximo', k);
    linha.appendChild(ia);
    linha.appendChild(im);
    grade.appendChild(linha);
    refs[k].ia = ia;
    refs[k].im = im;
  });
  form.appendChild(grade);

  var infoEl = el('p', 'stat-info');
  infoEl.setAttribute('aria-live', 'polite');
  var erroEl = el('p', 'stat-erro');
  erroEl.setAttribute('role', 'alert');
  erroEl.hidden = true;
  var salvar = botao('stat-salvar', 'Salvar');
  var encher = botao('stat-encher', 'Encher tudo');
  form.appendChild(erroEl);
  form.appendChild(salvar);
  form.appendChild(encher);
  det.appendChild(form);
  caixa.appendChild(infoEl);
  caixa.appendChild(det);

  function render(mensagem) {
    var d = ler();
    chaves.forEach(function (k) {
      var e = d[k], r = refs[k];
      var pct = Math.round(e.atual / e.max * 100);
      r.atual.textContent = e.atual;
      r.max.textContent = e.max;
      r.barra.setAttribute('aria-valuenow', e.atual);
      r.barra.setAttribute('aria-valuemax', e.max);
      r.barra.style.setProperty('--max', e.max);
      r.barra.classList.toggle('com-marcas', e.max <= 30);
      r.fill.style.setProperty('--p', pct + '%');
      r.bloco.classList.toggle('stat-baixo', pct <= 30);
      r.menos.disabled = e.atual <= 0;
      r.mais.disabled = e.atual >= e.max;
      if (document.activeElement !== r.ia) r.ia.value = e.atual;
      if (document.activeElement !== r.im) r.im.value = e.max;
    });
    if (typeof mensagem === 'string') infoEl.textContent = mensagem;
  }

  function mudar(k, delta) {
    var d = ler(), e = d[k];
    var novo = Math.max(0, Math.min(e.max, e.atual + delta));
    if (novo === e.atual) return;
    e.atual = novo;
    gravar(d);
    render(nomes[k] + ': ' + e.atual + ' de ' + e.max + '.');
  }

  function mostrarErro(msg) { erroEl.textContent = msg; erroEl.hidden = false; }

  salvar.addEventListener('click', function () {
    var d = ler(), i, k, ta, tm, max, atual;
    for (i = 0; i < chaves.length; i++) {
      k = chaves[i];
      ta = refs[k].ia.value.trim();
      tm = refs[k].im.value.trim();
      if (!/^\d{1,3}$/.test(tm) || parseInt(tm, 10) < 1) { mostrarErro(nomes[k] + ': o máximo é um número inteiro de 1 pra cima.'); refs[k].im.focus(); return; }
      if (!/^\d{1,3}$/.test(ta)) { mostrarErro(nomes[k] + ': o valor de agora é um número inteiro, de 0 pra cima.'); refs[k].ia.focus(); return; }
      max = parseInt(tm, 10);
      atual = parseInt(ta, 10);
      if (atual > max) { mostrarErro(nomes[k] + ': o valor de agora (' + atual + ') não pode passar do máximo (' + max + ').'); refs[k].ia.focus(); return; }
      d[k] = { atual: atual, max: max };
    }
    erroEl.hidden = true;
    gravar(d);
    render('Salvo.');
  });

  encher.addEventListener('click', function () {
    var d = ler();
    chaves.forEach(function (k) { d[k].atual = d[k].max; });
    erroEl.hidden = true;
    gravar(d);
    render('Energia, fome e sede no máximo.');
  });

  render();
})();
