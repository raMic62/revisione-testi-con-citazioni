# Istruzioni per l'IA: giri di revisione e citazioni verificabili

Queste istruzioni si danno all'inizio della chat a un assistente IA (Claude, ChatGPT o altri) che aiuta a rivedere un testo nel vault di Obsidian. Valgono così come sono; chi le usa può aggiungere le proprie regole di scrittura.

Se l'assistente può eseguire comandi sul computer dell'utente, lancia da solo lo script `strumenti/revisione.js`. Se non può, chiede all'utente di lanciare i comandi e di incollare il risultato.

## Le cartelle

- `libri/`: i PDF citati, oppure collegamenti simbolici ai PDF (vedi `libri/LEGGIMI.md`).
- `testi/NOME/`: una cartella per ogni testo da rivedere, sempre in copia. L'utente lavora su due file:
  - `NOME testo pulito.md`: il testo dell'ultimo giro, senza colori;
  - `NOME modifiche.md`: le modifiche dell'ultimo giro in rosso e verde, con le risposte alle note; il numero del giro sta nel titolo.
- `testi/NOME/storico/`: lo stato dei due file alla fine di ogni giro (`giro-NN-testo-pulito.md`, `giro-NN-modifiche.md`) e il testo di partenza (`giro-00-testo-di-partenza.md`). L'elenco dei file sta in `storico/elenco.md`.

## Regole fisse

- I libri si leggono soltanto: nessun PDF va rinominato, spostato, modificato o cancellato.
- Prima e dopo ogni giro si lancia `impronta` sui PDF usati e si dice all'utente se sono rimasti identici.
- Nessun file di testo si cancella: se uno non serve più, lo si dice all'utente.
- Le frasi che l'utente scrive direttamente nel testo prevalgono: restano come sono e, se sembrano errori, si segnalano nei punti aperti.
- Quando due note si contraddicono, l'IA lo segnala nei punti aperti e lascia la scelta all'utente.
- Prima di ogni azione che non sia leggere, l'IA dice che cosa sta per scrivere e dove.

## Preparare un testo

1. Creare `testi/NOME/storico/`, copiare il testo in `testi/NOME/NOME testo pulito.md` e, così com'è, in `storico/giro-00-testo-di-partenza.md`.
2. Per ogni libro citato controllare il nome del file con `nome LIBRO.pdf CARTELLA-DEI-LIBRI` e prendere l'`impronta`.
3. Mettere il libro in `libri/`, come copia o come collegamento simbolico.

## La forma delle citazioni

```
[[libri/LIBRO.pdf#page=14&search=parole esatte del passo|(Autore, anno, p. 12)]]
```

Con il plugin PDF++ il clic apre il PDF alla pagina giusta e evidenzia il passo.

- `page` è la pagina del file PDF; la pagina stampata va nel testo visibile, fra parentesi.
- Prima di scrivere una citazione l'IA legge la pagina con `pdf` e copia le parole da lì. Le parole spezzate a fine riga si scrivono intere.
- Le parole di `search` sono quelle della frase che sostiene l'affermazione, così chi clicca vede evidenziato proprio il passo da controllare. Se una frase contiene affermazioni prese da passi diversi, ognuna ha il suo collegamento.
- Anche una parafrasi o un riassunto hanno in `search` le parole originali del libro.
- Le parole cercate non contengono `& # | [ ] ^`: il comando `passo` lo controlla.
- Un passo a cavallo di due pagine ha due collegamenti; una citazione su più pagine (per esempio «pp. 193-194») ha un collegamento per pagina.
- Se accanto a una citazione c'è «[da verificare]», è cliccabile solo la parte prima delle parentesi quadre.
- Ogni attribuzione si verifica sul testo del libro. Quello che non si riesce a leggere resta «[da verificare]» e va detto all'utente.

### PDF scansionati

- Nel testo la citazione apre solo la pagina: `[[libri/LIBRO.pdf#page=20|(Autore, anno, p. 28)]]`.
- Il riquadro del passo sta in una nota di servizio `testi/NOME/NOME riquadri.md`, un collegamento per passo: `[[libri/LIBRO.pdf#page=20&rect=sinistra,basso,destra,alto&color=red|Autore, p. 28: prime parole]]`. Le misure vengono dal comando `riquadri`.
- Il riconoscimento del testo può sbagliare qualche parola: una citazione diretta presa da una scansione va segnalata all'utente perché la ricontrolli sull'originale.

### Libri in EPUB

Si cita una copia PDF dell'EPUB. `page` è la pagina della copia, mentre nel testo visibile si indica il capitolo, per esempio `(Autore, anno, cap. 6)`: le pagine della copia non corrispondono a nessuna edizione.

## Le note dell'utente

L'utente le scrive con il plugin Revisione testi (clic destro, «Commenta»), in tutti e due i file. Restano dentro il testo:

- nota su un passo: `==il passo==%%NOTA 1700000000000 | la nota%%`
- nota in un punto: `%%NOTA 1700000000000 | la nota%%`
- nota sul testo intero, in cima al file: `%%NOTA 1700000000000 G | la nota%%`

## A ogni giro, quando l'utente dice «ho finito il giro»

1. `impronta` sui PDF usati.
2. Copiare così come sono `NOME testo pulito.md` in `storico/giro-NN-testo-pulito.md` e `NOME modifiche.md` in `storico/giro-NN-modifiche.md` (NN è il giro appena finito), controllare che le copie siano uguali e aggiungere due righe a `storico/elenco.md`.
3. Leggere le note di tutti e due i file con `note`. Le note che si possono leggere in più modi si chiariscono con l'utente, una domanda alla volta, prima di riscrivere; se l'utente non c'è, il passo resta com'è e la domanda va nei punti aperti. Confrontare anche il testo con quello del giro prima, per vedere che cosa l'utente ha scritto direttamente.
4. Scrivere il testo nuovo in `NOME testo pulito.md`, senza note, dopo aver ricontrollato che il file sia ancora uguale alla copia del punto 2.
5. Facoltativo: cercare sequenze di sei o più parole uguali fra il testo e le pagine dei libri citati (con `pdf`), citazioni escluse, e riscrivere o mettere fra virgolette i passi che coincidono. Il controllo copre solo i libri esaminati e non sostituisce i programmi antiplagio.
6. Riscrivere `NOME modifiche.md` con il numero del giro nuovo nel titolo, in quest'ordine: «Il testo con le modifiche» (il risultato di `confronta "storico/giro-NN-testo-pulito.md" "NOME testo pulito.md"`), «I commenti del giro precedente» (ogni nota con quello che se n'è fatto), «Altre modifiche», «Punti aperti». Prima del confronto gli a capo singoli diventano capoversi in tutti e due i file, altrimenti `confronta` mescola i capoversi. Il confronto resta sempre parola per parola.
7. `impronta` di nuovo e `collegamenti` su tutti e due i file. Ogni problema segnalato si corregge prima di dire all'utente che il giro è pronto.

## La copia Word

Quando l'utente approva il testo: prima `word-anteprima` per controllare il risultato, poi `word "testi/NOME/NOME testo pulito.md" "USCITA.docx"`. I «[possibile nota: …]» diventano note a piè di pagina; i «[da verificare]» rimasti si segnalano all'utente. Come terzo argomento si può dare un docx di modello per lo stile.
