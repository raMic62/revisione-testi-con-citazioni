/*
 * revisione.js: command-line tools for revision rounds and citation checks
 * Strumenti da riga di comando per i giri di revisione e il controllo delle citazioni
 *
 * Requires Node.js. Some commands also need poppler (pdftotext, pdfinfo, pdftoppm),
 * tesseract (scanned pages) or pandoc (Word copy). Messages are in Italian when the
 * system language is Italian (or REVISIONE_LINGUA=it), in English otherwise.
 * Every command only reads files and prints to the screen, except "word", which
 * writes the .docx file you name.
 *
 *   node revisione.js note      text.md
 *       lists the review notes in the file (same format as the Revisione testi plugin)
 *   node revisione.js pulisci   text.md
 *       prints the text without notes
 *   node revisione.js confronta before.md after.md
 *       word-by-word comparison: removed words in red, added words in green (<del>/<ins>)
 *   node revisione.js pdf       book.pdf 14 16
 *       text of PDF pages 14 to 16
 *   node revisione.js scansione book.pdf 12 13
 *       text of scanned pages, with OCR (tesseract)
 *   node revisione.js riquadri  book.pdf 13
 *       like scansione, with the position of each line, for links with "rect"
 *   node revisione.js impronta  book1.pdf [book2.pdf ...]
 *       size, modification date and md5: compare before and after a round
 *   node revisione.js nome      book.pdf [books-folder]
 *       checks that the file name works in an Obsidian link and is not duplicated
 *   node revisione.js passo     "words of the passage"
 *       checks that the words to search contain no characters that break the link
 *   node revisione.js collegamenti text.md [books-folder]
 *       for every link to libri/: the book exists, the page exists, the searched words
 *       are on that page, the link is not inside the colours
 *   node revisione.js word      text.md output.docx [template.docx]
 *       Word copy of the approved text: notes and codes removed, links reduced to their
 *       visible text, [possibile nota: ...] / [possible note: ...] turned into footnotes
 *   node revisione.js word-anteprima text.md
 *       prints the text that would go into Word, without writing anything
 *
 * books-folder can also be set once with the environment variable REVISIONE_LIBRI.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const IT = /^it/i.test(process.env.REVISIONE_LINGUA || process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || '');
function L(it, en) { return IT ? it : en; }

function leggi(percorso) {
  try { return fs.readFileSync(percorso, 'utf8'); }
  catch (e) { throw new Error(L('Non riesco a leggere ', 'Cannot read ') + percorso); }
}

var RE_NOTA = /%%NOTA (\d+)( G)?(?: \+| \| ([\s\S]*?))%%/g;


/* ---------- note (le stesse regole del plugin Revisione testi) ---------- */

