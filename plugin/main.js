'use strict';
/*
 * Revisione testi (Obsidian plugin)
 *
 * EN: adds "Comment", "Note at this point" and "Note on the whole text" to the
 * editor context menu, and a side panel listing the notes of the open file.
 * IT: aggiunge al clic destro le voci "Commenta", "Nota in questo punto" e
 * "Nota sul testo intero", e un pannello laterale con le note del file.
 *
 * Notes are stored inside the Markdown file itself, as Obsidian comments:
 *   note on a passage:       ==the passage==%%NOTA 1731543212345 | the note%%
 *   note at a point:         %%NOTA 1731543212345 | the note%%
 *   note on the whole text:  %%NOTA 1731543212345 G | the note%%  (top of file)
 * A passage spanning several paragraphs is split into pieces: the first ones
 * end with %%NOTA id +%%, the last one carries the text of the note.
 *
 * The plugin reads and writes only the file you are working on, never other
 * files, and never connects to the internet.
 * The interface follows Obsidian's language: Italian if Obsidian is in
 * Italian, English otherwise.
 */

const obsidian = require('obsidian');
const { Plugin, ItemView, Modal, Notice, MarkdownView } = obsidian;

// Parti dell'editor di Obsidian, servono solo a disegnare il segno numerato.
let cmView = null;
let cmState = null;
try {
  cmView = require('@codemirror/view');
  cmState = require('@codemirror/state');
} catch (e) {
  cmView = null;
  cmState = null;
}

