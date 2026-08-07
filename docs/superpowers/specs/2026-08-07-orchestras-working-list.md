# Orchestras — working list

2026-08-07

## Moduł — decyzje zatwierdzone

- Nazwa: Orchestras
- Pozycja w nawigacji: między Map a Learn
- Widok domyślny: jedna ścieżka na orkiestrę na wspólnej osi czasu
- Pasma epok jako tło za ścieżkami
- Soczewka przestawia kolejność ścieżek (sortowanie: data / podobieństwo / rodzina)
- Oś czasu nieruchoma we wszystkich trybach sortowania
- Przestawianie animowane, z poszanowaniem `prefers-reduced-motion`
- Krawędzie relacji tylko po zaznaczeniu, nigdy domyślnie
- Kodowanie aktywności: zagnieżdżone rozpiętości
- Tożsamość encji: autorskie opaque id (reguła lider+nazwa odrzucona po review)
- Atrybuty stylistyczne na fazie, nie na orkiestrze
- Pochodzenie autorskie, podobieństwo liczone
- `similarityOverrides` wypuszczone puste
- Fasety punktowane 0–3, nie wzajemnie wykluczające się
- Daty w EDTF (ISO 8601-2)
- Kręgosłup w formacie kolumnowym (tablice typowane)
- Wirtualizacja ścieżek wymagana
- Przykład sztandarowy: Pugliese; D'Arienzo drugi

## Model danych — encje

- `Orchestra`
- `NameSpan`
- `LeaderSpan`
- `Ending`
- `Person`
- `Stint`
- `Phase`
- `ActivityInterval`
- `LineageEdge`
- `Era`
- `StyleFacets`
- `SimilarityOverride`
- `Source`

## Epoki — ustalenia