function pulisciPasso(s) {
  return s
    .replace(/%%[\s\S]*?%%/g, '')
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/==/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function trovaMarcatori(testo) {
  var out = [], m;
  RE_NOTA.lastIndex = 0;
  while ((m = RE_NOTA.exec(testo))) {
    var inizio = m.index, fine = inizio + m[0].length;
    var r = { id: m[1], generale: !!m[2], continua: m[3] === undefined, nota: m[3] || '',
              inizio: inizio, fine: fine, passoInizio: -1, passo: '' };
    if (inizio >= 4 && testo.slice(inizio - 2, inizio) === '==') {
      var inizioRiga = testo.lastIndexOf('\n', inizio - 1) + 1;
      var apre = testo.lastIndexOf('==', inizio - 4);
      if (apre >= inizioRiga) { r.passoInizio = apre; r.passo = testo.slice(apre + 2, inizio - 2); }
    }
    out.push(r);
  }
  return out;
}

function elencoNote(testo) {
  var per = {}, ordine = [];
  trovaMarcatori(testo).forEach(function (k) {
    var n = per[k.id];
    if (!n) {
      var inizioRiga = testo.lastIndexOf('\n', k.inizio - 1) + 1;
      var fineRiga = testo.indexOf('\n', k.fine);
      if (fineRiga < 0) fineRiga = testo.length;
      n = per[k.id] = { id: k.id, tipo: 'punto', passi: [], nota: '',
        capoverso: pulisciPasso(testo.slice(inizioRiga, fineRiga)).slice(0, 80),
        prima: pulisciPasso(testo.slice(inizioRiga, k.inizio)).slice(-40),
        dopo: pulisciPasso(testo.slice(k.fine, fineRiga)).slice(0, 40) };
      ordine.push(n);
    }
    if (k.generale) n.tipo = 'generale';
    if (k.passoInizio >= 0) { n.tipo = 'passo'; n.passi.push(pulisciPasso(k.passo)); }
    if (!k.continua) n.nota = k.nota;
  });
  return ordine;
}

function togliNote(testo) {
  var modifiche = [];
  trovaMarcatori(testo).forEach(function (k) {
    if (k.passoInizio >= 0) { modifiche.push({ da: k.passoInizio, a: k.fine, testo: k.passo }); return; }
    var da = k.inizio, a = k.fine;
    var inizioRiga = testo.lastIndexOf('\n', da - 1) + 1;
    var fineRiga = testo.indexOf('\n', a);
    if (fineRiga < 0) fineRiga = testo.length;
    if (da === inizioRiga && a === fineRiga) {
      var tolte = 0;
      while (a < testo.length && testo[a] === '\n' && tolte < 2) { a++; tolte++; }
    }
    modifiche.push({ da: da, a: a, testo: '' });
  });
  modifiche.sort(function (x, y) { return y.da - x.da; });
  modifiche.forEach(function (c) { testo = testo.slice(0, c.da) + c.testo + testo.slice(c.a); });
  return testo;
}

/* ---------- confronto parola per parola ---------- */

// Una "parola" è: un collegamento intero, un cambio di capoverso, un a capo, o una parola.
function parole(testo) {
  var out = [], m;
  var re = /([ \t]*)(\[\[[^\]]*\]\]|\n[ \t]*\n\s*|\n|(?:(?!\[\[)\S)+)/g;
  while ((m = re.exec(testo))) {
    var x = m[2];
    if (/^\n[ \t]*\n/.test(x)) x = '¶';
    else if (x === '\n') x = '↵';
    out.push({ t: x, sp: m[1].length > 0 });
  }
  return out;
}

function confronta(a, b) {
  var p = 0;
  while (p < a.length && p < b.length && a[p].t === b[p].t) p++;
  var s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s].t === b[b.length - 1 - s].t) s++;
  var A = a.slice(p, a.length - s), B = b.slice(p, b.length - s);
  var n = A.length, m = B.length, W = m + 1, i, j;
  var L = new Uint32Array((n + 1) * W);
  for (i = n - 1; i >= 0; i--) {
    for (j = m - 1; j >= 0; j--) {
      L[i * W + j] = A[i].t === B[j].t ? L[(i + 1) * W + j + 1] + 1
                                       : Math.max(L[(i + 1) * W + j], L[i * W + j + 1]);
    }
  }
  var ops = [];
  for (i = 0; i < p; i++) ops.push({ op: '=', k: b[i] });
  i = 0; j = 0;
  while (i < n && j < m) {
    if (A[i].t === B[j].t) { ops.push({ op: '=', k: B[j] }); i++; j++; }
    else if (L[(i + 1) * W + j] >= L[i * W + j + 1]) { ops.push({ op: '-', k: A[i] }); i++; }
    else { ops.push({ op: '+', k: B[j] }); j++; }
  }
  while (i < n) ops.push({ op: '-', k: A[i++] });
  while (j < m) ops.push({ op: '+', k: B[j++] });
  for (i = b.length - s; i < b.length; i++) ops.push({ op: '=', k: b[i] });
  return ops;
}

var DEL = '<del style="background:rgba(220,60,50,.24);">';
var INS = '<ins style="background:rgba(60,170,90,.28);text-decoration:none;">';

