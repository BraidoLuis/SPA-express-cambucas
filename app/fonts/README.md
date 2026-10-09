# Fontes locais do SPA Express Cambucás

Os binários oficiais foram obtidos do repositório [Google Fonts](https://github.com/google/fonts/tree/51303ca9e8ac9dcea7b12d307ba568fd0e6fcfca), na revisão 51303ca9e8ac9dcea7b12d307ba568fd0e6fcfca. Os binários permanecem inalterados. Os nomes locais usam o sufixo -Variable, evitando URLs diferentes para colchetes no preload e no CSS.

- Playfair Display: arquivo variável oficial, eixo wght 400–900; o layout mantém os pesos 500, 600 e 700 na faixa CSS 500–700.
- Montserrat: arquivo variável oficial, eixo wght 100–900; o layout mantém os pesos 400, 500, 600 e 700 na faixa CSS 400–700.
- Estilo normal, com os itálicos sintetizados pelo navegador como no carregamento anterior.
- next/font/local mantém --font-display, --font-sans e display: swap. Os arquivos são servidos pelo próprio Next.js; build e runtime não consultam Google Fonts.
- Arquivos completos, sem subsetting: verificados os glifos ÁÀÂÃÉÊÍÓÔÕÚÜÇ e áàâãéêíóôõúüç.
- Fallbacks de métricas: Times New Roman para Playfair Display e Arial para Montserrat.

## Origem, integridade e licenças

As duas famílias usam SIL Open Font License 1.1. Os respectivos OFL.txt completos, incluindo copyright e nomes reservados quando aplicáveis, acompanham os binários. Foi removido apenas o espaço no fim de uma linha de cada licença para passar git diff --check; o texto foi preservado.

| Arquivo | SHA-256 do arquivo (texto em LF) | Origem |
| --- | --- | --- |
| PlayfairDisplay-Variable.ttf (playfair-display) | c40f2293766a503bc70cce9e512ef844a4ccb7cbcde792fe2ea31d191917d8d6 | [Google Fonts](https://raw.githubusercontent.com/google/fonts/51303ca9e8ac9dcea7b12d307ba568fd0e6fcfca/ofl/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf) |
| OFL.txt (playfair-display) | 0bb2b43ffd21233963b5d0c0eb6f1abffa776ec53c56131b5818708f2730ffd6 | [Google Fonts](https://raw.githubusercontent.com/google/fonts/51303ca9e8ac9dcea7b12d307ba568fd0e6fcfca/ofl/playfairdisplay/OFL.txt) |
| Montserrat-Variable.ttf (montserrat) | 0f7b311b2f3279e4eef9b2f968bcdbab6e28f4daeb1f049f4f278a902bcd82f7 | [Google Fonts](https://raw.githubusercontent.com/google/fonts/51303ca9e8ac9dcea7b12d307ba568fd0e6fcfca/ofl/montserrat/Montserrat%5Bwght%5D.ttf) |
| OFL.txt (montserrat) | fa036c290600f85c9c7747dbd2bd3ac26d28de0ac0582ff9320c53161765e19b | [Google Fonts](https://raw.githubusercontent.com/google/fonts/51303ca9e8ac9dcea7b12d307ba568fd0e6fcfca/ofl/montserrat/OFL.txt) |