const VISTA = 'revisione-testi-pannello';
const RE_NOTA = /%%NOTA (\d+)( G)?(?: \+| \| ([\s\S]*?))%%/g;
const RE_BLOCCHI = /\[\[[^\]]*\]\]|%%[\s\S]*?%%|\[[^\]]*\]\([^)]*\)/g;
const RE_INIZIO_RIGA = /^(\s*(#{1,6} |> ?|[-*+] |\d+[.)] ))+/;

/* ---------- testi dell'interfaccia (italiano e inglese) ---------- */

const TESTI = {
  it: {
    notaSulTesto: 'Nota sul testo intero',
    notaSulTestoIcona: '✎ Nota sul testo intero',
    segnoGenerale: function (n) { return '✎ ' + n + ' · nota sul testo intero'; },
    clicModifica: '(clic per modificare)',
    scriviNota: 'Scrivi la nota',
    annulla: 'Annulla',
    salva: 'Salva',
    aiuto: 'Esc chiude senza salvare. Cmd/Ctrl + Invio salva.',
    notaVuota: 'La nota è vuota.',
    titoloPannello: 'Note di revisione',
    apriUnTesto: 'Apri un testo per vedere le sue note.',
    conta: function (n) { return n === 1 ? '1 nota' : n + ' note'; },
    nessunaNota: 'Nessuna nota. Nel testo: clic destro su un passo selezionato, poi «Commenta».',
    passo: 'Passo',
    punto: 'Punto',
    generale: 'Testo intero',
    vai: 'Vai al punto',
    modifica: 'Modifica',
    elimina: 'Elimina',
    segniNonDisponibili: 'Revisione testi: segni numerati non disponibili',
    cmdPannello: 'Apri il pannello delle note',
    cmdCommenta: 'Commenta il passo selezionato o il punto',
    menuCommenta: '✎ Commenta',
    menuPunto: '✎ Nota in questo punto',
    selezionaPasso: 'Seleziona un passo del testo.',
    passoOccupato: 'Questo passo contiene già una nota o un\'evidenziazione. Per aggiungerne un\'altra usa «Nota in questo punto» subito dopo il passo.',
    commentaPasso: 'Commenta il passo',
    attaccata: 'Qui la nota finirebbe attaccata a un\'evidenziazione e verrebbe letta come nota sul passo. Metti il cursore dopo uno spazio.',
    notaPunto: 'Nota in questo punto',
    apriPrima: 'Apri prima il testo in una scheda.',
    nonTrovo: 'Non trovo più questa nota nel testo.',
    modificaGenerale: 'Modifica la nota sul testo intero',
    modificaNota: 'Modifica la nota',
    nonModificata: 'Non sono riuscito a modificare la nota: il testo è rimasto com\'era.'
  },
  en: {
    notaSulTesto: 'Note on the whole text',
    notaSulTestoIcona: '✎ Note on the whole text',
    segnoGenerale: function (n) { return '✎ ' + n + ' · note on the whole text'; },
    clicModifica: '(click to edit)',
    scriviNota: 'Write the note',
    annulla: 'Cancel',
    salva: 'Save',
    aiuto: 'Esc closes without saving. Cmd/Ctrl + Enter saves.',
    notaVuota: 'The note is empty.',
    titoloPannello: 'Review notes',
    apriUnTesto: 'Open a text to see its notes.',
    conta: function (n) { return n === 1 ? '1 note' : n + ' notes'; },
    nessunaNota: 'No notes yet. In the text: select a passage, right-click, then "Comment".',
    passo: 'Passage',
    punto: 'Point',
    generale: 'Whole text',
    vai: 'Go to',
    modifica: 'Edit',
    elimina: 'Delete',
    segniNonDisponibili: 'Revisione testi: numbered markers not available',
    cmdPannello: 'Open the notes panel',
    cmdCommenta: 'Comment on the selected passage or at the cursor',
    menuCommenta: '✎ Comment',
    menuPunto: '✎ Note at this point',
    selezionaPasso: 'Select a passage of the text.',
    passoOccupato: 'This passage already contains a note or a highlight. To add another note, use "Note at this point" right after the passage.',
    commentaPasso: 'Comment on the passage',
    attaccata: 'Here the note would stick to a highlight and be read as a note on the passage. Place the cursor after a space.',
    notaPunto: 'Note at this point',
    apriPrima: 'Open the text in a tab first.',
    nonTrovo: 'This note is no longer in the text.',
    modificaGenerale: 'Edit the note on the whole text',
    modificaNota: 'Edit the note',
    nonModificata: 'Could not edit the note: the text is unchanged.'
  }
};

// La lingua di Obsidian: italiano se Obsidian è in italiano, altrimenti inglese.
let lingua = null;
function linguaAttiva() {
  if (lingua) return lingua;
  let l = '';
  try {
    if (typeof obsidian.getLanguage === 'function') l = obsidian.getLanguage() || '';
    else if (typeof window !== 'undefined' && window.localStorage) l = window.localStorage.getItem('language') || '';
  } catch (e) {
    l = '';
  }
  lingua = String(l).toLowerCase().indexOf('it') === 0 ? 'it' : 'en';
  return lingua;
}

function t(chiave) {
  const v = TESTI[linguaAttiva()][chiave];
  if (typeof v === 'function') return v.apply(null, Array.prototype.slice.call(arguments, 1));
  return v;
}

/* ---------- funzioni sul testo (senza Obsidian) ---------- */

// Toglie note, collegamenti ed evidenziazioni e lascia il testo come si legge.
function pulisci(s) {
  return s
    .replace(/%%[\s\S]*?%%/g, '')
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/==/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Trova ogni segno di nota nel testo, con il passo evidenziato che lo precede.
function trovaMarcatori(testo) {
  const out = [];
  RE_NOTA.lastIndex = 0;
  let m;
  while ((m = RE_NOTA.exec(testo))) {
    const inizio = m.index;
    const fine = inizio + m[0].length;
    const r = {
      id: m[1],
      generale: !!m[2],
      continua: m[3] === undefined,
      nota: m[3] || '',
      inizio: inizio,
      fine: fine,
      passoInizio: -1,
      passo: ''
    };
    if (inizio >= 4 && testo.slice(inizio - 2, inizio) === '==') {
      const inizioRiga = testo.lastIndexOf('\n', inizio - 1) + 1;
      const apre = testo.lastIndexOf('==', inizio - 4);
      if (apre >= inizioRiga) {
        r.passoInizio = apre;
        r.passo = testo.slice(apre + 2, inizio - 2);
      }
    }
    out.push(r);
  }
  return out;
}

// Elenco delle note, una per identificatore, nell'ordine in cui compaiono.
function elencoNote(testo) {
  const per = new Map();
  for (const k of trovaMarcatori(testo)) {
    let n = per.get(k.id);
    if (!n) {
      const inizioRiga = testo.lastIndexOf('\n', k.inizio - 1) + 1;
      let fineRiga = testo.indexOf('\n', k.fine);
      if (fineRiga < 0) fineRiga = testo.length;
      n = {
        id: k.id,
        tipo: 'punto',
        passi: [],
        nota: '',
        posizione: k.passoInizio >= 0 ? k.passoInizio : k.inizio,
        prima: pulisci(testo.slice(inizioRiga, k.inizio)).slice(-40),
        dopo: pulisci(testo.slice(k.fine, fineRiga)).slice(0, 40)
      };
      per.set(k.id, n);
    }
    if (k.generale) n.tipo = 'generale';
    if (k.passoInizio >= 0) {
      n.tipo = 'passo';
      n.passi.push(pulisci(k.passo));
    }
    if (!k.continua) n.nota = k.nota;
  }
  return Array.from(per.values());
}

// Le modifiche da fare per togliere una nota (il passo resta, senza segni).
function modificheElimina(testo, id) {
  const out = [];
  for (const k of trovaMarcatori(testo)) {
    if (k.id !== id) continue;
    if (k.passoInizio >= 0) {
      out.push({ da: k.passoInizio, a: k.fine, testo: k.passo });
      continue;
    }
    const da = k.inizio;
    let a = k.fine;
    const inizioRiga = testo.lastIndexOf('\n', da - 1) + 1;
    let fineRiga = testo.indexOf('\n', a);
    if (fineRiga < 0) fineRiga = testo.length;
    if (da === inizioRiga && a === fineRiga) {
      // la nota occupa una riga intera: tolgo anche la riga vuota che segue
      let tolte = 0;
      while (a < testo.length && testo[a] === '\n' && tolte < 2) { a++; tolte++; }
    }
    out.push({ da: da, a: a, testo: '' });
  }
  return out;
}

// La modifica da fare per cambiare il testo di una nota: si riscrive solo il
// segno che porta il testo (l'ultimo pezzo), con lo stesso identificatore.
function modificaTestoNota(testo, id, nuovo) {
  const segni = trovaMarcatori(testo).filter(function (k) { return k.id === id && !k.continua; });
  if (segni.length !== 1) return null;
  const k = segni[0];
  return { da: k.inizio, a: k.fine, testo: '%%NOTA ' + id + (k.generale ? ' G' : '') + ' | ' + nuovo + '%%' };
}

function applica(testo, modifiche) {
  const ord = modifiche.slice().sort(function (x, y) { return y.da - x.da; });
  for (const c of ord) testo = testo.slice(0, c.da) + c.testo + testo.slice(c.a);
  return testo;
}

// Il testo della nota non può contenere a capo né il segno %%.
function ripulisciNota(s) {
  return s.replace(/\r?\n+/g, ' / ').replace(/%%/g, '% %').trim();
}

// Se la posizione cade dentro un collegamento o una nota, la sposta fuori.
function fuoriDaiBlocchi(riga, ch, lato) {
  RE_BLOCCHI.lastIndex = 0;
  let m;
  while ((m = RE_BLOCCHI.exec(riga))) {
    const da = m.index;
    const a = da + m[0].length;
    if (ch > da && ch < a) return lato === 'inizio' ? da : a;
  }
  return ch;
}

// Un clic a metà parola porta la nota all'inizio della parola.
function inizioParola(riga, ch) {
  const lettera = /[\p{L}\p{N}'’]/u;
  while (ch > 0 && ch < riga.length && lettera.test(riga[ch - 1]) && lettera.test(riga[ch])) ch--;
  return ch;
}

// Una nota su un punto attaccata a "==" verrebbe letta come nota sul passo
// evidenziato, e l'evidenziazione andrebbe persa quando si toglie la nota.
// Subito dopo la chiusura di un'evidenziazione: la nota va dopo lo spazio che segue,
// e se lo spazio non c'è si rinuncia (-1). Subito dopo l'apertura: la nota va prima.
function fuoriDalleEvidenziazioni(riga, ch) {
  if (ch < 2 || riga.slice(ch - 2, ch) !== '==') return ch;
  RE_BLOCCHI.lastIndex = 0;
  const senzaBlocchi = riga.slice(0, ch).replace(RE_BLOCCHI, function (m) { return ' '.repeat(m.length); });
  const segni = (senzaBlocchi.match(/==/g) || []).length;
  if (segni % 2 === 1) return ch - 2;
  // il primo spazio che segue, fuori da note e collegamenti
  let da = ch;
  for (;;) {
    const spazio = riga.indexOf(' ', da);
    if (spazio < 0) return -1;
    const fuori = fuoriDaiBlocchi(riga, spazio, 'fine');
    if (fuori === spazio) return spazio + 1;
    da = fuori;
  }
}

// I pezzi di un passo selezionato, uno per riga, senza spazi ai bordi.
function pezziDelPasso(righe, da, a) {
  // righe: funzione numero di riga -> testo; da, a: {line, ch}
  const pezzi = [];
  for (let l = da.line; l <= a.line; l++) {
    const riga = righe(l);
    let inizio = l === da.line ? da.ch : 0;
    let fine = l === a.line ? a.ch : riga.length;
    const testa = riga.match(RE_INIZIO_RIGA);
    if (testa && inizio < testa[0].length) inizio = testa[0].length;
    while (inizio < fine && /\s/.test(riga[inizio])) inizio++;
    while (fine > inizio && /\s/.test(riga[fine - 1])) fine--;
    if (fine > inizio) pezzi.push({ line: l, inizio: inizio, fine: fine, testo: riga.slice(inizio, fine) });
  }
  return pezzi;
}

/* ---------- segno numerato dentro il testo ---------- */

// Nella vista di modifica nasconde "%%NOTA numero | testo%%" e mostra al suo
// posto un piccolo segno con il numero della nota. Il file non cambia: cambia
// solo come lo si vede. Se qualcosa va storto, il testo si vede com'era prima.
function estensioneSegni(plugin) {
  if (!cmView || !cmState || !cmView.ViewPlugin || !cmView.Decoration || !cmView.WidgetType || !cmState.RangeSetBuilder) return null;
  const ViewPlugin = cmView.ViewPlugin;
  const Decoration = cmView.Decoration;
  const WidgetType = cmView.WidgetType;
  const EditorView = cmView.EditorView;
  const RangeSetBuilder = cmState.RangeSetBuilder;

  class Segno extends WidgetType {
    constructor(numero, nota, generale, id) {
      super();
      this.id = id;
      this.numero = numero;
      this.nota = nota;
      this.generale = generale;
    }
    eq(altro) {
      return altro.numero === this.numero && altro.nota === this.nota && altro.generale === this.generale && altro.id === this.id;
    }
    toDOM() {
      const s = document.createElement('span');
      s.className = 'cr-segno-nota' + (this.generale ? ' cr-segno-generale' : '');
      s.textContent = this.generale ? t('segnoGenerale', this.numero) : String(this.numero);
      if (this.nota) s.setAttribute('aria-label', this.nota + '\n' + t('clicModifica'));
      const id = this.id;
      s.addEventListener('mousedown', function (e) {
        e.preventDefault();
        plugin.apriPannello();
        plugin.modificaNelTestoAttivo(id);
      });
      return s;
    }
    ignoreEvent() { return false; }
  }

  function costruisci(view) {
    const b = new RangeSetBuilder();
    try {
      // solo nella vista di modifica "dal vivo", non in quella con i codici
      if (obsidian.editorLivePreviewField && !view.state.field(obsidian.editorLivePreviewField)) return b.finish();
      const marcatori = trovaMarcatori(view.state.doc.toString());
      const numeri = new Map();
      const note = new Map();
      for (const k of marcatori) {
        if (!numeri.has(k.id)) numeri.set(k.id, numeri.size + 1);
        if (!k.continua) note.set(k.id, k.nota);
      }
      for (const k of marcatori) {
        b.add(k.inizio, k.fine, Decoration.replace({
          widget: new Segno(numeri.get(k.id), note.get(k.id) || '', k.generale, k.id)
        }));
      }
    } catch (e) {
      return new RangeSetBuilder().finish();
    }
    return b.finish();
  }

  const estensione = ViewPlugin.fromClass(class {
    constructor(view) { this.decorations = costruisci(view); }
    update(u) {
      if (u.docChanged || u.viewportChanged || u.transactions.length) this.decorations = costruisci(u.view);
    }
  }, {
    decorations: function (v) { return v.decorations; },
    // il cursore salta il segno invece di finirci dentro
    provide: function (p) {
      return EditorView.atomicRanges.of(function (view) {
        const v = view.plugin(p);
        return v ? v.decorations : Decoration.none;
      });
    }
  });
  return estensione;
}

/* ---------- finestra per scrivere la nota ---------- */

class FinestraNota extends Modal {
  constructor(app, titolo, citazione, onSalva, iniziale) {
    super(app);
    this.titolo = titolo;
    this.citazione = citazione;
    this.onSalva = onSalva;
    this.iniziale = iniziale || '';
  }

  onOpen() {
    const self = this;
    this.titleEl.setText(this.titolo);
    const c = this.contentEl;
    c.addClass('cr-finestra');
    if (this.citazione) c.createEl('blockquote', { text: this.citazione, cls: 'cr-citazione' });
    const area = c.createEl('textarea', { cls: 'cr-area' });
    area.setAttr('rows', '5');
    area.setAttr('placeholder', t('scriviNota'));
    if (this.iniziale) area.value = this.iniziale;
    const riga = c.createDiv({ cls: 'cr-bottoni' });
    const annulla = riga.createEl('button', { text: t('annulla') });
    const salva = riga.createEl('button', { text: t('salva'), cls: 'mod-cta' });
    c.createEl('div', { text: t('aiuto'), cls: 'cr-aiuto' });

    function conferma() {
      const testo = ripulisciNota(area.value);
      if (!testo) { new Notice(t('notaVuota')); return; }
      self.close();
      self.onSalva(testo);
    }
    salva.addEventListener('click', conferma);
    annulla.addEventListener('click', function () { self.close(); });
    area.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); conferma(); }
    });
    window.setTimeout(function () {
      area.focus();
      area.setSelectionRange(area.value.length, area.value.length);
    }, 0);
  }

  onClose() {
    this.contentEl.empty();
  }
}