- Guardia Vieja
- Guardia Nueva (zamiast „Época Decarana")
- Golden Age jako jedno pasmo ~1935–1955
- Koniec Golden Age oznaczony jako sporny
- Vanguardia (zamiast „Revolutionary/Evolutionary")
- Tango Nuevo rozbite na trzy znaczenia
- Renacimiento / orquestas jóvenes
- Ballroom jako gałąź równoległa
- Pasma etykietowane wyłącznie okresem, nigdy stylem
- `eraId` usunięte z faset
- Lyrical/Rhythmic jako faseta, nie pasmo czasowe

## Wydajność — zmierzone

- `computeLayout`, 250 ścieżek: 1,04 ms
- `sortBySimilarity`, 1000 faz: 0,41 ms
- Wyszukiwanie po nazwie: 0,16 ms
- Przesortowanie + układ: 1,45 ms
- Parse pełnego rekordu (471 KB): 5,09 ms
- Parse kręgosłupa (95 KB): 1,66 ms
- Parse kolumnowy (62 KB): 0,28 ms
- Układ z tablic typowanych: 0,24 ms
- Pierwszy paint kolumnowo: 0,52 ms
- Zapytanie Postgres: ~20 ms
- Narzut funkcji ponad stronę statyczną: ~0 ms
- Ciepłe żądanie z Polski: 107 ms
- RTT do edge: ~35 ms
- Handshake TLS: 140–230 ms, raz na połączenie

## Źródła danych — pokrycie i licencje

- MusicBrainz core (Artist, relacje): CC0, komercyjnie, bez atrybucji
- MusicBrainz tagi/gatunki/oceny: CC BY-NC-SA, poza core
- MusicBrainz struktura: Person / Orchestra / Group rozdzielone
- MusicBrainz relacje dla tanga: puste (Di Sarli — 1 relacja, bez dat)
- Wikidata: CC0
- tango.info: 100 039 utworów, 40 697 wykonań, 24 488 dzieł, 9 996 osób
- tango.info: brak deklarowanej licencji, blokuje boty (403)
- todotango: niezweryfikowane (404 na stronie warunków)
- EDTF (ISO 8601-2) — standard dat
- schema.org MusicGroup / Person / member — publikowalność
- WCAG 2.2 / 1.4.11 — próg kontrastu 3:1

## Review — sceptyk modelu danych

- Reguła lider+nazwa sprzeczna z fasetą `ensemble`
- Orquesta Típica Víctor rozpada się na 4+ ścieżki
- Sexteto Mayor rozpada się po śmierci Ferrera
- Współprowadzenie niereprezentowalne w `leaderName: string`
- `YearSpec` gubi datowanie sesyjne co do dnia
- Fazy nie mogą być rozłączne ani total ordered
- Inkluzywność granic faz niezdefiniowana
- Hiatus wyrażalny na dwa sposoby
- `ended?` konflatuje trwa / lider zmarł / nieznane
- `genres` i `ensemble` niemal stałe → podobieństwo bez sygnału
- Jednowartościowy `character` niszczy sens
- Brak reguły agregacji faz do poziomu orkiestry
- Epoka zamodelowana trzy razy
- Brak `sources[]`
- Brak encji Person
- Krawędzie jednostronne
- Brak `renamed-to` / `merged-with`
- Brak wersji schematu

## Review — ekspert dziedzinowy

- Lyrical/Rhythmic to szkoły równoległe, nie okresy
- Brak śpiewaków — największa dziura
- Estribillista vs cantor de la orquesta
- Powroty śpiewaków niewyrażalne
- Siedmiookresowy pasek nieprawdziwy dla większości orkiestr
- „Época Decarana" → Guardia Nueva
- „Revolutionary/Evolutionary" nie jest słownictwem tanga
- „Tango Nuevo" oznacza trzy różne rzeczy
- `character` zbyt cienki, 'smooth' i 'lyrical' się zlewają
- Brak tempa, `danceability`, aranżera, wytwórni
- Zespoły firmowe bez ciągłego lidera
- Kooperatywy bezliderowe
- Kontynuacje pośmiertne wymagają osobnego typu krawędzi
- Jeden lider, dwa równoległe billingi
- D'Arienzo to nie najostrzejszy przykład
- Brak cuarteto i conjunto w `ensemble`
- Brak candombe i tango canción
- `danceStyles` miesza poziomy
- Tanda-compatibility jako brakujący wymiar

## Review — inżynier frontendu / a11y

- Kodowanie jednokanałowe (opacity) niebezpieczne przy motywach użytkownika
- Przerwa uśpienia nieodróżnialna od dziury renderowania
- Brak reprezentacji dostępnościowej
- 900–2000 prostokątów, sekwencja tabulacji nie do użycia
- Wymagany roving tabIndex + live region
- Wymagany równorzędny widok tabelaryczny
- FLIP tylko na poziomie ścieżki
- Kolejność DOM rozjeżdża się z wizualną
- Utrata fokusu przy rekoncyliacji
- Skok scrolla przy przesortowaniu
- Krawędzie nieaktualne w trakcie animacji
- Przerwanie animacji w locie
- `prefers-reduced-motion` z czasem 0 gorsze niż brak soczewki
- 3,4 px na rok przy 375 px
- Cel 44 px = 13 lat szerokości
- Ścieżka jedynym celem dotykowym na coarse
- Etykiety pasm w osobnym pasku
- Klastrowanie znaczników poniżej 4 px w silniku
- `measureText` prawie nieistotny
- Silnik ma zwracać punkty końcowe, nie stringi `d`
- `orderIndex` per tryb sortowania
- `computeEdgePaths` osobno od układu
- `circa`/`decade` przez `linearGradient` na `currentColor`
- Memoizacja na `(data, width, sortMode)`
- Test integralności wzorowany na `mapNodes.ts`
- Sortowanie i zaznaczenie w `searchParams`

## Odłożone

- Aranżer jako pole
- Wytwórnia
- Rozróżnienie acoustic/electric
- Słownictwo marcato / síncopa / fraseo / yumba
- Siedmiookresowy pasek w wersji globalnej
- Poziom utworów
- Wkład społeczności / korekty użytkowników

## Otwarte

- Zakres faset: minimum dla DJ-a vs koszt autorski razy 60
- Pasek okresowy: per orkiestra czy wcale
- Próg wejścia na poziom utworów
- Weryfikacja licencji todotango
- Głębokość pokrycia tanga w Wikidanych
- Koszt renderowania 3000 prostokątów w DOM
- Sekcja 2: kontrakt silnika układu
- Sekcja 3: ekran i interakcje
- Sekcja 4: testy i zakres v1

## Wdrożone w tej sesji

- #54 — `.gitignore` dla `.gstack/`
- #55 — overrides postcss + sharp, 7→4 advisory
- #56 — drizzle-orm 0.45.2, 4→3
- #57 — stos auth beta.32, 3→0, bramka audytu w CI
- #58 — domknięcie planu remediacji
- #59 — polityka weryfikacji auth na produkcji
- #60 — przypięcie funkcji do cdg1
- PR #1 zamknięty jako nieaktualny
- 39 gałęzi usuniętych

## Chronologia sesji

- Rekolorowanie BloodRose na produkcji
- Stan repozytorium i projektu
- Plan remediacji bezpieczeństwa
- Zadania 1–3 remediacji
- Zadanie 4 — stos auth
- Decyzja: weryfikacja auth na produkcji
- Start brainstormingu modułu Orchestras
- Wybór widoku domyślnego
- Wybór reguły encji
- Wybór modelu soczewki
- Wybór kodowania aktywności
- Sekcja 1 — pierwsza wersja
- Korekta: utarte schematy zamiast wymyślonych skal
- Review trzema personami
- Synteza review
- Pytania o wolumen, standardy i kompletność wiedzy
- Weryfikacja pokrycia i licencji źródeł
- Naprawa regionu funkcji
- Dwie korekty błędnej metodologii pomiaru
- Benchmark do 6 ms
