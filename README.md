# Revisione testi con citazioni

A method and a small set of tools for revising long texts in Obsidian with an AI assistant, keeping every citation checkable against the PDF of the book it comes from.

[Italiano più sotto](#italiano)

## What it does

- **Citations you can check with one click.** A citation is an Obsidian link such as `[[libri/Book.pdf#page=14&search=exact words|(Author, 2020, p. 12)]]`. With the PDF++ plugin, clicking it opens the book at the right page with the cited passage highlighted.
- **Automatic citation check.** `node strumenti/revisione.js collegamenti text.md` checks every link: the book exists, the page exists, and the searched words really are on that page (it also says on which nearby page they are, if the page number is wrong).
- **Revision rounds.** You comment the text with the Revisione testi plugin; the AI rewrites it and produces a file with the changes in red and green, word by word, plus its answers to your notes. Each round is kept in a history folder.
- **Your books stay untouched.** Every command only reads the PDFs; `impronta` lets you check before and after each round that they are unchanged.
- **Any AI.** The instructions in `AI-INSTRUCTIONS.md` (English) and `ISTRUZIONI-PER-L-IA.md` (Italian) work with Claude, ChatGPT or any other assistant. If the assistant can run commands on your computer it uses the script itself; otherwise you run the commands and paste the output.

The tools check that a citation matches the book. They do not check the citation style (APA or other): the visible text of the citation is written by you.

## What is in the repository

```
plugin/              the Revisione testi plugin for Obsidian (review notes)
strumenti/           revisione.js, the command-line tool
vault-esempio/       an example vault with a fictitious book and text
  libri/             your PDFs, or links to them
  testi/fari/        an example text after one revision round
  testi/prova-errori.md   citations wrong on purpose, to see the check at work
AI-INSTRUCTIONS.md   instructions to give to the AI (English)
ISTRUZIONI-PER-L-IA.md   the same instructions in Italian
```

## What you need

- [Obsidian](https://obsidian.md), with two plugins: **Revisione testi** (in `plugin/`) and **PDF++** (from the community plugin list).
- [Node.js](https://nodejs.org) for `strumenti/revisione.js`.
- For some commands: poppler (`pdftotext`, `pdfinfo`, `pdftoppm`) to read PDF pages and check citations, tesseract to read scanned pages, pandoc for the Word copy.

## Try the example

1. Download the repository (*Code → Download ZIP*) and unzip it.
2. In Obsidian choose *Open folder as vault* and pick `vault-esempio`.
3. Install **PDF++** from *Settings → Community plugins*. Copy `main.js`, `manifest.json` and `styles.css` from `plugin/` into `vault-esempio/.obsidian/plugins/revisione-testi/`, restart Obsidian and enable both plugins.
4. Open `testi/fari/fari testo pulito.md` and click a citation: the fictitious book opens with the passage highlighted. Open `fari modifiche.md` to see a round of changes.
5. From a terminal in the repository folder, run:
   `node strumenti/revisione.js collegamenti "vault-esempio/testi/prova-errori.md"`
   It reports the four citations that are wrong on purpose.

## Use it with your own texts

Put your books in `libri/` (copies or symbolic links, see `vault-esempio/libri/LEGGIMI.md`), make a folder for your text in `testi/`, and start a chat with your AI assistant by giving it `AI-INSTRUCTIONS.md`. The example book and text can be deleted.

Messages of the script and of the plugin are in Italian when the system (or Obsidian) is in Italian, in English otherwise. For the script you can force the language with `REVISIONE_LINGUA=it` or `REVISIONE_LINGUA=en`.

## Status

Young project, used so far by its author. The text functions have automatic tests (`cd plugin && node --test`); the rest has been tried on the example vault. Bug reports and suggestions are welcome in the Issues.

The code was written with the help of Claude (Anthropic) and is maintained by the repository owner. License: MIT.

---

## Italiano

Un metodo e alcuni strumenti per rivedere testi lunghi in Obsidian con un assistente IA, tenendo ogni citazione controllabile sul PDF del libro da cui viene.

### Che cosa fa

- **Citazioni che si controllano con un clic.** Una citazione è un collegamento di Obsidian come `[[libri/Libro.pdf#page=14&search=parole esatte|(Autore, 2020, p. 12)]]`. Con il plugin PDF++ il clic apre il libro alla pagina giusta con il passo citato evidenziato.
- **Controllo automatico delle citazioni.** `node strumenti/revisione.js collegamenti testo.md` controlla ogni collegamento: il libro c'è, la pagina esiste e le parole cercate si trovano davvero su quella pagina. Se il numero di pagina è sbagliato, dice su quale pagina vicina sono.
- **Giri di revisione.** Si commenta il testo con il plugin Revisione testi; l'IA lo riscrive e prepara un file con le modifiche in rosso e verde, parola per parola, e le risposte alle note. Ogni giro resta in una cartella di storico.
- **I libri restano intatti.** Tutti i comandi leggono soltanto i PDF; `impronta` permette di controllare prima e dopo ogni giro che siano rimasti identici.
- **Qualunque IA.** Le istruzioni in `ISTRUZIONI-PER-L-IA.md` (italiano) e `AI-INSTRUCTIONS.md` (inglese) funzionano con Claude, ChatGPT o altri assistenti. Se l'assistente può eseguire comandi sul computer usa lo script da solo; altrimenti i comandi li lancia l'utente e ne incolla il risultato.

Gli strumenti controllano che la citazione corrisponda al libro; lo stile della citazione (APA o altro) resta affidato a chi scrive il testo visibile.

### Che cosa serve

Obsidian con i plugin Revisione testi (in `plugin/`) e PDF++; Node.js per lo script; per alcuni comandi poppler (lettura delle pagine e controllo delle citazioni), tesseract (pagine scansionate) e pandoc (copia Word).

### Provare l'esempio

Si scarica il repository, si apre `vault-esempio` in Obsidian con *Apri cartella come vault*, si installa PDF++ dai plugin della comunità e si copiano `main.js`, `manifest.json` e `styles.css` di `plugin/` in `vault-esempio/.obsidian/plugins/revisione-testi/`, poi si riavvia Obsidian e si attivano i due plugin. In `testi/fari/fari testo pulito.md` un clic su una citazione apre il libro fittizio con il passo evidenziato; `fari modifiche.md` mostra un giro di modifiche. Dal terminale, nella cartella del repository, `node strumenti/revisione.js collegamenti "vault-esempio/testi/prova-errori.md"` segnala le quattro citazioni sbagliate apposta.

### Usarlo con i propri testi

I libri vanno in `libri/` (copie o collegamenti simbolici, vedi `vault-esempio/libri/LEGGIMI.md`), il testo in una cartella dentro `testi/`, e la chat con l'assistente comincia dandogli `ISTRUZIONI-PER-L-IA.md`. Il libro e il testo di esempio si possono cancellare.

Il codice è stato scritto con l'aiuto di Claude (Anthropic) ed è mantenuto dal proprietario del repository. Licenza MIT.
