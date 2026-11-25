# Instructions for the AI: revision rounds and verifiable citations

Give these instructions to an AI assistant (Claude, ChatGPT or any other) at the start of a chat about revising a text in the Obsidian vault. Add your own writing rules if you have any.

If the assistant can run commands on the user's computer, it runs `strumenti/revisione.js` itself. If it cannot, it asks the user to run the commands and paste the output.

## Folders

- `libri/`: the cited PDFs, or symbolic links to them (see `libri/LEGGIMI.md`).
- `testi/NAME/`: one folder per text under revision, always a copy. The user works on two files:
  - `NAME testo pulito.md`: the text of the latest round, without colours;
  - `NAME modifiche.md`: the changes of the latest round in red and green, with the answers to the notes; the round number is in the title.
- `testi/NAME/storico/`: both files as they were at the end of each round (`giro-NN-testo-pulito.md`, `giro-NN-modifiche.md`) and the starting text (`giro-00-testo-di-partenza.md`), listed in `storico/elenco.md`.

## Fixed rules

- Books are read only: never rename, move, change or delete a PDF.
- Run `impronta` on the PDFs used before and after every round and tell the user whether they are unchanged.
- Never delete a text file: tell the user if one is no longer needed.
- Sentences the user writes directly in the text win: leave them as they are and flag apparent mistakes under open points.
- When two notes contradict each other, list them under open points and let the user choose.
- Before any action other than reading, say what will be written and where.

## Preparing a text

1. Create `testi/NAME/storico/`, copy the text to `testi/NAME/NAME testo pulito.md` and, unchanged, to `storico/giro-00-testo-di-partenza.md`.
2. For each cited book, check the file name with `nome BOOK.pdf BOOKS-FOLDER` and take its `impronta`.
3. Put the book in `libri/`, as a copy or a symbolic link.

## Citation format

```
[[libri/BOOK.pdf#page=14&search=exact words of the passage|(Author, year, p. 12)]]
```

With the PDF++ plugin, a click opens the PDF at the right page with the passage highlighted.

- `page` is the page of the PDF file; the printed page goes in the visible text.
- Before writing a citation, read the page with `pdf` and copy the words from there. Words split at the end of a line are written whole.
- The `search` words are those of the sentence that supports the claim, so the reader sees exactly the passage to check. A sentence with claims from different passages gets one link per claim.
- Paraphrases and summaries also use the book's original words in `search`.
- Searched words must not contain `& # | [ ] ^`: the `passo` command checks this.
- A passage across two pages gets two links; a citation spanning pages (e.g. "pp. 193-194") gets one link per page.
- If a citation is followed by "[to be checked]", only the part before the square brackets is a link.
- Every attribution is checked against the book. Whatever cannot be read stays "[to be checked]" and is reported to the user.

### Scanned PDFs

- In the text the citation opens the page only: `[[libri/BOOK.pdf#page=20|(Author, year, p. 28)]]`.
- The box around the passage goes in a service note `testi/NAME/NAME riquadri.md`, one link per passage: `[[libri/BOOK.pdf#page=20&rect=left,bottom,right,top&color=red|Author, p. 28: first words]]`. The measurements come from the `riquadri` command.
- OCR can get words wrong: a direct quotation from a scan must be flagged for the user to check against the original.

### EPUB books

Cite a PDF copy of the EPUB. `page` is the page of the copy, while the visible text gives the chapter, e.g. `(Author, year, ch. 6)`: the pages of the copy match no edition.

## The user's notes

The user writes them with the Revisione testi plugin (right-click, "Comment"), in both files. They stay inside the text:

- note on a passage: `==the passage==%%NOTA 1700000000000 | the note%%`
- note at a point: `%%NOTA 1700000000000 | the note%%`
- note on the whole text, at the top: `%%NOTA 1700000000000 G | the note%%`

## Each round, when the user says the round is finished

1. `impronta` on the PDFs used.
2. Copy `NAME testo pulito.md` to `storico/giro-NN-testo-pulito.md` and `NAME modifiche.md` to `storico/giro-NN-modifiche.md` unchanged (NN is the round just finished), check the copies are identical and add two lines to `storico/elenco.md`.
3. Read the notes in both files with `note`. Clarify ambiguous notes with the user, one question at a time, before rewriting; if the user is away, leave the passage as it is and put the question under open points. Also compare the text with the previous round to see what the user wrote directly.
4. Write the new text in `NAME testo pulito.md`, without notes, after checking that the file still matches the copy made in step 2.
5. Optional: look for sequences of six or more identical words between the text and the pages of the cited books (with `pdf`), quotations excluded, and rewrite or quote the passages that match. This covers only the books examined and does not replace plagiarism software.
6. Rewrite `NAME modifiche.md` with the new round number in the title, in this order: the text with the changes (output of `confronta "storico/giro-NN-testo-pulito.md" "NAME testo pulito.md"`), the notes of the previous round with what was done about each, other changes, open points. Before comparing, turn single line breaks into paragraphs in both files, otherwise `confronta` mixes up paragraphs. The comparison is always word by word.
7. `impronta` again and `collegamenti` on both files. Fix every problem reported before telling the user the round is ready.

## The Word copy

When the user approves the text: check with `word-anteprima`, then `word "testi/NAME/NAME testo pulito.md" "OUTPUT.docx"`. "[possible note: …]" (or "[possibile nota: …]") becomes a footnote; remaining "[to be checked]" are reported to the user. A .docx template can be given as a third argument.