/* ---------- pannello laterale ---------- */

class PannelloNote extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.giro = 0;
  }

  getViewType() { return VISTA; }
  getDisplayText() { return t('titoloPannello'); }
  getIcon() { return 'message-square'; }

  async onOpen() { await this.aggiorna(); }

  async aggiorna() {
    const giro = ++this.giro;
    const plugin = this.plugin;
    const file = plugin.ultimoFile;
    let note = [];
    if (file) {
      const testo = await plugin.testoDi(file);
      if (giro !== this.giro) return;
      note = elencoNote(testo);
    }

    const c = this.contentEl;
    c.empty();
    c.addClass('cr-pannello');
    if (!file) {
      c.createEl('p', { text: t('apriUnTesto'), cls: 'cr-vuoto' });
      return;
    }

    const testa = c.createDiv({ cls: 'cr-testa' });
    testa.createEl('div', { text: file.basename, cls: 'cr-file' });
    testa.createEl('div', { text: t('conta', note.length), cls: 'cr-conta' });
    const nuova = c.createEl('button', { text: t('notaSulTestoIcona'), cls: 'cr-nuova' });
    nuova.addEventListener('click', function () { plugin.notaGeneraleSu(file); });

    if (!note.length) {
      c.createEl('p', {
        text: t('nessunaNota'),
        cls: 'cr-vuoto'
      });
      return;
    }

    const etichette = { passo: t('passo'), punto: t('punto'), generale: t('generale') };
    note.forEach(function (n, i) {
      const scheda = c.createDiv({ cls: 'cr-scheda cr-' + n.tipo });
      scheda.createEl('div', { text: (i + 1) + '. ' + etichette[n.tipo], cls: 'cr-tipo' });
      if (n.tipo === 'passo') {
        scheda.createEl('blockquote', { text: n.passi.join(' […] '), cls: 'cr-citazione' });
      } else if (n.tipo === 'punto') {
        const q = scheda.createEl('blockquote', { cls: 'cr-citazione' });
        q.createSpan({ text: n.prima ? '…' + n.prima + ' ' : '' });
        q.createSpan({ text: '▮', cls: 'cr-segno' });
        q.createSpan({ text: n.dopo ? ' ' + n.dopo + '…' : '' });
      }
      scheda.createEl('div', { text: n.nota, cls: 'cr-nota' });
      const azioni = scheda.createDiv({ cls: 'cr-azioni' });
      const vai = azioni.createEl('a', { text: t('vai') });
      vai.addEventListener('click', function () { plugin.vaiA(file, n.id); });
      const modifica = azioni.createEl('a', { text: t('modifica') });
      modifica.addEventListener('click', function () { plugin.modifica(file, n.id); });
      const elimina = azioni.createEl('a', { text: t('elimina'), cls: 'cr-elimina' });
      elimina.addEventListener('click', function () { plugin.elimina(file, n.id); });
    });
  }
}

