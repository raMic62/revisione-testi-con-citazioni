# La cartella dei libri / The books folder

**Italiano.** Qui vanno i libri che citi, in PDF. Ci sono due modi.

1. **Copiare i PDF qui dentro.** È il modo più semplice.
2. **Collegare i PDF che hai già altrove**, senza copiarli, con un collegamento simbolico. Su macOS e Linux, dal Terminale:
   `ln -s "/percorso/della/tua/cartella/Libro.pdf" "/percorso/del/vault/libri/Libro.pdf"`
   Su Windows si usa `mklink` da un prompt dei comandi aperto come amministratore.

In tutti e due i casi i PDF non vengono mai modificati: il vault li apre e li legge soltanto. Il nome del file non deve contenere `# | [ ] ^`, perché romperebbe i collegamenti di Obsidian (il comando `nome` lo controlla).

Un libro che hai solo in EPUB va prima convertito in PDF, per esempio con Calibre o con pandoc. Le pagine della copia non sono quelle di un'edizione: nella citazione si indica il capitolo.

Il PDF `Inventato-2020-I-fari-di-Vallemare.pdf` è un libro fittizio scritto per gli esempi: puoi cancellarlo.

**English.** Put the books you cite here, as PDFs. Either copy the PDFs into this folder, or link the PDFs you already keep elsewhere with a symbolic link (`ln -s` on macOS and Linux, `mklink` on Windows). The PDFs are only opened and read, never changed. File names must not contain `# | [ ] ^`. Convert EPUB books to PDF first and cite them by chapter. `Inventato-2020-I-fari-di-Vallemare.pdf` is a fictitious book written for the examples: you can delete it.
