# Revisione testi

An Obsidian plugin for reviewing long texts: you attach notes to a passage, to a point in the text or to the whole text, and the notes are saved inside the Markdown file itself.

[Italiano più sotto](#italiano)

## What it does

- **Comment on a passage.** Select a passage, right-click, choose *Comment*. The passage is highlighted and the note is saved right after it. A passage can span several paragraphs.
- **Note at a point.** Right-click without selecting anything and choose *Note at this point*.
- **Note on the whole text.** Saved at the top of the file, after the properties.
- **Side panel.** Lists the notes of the open file in order, with the passage they refer to. From the panel you can go to a note, edit it or delete it. Deleting a note keeps the passage and removes only the highlight and the note.
- **Numbered markers.** In Live Preview each note is shown as a small number; click it to edit the note. The file does not change, only the way it is displayed.

The interface follows Obsidian's language: Italian when Obsidian is set to Italian, English otherwise.

## How notes are stored

Notes are Obsidian comments (`%%…%%`), so they stay invisible in Reading view and travel with the file:

```
==the passage==%%NOTA 1731543212345 | the note%%
%%NOTA 1731543212345 | a note at a point%%
%%NOTA 1731543212345 G | a note on the whole text%%
```

The number is the time the note was created and works as its identifier. A passage over several paragraphs is split into pieces: all but the last end with `%%NOTA id +%%`. The keyword `NOTA` is the same in both languages, so files stay compatible.

The plugin reads and writes only the file you are working on, never other files, and makes no network connections.

## Installation

The plugin is not yet in the community plugin list. To install it by hand:

1. Create the folder `.obsidian/plugins/revisione-testi` inside your vault.
2. Copy `main.js`, `manifest.json` and `styles.css` into it.
3. Restart Obsidian and enable *Revisione testi* in *Settings → Community plugins*.

## Tests

The text functions can be tested without Obsidian:

```
node --test
```

## About

The code was written with the help of Claude (Anthropic) and is maintained by the repository owner. Bug reports and suggestions are welcome in the Issues.

License: MIT.

---

## Italiano

Plugin per Obsidian pensato per rivedere testi lunghi: le note si attaccano a un passo, a un punto del testo o al testo intero e vengono salvate dentro il file Markdown.

### Che cosa fa

- **Commento su un passo.** Si seleziona un passo, clic destro, *Commenta*. Il passo viene evidenziato e la nota si salva subito dopo. Il passo può attraversare più capoversi.
- **Nota in un punto.** Clic destro senza selezione, *Nota in questo punto*.
- **Nota sul testo intero.** Si salva in cima al file, dopo le proprietà.
- **Pannello laterale.** Elenca le note del file aperto nell'ordine in cui compaiono, con il passo a cui si riferiscono. Dal pannello si va alla nota, la si modifica o la si elimina. Eliminando una nota il passo resta e spariscono soltanto l'evidenziazione e la nota.
- **Segni numerati.** Nella vista di modifica ogni nota compare come un piccolo numero; con un clic si modifica. Il file resta com'è: cambia solo il modo in cui lo si vede.

L'interfaccia segue la lingua di Obsidian: italiano se Obsidian è in italiano, inglese negli altri casi.

### Dove finiscono le note

Le note sono commenti di Obsidian (`%%…%%`): nella vista di lettura restano nascoste e viaggiano insieme al file, nella forma descritta sopra. Il plugin legge e scrive soltanto il file su cui si lavora e non si collega a internet.

### Installazione

Si crea la cartella `.obsidian/plugins/revisione-testi` nel proprio vault, vi si copiano `main.js`, `manifest.json` e `styles.css`, poi si riavvia Obsidian e si attiva *Revisione testi* fra i plugin della comunità.

### Chi l'ha scritto

Il codice è stato scritto con l'aiuto di Claude (Anthropic) ed è mantenuto dal proprietario del repository. Segnalazioni e proposte sono benvenute nelle Issues.
