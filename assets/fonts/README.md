# Noto Sans SC

Source: Google Fonts `google/fonts`, `ofl/notosanssc/NotoSansSC[wght].ttf`.
License: SIL Open Font License 1.1, included in `OFL.txt`.

The four static faces are generated from that variable font using fontTools 4.60.2
`instantiateVariableFont(font, {"wght": weight}, inplace=True)` for 400, 500, 600 and 700.
AppText selects the named face and disables synthetic bold. This preserves the Figma
Regular/Medium/SemiBold/Bold weights on web and Android. The full glyph sets are retained.

2026-10-10: static faces have distinct Regular/Medium/SemiBold/Bold PostScript
names and matching legacy/typographic family and style records. Instantiation
alone had left every face named NotoSansSC-Thin. Weight outlines and glyph coverage
are unchanged; fsSelection/macStyle now describe the actual face. This prevents
font registration/cache collisions when all four files are loaded together.