function aCapo(t) { return t === '¶' ? '\n\n' : (t === '↵' ? '\n' : null); }
function innocuo(t) { return t.replace(/%%/g, '&#37;&#37;').replace(/==/g, '&#61;&#61;'); }

function eCollegamento(t) { return /^\[\[[^\]]*\]\]$/.test(t); }
function testoVisibile(t) {
  if (!eCollegamento(t)) return t;
  var x = t.slice(2, -2), i = x.indexOf('|');
  return i >= 0 ? x.slice(i + 1) : x;
}

function mostra(ops) {
  var out = '', tolte = [], aggiunte = [];
  function scarica() {
    // Dentro <del> e <ins> Obsidian non rende cliccabili i collegamenti.
    // Un collegamento tolto diventa il suo testo visibile, barrato; uno aggiunto resta
    // fuori dal verde, cliccabile.
    if (tolte.length) {
      out += (tolte[0].sp ? ' ' : '') + DEL;
      tolte.forEach(function (k, i) {
        var c = aCapo(k.t);
        out += (i && (k.sp || c) ? ' ' : '') + (c ? k.t : innocuo(testoVisibile(k.t)));
      });
      out += '</del>';
    }
    var aperto = false, primo = true;
    aggiunte.forEach(function (k) {
      var c = aCapo(k.t);
      if (c) { if (aperto) { out += '</ins>'; aperto = false; } out += c; primo = false; return; }
      if (eCollegamento(k.t)) {
        if (aperto) { out += '</ins>'; aperto = false; }
        out += ((k.sp || (primo && tolte.length)) ? ' ' : '') + k.t;
        primo = false;
        return;
      }
      if (!aperto) { out += ((k.sp || (primo && tolte.length)) ? ' ' : '') + INS; aperto = true; }
      else out += (k.sp ? ' ' : '');
      out += innocuo(k.t);
      primo = false;
    });
    if (aperto) out += '</ins>';
    tolte = []; aggiunte = [];
  }
  ops.forEach(function (o) {
    if (o.op === '-') { tolte.push(o.k); return; }
    if (o.op === '+') { aggiunte.push(o.k); return; }
    scarica();
    var c = aCapo(o.k.t);
    out += c ? c : (o.k.sp ? ' ' : '') + o.k.t;
  });
  scarica();
  return out;
}

/* ---------- PDF ---------- */

function esegui(cmd, args, opz) {
  // I messaggi di servizio di pdftotext e pdfinfo («Syntax Warning») non si mostrano.
  const zitti = (cmd === 'pdftotext' || cmd === 'pdfinfo') ? { stdio: ['ignore', 'pipe', 'ignore'] } : {};
  return execFileSync(cmd, args, Object.assign({ encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }, zitti, opz || {}));
}

function infoPagine(percorso, da, a) {
  const testo = esegui('pdfinfo', ['-box', '-f', String(da), '-l', String(a), percorso]);
  const tot = +(testo.match(/^Pages:\s+(\d+)/m) || [0, 0])[1];
  const pag = {};
  testo.split('\n').forEach(function (r) {
    let m = r.match(/^Page\s+(\d+)\s+MediaBox:\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/);
    if (m) { pag[m[1]] = pag[m[1]] || {}; pag[m[1]].box = [+m[2], +m[3], +m[4], +m[5]]; }
    m = r.match(/^Page\s+(\d+)\s+rot:\s+(-?\d+)/);
    if (m) { pag[m[1]] = pag[m[1]] || {}; pag[m[1]].rot = ((+m[2] % 360) + 360) % 360; }
  });
  return { tot: tot, pag: pag };
}

function pagine(percorso, da, a) {
  const info = infoPagine(percorso, 1, 1);
  const out = [L('pagine totali: ', 'total pages: ') + info.tot];
  for (let i = da; i <= a && i <= info.tot; i++) {
    const s = esegui('pdftotext', ['-f', String(i), '-l', String(i), '-enc', 'UTF-8', percorso, '-']).replace(/\f$/, '');
    out.push(L('=== PAGINA PDF ', '=== PDF PAGE ') + i + ' (' + s.length + L(' caratteri) ===\n', ' characters) ===\n') + s);
  }
  return out.join('\n');
}

