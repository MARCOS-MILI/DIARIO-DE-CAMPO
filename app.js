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

  window.addEventListener('hashchange', function () {
    mostrar(location.hash.replace('#', ''), { inicial: true });
  });

  mostrar(location.hash.replace('#', ''), { inicial: true });

  // links internos que levam a outra aba (ex.: "Abrir a bolsa")
  Array.prototype.slice.call(document.querySelectorAll('a.ir')).forEach(function (a) {
    a.addEventListener('click', function (ev) {
      ev.preventDefault();
      mostrar(a.getAttribute('data-aba'));
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