/* ---------- plugin ---------- */

class RevisioneTesti extends Plugin {
  async onload() {
    const self = this;
    this.ultimoFile = null;

    this.registerView(VISTA, function (leaf) { return new PannelloNote(leaf, self); });
    this.addRibbonIcon('message-square', t('titoloPannello'), function () { self.apriPannello(); });

    try {
      const segni = estensioneSegni(this);
      if (segni) this.registerEditorExtension(segni);
    } catch (e) {
      console.error(t('segniNonDisponibili'), e);
    }

    this.addCommand({
      id: 'apri-pannello',
      name: t('cmdPannello'),
      callback: function () { self.apriPannello(); }
    });
    this.addCommand({
      id: 'commenta',
      name: t('cmdCommenta'),
      editorCallback: function (editor) { self.commenta(editor); }
    });
    this.addCommand({
      id: 'nota-generale',
      name: t('notaSulTesto'),
      editorCallback: function (editor) { self.notaGenerale(editor); }
    });

    this.registerEvent(this.app.workspace.on('editor-menu', function (menu, editor) {
      const selezione = editor.somethingSelected();
      menu.addItem(function (voce) {
        voce.setTitle(selezione ? t('menuCommenta') : t('menuPunto'))
          .setIcon('message-square')
          .onClick(function () { self.commenta(editor); });
      });
      menu.addItem(function (voce) {
        voce.setTitle(t('notaSulTestoIcona'))
          .setIcon('file-text')
          .onClick(function () { self.notaGenerale(editor); });
      });
    }));

    const aggiorna = obsidian.debounce(function () { self.aggiornaPannelli(); }, 300, true);
    const cambio = function () { self.ricordaFile(); aggiorna(); };
    this.registerEvent(this.app.workspace.on('editor-change', aggiorna));
    this.registerEvent(this.app.workspace.on('active-leaf-change', cambio));
    this.registerEvent(this.app.workspace.on('file-open', cambio));
    this.registerEvent(this.app.vault.on('modify', aggiorna));
    this.app.workspace.onLayoutReady(cambio);
  }