const DPI = 200;

function lingue() {
  const l = esegui('tesseract', ['--list-langs'], { stdio: ['ignore', 'pipe', 'pipe'] }).split('\n').map(function (x) { return x.trim(); });
  return ['ita', 'eng', 'fra'].filter(function (x) { return l.indexOf(x) >= 0; }).join('+') || 'eng';
}

// Legge il testo di pagine senza testo selezionabile. Con i riquadri stampa,
// prima di ogni riga, la sua posizione nella pagina (sinistra,basso,destra,alto
// in punti del PDF), che serve per i collegamenti con "rect".
function riconosci(percorso, da, a, conRiquadri) {
  const info = infoPagine(percorso, da, a);
  const lang = lingue();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'revisione-'));
  const out = [L('pagine totali: ', 'total pages: ') + info.tot + L(' (lingue del riconoscimento: ', ' (OCR languages: ') + lang + ')'];
  try {
    for (let i = da; i <= a && i <= info.tot; i++) {
      const p = info.pag[String(i)] || { box: [0, 0, 612, 792], rot: 0 };
      const x0 = p.box[0], y0 = p.box[1], w = p.box[2] - p.box[0], hh = p.box[3] - p.box[1];
      const giro = p.rot || 0;
      const larg = (giro % 180) ? hh : w;   // misure della pagina come si vede
      const alt = (giro % 180) ? w : hh;
      const pre = path.join(tmp, 'p' + i);
      esegui('pdftoppm', ['-r', String(DPI), '-gray', '-f', String(i), '-l', String(i), '-singlefile', '-png', percorso, pre]);
      const png = pre + '.png';
      const env = Object.assign({}, process.env, { OMP_THREAD_LIMIT: '1' });
      let righe = [];
      if (!conRiquadri) {
        righe = esegui('tesseract', [png, 'stdout', '-l', lang, '--psm', '3'], { env: env, stdio: ['ignore', 'pipe', 'ignore'] })
          .split('\n').filter(function (r) { return r.trim(); });
      } else {
        const tsv = esegui('tesseract', [png, 'stdout', '-l', lang, '--psm', '3', 'tsv'], { env: env, stdio: ['ignore', 'pipe', 'ignore'] });
        const perRiga = new Map();
        tsv.split('\n').slice(1).forEach(function (r) {
          const c = r.split('\t');
          if (c.length < 12 || c[0] !== '5' || !c[11].trim()) return;
          const k = c[2] + '.' + c[3] + '.' + c[4];
          const L = +c[6], T = +c[7], W = +c[8], H = +c[9];
          let g = perRiga.get(k);
          if (!g) { g = { l: L, t: T, r: L + W, b: T + H, parole: [] }; perRiga.set(k, g); }
          g.l = Math.min(g.l, L); g.t = Math.min(g.t, T); g.r = Math.max(g.r, L + W); g.b = Math.max(g.b, T + H);
          g.parole.push(c[11]);
        });
        const k = 72 / DPI;
        perRiga.forEach(function (g) {
          // posizione sulla pagina come si vede, in punti, dal basso a sinistra
          const X1 = g.l * k, X2 = g.r * k, Y1 = alt - g.b * k, Y2 = alt - g.t * k;
          let a1, a2;
          if (giro === 90) { a1 = [w - Y2, X1]; a2 = [w - Y1, X2]; }
          else if (giro === 180) { a1 = [w - X2, hh - Y2]; a2 = [w - X1, hh - Y1]; }
          else if (giro === 270) { a1 = [Y1, hh - X2]; a2 = [Y2, hh - X1]; }
          else { a1 = [X1, Y1]; a2 = [X2, Y2]; }
          const sx = Math.round(x0 + a1[0]), gi = Math.round(y0 + a1[1]);
          const dx = Math.round(x0 + a2[0]), su = Math.round(y0 + a2[1]);
          righe.push(sx + ',' + gi + ',' + dx + ',' + su + ' | ' + g.parole.join(' '));
        });
      }
      fs.unlinkSync(png);
      out.push(L('=== PAGINA PDF ', '=== PDF PAGE ') + i + ' (' + Math.round(w) + ' x ' + Math.round(hh) + L(' punti, rotazione ', ' points, rotation ') + giro + ', ' + righe.length + L(' righe riconosciute) ===\n', ' lines recognised) ===\n') + righe.join('\n'));
    }
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* cartella temporanea */ }
  }
  return out.join('\n');
}

