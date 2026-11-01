#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Gera livro/index.html a partir dos cartões da aba Projetos da ficha (../index.html).
Rodar de novo sempre que um projeto da ficha mudar:  python3 livro/gerar.py
"""
import html as H
import math
import os
import re
import sys
from bs4 import BeautifulSoup

AQUI = os.path.dirname(os.path.abspath(__file__))
FICHA = os.path.join(AQUI, '..', 'index.html')
SAIDA = os.path.join(AQUI, 'index.html')
VERSAO = sys.argv[1] if len(sys.argv) > 1 else '1'
ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']


# O livro é "do Marck": onde o texto da ficha diz Kairon, aqui sai Marck.
# Frases com artigo primeiro; o que sobrar cai na troca simples (e avisa).
TROCAS_NOME = [
    ('Kairon trabalha em', 'O Marck trabalha em'),
    ('Kairon fez esse rádio', 'O Marck fez esse rádio'),
    ('que Kairon fala', 'que o Marck fala'),
    ('Kairon tratou', 'o Marck tratou'),
    ('do Kairon', 'do Marck'),
    ('Kairon', 'Marck'),
]
PROIBIDAS = ('kairon', 'flagon', 'hydra', 'agente duplo', 'duplo-agente', 'espião', 'alemanha', 'contato com o outro lado', 'recebe do outro lado')

# O livro também não conta que o Marck é espião: sai a Hydra, os Aliados e a Alemanha.
REMOVER_PARAGRAFOS = ['Os Aliados sabem que existe', 'É por esse rádio que', 'Em aberto: quem recebe do outro lado']
TROCAS_ESPIONAGEM = [
    ('com um objetivo: não ser percebido como espião. É a forma que ele tem de se comunicar com os outros.', 'pra se comunicar com os outros.'),
    ('Alcance, dificuldade pra rastrear e quem recebe do outro lado pendentes', 'Alcance e dificuldade pra rastrear pendentes'),
    ('Liga com o agente duplo e com o ', 'Liga com o '),
    (', onde vende as informações', ''),
    ('caderno do duplo-agente', 'caderno'),
]


def tirar_espionagem(corpo, cap_id):
    for p in list(corpo.find_all('p')):
        t = p.get_text(' ', strip=True)
        if any(t.startswith(r) for r in REMOVER_PARAGRAFOS):
            p.decompose()
    for no in list(corpo.find_all(string=True)):
        t = str(no)
        novo = t
        for velho, nv in TROCAS_ESPIONAGEM:
            novo = novo.replace(velho, nv)
        if novo != t:
            no.replace_with(novo)


def tirar_nome(corpo, cap_id):
    for no in list(corpo.find_all(string=True)):
        t = str(no)
        if not re.search('kairon', t, re.I):
            continue
        novo = t
        for velho, nv in TROCAS_NOME:
            novo = novo.replace(velho, nv)
        if re.search('kairon', novo, re.I):
            print('AVISO: sobrou Kairon em', cap_id, '->', novo[:80])
        no.replace_with(novo)


def esc(t):
    return H.escape(t, quote=True)


def texto(e):
    return re.sub(r'\s+', ' ', e.get_text(' ', strip=True)) if e else ''


def lerficha():
    soup = BeautifulSoup(open(FICHA, encoding='utf-8').read(), 'html.parser')
    painel = soup.find(id='painel-projetos')
    partes = []
    for g in painel.select('section.proj-grupo'):
        caps = []
        for a in g.select('article.projeto'):
            c = a.select_one('.carimbo')
            caps.append(dict(
                id=a['id'].split('-')[1],
                nome=texto(a.select_one('.proj-nome')),
                sub=texto(a.select_one('.proj-sub')),
                estado=texto(a.select_one('.proj-estado')),
                classe_estado=[x for x in a['class'] if x.startswith('est-')][0],
                data=texto(a.select_one('.proj-data')),
                iso=(a.select_one('.proj-data time') or {}).get('datetime', ''),
                carimbo=texto(c),
                aprovado='aprovado' in (c.get('class') or []),
                corpo=a.select_one('.proj-corpo'),
            ))
        partes.append(dict(id=g['id'], titulo=texto(g.select_one('.grupo-titulo')), desc=texto(g.select_one('.grupo-desc')), caps=caps))
    return partes


def origem_prancha(nome_img):
    """Prancha do livro: usa livro/pranchas/NOME se existir (cópia sem o nome Kairon), senão a de img/."""
    propria = os.path.join(AQUI, 'pranchas', os.path.basename(nome_img))
    return propria if os.path.exists(propria) else os.path.join(AQUI, '..', nome_img)


def caminho_prancha(nome_img):
    propria = os.path.join(AQUI, 'pranchas', os.path.basename(nome_img))
    return 'pranchas/' + os.path.basename(nome_img) if os.path.exists(propria) else '../' + nome_img


def mini(nome_img):
    """Recorte do topo da prancha (miniatura leve pro livro). Devolve (caminho, largura, altura)."""
    base = os.path.splitext(os.path.basename(nome_img))[0]
    rel = 'mini/%s.webp' % base
    destino = os.path.join(AQUI, rel)
    origem = origem_prancha(nome_img)
    L, A = 760, 520
    if not os.path.exists(destino) or os.path.getmtime(destino) < os.path.getmtime(origem):
        from PIL import Image
        os.makedirs(os.path.dirname(destino), exist_ok=True)
        im = Image.open(origem).convert('RGB')
        alt = min(im.height, int(im.width * A / L))
        im = im.crop((0, 0, im.width, alt)).resize((L, int(L * alt / im.width)), Image.LANCZOS)
        im.save(destino, 'WEBP', quality=74, method=6)
        L, A = im.size
    else:
        from PIL import Image
        L, A = Image.open(destino).size
    return rel, L, A


def figura(f):
    img = f.find('img')
    src = caminho_prancha(img['src'])
    pq, pl, pa = mini(img['src'])
    alt = img.get('alt', '')
    cap = texto(f.find('figcaption'))
    cap = re.sub(r'\s*Toque na imagem pra ampliar\.?', '', cap).strip()
    if cap and not cap.endswith('.'):
        cap += '.'
    return ('<figure class="prancha"><a class="prancha-abrir" href="%s" target="_blank" rel="noopener" data-titulo="%s">'
            '<img src="%s" width="%s" height="%s" loading="lazy" decoding="async" alt="%s"></a>'
            '<figcaption>%s <span class="dica">Toque pra abrir a prancha.</span></figcaption></figure>') % (
        esc(src), esc(alt), esc(pq), pl, pa, esc(alt), esc(cap))


def corpo_html(corpo, cap_id=''):
    tirar_nome(corpo, cap_id)
    tirar_espionagem(corpo, cap_id)
    # links entre projetos viram links do livro
    for a in corpo.select('a.ir'):
        alvo = a.get('data-abrir', '')
        m = re.match(r'projeto-(\d+)$', alvo)
        if m:
            n = m.group(1)
            for k in ('data-aba', 'data-abrir'):
                a.attrs.pop(k, None)
            a['href'] = '#cap-' + n
            a['data-cap'] = 'cap-' + n
        else:
            a.unwrap()
    primeiro = corpo.select_one('p.corpo')
    if primeiro is not None:
        primeiro['class'] = primeiro.get('class', []) + ['inicial']
    out = []
    for el in corpo.children:
        if getattr(el, 'name', None) is None:
            continue
        if el.name == 'figure':
            out.append(figura(el))
        else:
            out.append(str(el))
    return '\n'.join(out)


def engrenagem(cx, cy, r_ext, r_int, dentes):
    pts = []
    for i in range(dentes):
        a0 = 2 * math.pi * i / dentes
        passo = 2 * math.pi / dentes
        for f, rr in ((0.0, r_int), (0.18, r_ext), (0.5, r_ext), (0.68, r_int)):
            a = a0 + passo * f
            pts.append('%.1f,%.1f' % (cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return ' '.join(pts)


def emblema():
    g = engrenagem(100, 100, 86, 72, 20)
    return ('<svg class="emblema" viewBox="0 0 200 200" aria-hidden="true" focusable="false">'
            '<defs><linearGradient id="ouroG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8a6118"/><stop offset=".3" stop-color="#f6e3a0"/>'
            '<stop offset=".55" stop-color="#b88a2b"/><stop offset=".78" stop-color="#f1d27a"/><stop offset="1" stop-color="#7a5414"/></linearGradient>'
            '<linearGradient id="cristalG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd1f1"/><stop offset=".5" stop-color="#e060c2"/><stop offset="1" stop-color="#8a2a80"/></linearGradient></defs>'
            '<polygon points="%s" fill="url(#ouroG)" stroke="#2a1708" stroke-width="2"/>'
            '<circle cx="100" cy="100" r="62" fill="none" stroke="#2a1708" stroke-width="2.5"/>'
            '<circle cx="100" cy="100" r="56" fill="#2a1a0d" stroke="url(#ouroG)" stroke-width="3"/>'
            '<g stroke="url(#ouroG)" stroke-width="2.4" fill="none" stroke-linecap="round">'
            '<path d="M100 44 L100 62 M100 138 L100 156 M44 100 L62 100 M138 100 L156 100"/>'
            '<path d="M60 60 L72 72 M128 128 L140 140 M140 60 L128 72 M72 128 L60 140"/></g>'
            '<polygon points="100,62 118,78 118,120 100,138 82,120 82,78" fill="url(#cristalG)" stroke="#2a1708" stroke-width="2.2" stroke-linejoin="round"/>'
            '<path d="M100 62 L100 138 M82 78 L100 90 L118 78" stroke="#7a1f72" stroke-width="1.3" fill="none"/>'
            '<polygon points="90,76 98,70 98,128 90,120" fill="#fff" opacity=".35"/></svg>') % g


def montar(partes):
    caps_sec = []
    toc = []
    for pi, p in enumerate(partes):
        romano = ROMANOS[pi]
        caps_sec.append(
            '<section class="cap parte" id="parte-%d" data-tipo="parte" data-titulo="%s"><div class="fluxo">'
            '<div class="parte-capa"><p class="parte-n">Parte %s</p><div class="orn" aria-hidden="true"><i></i></div>'
            '<h2 class="parte-nome">%s</h2><p class="parte-desc">%s</p></div></div></section>' % (pi + 1, esc('Parte %s · %s' % (romano, p['titulo'])), romano, esc(p['titulo']), esc(p['desc'])))
        itens = []
        for c in p['caps']:
            selo = '<p class="selo"><span class="carimbo%s">%s</span></p>' % (' aprovado' if c['aprovado'] else '', esc(c['carimbo']))
            sub = '<p class="cap-sub">%s</p>' % esc(c['sub']) if c['sub'] else ''
            cab = ('<header class="cap-cab"><p class="cap-n">Projeto %s</p><h2 class="cap-nome">%s</h2>%s'
                   '<div class="orn" aria-hidden="true"><i></i></div>'
                   '<p class="cap-meta"><span class="estado %s">%s</span><span class="sep" aria-hidden="true"> · </span><time datetime="%s">%s</time></p>%s</header>') % (
                c['id'], esc(c['nome']), sub, c['classe_estado'], esc(c['estado']), esc(c['iso']), esc(c['data']), selo)
            caps_sec.append(
                '<section class="cap capitulo" id="cap-%s" data-tipo="capitulo" data-n="%s" data-titulo="%s"><div class="fluxo">\n%s\n%s\n</div></section>' % (
                    c['id'], c['id'], esc(c['nome']), cab, corpo_html(c['corpo'], 'cap-' + c['id'])))
            itens.append('<li><a href="#cap-%s" data-cap="cap-%s"><span class="ind-n">%s</span><span class="ind-nome">%s%s</span>'
                         '<span class="ind-fio" aria-hidden="true"></span><span class="ind-sel %s" role="img" aria-label="%s"></span><span class="pg-num">000</span></a></li>' % (
                c['id'], c['id'], c['id'], esc(c['nome']), ('<small>%s</small>' % esc(c['sub'])) if c['sub'] else '',
                'ok' if c['aprovado'] else 'pend', esc(c['carimbo'])))
        toc.append('<p class="ind-parte"><span>Parte %s</span> %s</p><ol class="ind-lista">%s</ol>' % (romano, esc(p['titulo']), ''.join(itens)))
    total = sum(len(p['caps']) for p in partes)

    frente = (
        '<section class="cap frente" id="cap-rosto" data-tipo="frente" data-titulo="Folha de rosto"><div class="fluxo"><div class="rosto">'
        '<p class="rosto-pre">Livro de</p><h1 class="rosto-titulo">Invenções</h1><p class="rosto-do">do Marck</p>'
        '<div class="orn" aria-hidden="true"><i></i></div><p class="rosto-leg">Projetos, plantas e experimentos</p>'
        '<p class="rosto-vol">Volume I</p></div></div></section>'
        '<section class="cap frente" id="cap-como" data-tipo="frente" data-titulo="Antes de ler"><div class="fluxo"><div class="como">'
        '<h2 class="como-tit">Antes de ler</h2><div class="orn" aria-hidden="true"><i></i></div>'
        '<p class="corpo">Vire a página arrastando de lado, pelas setas ou pelas teclas do teclado. O <strong>Índice</strong> leva a qualquer projeto. A fita vermelha marca a página onde você parou.</p>'
        '<p class="corpo">As plantas aparecem como <strong>pranchas</strong> coladas nas páginas. Toque numa prancha pra abrir inteira.</p>'
        '<p class="como-selo"><span class="carimbo aprovado">Aprovado pelo mestre</span></p>'
        '<p class="corpo">O mestre já aprovou o projeto.</p>'
        '<p class="como-selo"><span class="carimbo">Pendente de aprovação do mestre</span></p>'
        '<p class="corpo">O mestre ainda não aprovou o projeto.</p>'
        '<p class="corpo">Alcances, pesos, pressões e danos são propostas do Marck. Quem decide os números é o mestre.</p>'
        '</div></div></section>'
        '<section class="cap indice" id="cap-indice" data-tipo="indice" data-titulo="Índice"><div class="fluxo"><nav class="indice" aria-label="Índice">'
        '<h2 class="ind-tit">Índice</h2><div class="orn" aria-hidden="true"><i></i></div>%s'
        '<p class="ind-leg"><span class="ind-sel ok"></span> aprovado pelo mestre <span class="ind-sel pend"></span> pendente</p>'
        '<p class="ind-acoes"><button type="button" class="btn-livro" data-acao="capa">Fechar o livro</button> <button type="button" class="btn-livro" data-acao="rolagem">Ler rolando</button></p>'
        '</nav></div></section>') % ''.join(toc)

    fim = ('<section class="cap fim" id="cap-fim" data-tipo="fim" data-titulo="Fim do volume"><div class="fluxo"><div class="fim-pg">'
           '<div class="orn" aria-hidden="true"><i></i></div><p class="fim-tit">Fim do volume</p>'
           '<p class="fim-txt">%d projetos até agora. Os novos entram aqui conforme o Marck for criando.</p>'
           '<p class="ind-acoes"><button type="button" class="btn-livro" data-acao="indice">Ver o índice</button> <button type="button" class="btn-livro" data-acao="capa">Fechar o livro</button></p>'
           '</div></div></section>') % total

    capa = ('<div class="capa" id="capa" role="button" tabindex="0" aria-label="Abrir o livro">'
            '<div class="capa-moldura" aria-hidden="true"></div><div class="capa-conteudo">%s'
            '<p class="capa-pre ouro">Livro de</p><h1 class="capa-titulo ouro">Invenções</h1><p class="capa-do ouro">do Marck</p>'
            '<div class="orn ouro" aria-hidden="true"><i></i></div><p class="capa-leg">Projetos, plantas e experimentos</p>'
            '<button type="button" class="capa-abrir" data-acao="abrir">Abrir o livro</button>'
            '<button type="button" class="capa-continuar" data-acao="continuar" hidden>Continuar de onde parou</button>'
            '</div></div>') % emblema()

    filtro = ('<svg class="svg-defs" width="0" height="0" aria-hidden="true" focusable="false"><filter id="tinta-carimbo" x="-4%" y="-6%" width="108%" height="112%">'
              '<feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed="4" result="ruido"/>'
              '<feDisplacementMap in="SourceGraphic" in2="ruido" scale="1.1" xChannelSelector="R" yChannelSelector="G" result="tremido"/>'
              '<feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" seed="9" result="manchas"/>'
              '<feColorMatrix in="manchas" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -14 0 0 0 10.9" result="falhas"/>'
              '<feComposite in="tremido" in2="falhas" operator="in"/></filter></svg>')

    cromo = ('<div class="cromo" id="cromo" aria-hidden="false">'
             '<div class="slot slot-e"><p class="cab" id="cab-e"></p><p class="fol" id="fol-e"></p></div>'
             '<div class="slot slot-d"><p class="cab" id="cab-d"></p><p class="fol" id="fol-d"></p></div>'
             '<div class="lombada" aria-hidden="true"></div>'
             '<button type="button" class="ctl ctl-indice" id="b-indice" aria-label="Ir ao índice"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h9" stroke-linecap="round"/></svg><span>Índice</span></button>'
             '<button type="button" class="ctl ctl-ant" id="b-ant" aria-label="Página anterior"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'
             '<button type="button" class="ctl ctl-prox" id="b-prox" aria-label="Próxima página"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'
             '<button type="button" class="fita" id="b-fita" aria-label="Marcar esta página" aria-pressed="false"><svg viewBox="0 0 24 64" aria-hidden="true"><path d="M2 0h20v62l-10-12L2 62z"/></svg></button>'
             '<p class="aviso-pg" id="aviso-pg" role="status" aria-live="polite"></p></div>')

    prancha = ('<div class="prancha-vista" id="prancha-vista" role="dialog" aria-modal="true" aria-label="Prancha" hidden>'
               '<div class="pv-barra"><p class="pv-tit" id="pv-tit"></p><a class="pv-orig" id="pv-orig" href="#" target="_blank" rel="noopener">Abrir a imagem</a>'
               '<button type="button" class="pv-fechar" id="pv-fechar" aria-label="Fechar a prancha">Fechar</button></div>'
               '<div class="pv-corpo" id="pv-corpo"><img id="pv-img" alt=""></div></div>')

    modo = '<button type="button" class="modo-flutuante" id="modo-livro" data-acao="livro" hidden>Ler como livro</button>'

    return ('<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            '<meta name="robots" content="noindex, nofollow">\n<meta name="theme-color" content="#1f130a">\n'
            '<title>Livro de Invenções do Marck</title>\n'
            '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
            '<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&amp;family=IM+Fell+English:ital@0;1&amp;family=IM+Fell+English+SC&amp;display=swap" rel="stylesheet">\n'
            '<link rel="stylesheet" href="livro.css?v=%s">\n<script>document.documentElement.classList.add(\'js\')</script>\n</head>\n<body>\n%s\n'
            '<div class="livro" id="livro" data-estado="capa">\n%s\n<div class="miolo" id="miolo">\n<div class="janela" id="janela"><div class="trilho" id="trilho">\n%s\n%s\n%s\n</div></div>\n%s\n</div>\n%s\n%s\n</div>\n'
            '<script src="livro.js?v=%s"></script>\n</body>\n</html>\n') % (
        VERSAO, filtro, capa, frente, '\n'.join(caps_sec), fim, cromo, prancha, modo, VERSAO)


if __name__ == '__main__':
    partes = lerficha()
    saida = montar(partes)
    for palavra in PROIBIDAS:
        if palavra in saida.lower():
            raise SystemExit('ERRO: "%s" ainda aparece no livro, não publiquei.' % palavra)
    open(SAIDA, 'w', encoding='utf-8').write(saida)
    print('ok:', sum(len(p['caps']) for p in partes), 'projetos,', len(partes), 'partes,', len(saida), 'bytes')