  // Il pannello mostra le note dell'ultimo testo su cui si è lavorato.
  ricordaFile() {
    const v = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (v && v.file) { this.ultimoFile = v.file; return; }
    if (this.ultimoFile) return;
    for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
      if (leaf.view && leaf.view.file) { this.ultimoFile = leaf.view.file; return; }
    }
  }

  aggiornaPannelli() {
    for (const leaf of this.app.workspace.getLeavesOfType(VISTA)) {
      if (leaf.view instanceof PannelloNote) leaf.view.aggiorna();
    }
  }

  async apriPannello() {
    const ws = this.app.workspace;
    let leaf = ws.getLeavesOfType(VISTA)[0];
    if (!leaf) {
      leaf = ws.getRightLeaf(false);
      await leaf.setViewState({ type: VISTA, active: true });
    }
    ws.revealLeaf(leaf);
  }

  // La scheda in cui il file è aperto, se c'è.
  schedaDi(file) {
    for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
      const v = leaf.view;
      if (v && v.file && v.file.path === file.path && v.editor) return leaf;
    }
    return null;
  }

  async testoDi(file) {
    const leaf = this.schedaDi(file);
    if (leaf) return leaf.view.editor.getValue();
    return await this.app.vault.cachedRead(file);
  }

  commenta(editor) {
    if (editor.somethingSelected()) this.commentaPasso(editor);
    else this.notaPunto(editor);
  }

  commentaPasso(editor) {
    const self = this;
    const da = editor.getCursor('from');
    const a = editor.getCursor('to');
    da.ch = fuoriDaiBlocchi(editor.getLine(da.line), da.ch, 'inizio');
    a.ch = fuoriDaiBlocchi(editor.getLine(a.line), a.ch, 'fine');
    const pezzi = pezziDelPasso(function (l) { return editor.getLine(l); }, da, a);
    if (!pezzi.length) { new Notice(t('selezionaPasso')); return; }
    for (const p of pezzi) {
      if (p.testo.indexOf('==') >= 0 || p.testo.indexOf('%%NOTA') >= 0) {
        new Notice(t('passoOccupato'), 8000);
        return;
      }
    }
    const citazione = pezzi.map(function (p) { return pulisci(p.testo); }).join(' […] ');
    new FinestraNota(this.app, t('commentaPasso'), citazione, function (testo) {
      const id = String(Date.now());
      const modifiche = [];
      pezzi.forEach(function (p, i) {
        const ultimo = i === pezzi.length - 1;
        const segno = ultimo ? '%%NOTA ' + id + ' | ' + testo + '%%' : '%%NOTA ' + id + ' +%%';
        modifiche.push({ from: { line: p.line, ch: p.inizio }, to: { line: p.line, ch: p.inizio }, text: '==' });
        modifiche.push({ from: { line: p.line, ch: p.fine }, to: { line: p.line, ch: p.fine }, text: '==' + segno });
      });
      editor.transaction({ changes: modifiche });
      self.dopoNuovaNota();
    }).open();
  }

  notaPunto(editor) {
    const self = this;
    const pos = editor.getCursor();
    const riga = editor.getLine(pos.line);
    let ch = fuoriDaiBlocchi(riga, pos.ch, 'inizio');
    ch = inizioParola(riga, ch);
    ch = fuoriDalleEvidenziazioni(riga, ch);
    if (ch < 0) {
      new Notice(t('attaccata'), 8000);
      return;
    }
    const prima = pulisci(riga.slice(0, ch)).slice(-40);
    const dopo = pulisci(riga.slice(ch)).slice(0, 40);
    const citazione = (prima ? '…' + prima + ' ' : '') + '▮' + (dopo ? ' ' + dopo + '…' : '');
    new FinestraNota(this.app, t('notaPunto'), citazione, function (testo) {
      const segno = '%%NOTA ' + Date.now() + ' | ' + testo + '%%';
      const dove = { line: pos.line, ch: ch };
      editor.replaceRange(segno, dove, dove);
      self.dopoNuovaNota();
    }).open();
  }

  notaGenerale(editor) {
    const self = this;
    new FinestraNota(this.app, t('notaSulTesto'), '', function (testo) {
      // in cima al file, dopo le proprietà se ci sono
      let riga = 0;
      if (editor.getLine(0) === '---') {
        for (let l = 1; l < editor.lineCount(); l++) {
          if (editor.getLine(l) === '---') { riga = l + 1; break; }
        }
      }
      const segno = '%%NOTA ' + Date.now() + ' G | ' + testo + '%%\n\n';
      const dove = { line: riga, ch: 0 };
      editor.replaceRange(segno, dove, dove);
      self.dopoNuovaNota();
    }).open();
  }

  // Dal pulsante del pannello: serve il testo aperto in una scheda.
  notaGeneraleSu(file) {
    const leaf = this.schedaDi(file);
    if (!leaf) { new Notice(t('apriPrima')); return; }
    this.notaGenerale(leaf.view.editor);
  }

  dopoNuovaNota() {
    this.aggiornaPannelli();
    if (!this.app.workspace.getLeavesOfType(VISTA).length) this.apriPannello();
  }

  async vaiA(file, id) {
    let leaf = this.schedaDi(file);
    if (!leaf) {
      leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file);
    }
    const editor = leaf.view.editor;
    const nota = elencoNote(editor.getValue()).find(function (n) { return n.id === id; });
    if (!nota) { new Notice(t('nonTrovo')); return; }
    const pos = editor.offsetToPos(nota.posizione);
    this.app.workspace.setActiveLeaf(leaf, { focus: true });
    editor.setCursor(pos);
    editor.scrollIntoView({ from: pos, to: pos }, true);
  }

  // Cambia il testo di una nota già scritta. Il passo, il posto e il numero restano.
  async modifica(file, id) {
    const self = this;
    const testo = await this.testoDi(file);
    const nota = elencoNote(testo).find(function (n) { return n.id === id; });
    if (!nota) { new Notice(t('nonTrovo')); return; }
    let citazione = '';
    if (nota.tipo === 'passo') citazione = nota.passi.join(' […] ');
    else if (nota.tipo === 'punto') citazione = (nota.prima ? '…' + nota.prima + ' ' : '') + '▮' + (nota.dopo ? ' ' + nota.dopo + '…' : '');
    const titolo = nota.tipo === 'generale' ? t('modificaGenerale') : t('modificaNota');
    new FinestraNota(this.app, titolo, citazione, function (nuovo) {
      self.salvaModifica(file, id, nuovo);
    }, nota.nota).open();
  }

  async salvaModifica(file, id, nuovo) {
    const leaf = this.schedaDi(file);
    let fatto = false;
    if (leaf) {
      const editor = leaf.view.editor;
      const c = modificaTestoNota(editor.getValue(), id, nuovo);
      if (c) {
        editor.transaction({ changes: [{ from: editor.offsetToPos(c.da), to: editor.offsetToPos(c.a), text: c.testo }] });
        fatto = true;
      }
    } else {
      await this.app.vault.process(file, function (testo) {
        const c = modificaTestoNota(testo, id, nuovo);
        if (!c) return testo;
        fatto = true;
        return applica(testo, [c]);
      });
    }
    if (!fatto) new Notice(t('nonModificata'), 8000);
    this.aggiornaPannelli();
  }

  // Dal pallino numerato nel testo: modifica la nota del file aperto.
  modificaNelTestoAttivo(id) {
    const v = this.app.workspace.getActiveViewOfType(MarkdownView);
    const file = (v && v.file) || this.ultimoFile;
    if (file) this.modifica(file, id);
  }

  async elimina(file, id) {
    const leaf = this.schedaDi(file);
    if (leaf) {
      const editor = leaf.view.editor;
      const modifiche = modificheElimina(editor.getValue(), id).map(function (c) {
        return { from: editor.offsetToPos(c.da), to: editor.offsetToPos(c.a), text: c.testo };
      });
      if (modifiche.length) editor.transaction({ changes: modifiche });
    } else {
      await this.app.vault.process(file, function (testo) {
        return applica(testo, modificheElimina(testo, id));
      });
    }
    this.aggiornaPannelli();
  }
}

// Solo per i controlli automatici: le funzioni sul testo.
RevisioneTesti._prova = {
  pulisci: pulisci,
  trovaMarcatori: trovaMarcatori,
  elencoNote: elencoNote,
  modificheElimina: modificheElimina,
  applica: applica,
  ripulisciNota: ripulisciNota,
  fuoriDaiBlocchi: fuoriDaiBlocchi,
  inizioParola: inizioParola,
  pezziDelPasso: pezziDelPasso,
  modificaTestoNota: modificaTestoNota,
  fuoriDalleEvidenziazioni: fuoriDalleEvidenziazioni
};

module.exports = RevisioneTesti;