/* ---------- controlli di sicurezza ---------- */

function impronta(file) {
  return file.map(function (f) {
    const st = fs.statSync(f);
    const md5 = crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');
    return st.size + ' byte | ' + new Date(st.mtimeMs).toISOString() + ' | ' + md5 + ' | ' + path.basename(f);
  }).join('\n');
}

const VIETATI_NOME = /[#|\[\]^]/;
const VIETATI_PASSO = /[&#|\[\]^]|%%/;

function tuttiIPdf(dir) {
  const out = [];
  (function giro(d) {
    let voci = [];
    try { voci = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    voci.forEach(function (v) {
      const p = path.join(d, v.name);
      if (v.isDirectory()) { if (v.name[0] !== '.') giro(p); }
      else if (/\.pdf$/i.test(v.name)) out.push(p);
    });
  })(dir);
  return out;
}

function controllaNome(file, cartella) {
  const nome = path.basename(file);
  const r = [L('file: ', 'file: ') + nome];
  const bad = nome.match(new RegExp(VIETATI_NOME.source, 'g'));
  if (bad) r.push(L('ATTENZIONE: il nome contiene caratteri che i collegamenti di Obsidian non accettano (', 'WARNING: the name contains characters that Obsidian links do not accept (') + Array.from(new Set(bad)).join(' ') + L('). Serve un altro tipo di collegamento: non rinominare il file.', '). A different kind of link is needed: do not rename the file.'));
  else r.push(L('nome: va bene per un collegamento.', 'name: fine for a link.'));
  if (cartella) {
    const doppi = tuttiIPdf(cartella).filter(function (p) { return path.basename(p) === nome; });
    if (doppi.length > 1) {
      r.push(L('ATTENZIONE: nome doppio, ', 'WARNING: duplicate name, ') + doppi.length + L(' file con lo stesso nome. Nel collegamento scrivi anche la cartella:', ' files with the same name. Write the folder in the link as well:'));
      doppi.forEach(function (p) { r.push('   ' + path.relative(cartella, p)); });
    } else r.push(L('doppi: nessuno.', 'duplicates: none.'));
  }
  return r.join('\n');
}

function controllaPasso(s) {
  if (!VIETATI_PASSO.test(s)) return L('parole del passo: vanno bene.', 'words of the passage: fine.');
  const pezzi = s.split(/[&#|\[\]^]|%%/).map(function (x) { return x.trim(); }).filter(Boolean)
    .sort(function (x, y) { return y.length - x.length; });
  return L('ATTENZIONE: le parole contengono caratteri che rompono il collegamento (& # | [ ] ^ %%).\n', 'WARNING: the words contain characters that break the link (& # | [ ] ^ %%).\n') +
    L('Usa per la ricerca un tratto senza questi caratteri, per esempio:\n   ', 'Search for a stretch without these characters, for example:\n   ') + (pezzi[0] || L('(nessun tratto utile)', '(no usable stretch)'));
}

/* ---------- controllo dei collegamenti ---------- */

function radiceVault(file) {
  let d = path.dirname(path.resolve(file));
  for (;;) {
    if (fs.existsSync(path.join(d, '.obsidian'))) return d;
    const su = path.dirname(d);
    if (su === d) throw new Error(L('Non trovo la cartella del vault (.obsidian) sopra ', 'Cannot find the vault folder (.obsidian) above ') + file);
    d = su;
  }
}

// Forma "sciolta" per confrontare le parole cercate con il testo della pagina:
// maiuscole, legature, virgolette, trattini, a capo e spazi non contano.
function sciolto(s) {
  return s.normalize('NFKC').toLowerCase()
    .replace(/[‘’‛′`´]/g, "'")
    .replace(/[“”„«»″]/g, '"')
    .replace(/[\s­\-‐‑‒–—]/g, '');
}

// Il file di un collegamento a libri/. In libri/ ci possono essere i PDF stessi o
// collegamenti simbolici ai PDF. Se un collegamento simbolico non si apre da qui
// (per esempio perché la shell vede la cartella dei libri in un altro percorso),
// si cerca il resto del percorso dentro la cartella dei libri indicata.
function percorsoLibro(radice, bersaglio, cartellaLibri) {
  const p = path.join(radice, bersaglio);
  let st;
  try { st = fs.lstatSync(p); } catch (e) { return { errore: L('in libri/ non c\'è ', 'libri/ has no ') + path.basename(bersaglio) }; }
  if (!st.isSymbolicLink()) return { file: p };
  if (fs.existsSync(p)) return { file: fs.realpathSync(p) };
  const dest = fs.readlinkSync(p);
  if (!cartellaLibri) return { errore: L('il collegamento non si apre: ', 'the link does not open: ') + dest + L(' (indica la cartella dei libri)', ' (give the books folder)') };
  const nome = path.basename(path.resolve(cartellaLibri));
  const i = dest.indexOf('/' + nome + '/');
  if (i < 0) return { errore: L('il collegamento punta fuori dalla cartella dei libri: ', 'the link points outside the books folder: ') + dest };
  const vero = path.join(cartellaLibri, dest.slice(i + nome.length + 2));
  if (!fs.existsSync(vero)) return { errore: L('il libro non si trova più: ', 'the book is no longer there: ') + dest };
  return { file: vero };
}

function controllaCollegamenti(file, cartellaLibri) {
  cartellaLibri = cartellaLibri || process.env.REVISIONE_LIBRI || '';
  const testo = leggi(file);
  const radice = radiceVault(file);
  const zone = [];
  const reZ = /<(del|ins)\b[^>]*>[\s\S]*?<\/\1>/g;
  let z;
  while ((z = reZ.exec(testo))) zone.push([z.index, z.index + z[0].length]);
  const cache = {};
  const problemi = [], avvisi = [];
  const re = /\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g;
  let m, n = 0;
  while ((m = re.exec(testo))) {
    const bersaglio = m[1];
    if (!/^libri\//.test(bersaglio)) continue;
    n++;
    const pos = m.index;
    const dove = L('riga ', 'line ') + testo.slice(0, pos).split('\n').length + ', «' + (m[2] || bersaglio).slice(0, 60) + '»';
    if (zone.some(function (q) { return pos >= q[0] && pos < q[1]; })) problemi.push(dove + L(': sta dentro i colori, in Obsidian non si clicca', ': it is inside the colours, Obsidian will not open it'));
    const h = bersaglio.indexOf('#');
    const nomeFile = h >= 0 ? bersaglio.slice(0, h) : bersaglio;
    const param = {};
    (h >= 0 ? bersaglio.slice(h + 1) : '').split('&').forEach(function (kv) {
      const j = kv.indexOf('=');
      if (j > 0) param[kv.slice(0, j)] = kv.slice(j + 1);
    });
    const lib = percorsoLibro(radice, nomeFile, cartellaLibri);
    if (lib.errore) { problemi.push(dove + ': ' + lib.errore); continue; }
    if (!/\.pdf$/i.test(lib.file)) continue;
    if (!param.page) { avvisi.push(dove + L(': senza numero di pagina', ': no page number')); continue; }
    const k = lib.file, pag = parseInt(param.page, 10);
    if (!cache[k]) cache[k] = { tot: infoPagine(k, 1, 1).tot, pagine: {} };
    if (!(pag >= 1 && pag <= cache[k].tot)) { problemi.push(dove + L(': la pagina ', ': page ') + pag + L(' non esiste (il file ha ', ' does not exist (the file has ') + cache[k].tot + L(' pagine)', ' pages)')); continue; }
    if (param.search === undefined) continue;
    let cerca = param.search;
    try { cerca = decodeURIComponent(cerca); } catch (e) { /* lascia com'è */ }
    if (VIETATI_PASSO.test(cerca)) problemi.push(dove + L(': le parole cercate contengono caratteri che rompono il collegamento', ': the searched words contain characters that break the link'));
    const testoPag = function (p) {
      if (cache[k].pagine[p] === undefined) {
        cache[k].pagine[p] = sciolto(esegui('pdftotext', ['-f', String(p), '-l', String(p), '-enc', 'UTF-8', k, '-']));
      }
      return cache[k].pagine[p];
    };
    const s = sciolto(cerca);
    const tp = testoPag(pag);
    if (tp.length < 20) { avvisi.push(dove + L(': la pagina ', ': page ') + pag + L(' non ha testo (scansione), parole non controllabili', ' has no text (scan), words cannot be checked')); continue; }
    if (tp.indexOf(s) >= 0) continue;
    let altrove = null;
    [pag - 1, pag + 1, pag - 2, pag + 2].some(function (q) {
      if (q >= 1 && q <= cache[k].tot && testoPag(q).indexOf(s) >= 0) { altrove = q; return true; }
      return false;
    });
    problemi.push(dove + L(': le parole «', ': the words «') + cerca + L('» non sono a pagina ', '» are not on page ') + pag + (altrove ? L(' (sono a pagina ', ' (they are on page ') + altrove + ')' : ''));
  }
  const r = [L('Collegamenti ai libri: ', 'Links to books: ') + n + '. ' + (problemi.length ? problemi.length + L(' da correggere:', ' to fix:') : L('Tutti a posto.', 'All fine.'))];
  problemi.forEach(function (x) { r.push('  - ' + x); });
  if (avvisi.length) { r.push(L('Da sapere:', 'Note:')); avvisi.forEach(function (x) { r.push('  - ' + x); }); }
  return r.join('\n');
}

/* ---------- copia Word del testo approvato ---------- */

function parentesiChiusa(testo, da) {
  let liv = 0;
  for (let i = da; i < testo.length; i++) {
    if (testo[i] === '[') liv++;
    else if (testo[i] === ']') { liv--; if (liv === 0) return i; }
  }
  return -1;
}

function soloTestoVisibile(s) {
  return s
    .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2')
    .replace(/\[\[([^\]]*)\]\]/g, function (_, t) { return path.basename(t.split('#')[0]).replace(/\.md$/, ''); });
}

function perWord(testo) {
  let t = togliNote(testo);
  t = t.replace(/%%[\s\S]*?%%[ \t]*\n?/g, '');
  t = t.replace(/<del\b[^>]*>[\s\S]*?<\/del>/g, '').replace(/<\/?ins\b[^>]*>/g, '');
  t = t.replace(/==/g, '');
  const note = [];
  const re = /\[(?:possibile nota|possible note):\s*/gi;
  let out = '', i = 0, m;
  while ((m = re.exec(t))) {
    const fine = parentesiChiusa(t, m.index);
    if (fine < 0) break;
    note.push(soloTestoVisibile(t.slice(m.index + m[0].length, fine)).replace(/\s+/g, ' ').trim());
    out += t.slice(i, m.index).replace(/[ \t]+$/, '') + '[^' + note.length + ']';
    i = fine + 1;
    re.lastIndex = i;
  }
  out += t.slice(i);
  out = soloTestoVisibile(out).replace(/\n{3,}/g, '\n\n').trim() + '\n';
  if (note.length) out += '\n' + note.map(function (x, k) { return '[^' + (k + 1) + ']: ' + x; }).join('\n') + '\n';
  return { md: out, note: note.length, daVerificare: (out.match(/\[(?:da verificare|to be checked)\]/gi) || []).length };
}

function copiaWord(file, uscita, modello) {
  if (!uscita || !/\.docx$/i.test(uscita)) throw new Error(L('Indica il file Word di uscita (.docx).', 'Give the output Word file (.docx).'));
  const r = perWord(leggi(file));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copia-word-'));
  const md = path.join(tmp, 'testo.md'), docx = path.join(tmp, 'testo.docx');
  fs.writeFileSync(md, r.md);
  const args = ['-f', 'markdown-smart-citations-auto_identifiers', '-t', 'docx', '--wrap=none', '-o', docx, md];
  if (modello) args.push('--reference-doc=' + modello);
  esegui('pandoc', args);
  fs.copyFileSync(docx, uscita);
  return L('Copia Word scritta: ', 'Word copy written: ') + uscita + L('\nNote a piè di pagina: ', '\nFootnotes: ') + r.note +
    (r.daVerificare ? L('\nATTENZIONE: nel testo restano ', '\nWARNING: the text still has ') + r.daVerificare + L(' «[da verificare]».', ' «[to be checked]».') : '');
}

/* ---------- comandi ---------- */

function run(argv) {
  const cosa = argv[0];
  if (cosa === 'note') {
    const note = elencoNote(leggi(argv[1]));
    if (!note.length) return L('Nessuna nota.', 'No notes.');
    return note.map(function (n, i) {
      let r = (i + 1) + '. [' + n.tipo + '] id ' + n.id + L('\n   capoverso: ', '\n   paragraph: ') + n.capoverso;
      if (n.tipo === 'passo') r += L('\n   passo: ', '\n   passage: ') + n.passi.join(' […] ');
      if (n.tipo === 'punto') r += L('\n   punto: …', '\n   point: …') + n.prima + ' ▮ ' + n.dopo + '…';
      return r + L('\n   nota: ', '\n   note: ') + n.nota;
    }).join('\n');
  }
  if (cosa === 'pulisci') return togliNote(leggi(argv[1]));
  if (cosa === 'confronta') {
    return mostra(confronta(parole(togliNote(leggi(argv[1]))), parole(togliNote(leggi(argv[2])))));
  }
  if (cosa === 'pdf') return pagine(argv[1], parseInt(argv[2], 10), parseInt(argv[3] || argv[2], 10));
  if (cosa === 'scansione' || cosa === 'riquadri') {
    return riconosci(argv[1], parseInt(argv[2], 10), parseInt(argv[3] || argv[2], 10), cosa === 'riquadri');
  }
  if (cosa === 'impronta') return impronta(argv.slice(1));
  if (cosa === 'nome') return controllaNome(argv[1], argv[2]);
  if (cosa === 'passo') return controllaPasso(argv.slice(1).join(' '));
  if (cosa === 'collegamenti') return controllaCollegamenti(argv[1], argv[2]);
  if (cosa === 'word') return copiaWord(argv[1], argv[2], argv[3]);
  if (cosa === 'word-anteprima') return perWord(leggi(argv[1])).md;
  return L('Comandi: ', 'Commands: ') + 'note, pulisci, confronta, pdf, scansione, riquadri, impronta, nome, passo, collegamenti, word, word-anteprima. ' + L('Vedi le istruzioni in cima al file.', 'See the instructions at the top of the file.');
}

if (require.main === module) {
  try { process.stdout.write(run(process.argv.slice(2)) + '\n'); }
  catch (e) { process.stderr.write(e.message + '\n'); process.exit(1); }
}
module.exports = { run: run, elencoNote: elencoNote, togliNote: togliNote, parole: parole, confronta: confronta, mostra: mostra };
