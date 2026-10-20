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
