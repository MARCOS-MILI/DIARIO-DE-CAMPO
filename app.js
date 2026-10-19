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
})();
